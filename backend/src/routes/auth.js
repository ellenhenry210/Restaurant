import { Router } from 'express';
import bcrypt from 'bcryptjs';

import { pool } from '../db.js';
import { generateToken } from '../auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_SALT_ROUNDS = 12;

// ---------------------------------------------------------------------
// Validation — hand-rolled rather than pulling in a library (zod/joi):
// two endpoints with a handful of fields each doesn't justify a new
// dependency yet. Revisit this if/when more routes need real validation.
// ---------------------------------------------------------------------

function validateRegisterInput(body) {
  const errors = [];
  if (!body.restaurant_name || typeof body.restaurant_name !== 'string') {
    errors.push({ field: 'restaurant_name', reason: 'required' });
  }
  if (!body.owner_name || typeof body.owner_name !== 'string') {
    errors.push({ field: 'owner_name', reason: 'required' });
  }
  if (!body.email || typeof body.email !== 'string' || !EMAIL_RE.test(body.email)) {
    errors.push({ field: 'email', reason: 'must be a valid email address' });
  }
  if (!body.password || typeof body.password !== 'string' || body.password.length < MIN_PASSWORD_LENGTH) {
    errors.push({ field: 'password', reason: `must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  return errors;
}

function validateLoginInput(body) {
  const errors = [];
  if (!body.email || typeof body.email !== 'string') {
    errors.push({ field: 'email', reason: 'required' });
  }
  if (!body.password || typeof body.password !== 'string') {
    errors.push({ field: 'password', reason: 'required' });
  }
  return errors;
}

function invalidRequest(res, errors) {
  return res.status(400).json({
    error: {
      code: 'INVALID_REQUEST',
      message: 'One or more fields are invalid',
      details: errors,
    },
  });
}

// ---------------------------------------------------------------------
// POST /register — onboard a brand-new restaurant, its first (Owner)
// user account, and the users<->restaurant_staff link between them, all
// in one request. This matches the existing documented contract
// ("Register a new restaurant") rather than a generic account-creation
// endpoint — SnapOrder's guests never register (they're identified by
// phone number only; see guest_profiles), so the only thing to register
// is a restaurant and its first staff account.
//
// owner_name is a field this route needs that the original API contract
// doc didn't list (it only had restaurant-level fields) — restaurant_
// staff.name is NOT NULL and there's no sensible default for a person's
// name, so it's a required addition here. SNAPORDER_API_CONTRACTS.md has
// been updated to match.
// ---------------------------------------------------------------------
router.post('/register', async (req, res) => {
  const errors = validateRegisterInput(req.body ?? {});
  if (errors.length > 0) {
    return invalidRequest(res, errors);
  }

  const { restaurant_name, owner_name, email, password, phone, address, registration_number } = req.body;

  let passwordHash;
  try {
    // Async hash, not hashSync: bcrypt is deliberately CPU-expensive (that's
    // what makes it resistant to brute-forcing), and the sync variant would
    // block Node's single event loop thread for that whole time — freezing
    // every other in-flight request on this server for ~100ms+ per hash.
    passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  } catch (err) {
    console.error('register: password hashing failed:', err.message);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process request' } });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const restaurantResult = await client.query(
      `INSERT INTO restaurants (name, email, phone, address, registration_number)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, created_at`,
      [restaurant_name, email, phone ?? null, address ?? null, registration_number ?? null]
    );
    const restaurant = restaurantResult.rows[0];

    const userResult = await client.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
      [email, passwordHash]
    );
    const userId = userResult.rows[0].id;

    await client.query(
      `INSERT INTO restaurant_staff (restaurant_id, user_id, name, role)
       VALUES ($1, $2, $3, 'owner')`,
      [restaurant.id, userId, owner_name]
    );

    await client.query('COMMIT');

    res.status(201).json({
      id: restaurant.id,
      name: restaurant.name,
      email: restaurant.email,
      status: 'active',
      created_at: restaurant.created_at,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    // Postgres unique_violation — either email is already a restaurant's
    // contact email or already a user's login email. Either way, from
    // the caller's perspective it's the same problem: that email is taken.
    if (err.code === '23505') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'An account with this email already exists' },
      });
    }

    console.error('register: transaction failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create account' } });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const errors = validateLoginInput(req.body ?? {});
  if (errors.length > 0) {
    return invalidRequest(res, errors);
  }

  const { email, password } = req.body;

  // Single generic message for "no such user" AND "wrong password" —
  // distinguishing them in the response would let an attacker enumerate
  // which emails have accounts at all, just by watching which error they
  // get back.
  const invalidCredentials = () =>
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } });

  try {
    const userResult = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];
    if (!user) {
      return invalidCredentials();
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return invalidCredentials();
    }

    // A user can have staff rows at more than one restaurant (see
    // init-db.js for why). For now we just take the first one — there's
    // no "pick which restaurant to log into" flow yet. Flagged as a real
    // simplification to revisit once that's actually needed, not an
    // oversight: right now every user in practice has exactly one.
    const staffResult = await pool.query(
      `SELECT rs.id, rs.restaurant_id, rs.name, rs.role
       FROM restaurant_staff rs
       WHERE rs.user_id = $1 AND rs.is_active = TRUE
       ORDER BY rs.created_at ASC
       LIMIT 1`,
      [user.id]
    );
    const staff = staffResult.rows[0];
    if (!staff) {
      // A user with no (active) restaurant role can authenticate as an
      // identity but has nothing to do here — e.g. deactivated everywhere.
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'This account has no active restaurant role' },
      });
    }

    // Deliberately minimal payload — just the user id. The token proves
    // identity; restaurant_id/role are NOT embedded in it, so a role
    // change or deactivation takes effect on the very next request
    // instead of only after the token expires. See
    // SNAPORDER_AUTHORIZATION.md Part 0 and middleware/auth.js.
    const accessToken = generateToken(user.id);

    // expires_in is derived from the token actually issued (via
    // JWT_EXPIRY, e.g. "6h") rather than hardcoded, so it can never
    // drift out of sync with the real expiry.
    const decoded = Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf-8');
    const { iat, exp } = JSON.parse(decoded);

    res.status(200).json({
      access_token: accessToken,
      // No refresh_token yet — refresh-token issuance/rotation isn't
      // implemented (tracked separately; see known gaps). Omitted rather
      // than faked, since a fake token here would be actively misleading.
      expires_in: exp - iat,
      user: {
        id: user.id,
        name: staff.name,
        email: user.email,
        role: staff.role,
        restaurant_id: staff.restaurant_id,
      },
    });
  } catch (err) {
    console.error('login: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to process login' } });
  }
});

export default router;
