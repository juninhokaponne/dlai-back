import { Queue } from "bullmq";
import { getRedisConnection } from "./redis-connection.js";

export const NEWSLETTER_GENERATE_QUEUE = "newsletter-generate";

export interface NewsletterGenerateJobData {
  newsletterId: string;
  userId: string;
}

let queue: Queue<NewsletterGenerateJobData> | null = null;

export function getNewsletterGenerateQueue(): Queue<NewsletterGenerateJobData> {
  if (!queue) {
    queue = new Queue<NewsletterGenerateJobData>(NEWSLETTER_GENERATE_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    });
  }
  return queue;
}
