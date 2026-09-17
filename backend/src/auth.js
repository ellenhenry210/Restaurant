import jwt from 'jsonwebtoken';

// How long a token stays valid after it's issued. Falls back to 6h if the
// env var isn't set, matching .env.example.
const JWT_EXPIRY = process.env.JWT_EXPIRY || '6h';

// Guest sessions get their own, shorter expiry — a typical dining visit,
// not a work shift. Separate from JWT_EXPIRY (staff) so tuning one never
// accidentally changes the other.
const GUEST_SESSION_EXPIRY = process.env.GUEST_SESSION_EXPIRY || '4h';

// Reads the signing secret lazily (called from inside generateToken /
// verifyToken, not at module load time). This matters because of how ESM
// import hoisting works: if this file were imported before dotenv.config()
// runs elsewhere in the app, reading process.env.JWT_SECRET as a top-level
// const would capture `undefined` permanently. Reading it on every call
// instead means it's only ever checked once dotenv has actually had a
// chance to populate process.env.
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // Fail loudly when a token is actually signed/verified rather than
    // silently using `undefined`, which would make every token
    // forgeable/guessable.
    throw new Error(
      'JWT_SECRET is not set. Add it to your .env file (see .env.example).'
    );
  }
  return secret;
}

/**
 * Create a signed JWT for a given user.
 *
 * @param {string|number} userId - The id of the authenticated user. This is
 *   the only claim we embed by default, keeping the token minimal — extra
 *   user data should be looked up server-side from this id, not trusted
 *   from the token itself.
 * @returns {string} A signed JWT string, e.g. "eyJhbGciOi...".
 */
export function generateToken(userId) {
  if (userId === undefined || userId === null) {
    throw new Error('generateToken requires a userId');
  }

  // `sub` (subject) is the standard JWT claim for "who is this token about".
  // Using it instead of a custom field like `userId` keeps the token
  // compatible with generic JWT tooling and middleware.
  const payload = { sub: userId };

  return jwt.sign(payload, getSecret(), {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Create a signed JWT for a guest session — deliberately a distinct
 * function from generateToken(), not an overload of it, so the two
 * identity types (staff vs. guest) can never be confused at a call site.
 * A guest never has a `users` row, so a guest token's `sub` is a
 * guest_sessions.id, not a users.id — `type: 'guest'` in the payload is
 * what lets middleware/authGuest.js (and, just as importantly,
 * middleware/auth.js) tell the two apart and refuse to accept the wrong
 * kind, even though both are structurally just JWTs signed with the same
 * secret. See routes/guestSession.js for how this token is actually
 * issued (gated by proximity to the restaurant, not on request alone).
 *
 * @param {string} guestSessionId - id of the guest_sessions row this
 *   token represents.
 * @param {{ tableId: string, restaurantId: string }} claims - embedded so
 *   downstream checks don't need a DB round-trip just to know which
 *   table/restaurant a guest session belongs to. Unlike staff tokens,
 *   this is intentionally NOT minimal — see the design note in
 *   middleware/authGuest.js for why that's fine here even though
 *   auth.js's own doc comment on generateToken() argues against it for
 *   staff (a guest session's table/restaurant can't change mid-session
 *   the way a staff member's role can).
 * @returns {string} A signed JWT string.
 */
export function generateGuestToken(guestSessionId, { tableId, restaurantId }) {
  if (!guestSessionId || !tableId || !restaurantId) {
    throw new Error('generateGuestToken requires guestSessionId, tableId, and restaurantId');
  }

  const payload = { sub: guestSessionId, type: 'guest', tableId, restaurantId };

  return jwt.sign(payload, getSecret(), {
    expiresIn: GUEST_SESSION_EXPIRY,
  });
}

/**
 * Verify a JWT's signature and expiry, and return its decoded payload.
 *
 * jwt.verify() does two things in one call: it recomputes the signature
 * over the header+payload using JWT_SECRET and checks it matches (proving
 * the token wasn't forged or tampered with), and it checks the `exp` claim
 * against the current time (proving the token hasn't expired).
 *
 * @param {string} token - The JWT to verify, as received from a client
 *   (typically the `Authorization: Bearer <token>` header).
 * @returns {{ sub: string|number, iat: number, exp: number }} The decoded
 *   payload if the token is valid.
 * @throws {jwt.JsonWebTokenError} If the signature is invalid or the token
 *   is malformed.
 * @throws {jwt.TokenExpiredError} If the token's expiry has passed.
 */
export function verifyToken(token) {
  if (!token) {
    throw new Error('verifyToken requires a token');
  }

  // Throws (rather than returning null/false) on any invalid, tampered, or
  // expired token — callers should catch this and respond 401, not treat
  // a caught error as "valid".
  return jwt.verify(token, getSecret());
}
