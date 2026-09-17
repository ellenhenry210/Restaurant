// Scaffolding, not yet wired in — see routes/orders.js for the actual,
// currently-running implementation (guest-facing create/status) and
// routes/restaurantOrders.js (staff/kitchen side: list, status
// transitions). Same reasoning as the other model stubs in this
// directory: not filled in yet, to avoid two independent copies of the
// same logic — especially risky here, since orders.js's create flow is
// the most complex thing in the codebase (guest_profile find-or-create,
// per-item allergen removal-policy enforcement, tax/service charge/tip
// calculation, all in one transaction). Splitting that out is exactly
// the kind of change that should happen deliberately, in one place, not
// as a half-copied stub.

// import { pool } from '../db.js'; — uncomment when implementing

/**
 * Create an order: find-or-create the guest_profile, validate + price
 * every item (including allergen removal-policy enforcement per
 * SNAPORDER_AUTHORIZATION.md Part 3), compute tax/service charge, and
 * insert the order + its items — all in one transaction.
 * Mirrors routes/orders.js `POST /`.
 *
 * @param {object} params
 * @returns {Promise<object>} the created order, with items
 */
export async function createOrder(params) {
  throw new Error('orderModel.createOrder: not implemented — see routes/orders.js for the live version');
}

/**
 * Fetch one order with its items.
 * Mirrors routes/orders.js `GET /:id`.
 *
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
export async function findById(orderId) {
  throw new Error('orderModel.findById: not implemented — see routes/orders.js for the live version');
}

/**
 * List a restaurant's orders, optionally filtered by status.
 * Mirrors routes/restaurantOrders.js `GET /`.
 *
 * @param {string} restaurantId
 * @param {{ status: string[] | null }} options
 * @returns {Promise<object[]>}
 */
export async function findByRestaurant(restaurantId, { status }) {
  throw new Error('orderModel.findByRestaurant: not implemented — see routes/restaurantOrders.js for the live version');
}

/**
 * Advance (or cancel) an order's status, validated against the state
 * machine (placed -> confirmed -> preparing -> ready -> served, or ->
 * cancelled at various points). Mirrors routes/restaurantOrders.js
 * `PATCH /:orderId/status`.
 *
 * @param {string} orderId
 * @param {string} nextStatus
 * @returns {Promise<object>}
 */
export async function updateStatus(orderId, nextStatus) {
  throw new Error('orderModel.updateStatus: not implemented — see routes/restaurantOrders.js for the live version');
}

/**
 * Update one order item's status (the kitchen's unit of work), recording
 * which staff member handled it. Mirrors routes/restaurantOrders.js
 * `PATCH /:orderId/items/:itemId/status`.
 *
 * @param {string} itemId
 * @param {string} nextStatus
 * @param {string} staffId
 * @returns {Promise<object>}
 */
export async function updateItemStatus(itemId, nextStatus, staffId) {
  throw new Error('orderModel.updateItemStatus: not implemented — see routes/restaurantOrders.js for the live version');
}
