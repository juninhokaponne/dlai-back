import { Worker, type Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { db } from "../database/index.js";
import { newsletters, contacts, emailSendEvents, users } from "../database/schema/schema.js";
import { ResendEmailProvider } from "../shared/email/resend.provider.js";
import { personalizeContent } from "../shared/newsletter/personalize.js";
import { injectTracking } from "../shared/email/tracking-injector.js";
import { resolveAudienceConditions, resolveSegmentWhereClause } from "../shared/segments/segments.service.js";
import { getRedisConnection } from "./redis-connection.js";
import {
  NEWSLETTER_SEND_QUEUE,
  type NewsletterSendJobData,
} from "./newsletter-send.queue.js";
import { createNotification } from "../shared/notifications/notifications.service.js";
import { createLogger } from "../shared/logger/logger.js";

const logger = createLogger("newsletter-send.worker");
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? "http://localhost:3000";

function unsubscribeUrlFor(unsubscribeToken: string): string {
  return `${API_PUBLIC_URL}/api/contacts/unsubscribe/${unsubscribeToken}`;
}

function buildEmailHtml(content: string, unsubscribeUrl: string): string {
  return `
<div style="background-color:#f4f4f5;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;padding:32px;">
    ${content}
    <hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb;" />
    <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
      Voce esta recebendo este email porque se inscreveu para receber novidades.
      <a href="${unsubscribeUrl}" style="color:#9ca3af;">Cancelar inscricao</a>
    </p>
  </div>
</div>
`;
}

async function processJob(job: Job<NewsletterSendJobData>) {
  const { newsletterId, userId, contactId, trackingSendEventId, segmentId } = job.data;

  const [newsletter] = await db
    .select()
    .from(newsletters)
    .where(eq(newsletters.id, newsletterId))
    .limit(1);

  if (!newsletter || !newsletter.title || !newsletter.content) {
    return;
  }

  const [sender] = await db
    .select({ name: users.name, lastName: users.lastName, company: users.company })
    .from(users)
    .where(eq(users.id, newsletter.userId))
    .limit(1);

  const senderName = sender ? `${sender.name} ${sender.lastName}`.trim() : undefined;
  const sendDate = new Date().toLocaleDateString("pt-BR");

  let recipientsWhere = contactId
    ? and(eq(contacts.organizationId, newsletter.organizationId!), eq(contacts.id, contactId), eq(contacts.status, "subscribed"))
    : and(eq(contacts.organizationId, newsletter.organizationId!), eq(contacts.status, "subscribed"));

  // Same "unresolvable segment -> zero recipients, never everyone" rule as
  // the automation send path - a deleted segment must not silently widen a
  // deliberately-narrowed send.
  let skipAll = false;
  if (!contactId && segmentId) {
    const conditions = await resolveAudienceConditions(newsletter.organizationId!, segmentId);
    if (conditions === null) {
      skipAll = true;
    } else if (conditions.length > 0) {
      recipientsWhere = and(recipientsWhere, resolveSegmentWhereClause(newsletter.organizationId!, conditions));
    }
  }

  const recipients = skipAll ? [] : await db.select().from(contacts).where(recipientsWhere);

  const emailProvider = new ResendEmailProvider();
  let sent = 0;
  let failed = 0;

  for (const contact of recipients) {
    try {
      const unsubscribeUrl = unsubscribeUrlFor(contact.unsubscribeToken);
      const personalizationData = {
        company: sender?.company,
        contactName: contact.name,
        date: sendDate,
        senderName,
      };
      const personalizedContent = personalizeContent(newsletter.content, personalizationData);
      const personalizedSubject = personalizeContent(newsletter.title, personalizationData);
      let sendEventId = trackingSendEventId;
      if (!sendEventId) {
        const [event] = await db
          .insert(emailSendEvents)
          .values({
            organizationId: newsletter.organizationId!,
            contactId: contact.id,
            newsletterId: newsletter.id,
          })
          .returning({ id: emailSendEvents.id });
        sendEventId = event!.id;
      }

      let html = buildEmailHtml(personalizedContent, unsubscribeUrl);
      html = injectTracking(html, sendEventId, API_PUBLIC_URL);
      const result = await emailProvider.send({
        to: contact.email,
        subject: personalizedSubject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await db.update(emailSendEvents).set({ resendMessageId: result.id }).where(eq(emailSendEvents.id, sendEventId));
      sent++;
    } catch (err) {
      failed++;
      logger.error(
        { err, newsletterId, userId, contactEmail: contact.email },
        "Failed to send newsletter to contact",
      );
    }
  }

  if (!contactId) {
    await db
      .update(newsletters)
      .set({ status: "sent", sentAt: new Date(), recipientCount: sent, updatedAt: new Date() })
      .where(eq(newsletters.id, newsletterId));

    await createNotification({ userId, type: "newsletter_sent", newsletterId });
  }

  logger.info({ newsletterId, userId, contactId, sent, failed }, "Newsletter send finished");
}

export function startNewsletterSendWorker(): Worker<NewsletterSendJobData> {
  const worker = new Worker<NewsletterSendJobData>(
    NEWSLETTER_SEND_QUEUE,
    processJob,
    { connection: getRedisConnection(), concurrency: 2 },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    logger.error(
      { err, newsletterId: job.data.newsletterId, userId: job.data.userId },
      "Newsletter send job failed",
    );
    await db
      .update(newsletters)
      .set({
        status: "failed",
        lastErrorMessage: err.message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, job.data.newsletterId));

    await createNotification({
      userId: job.data.userId,
      type: "newsletter_send_failed",
      newsletterId: job.data.newsletterId,
    });
  });

  return worker;
}
