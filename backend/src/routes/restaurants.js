import { Router } from 'express';

import * as restaurantController from '../controllers/restaurantController.js';

// Routes/controllers/models split, migrated 2026-09-17 from the flat
// pattern (this file used to query the database directly). See
// controllers/restaurantController.js for request handling and
// models/restaurantModel.js for the actual queries — this file is just
// the URL-to-handler wiring.
const router = Router();

router.get('/', restaurantController.list);
router.get('/:id', restaurantController.getOne);

export default router;
