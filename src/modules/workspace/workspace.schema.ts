import { z } from "zod";

export const workspaceGenerateSchema = z.object({
  topic: z.string().trim().min(1).max(500),
});
