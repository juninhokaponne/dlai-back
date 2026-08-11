import type { AIProvider } from "./ai-provider.interface.js";
import { AI_TASK_MODELS, MODEL_PRICING_USD, type AITask } from "./ai.config.js";
import { AIProviderError } from "./ai.errors.js";
import { stripMarkdownCodeFence } from "./sanitize-ai-output.js";

export interface RunTaskResult {
  content: string;
  model: string;
  costUsd: number;
  usage: { promptTokens: number; completionTokens: number };
}

export class AIService {
  constructor(private readonly provider: AIProvider) {}

  async run(task: AITask, prompt: string, modelOverride?: string): Promise<RunTaskResult> {
    const model = modelOverride ?? AI_TASK_MODELS[task];

    const pricing = MODEL_PRICING_USD[model];
    if (!pricing) {
      throw new AIProviderError(`Model "${model}" is not an allowed/priced model.`, 400);
    }

    const result = await this.provider.generate({ model, prompt });

    const costUsd =
      (result.usage.promptTokens * pricing.promptPerMillion +
        result.usage.completionTokens * pricing.completionPerMillion) /
      1_000_000;

    return { content: stripMarkdownCodeFence(result.content), model, costUsd, usage: result.usage };
  }
}
