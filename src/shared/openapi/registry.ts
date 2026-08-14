import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "../../modules/auth/auth.schema.js";
import {
  createNewsletterSchema,
  generateSchema,
  updateNewsletterSchema,
} from "../../modules/newsletter/newsletter.schema.js";
import { checkoutSchema } from "../../modules/billing/billing.schema.js";
import { workspaceGenerateSchema, workspaceTextActionSchema } from "../../modules/workspace/workspace.schema.js";
import { contactRowSchema, importTextSchema } from "../../modules/contacts/contact.schema.js";
import { createTemplateSchema, generateTemplateSchema } from "../../modules/templates/template.schema.js";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
});

const bearerAuth = [{ bearerAuth: [] }];

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: z.object({ error: z.string() }) } },
});

const uuidParam = z.object({
  id: z.string().uuid().openapi({ description: "Newsletter id" }),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/auth/register",
  tags: ["Auth"],
  summary: "Cria uma nova conta",
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: {
    201: {
      description: "Usuario criado, com credito de trial",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            user: z.object({
              id: z.string(),
              name: z.string(),
              email: z.string(),
              creditBalance: z.number(),
            }),
          }),
        },
      },
    },
    409: errorResponse("Email ja cadastrado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Auth"],
  summary: "Login (retorna access token e seta cookie de refresh)",
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: {
      description: "Login bem sucedido",
      content: {
        "application/json": {
          schema: z.object({ accessToken: z.string(), user: z.object({}) }),
        },
      },
    },
    401: errorResponse("Credenciais invalidas"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/refresh",
  tags: ["Auth"],
  summary: "Renova o access token usando o cookie de refresh",
  responses: {
    200: {
      description: "Novo access token",
      content: { "application/json": { schema: z.object({ accessToken: z.string() }) } },
    },
    401: errorResponse("Refresh token ausente, invalido ou expirado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/logout",
  tags: ["Auth"],
  summary: "Revoga o refresh token e limpa o cookie",
  responses: { 204: { description: "Logout efetuado" } },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/me",
  tags: ["Auth"],
  summary: "Perfil do usuario autenticado",
  security: bearerAuth,
  responses: {
    200: { description: "Dados do usuario", content: { "application/json": { schema: z.object({ user: z.object({}) } ) } } },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/auth/me",
  tags: ["Auth"],
  summary: "Atualiza nome, sobrenome e/ou empresa do usuario autenticado",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: updateProfileSchema } } } },
  responses: {
    200: { description: "Perfil atualizado", content: { "application/json": { schema: z.object({ user: z.object({}) } ) } } },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/me/avatar",
  tags: ["Auth"],
  summary: "Envia a foto de perfil do usuario autenticado (multipart/form-data, campo 'avatar')",
  security: bearerAuth,
  responses: {
    200: { description: "Avatar atualizado", content: { "application/json": { schema: z.object({ user: z.object({}) } ) } } },
    400: errorResponse("Arquivo ausente ou formato invalido"),
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/change-password",
  tags: ["Auth"],
  summary: "Troca a senha do usuario autenticado (revoga todas as sessoes)",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: changePasswordSchema } } } },
  responses: {
    200: { description: "Senha atualizada", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    401: errorResponse("Senha atual incorreta ou nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/verify-email",
  tags: ["Auth"],
  summary: "Confirma o email do usuario a partir do token enviado por email",
  request: { body: { content: { "application/json": { schema: verifyEmailSchema } } } },
  responses: {
    200: { description: "Email confirmado", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    400: errorResponse("Token invalido ou expirado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/resend-verification",
  tags: ["Auth"],
  summary: "Reenvia o email de confirmacao para o usuario autenticado",
  security: bearerAuth,
  responses: {
    200: { description: "Email de verificacao reenviado", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/forgot-password",
  tags: ["Auth"],
  summary: "Envia um email de redefinicao de senha se o email existir (resposta identica em ambos os casos)",
  request: { body: { content: { "application/json": { schema: forgotPasswordSchema } } } },
  responses: {
    200: { description: "Resposta generica", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/reset-password",
  tags: ["Auth"],
  summary: "Redefine a senha a partir do token enviado por email",
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: { description: "Senha redefinida", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    400: errorResponse("Token invalido ou expirado"),
  },
});

// ---------------------------------------------------------------------------
// Newsletters
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/newsletters",
  tags: ["Newsletters"],
  summary: "Lista as newsletters do usuario",
  security: bearerAuth,
  responses: {
    200: { description: "Lista de newsletters", content: { "application/json": { schema: z.object({ newsletters: z.array(z.object({})) }) } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/newsletters",
  tags: ["Newsletters"],
  summary: "Cria uma newsletter (rascunho, ainda sem conteudo)",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: createNewsletterSchema } } } },
  responses: { 201: { description: "Newsletter criada", content: { "application/json": { schema: z.object({ newsletter: z.object({}) }) } } } },
});

registry.registerPath({
  method: "get",
  path: "/api/newsletters/{id}",
  tags: ["Newsletters"],
  summary: "Busca uma newsletter por id",
  security: bearerAuth,
  request: { params: uuidParam },
  responses: {
    200: { description: "Newsletter encontrada", content: { "application/json": { schema: z.object({ newsletter: z.object({}) }) } } },
    400: errorResponse("Id invalido"),
    404: errorResponse("Newsletter nao encontrada"),
  },
});

registry.registerPath({
  method: "put",
  path: "/api/newsletters/{id}",
  tags: ["Newsletters"],
  summary: "Edita topic/title/content manualmente",
  security: bearerAuth,
  request: {
    params: uuidParam,
    body: { content: { "application/json": { schema: updateNewsletterSchema } } },
  },
  responses: {
    200: { description: "Newsletter atualizada", content: { "application/json": { schema: z.object({ newsletter: z.object({}) }) } } },
    400: errorResponse("Id invalido ou nenhum campo enviado"),
    404: errorResponse("Newsletter nao encontrada"),
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/newsletters/{id}",
  tags: ["Newsletters"],
  summary: "Remove uma newsletter",
  security: bearerAuth,
  request: { params: uuidParam },
  responses: {
    204: { description: "Newsletter removida" },
    404: errorResponse("Newsletter nao encontrada"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/newsletters/{id}/generate",
  tags: ["Newsletters"],
  summary: "Gera titulo e corpo via IA (assincrono). Custo em creditos varia por modelo, veja GET /api/newsletters/models",
  security: bearerAuth,
  request: { params: uuidParam, body: { content: { "application/json": { schema: generateSchema } } } },
  responses: {
    202: { description: "Geracao enfileirada", content: { "application/json": { schema: z.object({ newsletter: z.object({}), creditBalance: z.number() }) } } },
    400: errorResponse("Sem creditos suficientes ou modelo invalido"),
    404: errorResponse("Newsletter nao encontrada"),
    409: errorResponse("Geracao ja em andamento"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/newsletters/models",
  tags: ["Newsletters"],
  summary: "Lista os modelos de IA disponiveis para o corpo da newsletter e seu custo em creditos",
  security: bearerAuth,
  responses: {
    200: {
      description: "Modelos disponiveis",
      content: {
        "application/json": {
          schema: z.object({
            models: z.array(
              z.object({ model: z.string(), label: z.string(), creditCost: z.number() }),
            ),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/newsletters/{id}/send",
  tags: ["Newsletters"],
  summary: "Envia a newsletter pronta para os contacts subscribed",
  security: bearerAuth,
  request: { params: uuidParam },
  responses: {
    202: { description: "Envio enfileirado", content: { "application/json": { schema: z.object({ newsletter: z.object({}), recipientCount: z.number() }) } } },
    400: errorResponse("Sem contacts subscribed ou newsletter nao esta pronta"),
    403: errorResponse("Email do remetente ainda nao foi confirmado"),
    404: errorResponse("Newsletter nao encontrada"),
    409: errorResponse("Envio ja em andamento"),
  },
});

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/contacts",
  tags: ["Contacts"],
  summary: "Lista os contacts do usuario",
  security: bearerAuth,
  request: {
    query: z.object({
      limit: z.string().optional().openapi({ description: "Padrao 100, maximo 500" }),
      offset: z.string().optional(),
    }),
  },
  responses: { 200: { description: "Lista de contacts", content: { "application/json": { schema: z.object({ contacts: z.array(z.object({})) }) } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/contacts",
  tags: ["Contacts"],
  summary: "Adiciona um contact manualmente",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: contactRowSchema } } } },
  responses: {
    201: { description: "Contact criado", content: { "application/json": { schema: z.object({ contact: z.object({}) }) } } },
    409: errorResponse("Contact ja existe"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/contacts/import",
  tags: ["Contacts"],
  summary: "Importa contacts via upload de CSV (colunas: email, name)",
  security: bearerAuth,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.string().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
  },
  responses: {
    201: { description: "Import processado", content: { "application/json": { schema: z.object({ imported: z.number(), skippedDuplicates: z.number(), invalidCount: z.number() }) } } },
    400: errorResponse("CSV ausente/invalido"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/contacts/import-text",
  tags: ["Contacts"],
  summary: "Importa contacts colados como texto (um por linha, com email obrigatorio e name opcional)",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: importTextSchema } } } },
  responses: {
    201: { description: "Import processado", content: { "application/json": { schema: z.object({ imported: z.number(), skippedDuplicates: z.number(), invalidCount: z.number() }) } } },
    400: errorResponse("Texto ausente/invalido"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/contacts/unsubscribe/{token}",
  tags: ["Contacts"],
  summary: "Link publico de descadastro (clicado a partir do email)",
  request: { params: z.object({ token: z.string().uuid() }) },
  responses: {
    200: { description: "Descadastrado com sucesso (HTML)" },
    400: { description: "Token invalido (HTML)" },
    404: { description: "Contato nao encontrado (HTML)" },
  },
});

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/billing/plans",
  tags: ["Billing"],
  summary: "Lista os planos disponiveis",
  responses: {
    200: {
      description: "Planos",
      content: {
        "application/json": {
          schema: z.object({ plans: z.array(z.object({})), trialPeriodDays: z.number() }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/billing/checkout",
  tags: ["Billing"],
  summary: "Cria uma sessao de checkout do Stripe para assinar um plano",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: checkoutSchema } } } },
  responses: {
    201: { description: "URL de checkout", content: { "application/json": { schema: z.object({ url: z.string() }) } } },
    500: errorResponse("Plano ainda nao configurado no Stripe"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/billing/subscription",
  tags: ["Billing"],
  summary: "Assinatura atual do usuario autenticado (null se nunca assinou)",
  security: bearerAuth,
  responses: {
    200: {
      description: "Assinatura atual",
      content: {
        "application/json": {
          schema: z.object({
            subscription: z.object({}).nullable(),
            planCredits: z.number(),
            creditsUsedThisCycle: z.number(),
          }),
        },
      },
    },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "get",
  path: "/api/billing/invoices",
  tags: ["Billing"],
  summary: "Historico de faturas do usuario (buscado direto do Stripe)",
  security: bearerAuth,
  responses: {
    200: { description: "Faturas", content: { "application/json": { schema: z.object({ invoices: z.array(z.object({})) }) } } },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/billing/cancel",
  tags: ["Billing"],
  summary: "Cancela a assinatura ao final do periodo ja pago",
  security: bearerAuth,
  responses: {
    200: {
      description: "Assinatura marcada para cancelar",
      content: {
        "application/json": {
          schema: z.object({ cancelAtPeriodEnd: z.boolean(), currentPeriodEnd: z.string().nullable() }),
        },
      },
    },
    401: errorResponse("Nao autenticado"),
    404: errorResponse("Nenhuma assinatura ativa para cancelar"),
  },
});

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/workspace/overview",
  tags: ["Workspace"],
  summary: "Resumo da conta: creditos, newsletters por status, contacts, recentes",
  security: bearerAuth,
  responses: {
    200: {
      description: "Resumo da conta",
      content: {
        "application/json": {
          schema: z.object({
            creditBalance: z.number(),
            newslettersByStatus: z.object({}),
            subscribedContacts: z.number(),
            recentNewsletters: z.array(z.object({})),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/workspace/ai-suggestions",
  tags: ["Workspace"],
  summary: "Sugestoes de temas de newsletter via IA, baseadas no historico do usuario",
  security: bearerAuth,
  responses: {
    200: { description: "Lista de sugestoes", content: { "application/json": { schema: z.object({ suggestions: z.array(z.string()) }) } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/workspace/generate",
  tags: ["Workspace"],
  summary: "Atalho: cria a newsletter e ja dispara a geracao num passo so",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: workspaceGenerateSchema } } } },
  responses: {
    202: { description: "Geracao enfileirada", content: { "application/json": { schema: z.object({ newsletter: z.object({}), creditBalance: z.number() }) } } },
    400: errorResponse("Sem creditos suficientes"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/workspace/rewrite",
  tags: ["Workspace"],
  summary: "Reescreve um texto via IA (debita credito)",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: workspaceTextActionSchema } } } },
  responses: {
    200: { description: "Texto reescrito", content: { "application/json": { schema: z.object({ result: z.string(), creditBalance: z.number() }) } } },
    402: errorResponse("Sem creditos suficientes"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/workspace/summarize",
  tags: ["Workspace"],
  summary: "Resume um texto/blog em formato de newsletter via IA (debita credito)",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: workspaceTextActionSchema } } } },
  responses: {
    200: { description: "Resumo gerado", content: { "application/json": { schema: z.object({ result: z.string(), creditBalance: z.number() }) } } },
    402: errorResponse("Sem creditos suficientes"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/workspace/subject-lines",
  tags: ["Workspace"],
  summary: "Gera sugestoes de assunto de email via IA (debita credito)",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: workspaceTextActionSchema } } } },
  responses: {
    200: { description: "Sugestoes geradas", content: { "application/json": { schema: z.object({ suggestions: z.array(z.string()), creditBalance: z.number() }) } } },
    402: errorResponse("Sem creditos suficientes"),
  },
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/templates",
  tags: ["Templates"],
  summary: "Lista os templates salvos do usuario",
  security: bearerAuth,
  responses: { 200: { description: "Lista de templates", content: { "application/json": { schema: z.object({ templates: z.array(z.object({})) }) } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/templates",
  tags: ["Templates"],
  summary: "Cria um template manualmente",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: createTemplateSchema } } } },
  responses: { 201: { description: "Template criado", content: { "application/json": { schema: z.object({ template: z.object({}) }) } } } },
});

registry.registerPath({
  method: "post",
  path: "/api/templates/generate",
  tags: ["Templates"],
  summary: "Gera um template via IA a partir de nome e descricao",
  security: bearerAuth,
  request: { body: { content: { "application/json": { schema: generateTemplateSchema } } } },
  responses: { 201: { description: "Template gerado", content: { "application/json": { schema: z.object({ template: z.object({}) }) } } } },
});

registry.registerPath({
  method: "delete",
  path: "/api/templates/{id}",
  tags: ["Templates"],
  summary: "Remove um template",
  security: bearerAuth,
  responses: {
    204: { description: "Template removido" },
    404: errorResponse("Template nao encontrado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/templates/{id}/use",
  tags: ["Templates"],
  summary: "Cria uma newsletter (status ready) a partir do conteudo de um template",
  security: bearerAuth,
  request: { params: uuidParam },
  responses: {
    201: { description: "Newsletter criada a partir do template", content: { "application/json": { schema: z.object({ newsletter: z.object({}) }) } } },
    404: errorResponse("Template nao encontrado"),
  },
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "post",
  path: "/api/uploads/image",
  tags: ["Uploads"],
  summary: "Envia uma imagem generica (multipart/form-data, campo 'image') e retorna a URL publica",
  security: bearerAuth,
  responses: {
    201: { description: "Imagem enviada", content: { "application/json": { schema: z.object({ url: z.string() }) } } },
    400: errorResponse("Arquivo ausente ou formato invalido"),
    401: errorResponse("Nao autenticado"),
  },
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

registry.registerPath({
  method: "get",
  path: "/api/notifications",
  tags: ["Notifications"],
  summary: "Lista as ultimas notificacoes do usuario e se o lembrete de confirmar email esta pendente",
  security: bearerAuth,
  responses: {
    200: {
      description: "Notificacoes",
      content: {
        "application/json": {
          schema: z.object({ notifications: z.array(z.object({})), emailVerificationPending: z.boolean() }),
        },
      },
    },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Marca uma notificacao como lida",
  security: bearerAuth,
  request: { params: uuidParam },
  responses: {
    204: { description: "Marcada como lida" },
    401: errorResponse("Nao autenticado"),
  },
});

registry.registerPath({
  method: "post",
  path: "/api/notifications/read-all",
  tags: ["Notifications"],
  summary: "Marca todas as notificacoes do usuario como lidas",
  security: bearerAuth,
  responses: {
    204: { description: "Todas marcadas como lidas" },
    401: errorResponse("Nao autenticado"),
  },
});
