import { Router } from 'express';

import { pool } from '../db.js';

const router = Router();

// ---------------------------------------------------------------------
// GET /restaurants/:restaurantId/menus
//
// One query, not N+1: categories_count and meals_count are computed via
// LEFT JOIN + COUNT(DISTINCT ...) + GROUP BY, in the same query as the
// menu rows themselves. The tempting-looking alternative — fetch the
// menus, then loop over them running a "how many meals" query per menu
// — is the classic N+1 pattern: fine with 2 menus, a real cost with 20.
// A LEFT JOIN (not INNER) is what makes a menu with zero categories yet
// still show up (with counts of 0) instead of silently disappearing.
// ---------------------------------------------------------------------
router.get('/restaurants/:restaurantId/menus', async (req, res) => {
  // active_only defaults to true (?active_only=false to see everything,
  // e.g. for a future admin view) — the common case for a guest-facing
  // menu list is "what can I actually order right now."
  const activeOnly = req.query.active_only !== 'false';

  try {
    const result = await pool.query(
      `SELECT
         m.id, m.name, m.description, m.is_active, m.active_from, m.active_until,
         COUNT(DISTINCT mc.id) AS categories_count,
         COUNT(DISTINCT meals.id) FILTER (WHERE meals.is_available = TRUE) AS meals_count
       FROM menus m
       LEFT JOIN meal_categories mc ON mc.menu_id = m.id
       LEFT JOIN meals ON meals.category_id = mc.id
       WHERE m.restaurant_id = $1
         AND ($2::boolean IS FALSE OR m.is_active = TRUE)
       GROUP BY m.id
       ORDER BY m.created_at ASC`,
      [req.params.restaurantId, activeOnly]
    );

    res.json({ data: result.rows });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Restaurant not found' } });
    }
    console.error('GET /restaurants/:restaurantId/menus: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list menus' } });
  }
});

// ---------------------------------------------------------------------
// GET /meals/:id — meal details, with ingredients and addons.
//
// Three separate queries run in parallel (Promise.all), not three
// sequential round-trips — the meal, its ingredients, and its addons
// don't depend on each other's results, so there's no reason to make
// the guest's request wait for them one after another. This is
// different from the N+1 concern above: three queries for ONE meal
// isn't N+1 (that's about one query PER ROW in a list), it's just
// "don't serialize independent work."
// ---------------------------------------------------------------------
router.get('/meals/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [mealResult, ingredientsResult, addonsResult] = await Promise.all([
      // JOIN to meal_categories: a meal alone doesn't say what category
      // it's in by name, only category_id — the join resolves that in
      // the same query instead of a second round-trip for "and what's
      // this category called."
      pool.query(
        `SELECT meals.*, mc.name AS category_name
         FROM meals
         JOIN meal_categories mc ON mc.id = meals.category_id
         WHERE meals.id = $1`,
        [id]
      ),
      // JOIN to ingredients: meal_ingredients alone only has
      // ingredient_id + the removal policy — the ingredient's actual
      // name/allergen_type live on the ingredients row itself.
      pool.query(
        `SELECT
           mi.id, i.name, i.allergen_type,
           mi.removal_policy, mi.removal_policy_reason, mi.is_required,
           mi.quantity, mi.unit_of_measure
         FROM meal_ingredients mi
         JOIN ingredients i ON i.id = mi.ingredient_id
         WHERE mi.meal_id = $1
         ORDER BY mi.sort_order ASC`,
        [id]
      ),
      pool.query(
        `SELECT id, name, description, additional_price, max_quantity
         FROM meal_addons
         WHERE meal_id = $1 AND is_available = TRUE
         ORDER BY sort_order ASC`,
        [id]
      ),
    ]);

    const meal = mealResult.rows[0];
    if (!meal) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }

    res.json({ ...meal, ingredients: ingredientsResult.rows, addons: addonsResult.rows });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }
    console.error('GET /meals/:id: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load meal' } });
  }
});

// ---------------------------------------------------------------------
// GET /meals/:id/ingredients — the same ingredient join as above, on
// its own. Genuinely redundant with the embedded list in GET /meals/:id
// for a client that already fetched that — kept as its own endpoint
// because it was asked for directly, and it's a real, lighter-weight
// fetch for a UI that only needs an allergen/ingredient check (e.g. a
// "does this contain nuts" lookup) without the rest of the meal payload.
// ---------------------------------------------------------------------
router.get('/meals/:id/ingredients', async (req, res) => {
  try {
    // Confirm the meal exists first — otherwise a bad :id and a real
    // meal with zero ingredients both just return `{ "data": [] }`,
    // which hides a genuine 404 as if it were a valid empty result.
    const mealResult = await pool.query('SELECT id FROM meals WHERE id = $1', [req.params.id]);
    if (!mealResult.rows[0]) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }

    const result = await pool.query(
      `SELECT
         mi.id, i.name, i.allergen_type,
         mi.removal_policy, mi.removal_policy_reason, mi.is_required,
         mi.quantity, mi.unit_of_measure
       FROM meal_ingredients mi
       JOIN ingredients i ON i.id = mi.ingredient_id
       WHERE mi.meal_id = $1
       ORDER BY mi.sort_order ASC`,
      [req.params.id]
    );

    res.json({ data: result.rows });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Meal not found' } });
    }
    console.error('GET /meals/:id/ingredients: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load ingredients' } });
  }
});

export default router;
