import { Router } from 'express';

import { pool } from '../db.js';
import { authenticateGuest } from '../middleware/authGuest.js';

const router = Router();

function validateCreateOrderInput(body) {
  const errors = [];
  if (!body.phone_number || typeof body.phone_number !== 'string') {
    errors.push({ field: 'phone_number', reason: 'required' });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push({ field: 'items', reason: 'must be a non-empty array' });
  } else {
    body.items.forEach((item, i) => {
      if (!item.meal_id || typeof item.meal_id !== 'string') {
        errors.push({ field: `items[${i}].meal_id`, reason: 'required' });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        errors.push({ field: `items[${i}].quantity`, reason: 'must be a positive integer' });
      }
    });
  }
  // Optional — tipping is guest-initiated and entirely at their
  // discretion, so it's simply absent (not 0, not required) unless
  // they choose to include it.
  if (body.tip_amount !== undefined && (typeof body.tip_amount !== 'number' || body.tip_amount < 0)) {
    errors.push({ field: 'tip_amount', reason: 'must be a non-negative number' });
  }
  return errors;
}

// ---------------------------------------------------------------------
// POST /orders — create a new order. Behind authenticateGuest: only a
// guest with a proximity-verified session (see routes/guestSession.js)
// can place one, which is the whole point of that session existing.
//
// This is also the first real implementation of the allergen removal-
// policy engine from SNAPORDER_AUTHORIZATION.md Part 3 — designed since
// early in this project, never wired to actual order-creation code
// until now. See the per-item loop below.
// ---------------------------------------------------------------------
router.post('/', authenticateGuest, async (req, res) => {
  const errors = validateCreateOrderInput(req.body ?? {});
  if (errors.length > 0) {
    return res.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'One or more fields are invalid', details: errors },
    });
  }

  const { phone_number, guest_name, items, special_requests, tip_amount: tipAmount } = req.body;
  const { restaurant_id: restaurantId, table_id: tableId } = req.guestSession;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Per-restaurant, not a global constant — a restaurant's tax rate is
    // a fact about that restaurant/jurisdiction, and not everyone
    // charges a service charge at all (migration 008). Fetched once
    // here rather than per-item, since it's the same for the whole order.
    const ratesResult = await client.query(
      `SELECT tax_rate, service_charge_rate FROM restaurants WHERE id = $1`,
      [restaurantId]
    );
    const { tax_rate: taxRate, service_charge_rate: serviceChargeRate } = ratesResult.rows[0];

    // Find-or-create the guest_profile — this IS "on first order",
    // exactly the trigger point the product design (product-vision)
    // already specified: guest_profiles don't exist until here.
    let guestProfileResult = await client.query(
      `SELECT id FROM guest_profiles WHERE restaurant_id = $1 AND phone_number = $2`,
      [restaurantId, phone_number]
    );
    let guestProfileId = guestProfileResult.rows[0]?.id;

    if (!guestProfileId) {
      const inserted = await client.query(
        `INSERT INTO guest_profiles (restaurant_id, phone_number, guest_name) VALUES ($1, $2, $3) RETURNING id`,
        [restaurantId, phone_number, guest_name ?? null]
      );
      guestProfileId = inserted.rows[0].id;
    }

    // Link this session to the guest_profile if it isn't already
    // (a returning guest re-scanning gets a fresh session each time,
    // but the same underlying guest_profile via phone_number).
    if (!req.guestSession.guest_profile_id) {
      await client.query('UPDATE guest_sessions SET guest_profile_id = $1 WHERE id = $2', [
        guestProfileId,
        req.guestSession.id,
      ]);
    }

    // Validate and price every item BEFORE inserting anything — a
    // rejected item (unavailable meal, blocked allergen removal, an
    // addon that isn't actually this meal's) fails the whole order, not
    // just that line, so nothing should be written until every item has
    // passed.
    const preparedItems = [];
    let subtotal = 0;

    for (const [i, item] of items.entries()) {
      const mealResult = await client.query(
        `SELECT id, name, base_price, is_available FROM meals WHERE id = $1 AND restaurant_id = $2`,
        [item.meal_id, restaurantId]
      );
      const meal = mealResult.rows[0];
      if (!meal) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: `Item ${i}: meal not found at this restaurant` },
        });
      }
      if (!meal.is_available) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: { code: 'INVALID_REQUEST', message: `Item ${i}: "${meal.name}" is currently unavailable` },
        });
      }

      // --- Allergen removal policy (Part 3) ---
      const removedIngredients = Array.isArray(item.removed_ingredients) ? item.removed_ingredients : [];
      let requiresCautionAck = false;

      if (removedIngredients.length > 0) {
        const policyResult = await client.query(
          `SELECT ingredient_id, removal_policy, removal_policy_reason
           FROM meal_ingredients
           WHERE meal_id = $1 AND ingredient_id = ANY($2::uuid[])`,
          [meal.id, removedIngredients]
        );
        const policyByIngredient = new Map(policyResult.rows.map((r) => [r.ingredient_id, r]));

        for (const ingredientId of removedIngredients) {
          const policy = policyByIngredient.get(ingredientId);
          if (!policy) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: { code: 'INVALID_REQUEST', message: `Item ${i}: that ingredient isn't part of "${meal.name}"` },
            });
          }
          if (policy.removal_policy === 'cannot_remove') {
            // Blocked, per policy — not a validation error, a genuine
            // safety refusal. 403, not 400.
            await client.query('ROLLBACK');
            return res.status(403).json({
              error: {
                code: 'FORBIDDEN',
                message: `Item ${i}: cannot remove that ingredient from "${meal.name}"${policy.removal_policy_reason ? ` — ${policy.removal_policy_reason}` : ''}`,
              },
            });
          }
          if (policy.removal_policy === 'caution') {
            requiresCautionAck = true;
          }
        }
      }

      if (requiresCautionAck && item.allergen_caution_acknowledged !== true) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: `Item ${i}: removing this ingredient carries a cross-contamination risk — resubmit with allergen_caution_acknowledged: true to confirm`,
          },
        });
      }

      // --- Addons ---
      const addedAddons = Array.isArray(item.added_addons) ? item.added_addons : [];
      let addonsTotal = 0;

      if (addedAddons.length > 0) {
        const addonResult = await client.query(
          `SELECT id, additional_price FROM meal_addons WHERE meal_id = $1 AND id = ANY($2::uuid[]) AND is_available = TRUE`,
          [meal.id, addedAddons]
        );
        if (addonResult.rows.length !== addedAddons.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: { code: 'INVALID_REQUEST', message: `Item ${i}: one or more addons aren't available for "${meal.name}"` },
          });
        }
        addonsTotal = addonResult.rows.reduce((sum, a) => sum + Number(a.additional_price), 0);
      }

      const unitPrice = Number(meal.base_price) + addonsTotal;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      preparedItems.push({
        meal_id: meal.id,
        meal_name: meal.name,
        meal_price: unitPrice,
        quantity: item.quantity,
        removed_ingredients: removedIngredients,
        allergen_caution_acknowledged: requiresCautionAck,
        added_addons: addedAddons,
        special_request: item.special_request ?? null,
      });
    }

    // Round to the nearest kobo/cent (2dp) before summing, not after —
    // summing unrounded fractions and rounding once at the end can land
    // a cent off from what tax_rate * subtotal alone would show, which
    // is the kind of "why doesn't this add up" discrepancy a guest
    // would notice on a receipt.
    const tax = Math.round(subtotal * Number(taxRate) * 100) / 100;
    const serviceCharge = Math.round(subtotal * Number(serviceChargeRate) * 100) / 100;
    // total_amount deliberately does NOT include the tip — matches how a
    // receipt normally reads ("Total: X, tip at your discretion"), not
    // folded silently into one number. grand_total (below, in the
    // response only — not its own column) is the actual amount that
    // would be charged/paid, for a client that wants one final figure.
    const totalAmount = subtotal + tax + serviceCharge;
    const tip = tipAmount ?? 0;

    const orderNumberResult = await client.query(`SELECT nextval('order_number_seq') AS n`);
    const orderNumber = `ORD-${new Date().getFullYear()}-${String(orderNumberResult.rows[0].n).padStart(5, '0')}`;

    const orderResult = await client.query(
      `INSERT INTO orders (restaurant_id, table_id, guest_profile_id, order_number, subtotal, tax, service_charge, total_amount, tip_amount, special_requests)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, order_number, status, subtotal, tax, service_charge, total_amount, tip_amount, currency, placed_at`,
      [restaurantId, tableId, guestProfileId, orderNumber, subtotal, tax, serviceCharge, totalAmount, tip, special_requests ?? null]
    );
    const order = orderResult.rows[0];
    const grandTotal = Number(order.total_amount) + Number(order.tip_amount);

    const insertedItems = [];
    for (const item of preparedItems) {
      const itemResult = await client.query(
        `INSERT INTO order_items (order_id, meal_id, meal_name, meal_price, quantity, removed_ingredients, allergen_caution_acknowledged, added_addons, special_request)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, meal_id, meal_name, meal_price, quantity, status`,
        [
          order.id,
          item.meal_id,
          item.meal_name,
          item.meal_price,
          item.quantity,
          item.removed_ingredients,
          item.allergen_caution_acknowledged,
          item.added_addons,
          item.special_request,
        ]
      );
      insertedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({ ...order, grand_total: grandTotal, items: insertedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /orders: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' } });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------
// GET /orders/:id — order status. Ownership check is table-based, not
// guest_profile-based: a guest re-scanning mid-meal gets a NEW
// guest_sessions row (guest_profile_id starts NULL on it again until
// they order in THAT session), so matching on guest_profile would wrongly
// reject them checking an order they placed a few minutes ago in a
// previous session. Matching on table_id instead reflects the actual
// physical reality — you're checking on your order because you're
// sitting at your table, which the current session is scoped to either way.
// ---------------------------------------------------------------------
router.get('/:id', authenticateGuest, async (req, res) => {
  try {
    const orderResult = await pool.query(
      `SELECT id, restaurant_id, table_id, order_number, status,
              placed_at, confirmed_at, ready_at, served_at, cancelled_at,
              estimated_ready_time, subtotal, tax, service_charge, total_amount,
              tip_amount, currency, special_requests
       FROM orders
       WHERE id = $1`,
      [req.params.id]
    );
    const order = orderResult.rows[0];

    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (order.table_id !== req.guestSession.table_id || order.restaurant_id !== req.guestSession.restaurant_id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This order does not belong to your table' } });
    }
    order.grand_total = Number(order.total_amount) + Number(order.tip_amount);

    const itemsResult = await pool.query(
      `SELECT id, meal_id, meal_name, meal_price, quantity, status, special_request
       FROM order_items
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [order.id]
    );

    res.json({ ...order, items: itemsResult.rows });
  } catch (err) {
    if (err.code === '22P02') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    console.error('GET /orders/:id: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load order' } });
  }
});

export default router;
