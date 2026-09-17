import { Router } from 'express';

import * as menuController from '../controllers/menuController.js';

// Routes/controllers/models split, migrated 2026-09-17 from the flat
// pattern. See controllers/menuController.js for request handling and
// models/menuModel.js for the actual queries.
const router = Router();

router.get('/restaurants/:restaurantId/menus', menuController.listMenus);
router.get('/meals/:id', menuController.getMeal);
router.get('/meals/:id/ingredients', menuController.getIngredients);

export default router;
