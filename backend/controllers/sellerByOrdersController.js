// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrdersController.js — Controller Vendedor x Pedido | CONSART ║
// ║ Base: /api/orders/:orderId/sellers                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  listByOrder,
  upsertForOrder,
  patchSeller,
  remove,
} from '../repositories/sellerByOrders/sellerByOrders.index.js';

const badReq = (res, msg, code = 400) => res.status(code).json({ ok: false, error: msg });

export async function initSellerByOrdersController() {
  try {
    await ensureTable();
  } catch (e) {
    console.error('[initSellerByOrdersController] ERR:', e);
  }
}

export async function listOrderSellers(req, res) {
  try {
    const orderId = req.params.orderId;
    const out = await listByOrder(orderId);
    if (!out.ok) return badReq(res, out.error, out.error === 'NOT_FOUND' ? 404 : 400);
    return res.json(out);
  } catch (e) {
    console.error('[listOrderSellers] EXC:', e);
    return badReq(res, String(e.message || e), 500);
  }
}

export async function upsertOrderSeller(req, res) {
  try {
    const orderId = req.params.orderId;
    const payload = req.body || {};
    const out = await upsertForOrder(orderId, payload);
    if (!out.ok) return badReq(res, out.error, 400);
    return res.json(out);
  } catch (e) {
    console.error('[upsertOrderSeller] EXC:', e);
    return badReq(res, String(e.message || e), 500);
  }
}

export async function patchOrderSeller(req, res) {
  try {
    const { orderId, sellerId } = req.params;
    const out = await patchSeller(orderId, sellerId, req.body || {});
    if (!out.ok) {
      const code = out.error === 'NOT_FOUND' ? 404 : 400;
      return badReq(res, out.error, code);
    }
    return res.json(out);
  } catch (e) {
    console.error('[patchOrderSeller] EXC:', e);
    return badReq(res, String(e.message || e), 500);
  }
}

export async function deleteOrderSeller(req, res) {
  try {
    const { orderId, sellerId } = req.params;
    const out = await remove(orderId, sellerId);
    if (!out.ok) {
      const code = out.error === 'NOT_FOUND' ? 404 : 400;
      return badReq(res, out.error, code);
    }
    return res.json(out);
  } catch (e) {
    console.error('[deleteOrderSeller] EXC:', e);
    return badReq(res, String(e.message || e), 500);
  }
}
