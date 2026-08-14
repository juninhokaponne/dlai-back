import { Queue } from "bullmq";
import { getRedisConnection } from "./redis-connection.js";

export const AUTOMATION_HEARTBEAT_QUEUE = "automation-heartbeat";

let queue: Queue | null = null;

export function getAutomationHeartbeatQueue(): Queue {
  if (!queue) {
    queue = new Queue(AUTOMATION_HEARTBEAT_QUEUE, { connection: getRedisConnection() });
  }
  return queue;
}

export async function scheduleAutomationHeartbeat(): Promise<void> {
  await getAutomationHeartbeatQueue().upsertJobScheduler("automation-heartbeat", { every: 60_000 }, { name: "tick" });
}
