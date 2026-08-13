export class InsufficientCreditsError extends Error {
  statusCode = 402;

  constructor(message = "Insufficient credits.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

export class SubscriptionNotFoundError extends Error {
  statusCode = 404;

  constructor(message = "No active subscription to cancel.") {
    super(message);
    this.name = "SubscriptionNotFoundError";
  }
}
