// Scaffolding, not yet wired in — see routes/restaurants.js for the
// actual, currently-running implementation of everything below.
//
// This project uses a flat pattern today (routes query the database
// directly, no separate model/controller layers) — a deliberate,
// explicit decision, not an oversight. See SNAPORDER_AUTHORIZATION.md-
// adjacent project memory for the reasoning. These files exist so a
// future migration to a layered structure has somewhere to land
// *when there's an actual reason to* (the same query needed from a
// second entry point — a background job, a CLI script — or a route
// file that's grown hard to read) — not because that need exists yet.
//
// Intentionally NOT implemented: filling these in with real query logic
// while routes/restaurants.js keeps its own copy would create two
// independent implementations of the same behavior that could silently
// drift apart (fix a bug in one, forget the other). When this actually
// gets used, the real move is to CUT the query logic out of
// routes/restaurants.js and paste it here, then have the route call
// this module — not maintain both at once.

// import { pool } from '../db.js'; — uncomment when implementing

/**
 * List active restaurants, paginated.
 * Mirrors routes/restaurants.js `GET /` — see that file for the live
 * version (public-safe column list, total count, etc).
 *
 * @param {{ page: number, perPage: number }} params
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function findActive({ page, perPage }) {
  throw new Error('restaurantModel.findActive: not implemented — see routes/restaurants.js for the live version');
}

/**
 * Fetch a single restaurant by id.
 * Mirrors routes/restaurants.js `GET /:id`.
 *
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function findById(id) {
  throw new Error('restaurantModel.findById: not implemented — see routes/restaurants.js for the live version');
}
