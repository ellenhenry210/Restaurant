// Scaffolding, not yet wired in — see routes/restaurants.js for the
// actual, currently-running handlers. Same reasoning as
// models/restaurantModel.js: kept empty rather than a half-copy of the
// live logic, which would drift from it over time.
//
// Intended shape once this IS wired in: a controller function takes
// (req, res), reads whatever it needs off req, calls into
// models/restaurantModel.js for data, and shapes the HTTP response —
// no direct pool/SQL access here, that's the model's job.

// import * as restaurantModel from '../models/restaurantModel.js';

/**
 * GET /restaurants — mirrors routes/restaurants.js `GET /`.
 */
export async function list(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/restaurants.js' } });
}

/**
 * GET /restaurants/:id — mirrors routes/restaurants.js `GET /:id`.
 */
export async function getOne(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/restaurants.js' } });
}
