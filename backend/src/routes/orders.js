import { Router } from 'express';

import { authenticateGuest } from '../middleware/authGuest.js';
import * as orderController from '../controllers/orderController.js';

// Routes/controllers/models split, migrated 2026-09-17 from the flat
// pattern. See controllers/orderController.js for the transaction
// orchestration + allergen-policy business logic, and
// models/orderModel.js for the actual queries.
const router = Router();

router.post('/', authenticateGuest, orderController.create);
router.get('/:id', authenticateGuest, orderController.getStatus);

export default router;
