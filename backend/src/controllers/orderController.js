// Scaffolding, not yet wired in — see routes/orders.js (guest create/
// status) and routes/restaurantOrders.js (staff/kitchen list/status
// updates) for the actual, currently-running handlers. Same reasoning
// as models/orderModel.js — especially worth not half-copying here,
// since the real create-order flow is the most complex logic in the
// codebase (allergen policy enforcement, tax/tip calculation, all in
// one transaction).

// import * as orderModel from '../models/orderModel.js';

/**
 * POST /orders — mirrors routes/orders.js `POST /`.
 */
export async function create(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/orders.js' } });
}

/**
 * GET /orders/:id — mirrors routes/orders.js `GET /:id`.
 */
export async function getStatus(req, res) {
  res.status(501).json({ error: { code: 'INTERNAL_ERROR', message: 'Not implemented — see routes/orders.js' } });
}
