import { Queue } from "bullmq";
import { getRedisConnection } from "./redis-connection.js";

export const NEWSLETTER_SEND_QUEUE = "newsletter-send";

export interface NewsletterSendJobData {
  newsletterId: string;
  userId: string;
  contactId?: string;
  trackingSendEventId?: string;
  segmentId?: string;
}

let queue: Queue<NewsletterSendJobData> | null = null;

export function getNewsletterSendQueue(): Queue<NewsletterSendJobData> {
  if (!queue) {
    queue = new Queue<NewsletterSendJobData>(NEWSLETTER_SEND_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86_400 },
      },
    });
  }
  return queue;
}
