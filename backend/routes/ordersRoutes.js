// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersRoutes.js — Rotas REST de Pedidos — /api/orders               ║
// ║ CONSART ERP | Express Router | ESM                                  ║
// ║ Pedidos, relatórios, PDFs comerciais e retorno ao orçamento         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import express from 'express';

import {
  searchOrders,
  listOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  reportOrdersPdf,
  listOrdersPendingNfe,
  downloadOrderSeparationPdf,
} from '../controllers/ordersController.js';

import { previewOrderPdf }
  from '../controllers/ordersPreviewPdfController.js';
import ordersApi from '../repositories/orders/orders.index.js';
import { queueErrorEmail } from '../errorEmailReporter.js';

function reportOrdersError(...args) {
  console.error(...args);

  const caught = args.find((value) => value instanceof Error);
  const label = typeof args[0] === 'string'
    ? args[0]
    : 'Erro nas rotas de pedidos';

  queueErrorEmail('ORDERS_ROUTES_ERROR', {
    module: 'routes/ordersRoutes.js',
    message: caught?.message || label,
    context: label,
    err: caught
      ? {
        name: caught.name,
        message: caught.message,
        code: caught.code,
        stack: caught.stack,
      }
      : undefined,
    details: args,
  });
}

const router = express.Router();

// Rotas fixas sempre antes das rotas com /:id.
router.get('/search', searchOrders);
router.get('/report/pdf', reportOrdersPdf);
router.get('/pending-nfe', listOrdersPendingNfe);
router.get('/', listOrders);

router.get('/:id/separation-pdf', downloadOrderSeparationPdf);
router.get('/:id/preview-pdf', previewOrderPdf);

// Retornar pedido para orçamento somente quando não houver NF-e.
router.post('/:orderId/return-to-budget', async (req, res) => {
  const id = Number(req.params.orderId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      ok: false,
      error: 'Parâmetro :orderId inválido.',
    });
  }

  try {
    const result = await ordersApi.returnToBudget(id);

    if (!result?.ok) {
      const message = result?.error || result?.message ||
        'Falha ao retornar pedido para orçamento.';

      const status = message === 'NOT_FOUND' || /NOT_FOUND/i.test(message)
        ? 404
        : /bloqueada|NF-e|budget_id|vinculad/i.test(message)
          ? 409
          : 400;

      return res.status(result?.status || status).json({
        ok: false,
        error: message,
      });
    }

    return res.json({
      ...result,
      ok: true,
      message: result?.message ||
        'Pedido retornado para orçamento com sucesso.',
    });
  } catch (error) {
    reportOrdersError('[ordersRoutes.returnToBudget] ERR:', error);

    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao retornar pedido para orçamento.',
      details: error?.message || String(error),
    });
  }
});

// CRUD por ID sempre por último.
router.get('/:id', getOrderById);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

export default router;
