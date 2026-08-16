import { render } from "@react-email/render";
import { ResendEmailProvider } from "./resend.provider.js";
import { OrganizationInviteEmail } from "./templates/organization-invite-email.js";
import { ORGANIZATION_INVITE_EMAIL_COPY, type EmailLocale } from "./templates/copy.js";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("send-organization-invite-email");
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

export async function sendOrganizationInviteEmail(params: {
  email: string;
  locale: EmailLocale;
  organizationName: string;
  inviteToken: string;
}) {
  const { email, locale, organizationName, inviteToken } = params;
  const acceptUrl = `${FRONTEND_URL}/accept-invite?token=${inviteToken}`;
  const copy = ORGANIZATION_INVITE_EMAIL_COPY[locale];

  try {
    const html = await render(OrganizationInviteEmail({ locale, organizationName, acceptUrl }));
    const provider = new ResendEmailProvider();
    await provider.send({ to: email, subject: copy.subject.replace("{organizationName}", organizationName), html });
  } catch (err) {
    logger.error({ err, email }, "Failed to send organization invite email");
  }
}
