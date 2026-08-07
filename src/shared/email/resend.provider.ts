import { Resend } from "resend";
import type {
  EmailProvider,
  SendEmailParams,
  SendEmailResult,
} from "./email-provider.interface.js";

const DEFAULT_FROM = "onboarding@resend.dev";

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(
    apiKey: string = process.env.RESEND_API_KEY ?? "",
    from: string = process.env.EMAIL_FROM ?? DEFAULT_FROM,
  ) {
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set.");
    }
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to send email.");
    }

    return { id: data.id };
  }
}
