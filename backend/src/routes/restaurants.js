import { Router } from 'express';

import { pool } from '../db.js';

const router = Router();

// Fields safe to expose publicly — deliberately NOT `SELECT *`. Excludes
// email, registration_number, tax_id, subscription_start_date/
// subscription_end_date, max_guest_distance_meters (internal proximity
// config) — none of that belongs in a public listing, even though the
// route itself is unauthenticated.
const PUBLIC_COLUMNS = `
  id, name, description, address, city, state, country,
  logo_url, primary_color, secondary_color,
  latitude, longitude, opening_hours,
  created_at
`;

// ---------------------------------------------------------------------
// GET /restaurants — list active restaurants. Public: no authenticate/
// authorize here, same reasoning as menus.js — this is a directory/
// discovery view, not restaurant-internal data.
// ---------------------------------------------------------------------
router.get('/', async (req, res) => {
  // Basic pagination — an unbounded "return every restaurant" query
  // gets worse (and slower) as the platform grows; bounding it from day
  // one avoids a query that's fine at 20 restaurants and a real problem
  // at 20,000.
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = Math.min(50, Math.max(1, parseInt(req.query.per_page, 10) || 20));
  const offset = (page - 1) * perPage;

  try {
    const [rowsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${PUBLIC_COLUMNS}
         FROM restaurants
         WHERE is_active = TRUE
         ORDER BY created_at ASC
         LIMIT $1 OFFSET $2`,
        [perPage, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM restaurants WHERE is_active = TRUE`),
    ]);

    res.json({
      data: rowsResult.rows,
      pagination: {
        total: Number(countResult.rows[0].count),
        page,
        per_page: perPage,
      },
    });
  } catch (err) {
    console.error('GET /restaurants: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list restaurants' } });
  }
});

// ---------------------------------------------------------------------
// GET /restaurants/:id — single restaurant. Same public field set.
// Returns inactive restaurants too (an inactive one isn't "not found",
// it's "temporarily unavailable" — a client can tell the difference
// from is_active in the response and show an appropriate message,
// rather than getting an indistinguishable 404).
// ---------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${PUBLIC_COLUMNS}, is_active FROM restaurants WHERE id = $1`,
      [req.params.id]
    );
    const restaurant = result.rows[0];

    if (!restaurant) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } });
    }

    res.json(restaurant);
  } catch (err) {
    // A malformed (non-UUID) :id makes Postgres itself throw, not just
    // return zero rows — treat that as "not found" too rather than a
    // 500, since from the caller's perspective a garbage id and a
    // nonexistent one both just mean "no such restaurant."
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } });
    }
    console.error('GET /restaurants/:id: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load restaurant' } });
  }
});

export default router;
