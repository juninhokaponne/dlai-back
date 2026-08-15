import { injectTracking } from "./tracking-injector.js";

describe("injectTracking", () => {
  const API_URL = "https://api.lettergo.test";
  const SEND_EVENT_ID = "11111111-1111-1111-1111-111111111111";

  it("appends a pixel image pointing at the open-tracking endpoint", () => {
    const result = injectTracking("<p>Hello</p>", SEND_EVENT_ID, API_URL);
    expect(result).toContain(
      `<img src="${API_URL}/api/t/o/${SEND_EVENT_ID}.png" width="1" height="1" alt="" style="display:none" />`,
    );
  });

  it("rewrites every anchor href through the click-tracking endpoint", () => {
    const html = '<a href="https://example.com/a">A</a><a href="https://example.com/b">B</a>';
    const result = injectTracking(html, SEND_EVENT_ID, API_URL);
    const expectedA = `${API_URL}/api/t/c/${SEND_EVENT_ID}?u=aHR0cHM6Ly9leGFtcGxlLmNvbS9h`;
    const expectedB = `${API_URL}/api/t/c/${SEND_EVENT_ID}?u=aHR0cHM6Ly9leGFtcGxlLmNvbS9i`;
    expect(result).toContain(`href="${expectedA}"`);
    expect(result).toContain(`href="${expectedB}"`);
  });

  it("leaves an unsubscribe link untouched", () => {
    const html = '<a href="https://api.lettergo.test/api/contacts/unsubscribe/abc">Unsubscribe</a>';
    const result = injectTracking(html, SEND_EVENT_ID, API_URL);
    expect(result).toContain('href="https://api.lettergo.test/api/contacts/unsubscribe/abc"');
  });

  it("leaves relative and mailto hrefs untouched", () => {
    const html = '<a href="#top">Top</a><a href="mailto:a@b.com">Email</a>';
    const result = injectTracking(html, SEND_EVENT_ID, API_URL);
    expect(result).toContain('href="#top"');
    expect(result).toContain('href="mailto:a@b.com"');
  });
});
