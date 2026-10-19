// ╔════════════════════════════════════════════════════════════════════╗
// ║ customerStatusRoutes.js — Rotas Status Atual do Cliente (ERP)     ║
// ║ Base: /api/customer-status                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import customerStatusController from '../controllers/customerStatusController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use(erpCompanyContext);

// Manutenção (criar tabela / índices)
router.post('/customer-status/ensure-table', customerStatusController.ensureTable);

// Define / atualiza status de um cliente (UPSERT por customer_id)
router.post('/customer-status', customerStatusController.setStatus);

// Lista status (com join em tipos)
router.get('/customer-status', customerStatusController.list);

// Acessos específicos
router.get('/customer-status/by-customer/:customerId', customerStatusController.getByCustomer);
router.delete('/customer-status/by-customer/:customerId', customerStatusController.removeByCustomer);

// CRUD direto pelo id do registro de status (se precisar)
router.get('/customer-status/:id', customerStatusController.getById);
router.put('/customer-status/:id', customerStatusController.updateById);

export default router;
