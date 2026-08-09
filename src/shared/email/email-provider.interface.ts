export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  id: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
