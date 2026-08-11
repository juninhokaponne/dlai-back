import { render } from "@react-email/render";
import { ResendEmailProvider } from "./resend.provider.js";
import { PasswordResetEmail } from "./templates/password-reset-email.js";
import { PasswordChangedEmail } from "./templates/password-changed-email.js";
import { PASSWORD_RESET_EMAIL_COPY, PASSWORD_CHANGED_EMAIL_COPY, type EmailLocale } from "./templates/copy.js";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("send-password-emails");
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

export async function sendPasswordResetEmail(params: { email: string; locale: EmailLocale; resetToken: string }) {
  const { email, locale, resetToken } = params;
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
  const copy = PASSWORD_RESET_EMAIL_COPY[locale];

  try {
    const html = await render(PasswordResetEmail({ locale, resetUrl }));
    const provider = new ResendEmailProvider();
    await provider.send({ to: email, subject: copy.subject, html });
  } catch (err) {
    logger.error({ err, email }, "Failed to send password reset email");
  }
}

export async function sendPasswordChangedEmail(params: { email: string; locale: EmailLocale }) {
  const { email, locale } = params;
  const copy = PASSWORD_CHANGED_EMAIL_COPY[locale];

  try {
    const html = await render(PasswordChangedEmail({ locale }));
    const provider = new ResendEmailProvider();
    await provider.send({ to: email, subject: copy.subject, html });
  } catch (err) {
    logger.error({ err, email }, "Failed to send password changed email");
  }
}
