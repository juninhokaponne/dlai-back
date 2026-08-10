import { personalizeContent } from "./personalize.js";

describe("personalizeContent", () => {
  it("replaces {{name}} with the contact name", () => {
    expect(personalizeContent("Ola {{name}}, tudo bem?", "Maria")).toBe("Ola Maria, tudo bem?");
  });

  it("replaces legacy bracket placeholders", () => {
    expect(personalizeContent("Ola [Nome], tudo bem?", "Maria")).toBe("Ola Maria, tudo bem?");
    expect(personalizeContent("Ola [Nome do Assinante]!", "Maria")).toBe("Ola Maria!");
    expect(personalizeContent("Hi [Subscriber Name]!", "Maria")).toBe("Hi Maria!");
  });

  it("is case-insensitive", () => {
    expect(personalizeContent("Ola {{NAME}}!", "Maria")).toBe("Ola Maria!");
  });

  it("falls back to a generic term when the contact has no name", () => {
    expect(personalizeContent("Ola {{name}}!", null)).toBe("Ola assinante!");
    expect(personalizeContent("Ola {{name}}!", "  ")).toBe("Ola assinante!");
  });

  it("replaces every occurrence", () => {
    expect(personalizeContent("{{name}}... {{name}}?", "Ana")).toBe("Ana... Ana?");
  });

  it("leaves content without placeholders untouched", () => {
    expect(personalizeContent("No placeholders here.", "Ana")).toBe("No placeholders here.");
  });
});
