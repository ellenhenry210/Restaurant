// Scaffolding, not yet wired in — see routes/menus.js for the actual,
// currently-running implementation. Same reasoning as
// models/restaurantModel.js: not filled in yet, to avoid two
// independent copies of the same query logic drifting apart.

// import { pool } from '../db.js'; — uncomment when implementing

/**
 * List a restaurant's menus, with categories_count/meals_count.
 * Mirrors routes/menus.js `GET /restaurants/:restaurantId/menus` (the
 * live version's single JOIN + GROUP BY query, avoiding N+1).
 *
 * @param {string} restaurantId
 * @param {{ activeOnly: boolean }} options
 * @returns {Promise<object[]>}
 */
export async function findMenusByRestaurant(restaurantId, { activeOnly }) {
  throw new Error('menuModel.findMenusByRestaurant: not implemented — see routes/menus.js for the live version');
}

/**
 * Fetch one meal, with its category name joined in.
 * Mirrors routes/menus.js `GET /meals/:id`.
 *
 * @param {string} mealId
 * @returns {Promise<object|null>}
 */
export async function findMealById(mealId) {
  throw new Error('menuModel.findMealById: not implemented — see routes/menus.js for the live version');
}

/**
 * Fetch a meal's ingredients, joined with allergen/removal-policy info.
 * Mirrors routes/menus.js `GET /meals/:id/ingredients` — the same query
 * as the ingredients portion of findMealById above, kept separate
 * because the route it backs is deliberately lighter-weight.
 *
 * @param {string} mealId
 * @returns {Promise<object[]>}
 */
export async function findIngredientsByMealId(mealId) {
  throw new Error('menuModel.findIngredientsByMealId: not implemented — see routes/menus.js for the live version');
}

/**
 * Fetch a meal's addons.
 * Mirrors the addons portion of routes/menus.js `GET /meals/:id`.
 *
 * @param {string} mealId
 * @returns {Promise<object[]>}
 */
export async function findAddonsByMealId(mealId) {
  throw new Error('menuModel.findAddonsByMealId: not implemented — see routes/menus.js for the live version');
}
