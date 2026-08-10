// Matches the editor's rendered merge-tag chip (a <span data-variable="name">...</span>,
// styling classes and all) so the CSS-only chip markup never leaks into a sent email -
// the whole element is replaced by the plain contact name, not just its inner text.
const VARIABLE_CHIP_PATTERN = /<span[^>]*\bdata-variable="name"[^>]*>.*?<\/span>/gi;

const NAME_PLACEHOLDER_PATTERN =
  /\{\{\s*name\s*\}\}|\[\s*nome(?:\s+do\s+assinante)?\s*\]|\[\s*subscriber\s*name\s*\]|\[\s*name\s*\]/gi;

const FALLBACK_NAME = "assinante";

export function personalizeContent(content: string, contactName: string | null): string {
  const replacement = contactName?.trim() || FALLBACK_NAME;
  return content.replace(VARIABLE_CHIP_PATTERN, replacement).replace(NAME_PLACEHOLDER_PATTERN, replacement);
}
