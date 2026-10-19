// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersRoutes.js — Rotas HTTP Pedidos E-commerce            ║
// ║ CONSART ERP / BH3 E-commerce · ESM                                   ║
// ║                                                                      ║
// ║ Base: /api/ecommerce-orders                                          ║
// ║   GET    /           → searchEcommerceOrders                         ║
// ║   GET    /:id        → getEcommerceOrderById                         ║
// ║   POST   /           → createEcommerceOrder                          ║
// ║   PUT    /:id        → updateEcommerceOrder                          ║
// ║   DELETE /:id        → deleteEcommerceOrder                          ║
// ╚══════════════════════════════════════════════════════════════════════╝ */

import { Router } from 'express';

import {
  searchEcommerceOrders,
  getEcommerceOrderById,
  createEcommerceOrder,
  updateEcommerceOrder,
  deleteEcommerceOrder,
} from '../controllers/ecommerceOrdersController.js';

const router = Router();

// Lista / busca
router.get('/', searchEcommerceOrders);

// Detalhe (cabeçalho + itens)
router.get('/:id', getEcommerceOrderById);

// Criar pedido com itens
router.post('/', createEcommerceOrder);

// Atualizar apenas cabeçalho
router.put('/:id', updateEcommerceOrder);

// Excluir pedido (cabeçalho + itens via cascade)
router.delete('/:id', deleteEcommerceOrder);

export default router;
