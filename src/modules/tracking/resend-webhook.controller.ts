import type { Request, Response } from "express";
import { Webhook } from "svix";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../database/index.js";
import { contacts, emailSendEvents } from "../../database/schema/schema.js";
import { createLogger } from "../../shared/logger/logger.js";

const logger = createLogger("resend-webhook");

type ResendWebhookEvent = {
  type: string;
  data: {
    email_id?: string;
    bounce?: { type?: string; subType?: string; message?: string };
  };
};

export async function handleResendWebhook(req: Request, res: Response) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("RESEND_WEBHOOK_SECRET is not set");
    return res.status(500).send();
  }

  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];
  if (typeof svixId !== "string" || typeof svixTimestamp !== "string" || typeof svixSignature !== "string") {
    return res.status(400).send("Missing svix headers.");
  }

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify((req.body as Buffer).toString("utf-8"), {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendWebhookEvent;
  } catch (err) {
    logger.error({ err }, "Resend webhook signature verification failed");
    return res.status(400).send("Invalid signature.");
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return res.status(200).json({ received: true });
  }

  try {
    const [sendEvent] = await db
      .select({ id: emailSendEvents.id, contactId: emailSendEvents.contactId })
      .from(emailSendEvents)
      .where(eq(emailSendEvents.resendMessageId, emailId))
      .limit(1);

    if (!sendEvent) {
      return res.status(200).json({ received: true });
    }

    switch (event.type) {
      case "email.delivered":
        await db
          .update(emailSendEvents)
          .set({ deliveredAt: new Date() })
          .where(and(eq(emailSendEvents.id, sendEvent.id), isNull(emailSendEvents.deliveredAt)));
        break;

      case "email.bounced": {
        const bounceType = event.data.bounce?.type ?? null;
        await db
          .update(emailSendEvents)
          .set({ bouncedAt: new Date(), bounceType })
          .where(and(eq(emailSendEvents.id, sendEvent.id), isNull(emailSendEvents.bouncedAt)));

        // Only a hard (Permanent) bounce means the address itself is
        // undeliverable - Transient/Undetermined bounces are temporary
        // failures (mailbox full, greylisting) and must not suppress the
        // contact from future sends.
        if (bounceType === "Permanent") {
          await db.update(contacts).set({ status: "bounced" }).where(eq(contacts.id, sendEvent.contactId));
        }
        break;
      }

      case "email.complained":
        await db
          .update(emailSendEvents)
          .set({ complainedAt: new Date() })
          .where(and(eq(emailSendEvents.id, sendEvent.id), isNull(emailSendEvents.complainedAt)));
        await db.update(contacts).set({ status: "complained" }).where(eq(contacts.id, sendEvent.contactId));
        break;

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Resend webhook processing failed");
    return res.status(500).json({ error: "Processing failed" });
  }
}
