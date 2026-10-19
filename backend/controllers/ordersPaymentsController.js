// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersPaymentsController.js — Controller de Pagamentos de Pedidos   ║
// ║ CONSART ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  listOrdersPayments,
  getOrderPaymentById,
  createOrderPayment,
  updateOrderPayment,
  deleteOrderPayment,
} from '../repositories/ordersPayments/ordersPayments.index.js';

const ok = (res, data = {}) => res.json({ ok: true, ...data });

const bad = (res, message = 'Erro interno', code = 500, extra = {}) =>
  res.status(code).json({ ok: false, message, ...extra });

function toIntOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function list(req, res) {
  try {
    const order_id = toIntOrNull(req.query.order_id);
    const limit = toIntOrNull(req.query.limit) || 100;
    const offset = toIntOrNull(req.query.offset) || 0;

    const rows = await listOrdersPayments({
      order_id,
      limit,
      offset,
    });

    return ok(res, {
      rows,
      total: rows.length,
    });
  } catch (err) {
    console.error('[ordersPaymentsController.list]', err);
    return bad(res, 'Erro ao listar pagamentos do pedido.');
  }
}

export async function getById(req, res) {
  try {
    const order_payment_id = toIntOrNull(req.params.id);

    if (!order_payment_id) {
      return bad(res, 'ID do pagamento inválido.', 400);
    }

    const row = await getOrderPaymentById(order_payment_id);

    if (!row) {
      return bad(res, 'Pagamento não encontrado.', 404);
    }

    return ok(res, { row });
  } catch (err) {
    console.error('[ordersPaymentsController.getById]', err);
    return bad(res, 'Erro ao buscar pagamento do pedido.');
  }
}

export async function create(req, res) {
  try {
    const row = await createOrderPayment(req.body);
    return res.status(201).json({ ok: true, row });
  } catch (err) {
    console.error('[ordersPaymentsController.create]', err);
    return bad(res, err.message || 'Erro ao criar pagamento do pedido.', 400);
  }
}

export async function update(req, res) {
  try {
    const order_payment_id = toIntOrNull(req.params.id);

    if (!order_payment_id) {
      return bad(res, 'ID do pagamento inválido.', 400);
    }

    const row = await updateOrderPayment(order_payment_id, req.body);

    if (!row) {
      return bad(res, 'Pagamento não encontrado.', 404);
    }

    return ok(res, { row });
  } catch (err) {
    console.error('[ordersPaymentsController.update]', err);
    return bad(res, err.message || 'Erro ao atualizar pagamento do pedido.', 400);
  }
}

export async function remove(req, res) {
  try {
    const order_payment_id = toIntOrNull(req.params.id);

    if (!order_payment_id) {
      return bad(res, 'ID do pagamento inválido.', 400);
    }

    const row = await deleteOrderPayment(order_payment_id);

    if (!row) {
      return bad(res, 'Pagamento não encontrado.', 404);
    }

    return ok(res, {
      message: 'Pagamento removido com sucesso.',
      row,
    });
  } catch (err) {
    console.error('[ordersPaymentsController.remove]', err);
    return bad(res, 'Erro ao remover pagamento do pedido.');
  }
}

export default {
  list,
  getById,
  create,
  update,
  remove,
};