// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersBillingController.js — Cobranças de Pedidos (CONSART ERP)     ║
// ║                                                                      ║
// ║ Rotas principais:                                                    ║
// ║   GET /api/orders/:id/billing       → lista billing por pedido       ║
// ║   GET /api/orders-billing/by-provider/:providerPaymentId             ║
// ║                                        → busca por ID do Asaas       ║
// ║                                                                      ║
// ║ Integra com:                                                         ║
// ║   - services/apis/ordersBillingApi.js                                ║
// ║   - services/apis/orders/ordersApi.js (para validar existência do pedido)   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ordersBillingApi from '../repositories/ordersBilling/ordersBilling.index.js';
import ordersApi from '../repositories/orders/orders.index.js';

// ======================================================================
// Bootstrap opcional — chama no server.js
// ======================================================================
export async function initOrdersBillingController() {
  try {
    await ordersBillingApi.ensureTable?.();
  } catch (err) {
    console.error('[initOrdersBillingController] EXC:', err);
  }
}

// ======================================================================
// GET /api/orders/:id/billing
// → histórico de cobranças para um pedido
// ======================================================================
export async function getBillingByOrder(req, res) {
  try {
    const rawId = req.params.id ?? req.params.orderId;
    const orderId = Number(rawId);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :id inválido' });
    }

    // Opcional: valida se o pedido existe (para retornar 404 "bonito")
    try {
      const outOrder = await ordersApi.getById(orderId);
      if (!outOrder?.ok) {
        const code = outOrder?.error === 'NOT_FOUND' ? 404 : 400;
        return res
          .status(code)
          .json({ ok: false, error: outOrder?.error || 'PEDIDO_NAO_ENCONTRADO' });
      }
    } catch (e) {
      console.error('[getBillingByOrder] WARN getById(order):', e);
      // não derruba a rota — no pior caso ainda tenta listar billing
    }

    const rows = await ordersBillingApi.listByOrder(orderId);

    return res.json({
      ok: true,
      orderId,
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('[getBillingByOrder] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

// ======================================================================
// GET /api/orders-billing/by-provider/:providerPaymentId
// → usado p/ debugging / consultas pelo id do Asaas
// ======================================================================
export async function getBillingByProvider(req, res) {
  try {
    const providerPaymentId = req.params.providerPaymentId;

    if (!providerPaymentId) {
      return res
        .status(400)
        .json({ ok: false, error: 'Parâmetro :providerPaymentId obrigatório' });
    }

    const rows = await ordersBillingApi.listByProviderId(providerPaymentId);

    return res.json({
      ok: true,
      providerPaymentId,
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('[getBillingByProvider] EXC:', err);
    return res
      .status(500)
      .json({ ok: false, error: String(err?.message || err) });
  }
}

export default {
  initOrdersBillingController,
  getBillingByOrder,
  getBillingByProvider,
};
