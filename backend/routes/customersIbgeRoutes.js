// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeRoutes.js — Routes Express (ESM)                       ║
// ║ CONSART ERP | Customers IBGE                                       ║
// ║ Base: /api/customers-ibge                                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as ctrl from '../controllers/customersIbgeController.js';

const router = Router();

// Infra
router.post('/ensure', ctrl.ensure);

// Listagem
router.get('/', ctrl.list);
router.get('/search', ctrl.search);

// Resolve UF + City → registro mais confiável
router.get('/resolve', ctrl.resolve);

// Read / Upsert / Patch / Delete por customer_id
router.get('/:customerId', ctrl.getByCustomerId);
router.post('/:customerId', ctrl.upsert);
router.patch('/:customerId', ctrl.patch);
router.delete('/:customerId', ctrl.remove);

export default router;
