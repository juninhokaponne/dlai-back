import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { OpenRouterProvider } from "./openrouter.provider.js";
import { AIProviderError } from "./ai.errors.js";

const originalFetch = global.fetch;

describe("OpenRouterProvider.generate", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns content and usage on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Olá!" } }],
        usage: { prompt_tokens: 12, completion_tokens: 4 },
      }),
    }) as unknown as typeof fetch;

    const provider = new OpenRouterProvider("fake-key");
    const result = await provider.generate({ model: "openai/gpt-4.1-nano", prompt: "oi" });

    expect(result.content).toBe("Olá!");
    expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 4 });
  });

  it("throws AIProviderError with the provider status on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: "Insufficient credits" } }),
    }) as unknown as typeof fetch;

    const provider = new OpenRouterProvider("fake-key");

    await expect(
      provider.generate({ model: "openai/gpt-4.1-nano", prompt: "oi" }),
    ).rejects.toMatchObject({
      name: "AIProviderError",
      statusCode: 402,
      message: "Insufficient credits",
    } satisfies Partial<AIProviderError>);
  });

  it("throws a 504 when the request aborts", async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    }) as unknown as typeof fetch;

    const provider = new OpenRouterProvider("fake-key");

    await expect(
      provider.generate({ model: "openai/gpt-4.1-nano", prompt: "oi" }),
    ).rejects.toMatchObject({ statusCode: 504 });
  });
});
