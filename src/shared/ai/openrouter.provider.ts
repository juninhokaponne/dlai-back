import type { AIProvider, GenerateParams, GenerateResult } from "./ai-provider.interface.js";
import { AIProviderError } from "./ai.errors.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 30_000;

export class OpenRouterProvider implements AIProvider {
  constructor(private readonly apiKey: string = process.env.OPEN_ROUTE_API_KEY ?? "") {
    if (!this.apiKey) {
      throw new Error("OPEN_ROUTE_API_KEY is not set.");
    }
  }

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: params.model,
          messages: [{ role: "user", content: params.prompt }],
          max_tokens: params.maxTokens,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("AI provider request timed out.", 504);
      }
      throw new AIProviderError("Failed to reach AI provider.", 502);
    } finally {
      clearTimeout(timeout);
    }

    const body: any = await response.json().catch(() => null);

    if (!response.ok) {
      const message = body?.error?.message ?? `AI provider error (${response.status})`;
      const statusCode = response.status === 429 || response.status === 402 ? response.status : 502;
      throw new AIProviderError(message, statusCode);
    }

    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new AIProviderError("AI provider returned an empty response.", 502);
    }

    return {
      content,
      usage: {
        promptTokens: body?.usage?.prompt_tokens ?? 0,
        completionTokens: body?.usage?.completion_tokens ?? 0,
      },
    };
  }
}
