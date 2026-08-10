const NAME_PLACEHOLDER_PATTERN =
  /\{\{\s*name\s*\}\}|\[\s*nome(?:\s+do\s+assinante)?\s*\]|\[\s*subscriber\s*name\s*\]|\[\s*name\s*\]/gi;

const FALLBACK_NAME = "assinante";

export function personalizeContent(content: string, contactName: string | null): string {
  const replacement = contactName?.trim() || FALLBACK_NAME;
  return content.replace(NAME_PLACEHOLDER_PATTERN, replacement);
}
