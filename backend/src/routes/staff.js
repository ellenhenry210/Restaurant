import { Router } from 'express';

import { pool } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';

// mergeParams: true — this router is mounted at
// /v1/restaurants/:restaurantId/staff (see index.js), and needs that
// :restaurantId param in its own req.params. Express doesn't pass parent
// route params down to a mounted router by default.
const router = Router({ mergeParams: true });

// GET /v1/restaurants/:restaurantId/staff — first real demonstration of
// authorize() end-to-end: 'view_staff' is Manager/Owner/System Admin
// only per SNAPORDER_AUTHORIZATION.md Part 1, and every call is scoped
// to the :restaurantId in the URL by authorize()'s built-in ownership
// check, regardless of what other restaurants the caller might also be
// staff at.
router.get('/', authenticate, authorize('view_staff'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, is_active, created_at
       FROM restaurant_staff
       WHERE restaurant_id = $1
       ORDER BY created_at ASC`,
      [req.params.restaurantId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('GET /staff: failed:', err.message);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list staff' } });
  }
});

export default router;
