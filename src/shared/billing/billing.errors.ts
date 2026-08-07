export class InsufficientCreditsError extends Error {
  statusCode = 402;

  constructor(message = "Insufficient credits.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}
