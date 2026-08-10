export const MATCH_INPUT_LANGUAGE_INSTRUCTION =
  "IMPORTANT: Always write your entire response in the same language as the user's input/topic given above or below. If the input is in Portuguese, respond in Portuguese. If it's in English, respond in English. If it's in Spanish, respond in Spanish. Never mix languages and never translate the response into a different language than the input.";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
};

export function languageInstructionForLocale(locale: string): string {
  const languageName = LANGUAGE_NAMES[locale] ?? "English";
  return `IMPORTANT: If reference topics are provided below, write your entire response in the same language as those topics. Otherwise, write your entire response in ${languageName}. Never mix languages.`;
}
