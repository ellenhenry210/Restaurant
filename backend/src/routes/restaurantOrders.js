import { Router } from 'express';

import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { emitOrderStatusUpdate, emitItemStatusUpdate } from '../realtime.js';

// mergeParams: true — mounted at /v1/restaurants/:restaurantId/orders,
// needs that :restaurantId in its own req.params (see routes/staff.js
// for the same pattern).
const router = Router({ mergeParams: true });

// State machines — an order/item can't jump from any status to any
// other. This is the state-based ABAC condition from SNAPORDER_
// AUTHORIZATION.md Part 2 #5 made concrete: "kitchen accepts an order
// only if placed/confirmed" etc. generalizes to "every transition has
// to be a real, listed one." served and cancelled are terminal — no
// entry has an empty-but-present set for them by accident, they
// genuinely allow nothing further.
const VALID_ORDER_TRANSITIONS = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
};

const ORDER_TIMESTAMP_COLUMN = {
  confirmed: 'confirmed_at',
  ready: 'ready_at',
  served: 'served_at',
  cancelled: 'cancelled_at',
};

const VALID_ITEM_TRANSITIONS = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: [],
  cancelled: [],
};

// ---------------------------------------------------------------------
// GET / — list a restaurant's orders. view_all_orders covers waiter,
// kitchen_staff, manager, owner, system_admin per the matrix — a
// superset of view_kitchen_queue (kitchen_staff/manager/owner/admin
// only). Not enforced as a separate permission: a kitchen-focused UI
// gets the same data via ?status=placed,confirmed,preparing rather than
// a dedicated endpoint checking a narrower permission — a deliberate
// simplification, not an oversight, since the two would return
// identical rows for anyone who actually has view_kitchen_queue.
// ---------------------------------------------------------------------
router.get('/', authenticate, authorize('view_all_orders'), async (req, res) => {
  const { restaurantId } = req.params;
  const statusFilter = req.query.status ? req.query.status.split(',') : null;

  try {
    const result = await pool.query(
      `SELECT id, table_id, order_number, status,
              placed_at, confirmed_at, ready_at, served_at, cancelled_at,
              subtotal, tax, service_charge, total_amount, tip_amount,
              special_requests, allergen_warnings
       FROM orders
       WHERE restaurant_id = $1
         AND ($2::text[] IS NULL OR status = ANY($2::text[]))
       ORDER BY placed_at ASC`,
      [restaurantId, statusFilter]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('GET /restaurants/:restaurantId/orders: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list orders' } });
  }
});

// ---------------------------------------------------------------------
// PATCH /:orderId/status — advance (or cancel) an order.
//
// Uses authorize('modify_order') for the whole endpoint, including
// cancellations, rather than switching to authorize('cancel_order')
// when status === 'cancelled'. Today that's exactly correct: both
// permissions grant the identical staff role set (waiter/manager/
// owner/system_admin — kitchen_staff has neither). If the matrix ever
// gives one permission a role the other doesn't, this coupling needs
// to be revisited — noted here so that divergence doesn't silently
// become a bug.
// ---------------------------------------------------------------------
router.patch('/:orderId/status', authenticate, authorize('modify_order'), async (req, res) => {
  const { restaurantId, orderId } = req.params;
  const { status: nextStatus } = req.body ?? {};

  if (typeof nextStatus !== 'string' || !(nextStatus in VALID_ORDER_TRANSITIONS)) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: `status must be one of: ${Object.keys(VALID_ORDER_TRANSITIONS).join(', ')}` },
    });
  }

  try {
    const currentResult = await pool.query(
      `SELECT status, table_id FROM orders WHERE id = $1 AND restaurant_id = $2`,
      [orderId, restaurantId]
    );
    const current = currentResult.rows[0];
    if (!current) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const allowedNext = VALID_ORDER_TRANSITIONS[current.status];
    if (!allowedNext.includes(nextStatus)) {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: `Cannot move an order from '${current.status}' to '${nextStatus}'. Valid next state(s): ${allowedNext.length ? allowedNext.join(', ') : 'none — this is a final state'}`,
        },
      });
    }

    const timestampColumn = ORDER_TIMESTAMP_COLUMN[nextStatus];
    const result = await pool.query(
      timestampColumn
        ? `UPDATE orders SET status = $1, ${timestampColumn} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status, ${timestampColumn}`
        : `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status`,
      [nextStatus, orderId]
    );

    const updated = result.rows[0];

    // Broadcast-only — see realtime.js's top comment. This never changes
    // what the HTTP response says; a failure here is logged, not surfaced
    // as a failed status update (the update itself already succeeded).
    try {
      emitOrderStatusUpdate(restaurantId, current.table_id, { order_id: updated.id, status: updated.status });
    } catch (err) {
      console.error('emitOrderStatusUpdate failed (status update itself still succeeded):', err.message);
    }

    res.json(updated);
  } catch (err) {
    console.error('PATCH /restaurants/:restaurantId/orders/:orderId/status: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update order status' } });
  }
});

// ---------------------------------------------------------------------
// PATCH /:orderId/items/:itemId/status — kitchen updating one item.
// update_kitchen_item_status genuinely differs from modify_order in the
// matrix (kitchen_staff has it, waiter doesn't — the reverse of the
// order-level endpoint above), so this is its own real authorize() call,
// not sharing the one above.
// ---------------------------------------------------------------------
router.patch(
  '/:orderId/items/:itemId/status',
  authenticate,
  authorize('update_kitchen_item_status'),
  async (req, res) => {
    const { restaurantId, orderId, itemId } = req.params;
    const { status: nextStatus } = req.body ?? {};

    if (typeof nextStatus !== 'string' || !(nextStatus in VALID_ITEM_TRANSITIONS)) {
      return res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: `status must be one of: ${Object.keys(VALID_ITEM_TRANSITIONS).join(', ')}` },
      });
    }

    try {
      // Join through orders to confirm the item actually belongs to a
      // real order at THIS restaurant — an item's own row has no
      // restaurant_id to check directly. table_id comes along too, for
      // the realtime broadcast below (order_items has no table_id of
      // its own either).
      const currentResult = await pool.query(
        `SELECT oi.status, o.table_id
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE oi.id = $1 AND oi.order_id = $2 AND o.restaurant_id = $3`,
        [itemId, orderId, restaurantId]
      );
      const current = currentResult.rows[0];
      if (!current) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order item not found' } });
      }

      const allowedNext = VALID_ITEM_TRANSITIONS[current.status];
      if (!allowedNext.includes(nextStatus)) {
        return res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: `Cannot move an item from '${current.status}' to '${nextStatus}'. Valid next state(s): ${allowedNext.length ? allowedNext.join(', ') : 'none — this is a final state'}`,
          },
        });
      }

      // Records who on the kitchen team actually handled this item —
      // req.actor is the caller's own restaurant_staff row, attached by
      // authorize() on success.
      const result = await pool.query(
        `UPDATE order_items
         SET status = $1, prepared_by_staff_id = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, status, prepared_by_staff_id`,
        [nextStatus, req.actor.id, itemId]
      );

      const updated = result.rows[0];

      try {
        emitItemStatusUpdate(restaurantId, current.table_id, { order_id: orderId, item_id: updated.id, status: updated.status });
      } catch (err) {
        console.error('emitItemStatusUpdate failed (status update itself still succeeded):', err.message);
      }

      res.json(updated);
    } catch (err) {
      console.error('PATCH .../items/:itemId/status: failed:', err.message);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to update item status' } });
    }
  }
);

export default router;
