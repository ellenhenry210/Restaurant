import rateLimit from 'express-rate-limit';

// Shared response body for both limiters, matching the error shape used
// elsewhere in the API (see SNAPORDER_API_CONTRACTS.md "Errors").
function rateLimitedResponse(message) {
  return {
    error: {
      code: 'RATE_LIMITED',
      message,
    },
  };
}

/**
 * General-purpose limiter, meant to be applied to the whole API. Generous
 * enough for normal guest browsing/ordering traffic (menu views, cart
 * updates, order status polling) from a single IP, while still bounding
 * scripted/abusive traffic. Not applied to /health, since monitoring/
 * orchestration tools poll that frequently and it does no meaningful work.
 *
 * Rate-limit state is kept in memory (the express-rate-limit default
 * store). That's fine for a single backend instance; if this ever runs as
 * multiple instances behind a load balancer, it needs a shared store
 * (e.g. Redis, which is already a project dependency) so limits are
 * enforced across instances rather than per-instance.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per window per IP
  standardHeaders: 'draft-7', // adds RateLimit-Limit / RateLimit-Remaining / RateLimit-Policy headers
  legacyHeaders: false, // skip the older X-RateLimit-* headers — draft-7 supersedes them
  skip: (req) => req.path === '/health',
  message: rateLimitedResponse('Too many requests. Please try again later.'),
});

/**
 * Stricter limiter for authentication endpoints (login, register, password
 * reset once it exists) — the classic brute-force / credential-stuffing
 * target, so it gets a much tighter budget than general API traffic.
 *
 * Not wired into any route yet: there is no /auth/* route in index.js
 * yet. Apply this in addition to (not instead of) generalLimiter as soon
 * as auth routes are added, e.g.:
 *   app.use('/v1/auth', authLimiter, authRouter);
 *
 * skipSuccessfulRequests means only failed attempts count against the
 * limit, so a legitimate user's own successful logins never lock them out
 * — only repeated failures (guessing/stuffing) do.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 failed attempts per window per IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: rateLimitedResponse('Too many authentication attempts. Please try again later.'),
});
