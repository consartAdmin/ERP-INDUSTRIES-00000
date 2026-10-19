// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ecommerceOrdersController.js — Pedidos E-commerce (BH3 / CONSART)   ║
// ║                                                                      ║
// ║ - initEcommerceOrdersController()                                    ║
// ║ - searchEcommerceOrders(req, res)                                    ║
// ║ - getEcommerceOrderById(req, res)                                    ║
// ║ - createEcommerceOrder(req, res)                                     ║
// ║ - updateEcommerceOrder(req, res)                                     ║
// ║ - deleteEcommerceOrder(req, res)                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝ */

import ecommerceOrdersApi from '../repositories/ecommerceOrders/ecommerceOrders.index.js';
import ecommerceOrderItemsApi from '../repositories/ecommerceOrderItems/ecommerceOrderItems.index.js';

/* --------------------------------------------------------------------- */
/* 1. Bootstrap / DDL                                                     */
/* --------------------------------------------------------------------- */

export async function initEcommerceOrdersController() {
  try {
    await ecommerceOrdersApi.ensureTable?.();
    await ecommerceOrderItemsApi.ensureTable?.();
    console.log('✔ initEcommerceOrdersController() — tabelas ecommerce OK');
  } catch (err) {
    console.error('❌ initEcommerceOrdersController() failed:', err);
  }
}

/* --------------------------------------------------------------------- */
/* 2. Helpers                                                             */
/* --------------------------------------------------------------------- */

function parseSearchParams(req) {
  const {
    q,
    billingType,
    status,      // 🔹 novo: status do pagamento Asaas
    dateFrom,
    dateTo,
    limit,
    offset,
  } = req.query;

  return {
    q: q?.toString().trim() || undefined,
    billingType: billingType?.toString().trim() || undefined,
    status: status?.toString().trim() || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit: limit ? Number(limit) : 50,
    offset: offset ? Number(offset) : 0,
  };
}

/* --------------------------------------------------------------------- */
/* 3. Handlers — Listagem / Busca                                        */
/* --------------------------------------------------------------------- */

/**
 * GET /api/ecommerce-orders
 * Query params:
 *  - q            → texto livre (payment_id, provider, service, rule)
 *  - billingType  → asaas_billing_type
 *  - status       → asaas_status (PENDING, RECEIVED, AUTHORIZED, etc.)
 *  - dateFrom     → created_at >=
 *  - dateTo       → created_at <=
 *  - limit, offset
 */
export async function searchEcommerceOrders(req, res) {
  try {
    const {
      q,
      billingType,
      status,
      dateFrom,
      dateTo,
      limit,
      offset,
    } = parseSearchParams(req);

    const result = await ecommerceOrdersApi.listOrders({
      qText: q,
      billingType,
      status,
      date_from: dateFrom,
      date_to: dateTo,
      limit,
      offset,
    });

    res.json({
      ok: true,
      data: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (err) {
    console.error('[searchEcommerceOrders] error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao buscar pedidos e-commerce' });
  }
}

/* --------------------------------------------------------------------- */
/* 4. Handler — Buscar por ID (cabeçalho + itens)                        */
/* --------------------------------------------------------------------- */

/**
 * GET /api/ecommerce-orders/:id
 */
export async function getEcommerceOrderById(req, res) {
  const id = Number(req.params.id || 0);
  if (!id) {
    return res.status(400).json({ ok: false, error: 'ID inválido' });
  }

  try {
    const header = await ecommerceOrdersApi.getOrderById(id);
    if (!header) {
      return res
        .status(404)
        .json({ ok: false, error: 'Pedido não encontrado' });
    }

    const items = await ecommerceOrderItemsApi.getItemsByOrderId(id);

    res.json({
      ok: true,
      data: { header, items },
    });
  } catch (err) {
    console.error('[getEcommerceOrderById] error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao carregar pedido e-commerce' });
  }
}

/* --------------------------------------------------------------------- */
/* 5. Handler — Criar pedido (cabeçalho + itens)                         */
/* --------------------------------------------------------------------- */

export async function createEcommerceOrder(req, res) {
  const { header, items } = req.body || {};

  if (!header || typeof header !== 'object') {
    return res
      .status(400)
      .json({ ok: false, error: 'Payload inválido: header obrigatório' });
  }

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({
      ok: false,
      error: 'Payload inválido: items deve ter ao menos 1 item',
    });
  }

  try {
    const order = await ecommerceOrdersApi.createOrder(header);
    const insertedItems = await ecommerceOrderItemsApi.bulkInsert(order.id, items);

    res.status(201).json({
      ok: true,
      data: {
        header: order,
        items: insertedItems,
      },
    });
  } catch (err) {
    console.error('[createEcommerceOrder] error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao criar pedido e-commerce' });
  }
}

/* --------------------------------------------------------------------- */
/* 6. Handler — Atualizar apenas cabeçalho                               */
/* --------------------------------------------------------------------- */

export async function updateEcommerceOrder(req, res) {
  const id = Number(req.params.id || 0);
  if (!id) {
    return res.status(400).json({ ok: false, error: 'ID inválido' });
  }

  const changes = req.body || {};
  if (!changes || typeof changes !== 'object') {
    return res.status(400).json({ ok: false, error: 'Payload inválido' });
  }

  try {
    const updated = await ecommerceOrdersApi.updateOrder(id, changes);
    if (!updated) {
      return res
        .status(404)
        .json({ ok: false, error: 'Pedido não encontrado' });
    }

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('[updateEcommerceOrder] error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao atualizar pedido e-commerce' });
  }
}

/* --------------------------------------------------------------------- */
/* 7. Handler — Excluir pedido (cabeçalho + itens via CASCADE)           */
/* --------------------------------------------------------------------- */

export async function deleteEcommerceOrder(req, res) {
  const id = Number(req.params.id || 0);
  if (!id) {
    return res.status(400).json({ ok: false, error: 'ID inválido' });
  }

  try {
    const ok = await ecommerceOrdersApi.deleteOrder(id);
    if (!ok) {
      return res
        .status(404)
        .json({ ok: false, error: 'Pedido não encontrado' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[deleteEcommerceOrder] error:', err);
    res
      .status(500)
      .json({ ok: false, error: 'Erro ao excluir pedido e-commerce' });
  }
}

export default {
  initEcommerceOrdersController,
  searchEcommerceOrders,
  getEcommerceOrderById,
  createEcommerceOrder,
  updateEcommerceOrder,
  deleteEcommerceOrder,
};
