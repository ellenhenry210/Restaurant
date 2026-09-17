import { Router } from 'express';
import crypto from 'node:crypto';

import { pool } from '../db.js';
import { generateGuestToken } from '../auth.js';
import { authenticateGuest } from '../middleware/authGuest.js';
import { distanceMeters } from '../geo.js';

const router = Router();

function validateScanInput(body) {
  const errors = [];
  if (typeof body.latitude !== 'number' || Number.isNaN(body.latitude) || body.latitude < -90 || body.latitude > 90) {
    errors.push({ field: 'latitude', reason: 'must be a number between -90 and 90' });
  }
  if (typeof body.longitude !== 'number' || Number.isNaN(body.longitude) || body.longitude < -180 || body.longitude > 180) {
    errors.push({ field: 'longitude', reason: 'must be a number between -180 and 180' });
  }
  return errors;
}

// ---------------------------------------------------------------------
// POST /tables/:qrCodeId/scan — the entry point of the entire guest
// experience: scanning the physical QR code on a table. Deliberately not
// behind authenticate()/authorize() — there's no identity yet at this
// point, that's exactly what this route creates. The gate here is
// proximity, not a role.
// ---------------------------------------------------------------------
router.post('/tables/:qrCodeId/scan', async (req, res) => {
  const errors = validateScanInput(req.body ?? {});
  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'One or more fields are invalid', details: errors },
    });
  }

  const { latitude, longitude } = req.body;
  const { qrCodeId } = req.params;

  try {
    const tableResult = await pool.query(
      `SELECT t.id AS table_id, t.restaurant_id, t.is_active AS table_active,
              r.name AS restaurant_name, r.latitude AS restaurant_lat,
              r.longitude AS restaurant_lon, r.max_guest_distance_meters
       FROM tables t
       JOIN restaurants r ON r.id = t.restaurant_id
       WHERE t.qr_code_unique_id = $1`,
      [qrCodeId]
    );
    const table = tableResult.rows[0];

    if (!table) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Table not found' } });
    }
    if (!table.table_active) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This table is not currently active' } });
    }

    // Fail closed: a restaurant that hasn't set its location yet can't
    // be proximity-checked at all, so guest ordering can't be safely
    // allowed there — this is a restaurant setup gap to fix (set
    // latitude/longitude), not something a guest can do anything about.
    if (table.restaurant_lat === null || table.restaurant_lon === null) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'This restaurant has not configured its location yet — guest ordering is unavailable until it does',
        },
      });
    }

    const distance = distanceMeters(
      { latitude, longitude },
      { latitude: Number(table.restaurant_lat), longitude: Number(table.restaurant_lon) }
    );

    if (distance > table.max_guest_distance_meters) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `You need to be at ${table.restaurant_name} to order here — you appear to be about ${Math.round(distance)}m away (max ${table.max_guest_distance_meters}m).`,
        },
      });
    }

    // Within range. Generate the session id ourselves (rather than
    // letting Postgres's gen_random_uuid() default assign one) so we
    // have it before the row exists, to embed in the token — then decode
    // the token's own exp back out, so guest_sessions.expires_at and the
    // JWT's expiry can never drift apart by re-deriving the same "4h"
    // duration two different ways.
    const sessionId = crypto.randomUUID();
    const token = generateGuestToken(sessionId, {
      tableId: table.table_id,
      restaurantId: table.restaurant_id,
    });
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf-8'));
    const expiresAt = new Date(exp * 1000);

    await pool.query(
      `INSERT INTO guest_sessions (id, table_id, restaurant_id, scan_latitude, scan_longitude, distance_meters, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, table.table_id, table.restaurant_id, latitude, longitude, distance, expiresAt]
    );

    res.status(201).json({
      session_token: token,
      expires_at: expiresAt.toISOString(),
      restaurant: { id: table.restaurant_id, name: table.restaurant_name },
      distance_meters: Math.round(distance * 10) / 10,
    });
  } catch (err) {
    console.error('POST /tables/:qrCodeId/scan: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to start guest session' } });
  }
});

// ---------------------------------------------------------------------
// GET /guest/session — "who is this guest session" (the authenticateGuest
// counterpart to GET /v1/me), and the working proof that it functions:
// no session, expired session, or a staff token all get rejected; a
// live one from the scan above succeeds.
// ---------------------------------------------------------------------
router.get('/guest/session', authenticateGuest, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.name AS restaurant_name, t.table_number
       FROM guest_sessions gs
       JOIN restaurants r ON r.id = gs.restaurant_id
       JOIN tables t ON t.id = gs.table_id
       WHERE gs.id = $1`,
      [req.guestSession.id]
    );
    res.json({ session: req.guestSession, ...result.rows[0] });
  } catch (err) {
    console.error('GET /guest/session: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load session' } });
  }
});

export default router;
