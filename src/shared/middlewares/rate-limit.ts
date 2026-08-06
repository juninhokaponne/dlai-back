import rateLimit from "express-rate-limit";

export function ratelimit() {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: {
      statusCode: 429,
      error: "To many requests",
      message: "To many requests. Try again later.",
    },
  });

  return limiter;
}
