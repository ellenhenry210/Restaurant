// Scaffolding, not yet wired in — see routes/menus.js for the actual,
// currently-running handlers. Same reasoning as models/menuModel.js.

// import * as menuModel from '../models/menuModel.js';

/**
 * GET /restaurants/:restaurantId/menus — mirrors routes/menus.js.
 */
export async function listMenus(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/menus.js' } });
}

/**
 * GET /meals/:id — mirrors routes/menus.js.
 */
export async function getMeal(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/menus.js' } });
}

/**
 * GET /meals/:id/ingredients — mirrors routes/menus.js.
 */
export async function getIngredients(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/menus.js' } });
}
