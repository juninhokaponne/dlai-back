export const AI_TASK_MODELS = {
  title: "openai/gpt-4.1-nano",
  body: "openai/gpt-4.1-mini",
} as const;

export type AITask = keyof typeof AI_TASK_MODELS;

interface ModelPricing {
  promptPerMillion: number;
  completionPerMillion: number;
}

export const MODEL_PRICING_USD: Record<string, ModelPricing> = {
  "openai/gpt-4.1-nano": { promptPerMillion: 0.1, completionPerMillion: 0.4 },
  "openai/gpt-4.1-mini": { promptPerMillion: 0.4, completionPerMillion: 1.6 },
};
