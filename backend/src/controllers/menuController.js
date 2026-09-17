import * as menuModel from '../models/menuModel.js';

// ---------------------------------------------------------------------
// GET /restaurants/:restaurantId/menus
// ---------------------------------------------------------------------
export async function listMenus(req, res) {
  // active_only defaults to true (?active_only=false to see everything,
  // e.g. for a future admin view) — the common case for a guest-facing
  // menu list is "what can I actually order right now."
  const activeOnly = req.query.active_only !== 'false';

  try {
    const menus = await menuModel.findMenusByRestaurant(req.params.restaurantId, { activeOnly });
    res.json({ data: menus });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } });
    }
    console.error('GET /restaurants/:restaurantId/menus: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list menus' } });
  }
}

// ---------------------------------------------------------------------
// GET /meals/:id — meal details, with ingredients and addons.
//
// Three independent model calls run in parallel (Promise.all), not
// three sequential round-trips — the meal, its ingredients, and its
// addons don't depend on each other's results, so there's no reason to
// make the guest's request wait for them one after another. This is
// different from the N+1 concern in menuModel.js: three queries for ONE
// meal isn't N+1 (that's about one query PER ROW in a list), it's just
// "don't serialize independent work."
// ---------------------------------------------------------------------
export async function getMeal(req, res) {
  const { id } = req.params;

  try {
    const [meal, ingredients, addons] = await Promise.all([
      menuModel.findMealById(id),
      menuModel.findIngredientsByMealId(id),
      menuModel.findAddonsByMealId(id),
    ]);

    if (!meal) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }

    res.json({ ...meal, ingredients, addons });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }
    console.error('GET /meals/:id: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load meal' } });
  }
}

// ---------------------------------------------------------------------
// GET /meals/:id/ingredients — the same ingredient join as above, on its
// own. Genuinely redundant with the embedded list in getMeal() for a
// client that already fetched that — kept as its own endpoint because
// it was asked for directly, and it's a real, lighter-weight fetch for
// a UI that only needs an allergen/ingredient check without the rest of
// the meal payload.
// ---------------------------------------------------------------------
export async function getIngredients(req, res) {
  try {
    // Confirm the meal exists first — otherwise a bad :id and a real
    // meal with zero ingredients both just return `{ "data": [] }`,
    // which hides a genuine 404 as if it were a valid empty result.
    const exists = await menuModel.mealExists(req.params.id);
    if (!exists) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }

    const ingredients = await menuModel.findIngredientsByMealId(req.params.id);
    res.json({ data: ingredients });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }
    console.error('GET /meals/:id/ingredients: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load ingredients' } });
  }
}
