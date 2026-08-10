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
