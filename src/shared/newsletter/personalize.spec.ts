import { personalizeContent } from "./personalize.js";

describe("personalizeContent", () => {
  it("replaces {{name}} with the contact name", () => {
    expect(personalizeContent("Ola {{name}}, tudo bem?", { contactName: "Maria" })).toBe(
      "Ola Maria, tudo bem?",
    );
  });

  it("replaces legacy bracket placeholders", () => {
    expect(personalizeContent("Ola [Nome], tudo bem?", { contactName: "Maria" })).toBe("Ola Maria, tudo bem?");
    expect(personalizeContent("Ola [Nome do Assinante]!", { contactName: "Maria" })).toBe("Ola Maria!");
    expect(personalizeContent("Hi [Subscriber Name]!", { contactName: "Maria" })).toBe("Hi Maria!");
  });

  it("is case-insensitive", () => {
    expect(personalizeContent("Ola {{NAME}}!", { contactName: "Maria" })).toBe("Ola Maria!");
  });

  it("falls back to a generic term when the contact has no name", () => {
    expect(personalizeContent("Ola {{name}}!", { contactName: null })).toBe("Ola assinante!");
    expect(personalizeContent("Ola {{name}}!", { contactName: "  " })).toBe("Ola assinante!");
  });

  it("replaces every occurrence", () => {
    expect(personalizeContent("{{name}}... {{name}}?", { contactName: "Ana" })).toBe("Ana... Ana?");
  });

  it("leaves content without placeholders untouched", () => {
    expect(personalizeContent("No placeholders here.", { contactName: "Ana" })).toBe("No placeholders here.");
  });

  it("strips the editor's merge-tag chip markup entirely, not just its text", () => {
    const html =
      'Ola <span data-variable="name" class="merge-tag inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[0.95em] font-medium text-violet-700">{{name}}</span>, bem-vindo!';
    expect(personalizeContent(html, { contactName: "Maria" })).toBe("Ola Maria, bem-vindo!");
  });

  it("replaces sender_name and company with sender data", () => {
    expect(
      personalizeContent("Att, {{sender_name}} da {{company}}", {
        contactName: "Ana",
        company: "Acme",
        senderName: "Joao",
      }),
    ).toBe("Att, Joao da Acme");
  });

  it("replaces date with the provided date or falls back to today", () => {
    expect(personalizeContent("Hoje e {{date}}", { contactName: "Ana", date: "10/08/2026" })).toBe(
      "Hoje e 10/08/2026",
    );
  });

  it("resolves empty string for sender data that is missing", () => {
    expect(personalizeContent("Att, {{sender_name}}", { contactName: "Ana" })).toBe("Att, ");
  });
});
