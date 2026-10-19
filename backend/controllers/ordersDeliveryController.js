// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: controllers/ordersDeliveryController.js                       ║
// ║ MODULE: Orders Delivery Controller                                  ║
// ║ CONSART ERP                                                         ║
// ║ REST API - Order Shipping / Delivery                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import orderDeliveryApi from '../repositories/ordersDelivery/ordersDelivery.index.js';

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function parseOrderId(value) {
  const id = Number(value);

  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return id;
}

/* --------------------------------------------------------------------- */
/* GET /api/order-delivery/ensure-table                                  */
/* --------------------------------------------------------------------- */

export async function ensureTable(req, res) {
  try {
    const out = await orderDeliveryApi.ensureTable();

    return res.json({
      success: true,
      data: out,
    });
  } catch (err) {
    console.error('[ordersDeliveryController.ensureTable]', err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/order-delivery/order/:orderId                                */
/* --------------------------------------------------------------------- */

export async function getByOrderId(req, res) {
  try {
    const orderId = parseOrderId(req.params.orderId);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'order_id inválido.',
      });
    }

    const row = await orderDeliveryApi.getByOrderId(orderId);

    return res.json({
      success: true,
      data: row || null,
    });
  } catch (err) {
    console.error('[ordersDeliveryController.getByOrderId]', err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

/* --------------------------------------------------------------------- */
/* PUT /api/order-delivery/order/:orderId                                */
/* UPSERT                                                                */
/* --------------------------------------------------------------------- */

export async function upsertByOrderId(req, res) {
  try {
    const orderId = parseOrderId(req.params.orderId);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'order_id inválido.',
      });
    }

    const row = await orderDeliveryApi.upsertByOrderId(
      orderId,
      req.body || {}
    );

    return res.json({
      success: true,
      data: row,
    });
  } catch (err) {
    console.error('[ordersDeliveryController.upsertByOrderId]', err);

    const msg = String(err.message || '');

    const validation =
      msg.includes('freight_mode inválido') ||
      msg.includes('order_id inválido');

    return res.status(validation ? 400 : 500).json({
      success: false,
      message: msg,
    });
  }
}

/* --------------------------------------------------------------------- */
/* DELETE /api/order-delivery/order/:orderId                             */
/* --------------------------------------------------------------------- */

export async function removeByOrderId(req, res) {
  try {
    const orderId = parseOrderId(req.params.orderId);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'order_id inválido.',
      });
    }

    const out = await orderDeliveryApi.removeByOrderId(orderId);

    return res.json({
      success: true,
      data: out,
    });
  } catch (err) {
    console.error('[ordersDeliveryController.removeByOrderId]', err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}