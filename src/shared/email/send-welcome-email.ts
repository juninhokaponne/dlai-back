import { render } from "@react-email/render";
import { ResendEmailProvider } from "./resend.provider.js";
import { WelcomeVerifyEmail } from "./templates/welcome-verify-email.js";
import { WELCOME_EMAIL_COPY, type EmailLocale } from "./templates/copy.js";
import { createLogger } from "../logger/logger.js";

const logger = createLogger("send-welcome-email");
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

export async function sendWelcomeVerificationEmail(params: {
  email: string;
  locale: EmailLocale;
  name: string;
  verificationToken: string;
}) {
  const { email, locale, name, verificationToken } = params;
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
  const copy = WELCOME_EMAIL_COPY[locale];

  try {
    const html = await render(WelcomeVerifyEmail({ locale, name, verifyUrl }));
    const provider = new ResendEmailProvider();
    await provider.send({ to: email, subject: copy.subject, html });
  } catch (err) {
    logger.error({ err, email }, "Failed to send welcome/verification email");
  }
}
