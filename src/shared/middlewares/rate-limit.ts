import rateLimit from "express-rate-limit";

const tooManyRequests = {
  statusCode: 429,
  error: "Too many requests",
  message: "Too many requests. Try again later.",
};

// General safety net for the whole API. Generous because a single page of
// the app fires several calls at once (session check, newsletters, billing
// plans...) and the newsletter editor polls every 2s while generating.
export function apiRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: tooManyRequests,
  });
}

// Tight limit for credential-guessing-prone endpoints (login, register,
// change-password) where brute-force actually matters.
export function authRateLimit() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ipv6Subnet: 56,
    message: tooManyRequests,
  });
}
