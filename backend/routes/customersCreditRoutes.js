// customersCreditRoutes.js — Express routes (ESM)

import { Router } from 'express';
import controller from '../controllers/customersCreditController.js';

const router = Router();

router.get('/', controller.list);
router.get('/customer/:customerId', controller.getByCustomerId);
router.put('/customer/:customerId', controller.upsertByCustomerId);
router.delete('/customer/:customerId', controller.removeByCustomerId);

export default router;