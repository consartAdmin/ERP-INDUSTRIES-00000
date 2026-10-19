// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusTypesRoutes.js — Rotas Status Types (ERP)           ║
// ║ Base: /api/customer-status-types                                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import customerStatusTypesController from '../controllers/customerStatusTypesController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use(erpCompanyContext);

// Opcional: rota de manutenção para criar tabela/índices
router.post('/customer-status-types/ensure-table', customerStatusTypesController.ensureTable);

// CRUD básico
router.get('/customer-status-types', customerStatusTypesController.list);
router.get('/customer-status-types/search', customerStatusTypesController.search);
router.get('/customer-status-types/:id', customerStatusTypesController.getById);
router.post('/customer-status-types', customerStatusTypesController.create);
router.put('/customer-status-types/:id', customerStatusTypesController.updateById);
router.delete('/customer-status-types/:id', customerStatusTypesController.removeById);

export default router;
