import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../database/index.js";
import { newsletters } from "../database/schema/schema.js";
import { AIService } from "../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../shared/ai/openrouter.provider.js";
import { buildEmailDesignInstructions } from "../shared/ai/email-design-prompt.js";
import { MATCH_INPUT_LANGUAGE_INSTRUCTION } from "../shared/ai/language-instruction.js";
import { getRedisConnection } from "./redis-connection.js";
import {
  NEWSLETTER_GENERATE_QUEUE,
  type NewsletterGenerateJobData,
} from "./newsletter-generate.queue.js";
import { creditCredits } from "../shared/billing/credits.service.js";
import { createNotification } from "../shared/notifications/notifications.service.js";
import { createLogger } from "../shared/logger/logger.js";

const logger = createLogger("newsletter-generate.worker");
const aiService = new AIService(new OpenRouterProvider());

async function processJob(job: Job<NewsletterGenerateJobData>) {
  const { newsletterId, userId, bodyModel } = job.data;

  const [newsletter] = await db
    .select()
    .from(newsletters)
    .where(eq(newsletters.id, newsletterId))
    .limit(1);

  if (!newsletter) {
    return;
  }

  const title = await aiService.run(
    "title",
    `Write only a short, catchy title (max 60 characters, no quotes) for a newsletter about: "${newsletter.topic}".

${MATCH_INPUT_LANGUAGE_INSTRUCTION}`,
  );

  const body = await aiService.run(
    "body",
    `Write the body of a newsletter email about this topic: "${newsletter.topic}". The newsletter's title is: "${title.content}". Be concise and engaging.

${buildEmailDesignInstructions({ useImages: false, useLinks: true })}

You can personalize the email using exactly these placeholders (with double curly braces), without inventing other variants: {{name}} for the subscriber's name, {{sender_name}} for the sender's name, {{company}} for the sender's company, and {{date}} for today's date. Only use the ones that make sense for the content - don't force the use of all of them.

${MATCH_INPUT_LANGUAGE_INSTRUCTION}`,
    bodyModel,
  );

  const totalCost = title.costUsd + body.costUsd;

  await db
    .update(newsletters)
    .set({
      title: title.content.trim(),
      content: body.content.trim(),
      status: "ready",
      generationCostUsd: (
        Number(newsletter.generationCostUsd) + totalCost
      ).toFixed(6),
      lastErrorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(newsletters.id, newsletterId));

  logger.info({ newsletterId, userId, costUsd: totalCost }, "Newsletter generated");

  await createNotification({ userId, type: "newsletter_generated", newsletterId });
}

export function startNewsletterGenerateWorker(): Worker<NewsletterGenerateJobData> {
  const worker = new Worker<NewsletterGenerateJobData>(
    NEWSLETTER_GENERATE_QUEUE,
    processJob,
    { connection: getRedisConnection(), concurrency: 5 },
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (!exhausted) return;

    logger.error(
      { err, newsletterId: job.data.newsletterId, userId: job.data.userId },
      "Newsletter generation failed",
    );

    await db
      .update(newsletters)
      .set({
        status: "failed",
        lastErrorMessage: err.message.slice(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(newsletters.id, job.data.newsletterId));

    await creditCredits(job.data.userId, job.data.creditCost, "generation_refund", {
      newsletterId: job.data.newsletterId,
    });

    await createNotification({
      userId: job.data.userId,
      type: "newsletter_generation_failed",
      newsletterId: job.data.newsletterId,
    });
  });

  return worker;
}
