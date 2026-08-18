// Some models (notably Gemini and Claude) wrap HTML/code responses in a
// markdown code fence even when explicitly asked not to. Strip it so the
// raw HTML reaches the editor instead of being treated as literal text.
const CODE_FENCE_PATTERN = /^```(?:[a-zA-Z0-9]*)?\r?\n([\s\S]*?)\r?\n?```$/;

// Models also like to pretty-print HTML with indentation. The editor parses
// content as Markdown (to support mixed HTML/Markdown), and CommonMark turns
// a line with 4+ leading spaces (or a tab) into an "indented code block" -
// rendering the whole tag as literal text instead of a real element. Only
// strip at that threshold so lighter, harmless indentation is left alone.
const INDENTED_TAG_LINE = /^(?: {4,}|\t+)(?=<)/gm;

export function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(CODE_FENCE_PATTERN);
  const unfenced = match ? (match[1] ?? "").trim() : trimmed;
  return unfenced.replace(INDENTED_TAG_LINE, "");
}
