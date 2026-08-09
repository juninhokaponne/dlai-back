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
  "google/gemini-2.5-flash": { promptPerMillion: 0.3, completionPerMillion: 2.5 },
  "anthropic/claude-haiku-4.5": { promptPerMillion: 1.0, completionPerMillion: 5.0 },
};

// Alternative models a user can pick for the "body" task instead of the
// default, trading credit cost for a different model. Each entry's
// creditCost must comfortably cover its real cost vs GENERATION_CREDIT_COST
// (the default) so premium picks never lose money, even in the worst case.
export const BODY_MODEL_OPTIONS = [
  {
    model: AI_TASK_MODELS.body,
    label: "Padrao (GPT-4.1 mini)",
    creditCost: 1,
  },
  {
    model: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    creditCost: 2,
  },
  {
    model: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    creditCost: 3,
  },
] as const;

export type BodyModelId = (typeof BODY_MODEL_OPTIONS)[number]["model"];

export function findBodyModelOption(model: string) {
  return BODY_MODEL_OPTIONS.find((option) => option.model === model);
}
