import { pool } from '../db.js';

// Fields safe to expose publicly — deliberately NOT `SELECT *`. Excludes
// email, registration_number, tax_id, subscription_start_date/
// subscription_end_date, max_guest_distance_meters (internal proximity
// config) — none of that belongs in a public listing, even though the
// route it backs is unauthenticated.
export const PUBLIC_COLUMNS = `
  id, name, description, address, city, state, country,
  logo_url, primary_color, secondary_color,
  latitude, longitude, opening_hours,
  created_at
`;

/**
 * List active restaurants, paginated.
 * @param {{ limit: number, offset: number }} params
 * @returns {Promise<object[]>}
 */
export async function findActive({ limit, offset }) {
  const result = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}
     FROM restaurants
     WHERE is_active = TRUE
     ORDER BY created_at ASC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return result.rows;
}

/** Total count of active restaurants — for list() pagination metadata. */
export async function countActive() {
  const result = await pool.query(`SELECT COUNT(*) FROM restaurants WHERE is_active = TRUE`);
  return Number(result.rows[0].count);
}

/**
 * Fetch a single restaurant by id (active or not — an inactive
 * restaurant is a real result, not a "not found").
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  const result = await pool.query(`SELECT ${PUBLIC_COLUMNS}, is_active FROM restaurants WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}
