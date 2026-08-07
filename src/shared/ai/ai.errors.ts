export class AIProviderError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "AIProviderError";
    this.statusCode = statusCode;
  }
}
