// Some models (notably Gemini and Claude) wrap HTML/code responses in a
// markdown code fence even when explicitly asked not to. Strip it so the
// raw HTML reaches the editor instead of being treated as literal text.
const CODE_FENCE_PATTERN = /^```(?:[a-zA-Z0-9]*)?\r?\n([\s\S]*?)\r?\n?```$/;

export function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(CODE_FENCE_PATTERN);
  return match ? (match[1] ?? "").trim() : trimmed;
}
