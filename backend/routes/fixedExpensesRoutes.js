// ╔══════════════════════════════════════════════════════════════════════╗
// ║ fixedExpensesRoutes.js — Express Router (Despesas Fixas)            ║
/* ║ CONSART ERP — ESM, rotas REST + upsert por (customer_id, report_name)║
   ╚══════════════════════════════════════════════════════════════════════╝ */

import { Router } from 'express';
import { fixedExpensesController as c } from '../controllers/fixedExpensesController.js';

const router = Router();

// Listagem + filtros/paginação/ordem
router.get('/', c.list);

// Contagem (opcional, a listagem já retorna total)
router.get('/count', c.count);

// Upsert por (customer_id, report_name)
router.post('/upsert', c.upsertByCustomerAndReport);

// CRUD
router.get('/:id', c.getById);
router.post('/', c.create);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

export default router;