// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersBillingRoutes.js — Rotas de Cobranças de Pedidos              ║
// ║ CONSART ERP | ESM                                                    ║
// ║                                                                      ║
// ║ GET /api/orders/:id/billing                                         ║
// ║ GET /api/orders-billing/by-provider/:providerPaymentId              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  getBillingByOrder,
  getBillingByProvider,
} from '../controllers/ordersBillingController.js';

const router = Router();

// Histórico de cobranças de um pedido específico
router.get('/api/orders/:id/billing', getBillingByOrder);

// Consulta por id da cobrança no provedor (ex: id Asaas)
router.get(
  '/api/orders-billing/by-provider/:providerPaymentId',
  getBillingByProvider,
);

export default router;
