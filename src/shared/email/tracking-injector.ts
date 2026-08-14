const UNSUBSCRIBE_PATH = "/api/contacts/unsubscribe/";
const HREF_REGEX = /href="([^"]+)"/g;

export function injectTracking(html: string, sendEventId: string, apiPublicUrl: string): string {
  const withRewrittenLinks = html.replace(HREF_REGEX, (match, href: string) => {
    if (!href.startsWith("http://") && !href.startsWith("https://")) return match;
    if (href.includes(UNSUBSCRIBE_PATH)) return match;

    const encoded = Buffer.from(href, "utf-8").toString("base64url");
    return `href="${apiPublicUrl}/api/t/c/${sendEventId}?u=${encoded}"`;
  });

  const pixel = `<img src="${apiPublicUrl}/api/t/o/${sendEventId}.png" width="1" height="1" alt="" style="display:none" />`;
  return `${withRewrittenLinks}${pixel}`;
}
