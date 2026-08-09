import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry.js";

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "LetterGo API",
      version: "1.0.0",
      description: "API do backend do LetterGo (newsletters geradas por IA).",
    },
    servers: [
      { url: "https://api.lettergo.app", description: "Producao" },
      { url: "http://localhost:3000", description: "Local" },
    ],
  });
}
