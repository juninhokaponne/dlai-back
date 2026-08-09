import { Worker, type Job } from "bullmq";
import { and, eq } from "drizzle-orm";
import { db } from "../database/index.js";
import { newsletters, contacts } from "../database/schema/schema.js";
import { ResendEmailProvider } from "../shared/email/resend.provider.js";
import { getRedisConnection } from "./redis-connection.js";
import {
  NEWSLETTER_SEND_QUEUE,
  type NewsletterSendJobData,
} from "./newsletter-send.queue.js";
import { createLogger } from "../shared/logger/logger.js";

const logger = createLogger("newsletter-send.worker");
const API_PUBLIC_URL = process.env.API_PUBLIC_URL ?? "http://localhost:3000";

function unsubscribeUrlFor(unsubscribeToken: string): string {
  return `${API_PUBLIC_URL}/api/contacts/unsubscribe/${unsubscribeToken}`;
}

function buildEmailHtml(content: string, unsubscribeUrl: string): string {
  return `
${content}
<hr style="margin-top: 32px; border: none; border-top: 1px solid #ddd;" />
<p style="font-size: 12px; color: #888;">
  Voce esta recebendo este email porque se inscreveu para receber novidades.
  <a href="${unsubscribeUrl}">Cancelar inscricao</a>
</p>
`;
}

async function processJob(job: Job<NewsletterSendJobData>) {
  const { newsletterId, userId } = job.data;

  const [newsletter] = await db
    .select()
    .from(newsletters)
    .where(eq(newsletters.id, newsletterId))
    .limit(1);

  if (!newsletter || !newsletter.title || !newsletter.content) {
    return;
  }

  const recipients = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.userId, newsletter.userId), eq(contacts.status, "subscribed")),
    );

  const emailProvider = new ResendEmailProvider();
  let sent = 0;
  let failed = 0;

  for (const contact of recipients) {
    try {
      const unsubscribeUrl = unsubscribeUrlFor(contact.unsubscribeToken);
      await emailProvider.send({
        to: contact.email,
        subject: newsletter.title,
        html: buildEmailHtml(newsletter.content, unsubscribeUrl),
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch (err) {
      failed++;
      logger.error(
        { err, newsletterId, userId, contactEmail: contact.email },
        "Failed to send newsletter to contact",
      );
    }
  }

  await db
    .update(newsletters)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(newsletters.id, newsletterId));

  logger.info({ newsletterId, userId, sent, failed }, "Newsletter send finished");
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
  });

  return worker;
}
