import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components";
import { PASSWORD_RESET_EMAIL_COPY, type EmailLocale } from "./copy.js";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

type PasswordResetEmailProps = {
  locale: EmailLocale;
  resetUrl: string;
};

export function PasswordResetEmail({ locale, resetUrl }: PasswordResetEmailProps) {
  const copy = PASSWORD_RESET_EMAIL_COPY[locale];

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", margin: 0, padding: "32px 16px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "16px", margin: "0 auto", maxWidth: "480px", padding: "40px 32px" }}>
          <Img alt="LetterGo AI" height={40} src={`${FRONTEND_URL}/logo.png`} width={40} />
          <Heading style={{ color: "#111827", fontSize: "22px", fontWeight: 700, lineHeight: 1.3, margin: "24px 0 16px" }}>
            {copy.heading}
          </Heading>
          <Text style={{ color: "#374151", fontSize: "15px", lineHeight: 1.6, margin: "0 0 24px" }}>
            {copy.body}
          </Text>
          <Button
            href={resetUrl}
            style={{
              backgroundColor: "#2563eb",
              borderRadius: "10px",
              color: "#ffffff",
              display: "inline-block",
              fontSize: "15px",
              fontWeight: 600,
              padding: "12px 28px",
              textDecoration: "none",
            }}
          >
            {copy.cta}
          </Button>
          <Hr style={{ borderColor: "#e5e7eb", margin: "32px 0 16px" }} />
          <Text style={{ color: "#9ca3af", fontSize: "12px", lineHeight: 1.6, margin: 0 }}>
            {copy.footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
