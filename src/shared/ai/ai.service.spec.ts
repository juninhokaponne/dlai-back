import { describe, it, expect, jest } from "@jest/globals";
import { AIService } from "./ai.service.js";
import type { AIProvider, GenerateResult } from "./ai-provider.interface.js";

function fakeProvider(result: GenerateResult): AIProvider {
  return { generate: jest.fn<() => Promise<GenerateResult>>().mockResolvedValue(result) };
}

describe("AIService.run", () => {
  it("routes the title task to the cheap model and computes cost", async () => {
    const provider = fakeProvider({
      content: "Um título e tanto",
      usage: { promptTokens: 200, completionTokens: 30 },
    });
    const service = new AIService(provider);

    const result = await service.run("title", "gera um titulo");

    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-4.1-nano" }),
    );
    expect(result.model).toBe("openai/gpt-4.1-nano");
    expect(result.costUsd).toBeCloseTo((200 * 0.1 + 30 * 0.4) / 1_000_000, 10);
  });

  it("routes the body task to the mid-tier model", async () => {
    const provider = fakeProvider({
      content: "<html>...</html>",
      usage: { promptTokens: 500, completionTokens: 2000 },
    });
    const service = new AIService(provider);

    const result = await service.run("body", "gera o corpo do email");

    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/gpt-4.1-mini" }),
    );
    expect(result.model).toBe("openai/gpt-4.1-mini");
    expect(result.costUsd).toBeCloseTo((500 * 0.4 + 2000 * 1.6) / 1_000_000, 10);
  });
});
