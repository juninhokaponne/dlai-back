export type EmailLocale = "en" | "pt" | "es";

type WelcomeEmailCopy = {
  bodyIntro: string;
  bodyOutro: string;
  cta: string;
  footer: string;
  heading: string;
  preview: string;
  subject: string;
};

export const WELCOME_EMAIL_COPY: Record<EmailLocale, WelcomeEmailCopy> = {
  en: {
    bodyIntro:
      "You're all set to start generating newsletters with AI. Before you can send to real subscribers, just confirm your email address.",
    bodyOutro:
      "You can already explore the app and generate draft newsletters right away — confirming your email only unlocks sending to your subscribers.",
    cta: "Confirm my email",
    footer: "If you didn't create this account, you can safely ignore this email.",
    heading: "Welcome to LetterGo AI, {name}!",
    preview: "Confirm your email to start sending newsletters.",
    subject: "Welcome to LetterGo AI — confirm your email",
  },
  es: {
    bodyIntro:
      "Ya está todo listo para empezar a generar newsletters con IA. Antes de poder enviar a suscriptores reales, solo falta confirmar tu correo.",
    bodyOutro:
      "Ya puedes explorar la app y generar borradores de newsletters — confirmar tu correo solo habilita el envío a tus suscriptores.",
    cta: "Confirmar mi correo",
    footer: "Si no creaste esta cuenta, puedes ignorar este correo con tranquilidad.",
    heading: "¡Bienvenido a LetterGo AI, {name}!",
    preview: "Confirma tu correo para empezar a enviar newsletters.",
    subject: "Bienvenido a LetterGo AI — confirma tu correo",
  },
  pt: {
    bodyIntro:
      "Está tudo pronto pra você começar a gerar newsletters com IA. Antes de conseguir enviar pra assinantes de verdade, só falta confirmar seu email.",
    bodyOutro:
      "Você já pode explorar o app e gerar rascunhos de newsletter agora mesmo — confirmar o email só libera o envio pros seus assinantes.",
    cta: "Confirmar meu email",
    footer: "Se você não criou esta conta, pode ignorar este email com tranquilidade.",
    heading: "Bem-vindo à LetterGo AI, {name}!",
    preview: "Confirme seu email para começar a enviar newsletters.",
    subject: "Bem-vindo à LetterGo AI — confirme seu email",
  },
};

type PasswordResetEmailCopy = {
  body: string;
  cta: string;
  footer: string;
  heading: string;
  preview: string;
  subject: string;
};

export const PASSWORD_RESET_EMAIL_COPY: Record<EmailLocale, PasswordResetEmailCopy> = {
  en: {
    body: "We received a request to reset your LetterGo AI password. Click the button below to choose a new one. This link expires in 1 hour.",
    cta: "Reset my password",
    footer: "If you didn't request this, you can safely ignore this email — your password won't change.",
    heading: "Reset your password",
    preview: "Reset your LetterGo AI password.",
    subject: "Reset your LetterGo AI password",
  },
  es: {
    body: "Recibimos una solicitud para restablecer tu contraseña de LetterGo AI. Haz clic en el botón de abajo para elegir una nueva. Este enlace vence en 1 hora.",
    cta: "Restablecer mi contraseña",
    footer: "Si no solicitaste esto, puedes ignorar este correo con tranquilidad — tu contraseña no cambiará.",
    heading: "Restablece tu contraseña",
    preview: "Restablece tu contraseña de LetterGo AI.",
    subject: "Restablece tu contraseña de LetterGo AI",
  },
  pt: {
    body: "Recebemos um pedido pra redefinir sua senha da LetterGo AI. Clique no botão abaixo pra escolher uma nova. Esse link expira em 1 hora.",
    cta: "Redefinir minha senha",
    footer: "Se você não pediu isso, pode ignorar este email com tranquilidade — sua senha não vai mudar.",
    heading: "Redefina sua senha",
    preview: "Redefina sua senha da LetterGo AI.",
    subject: "Redefina sua senha da LetterGo AI",
  },
};

type PasswordChangedEmailCopy = {
  body: string;
  footer: string;
  heading: string;
  preview: string;
  subject: string;
};

export const PASSWORD_CHANGED_EMAIL_COPY: Record<EmailLocale, PasswordChangedEmailCopy> = {
  en: {
    body: "Your LetterGo AI password was just changed. You've been signed out everywhere and will need to sign in again with your new password.",
    footer: "If this wasn't you, reset your password again immediately using the link on the sign-in page.",
    heading: "Your password was changed",
    preview: "Your LetterGo AI password was changed.",
    subject: "Your LetterGo AI password was changed",
  },
  es: {
    body: "Tu contraseña de LetterGo AI acaba de cambiar. Se cerró tu sesión en todos los dispositivos y necesitarás iniciar sesión de nuevo con la nueva contraseña.",
    footer: "Si no fuiste tú, restablece tu contraseña de nuevo de inmediato usando el enlace en la página de inicio de sesión.",
    heading: "Tu contraseña fue cambiada",
    preview: "Tu contraseña de LetterGo AI fue cambiada.",
    subject: "Tu contraseña de LetterGo AI fue cambiada",
  },
  pt: {
    body: "Sua senha da LetterGo AI acabou de ser alterada. Sua sessão foi encerrada em todos os lugares e você vai precisar entrar de novo com a nova senha.",
    footer: "Se não foi você, redefina sua senha de novo imediatamente usando o link na página de login.",
    heading: "Sua senha foi alterada",
    preview: "Sua senha da LetterGo AI foi alterada.",
    subject: "Sua senha da LetterGo AI foi alterada",
  },
};
