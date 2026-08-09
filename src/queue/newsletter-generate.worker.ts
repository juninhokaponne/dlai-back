import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "../database/index.js";
import { newsletters } from "../database/schema/schema.js";
import { AIService } from "../shared/ai/ai.service.js";
import { OpenRouterProvider } from "../shared/ai/openrouter.provider.js";
import { getRedisConnection } from "./redis-connection.js";
import {
  NEWSLETTER_GENERATE_QUEUE,
  type NewsletterGenerateJobData,
} from "./newsletter-generate.queue.js";
import { creditCredits } from "../shared/billing/credits.service.js";
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
    `Gere apenas um titulo curto e chamativo (maximo 60 caracteres, sem aspas) para uma newsletter sobre: "${newsletter.topic}".`,
  );

  const body = await aiService.run(
    "body",
    `Gere o corpo de um email de newsletter em HTML simples (sem tags html/head/body, so o conteudo com paragrafos) sobre o tema: "${newsletter.topic}". O titulo da newsletter e: "${title.content}". Seja conciso e envolvente.`,
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
  });

  return worker;
}
