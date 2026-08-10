export const PLACEHOLDER_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAAEElEQVR4nGN4+vw1HDEgcwAaURW5zOzFqAAAAABJRU5ErkJggg==";

export function buildEmailDesignInstructions(options: { useImages?: boolean; useLinks?: boolean } = {}): string {
  const imageInstruction = options.useImages
    ? `- Include at least one image using exactly this tag near the top or at a relevant point: <img src="${PLACEHOLDER_IMAGE_DATA_URI}" alt="[describe the ideal image for this spot, in the same language as the content]" style="width:100%;max-width:600px;height:auto;border-radius:8px;display:block;margin:0 0 20px;" /> - this is a placeholder the user will replace with a real photo later, but it should occupy a prominent space as if it were a real image.`
    : `- Do not include any <img> tag.`;

  const linkInstruction = options.useLinks
    ? `- Include at least one call-to-action button using exactly this pattern (replace the button text with something appropriate for the content, in the same language as the content): <a href="#" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;margin:8px 0;">Button text</a>`
    : `- Do not include any links or buttons (<a> tags).`;

  return `This HTML will be sent as the body of a real email and opened in clients like Gmail, Outlook and Apple Mail - these clients do NOT load external CSS or respect CSS classes, so ALL visual styling must come from inline style="" attributes on each element, never from <style> tags or classes.

Follow these professional design guidelines so the result looks beautiful, organized, and has good visual hierarchy:
- A prominent main heading, e.g.: <h1 style="font-size:26px;font-weight:700;color:#111827;margin:0 0 16px;line-height:1.3;">
- Paragraphs with good readability: <p style="font-size:16px;line-height:1.6;color:#374151;margin:0 0 16px;">
- Use at most one accent color (#2563eb) for important elements (subheadings, buttons) - keep the rest of the text in neutral tones (#111827 for headings, #374151 for body text, #6b7280 for secondary text)
- Organize the content into distinct visual blocks/sections when the topic allows, each block inside <div style="margin-bottom:24px;">
- The text must be specific and useful for the requested topic, never generic or filler
${imageInstruction}
${linkInstruction}
- Do not include <html>, <head> or <body> tags - only the inner content.`;
}
