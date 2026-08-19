import { AIProviderError } from "./ai.errors.js";

const ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const REQUEST_TIMEOUT_MS = 60_000;
const MODEL_ID = "scribe_v1";

export class ElevenLabsProvider {
  constructor(private readonly apiKey: string = process.env.ELEVENLABS_API_KEY ?? "") {
    if (!this.apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not set.");
    }
  }

  async transcribe(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const formData = new FormData();
    formData.append("model_id", MODEL_ID);
    formData.append("file", new Blob([Uint8Array.from(buffer)], { type: mimeType }), filename);

    let response: Response;
    try {
      response = await fetch(ELEVENLABS_STT_URL, {
        method: "POST",
        headers: { "xi-api-key": this.apiKey },
        body: formData,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIProviderError("Speech-to-text request timed out.", 504);
      }
      throw new AIProviderError("Failed to reach speech-to-text provider.", 502);
    } finally {
      clearTimeout(timeout);
    }

    const body: any = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = body?.detail;
      const message =
        typeof detail === "string" ? detail : (detail?.message ?? `Speech-to-text provider error (${response.status})`);
      const statusCode = response.status === 429 ? 429 : 502;
      throw new AIProviderError(message, statusCode);
    }

    const text = body?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new AIProviderError("No speech detected in the recording.", 400);
    }

    return text.trim();
  }
}
