export type PersonalizationData = {
  contactName: string | null;
  senderName?: string | null | undefined;
  company?: string | null | undefined;
  date?: string | undefined;
};

const FALLBACK_NAME = "assinante";

function resolveVariable(tag: string, data: PersonalizationData): string | null {
  switch (tag) {
    case "name":
      return data.contactName?.trim() || FALLBACK_NAME;
    case "sender_name":
      return data.senderName?.trim() || "";
    case "company":
      return data.company?.trim() || "";
    case "date":
      return data.date ?? new Date().toLocaleDateString("pt-BR");
    default:
      return null;
  }
}

// Matches the editor's rendered merge-tag chip (a <span data-variable="tag">...</span>,
// styling classes and all) so the CSS-only chip markup never leaks into a sent email -
// the whole element is replaced by the resolved value, not just its inner text.
const VARIABLE_CHIP_PATTERN = /<span[^>]*\bdata-variable="([a-zA-Z0-9_]+)"[^>]*>.*?<\/span>/gi;
const VARIABLE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/gi;

// Legacy bracket-style placeholders the AI generated before {{name}} became the
// standard. Only applies to the subscriber-name variable.
const LEGACY_NAME_PATTERN =
  /\[\s*nome(?:\s+do\s+assinante)?\s*\]|\[\s*subscriber\s*name\s*\]|\[\s*name\s*\]/gi;

export function personalizeContent(content: string, data: PersonalizationData): string {
  return content
    .replace(VARIABLE_CHIP_PATTERN, (match, tag: string) => resolveVariable(tag.toLowerCase(), data) ?? match)
    .replace(VARIABLE_TOKEN_PATTERN, (match, tag: string) => resolveVariable(tag.toLowerCase(), data) ?? match)
    .replace(LEGACY_NAME_PATTERN, resolveVariable("name", data) ?? FALLBACK_NAME);
}
