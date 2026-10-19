// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpProductionOrders.repository.js — Ordens de produção (OP)        ║
// ║ Criação (explode a ficha técnica), status, apontamentos e baixa    ║
// ║ de estoque na conclusão (modo de estoque simples).                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_ORDERS, TB_ORDER_MATERIALS, TB_REPORTS, TB_PRODUCTS, TB_STOCK,
  TB_WORK_CENTERS, TB_BOM_OPERATIONS, ORDER_STATUS, ORDER_TRANSITIONS,
} from './pcp.constants.js';
import { getActiveByProduct } from './pcpBom.repository.js';
import * as productsStock from '../productsStock/productsStock.manager.js';
import { notEmpty, toText, toNum, toInt, toDate, badRequest, notFound } from './pcp.sanitizers.js';

export async function list({ q = '', status = '' } = {}) {
  const params = [];
  const where = [];
  if (notEmpty(status)) {
    params.push(status.split(',').map((s) => s.trim().toUpperCase()));
    where.push(`o.status = ANY($${params.length})`);
  }
  if (notEmpty(q)) {
    params.push(`%${q.trim()}%`);
    where.push(`(o.order_number ILIKE $${params.length} OR o.product_code ILIKE $${params.length}
                 OR p.description ILIKE $${params.length} OR o.sales_order_ref ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT o.*, p.description AS product_description
       FROM ${TB_ORDERS} o
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = o.product_code
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY (o.status IN ('CONCLUIDA','CANCELADA')), o.due_date NULLS LAST, o.order_id DESC
      LIMIT 500`,
    params
  );
  return rows;
}

export async function getById(orderId) {
  const { rows: [order] } = await pool.query(
    `SELECT o.*, p.description AS product_description
       FROM ${TB_ORDERS} o
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = o.product_code
      WHERE o.order_id = $1`,
    [orderId]
  );
  if (!order) return null;

  const { rows: materials } = await pool.query(
    `SELECT m.*, p.description AS component_description,
            COALESCE(s.stock_qty, 0) AS stock_qty
       FROM ${TB_ORDER_MATERIALS} m
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = m.component_code
       LEFT JOIN ${TB_STOCK} s ON s.product_stock_id = p.product_stock_id
      WHERE m.order_id = $1
      ORDER BY m.order_material_id`,
    [orderId]
  );

  const { rows: operations } = order.bom_id ? await pool.query(
    `SELECT o.seq, o.description, o.setup_minutes, o.run_minutes_per_unit,
            w.work_center_id, w.code AS work_center_code, w.name AS work_center_name
       FROM ${TB_BOM_OPERATIONS} o
       LEFT JOIN ${TB_WORK_CENTERS} w ON w.work_center_id = o.work_center_id
      WHERE o.bom_id = $1
      ORDER BY o.seq`,
    [order.bom_id]
  ) : { rows: [] };

  const { rows: reports } = await pool.query(
    `SELECT r.*, w.code AS work_center_code, w.name AS work_center_name
       FROM ${TB_REPORTS} r
       LEFT JOIN ${TB_WORK_CENTERS} w ON w.work_center_id = r.work_center_id
      WHERE r.order_id = $1
      ORDER BY r.reported_at DESC`,
    [orderId]
  );

  return { ...order, materials, operations, reports, next_statuses: ORDER_TRANSITIONS[order.status] || [] };
}

/** Cria a OP e copia os materiais da ficha técnica ativa do produto. */
export async function create(body = {}, user = null) {
  const product_code = toText(body.product_code);
  const quantity = toNum(body.quantity_planned);
  if (!product_code) throw badRequest('Informe o produto a produzir.');
  if (!(quantity > 0)) throw badRequest('A quantidade deve ser maior que zero.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rowCount } = await client.query(`SELECT 1 FROM ${TB_PRODUCTS} WHERE product_code = $1`, [product_code]);
    if (!rowCount) throw badRequest(`Produto ${product_code} não encontrado.`);

    const bom = await getActiveByProduct(product_code, client);
    if (!bom && body.allow_without_bom !== true) {
      throw badRequest('Este produto não tem ficha técnica ativa. Cadastre a ficha antes de abrir a OP.');
    }

    const { rows: [{ n }] } = await client.query(`SELECT nextval('public."pcpProductionOrders_number_seq"') AS n`);
    const orderNumber = `OP-${String(n).padStart(6, '0')}`;

    const { rows: [order] } = await client.query(
      `INSERT INTO ${TB_ORDERS}
         (order_number, product_code, bom_id, quantity_planned, due_date, sales_order_ref, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING order_id`,
      [orderNumber, product_code, bom?.bom_id ?? null, quantity, toDate(body.due_date),
       toText(body.sales_order_ref), toText(body.notes), user?.name || user?.email || null]
    );

    for (const it of bom?.items || []) {
      const perUnit = (Number(it.quantity) / Number(bom.base_qty)) * (1 + Number(it.loss_percent) / 100);
      await client.query(
        `INSERT INTO ${TB_ORDER_MATERIALS} (order_id, component_code, qty_per_unit, qty_required)
         VALUES ($1, $2, $3, $4)`,
        [order.order_id, it.component_code, perUnit, perUnit * quantity]
      );
    }

    await client.query('COMMIT');
    return getById(order.order_id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Edita dados da OP enquanto ainda está planejada. */
export async function update(orderId, body = {}) {
  const current = await getById(orderId);
  if (!current) throw notFound();
  if (current.status !== ORDER_STATUS.PLANNED) {
    throw badRequest('Só é possível editar uma OP planejada.');
  }
  const quantity = toNum(body.quantity_planned, Number(current.quantity_planned));
  if (!(quantity > 0)) throw badRequest('A quantidade deve ser maior que zero.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ${TB_ORDERS}
          SET quantity_planned = $2, due_date = $3, sales_order_ref = $4, notes = $5, updated_at = NOW()
        WHERE order_id = $1`,
      [orderId, quantity, toDate(body.due_date), toText(body.sales_order_ref), toText(body.notes)]
    );
    // Recalcula a necessidade de material com a nova quantidade.
    await client.query(
      `UPDATE ${TB_ORDER_MATERIALS} SET qty_required = qty_per_unit * $2 WHERE order_id = $1`,
      [orderId, quantity]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return getById(orderId);
}

/** Muda o status respeitando o fluxo PLANEJADA → LIBERADA → EM_PRODUCAO → CONCLUIDA. */
export async function changeStatus(orderId, nextStatus) {
  const order = await getById(orderId);
  if (!order) throw notFound();
  const next = String(nextStatus || '').toUpperCase();
  if (!(ORDER_TRANSITIONS[order.status] || []).includes(next)) {
    throw badRequest(`Não é possível mudar a OP de ${order.status} para ${next}.`);
  }

  if (next === ORDER_STATUS.DONE) return finish(order);

  await pool.query(
    `UPDATE ${TB_ORDERS}
        SET status = $2::varchar,
            started_at = CASE WHEN $2::varchar = 'EM_PRODUCAO' AND started_at IS NULL THEN NOW() ELSE started_at END,
            updated_at = NOW()
      WHERE order_id = $1`,
    [orderId, next]
  );
  return getById(orderId);
}

/** Apontamento: quantidade boa, refugo e tempo. Inicia a produção se ainda não iniciada. */
export async function addReport(orderId, body = {}) {
  const order = await getById(orderId);
  if (!order) throw notFound();
  if (![ORDER_STATUS.RELEASED, ORDER_STATUS.IN_PROGRESS].includes(order.status)) {
    throw badRequest('Só é possível apontar produção em OP liberada ou em produção.');
  }
  const good = Math.max(0, toNum(body.qty_good, 0));
  const scrap = Math.max(0, toNum(body.qty_scrap, 0));
  if (good === 0 && scrap === 0 && !(toNum(body.minutes, 0) > 0)) {
    throw badRequest('Informe a quantidade produzida, o refugo ou o tempo.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ${TB_REPORTS} (order_id, operation_seq, work_center_id, qty_good, qty_scrap, minutes, operator_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [orderId, toInt(body.operation_seq), toInt(body.work_center_id), good, scrap,
       Math.max(0, toNum(body.minutes, 0)), toText(body.operator_name), toText(body.notes)]
    );
    // Quantidade da OP: conta apontamentos sem operação ou da última operação do roteiro.
    const lastSeq = order.operations.length ? Math.max(...order.operations.map((o) => o.seq)) : null;
    const seq = toInt(body.operation_seq);
    const countsForOrder = lastSeq === null || seq === null || seq === lastSeq;
    await client.query(
      `UPDATE ${TB_ORDERS}
          SET quantity_produced = quantity_produced + $2,
              quantity_scrap = quantity_scrap + $3,
              status = 'EM_PRODUCAO',
              started_at = COALESCE(started_at, NOW()),
              updated_at = NOW()
        WHERE order_id = $1`,
      [orderId, countsForOrder ? good : 0, scrap]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return getById(orderId);
}

/**
 * Conclui a OP. No modo de estoque simples, dá entrada do produto acabado
 * (quantidade produzida) e baixa os componentes proporcionalmente.
 * No modo com lote, a OP é concluída e a movimentação fica para o estoque.
 */
async function finish(order) {
  const produced = Number(order.quantity_produced);
  if (!(produced > 0)) throw badRequest('Aponte a quantidade produzida antes de concluir a OP.');

  const warnings = [];
  const mode = await productsStock.resolveProductsStockMode().catch(() => null);
  const canPost = mode?.isSimple === true;
  if (!canPost) warnings.push('Estoque com controle de lote: faça a movimentação de estoque pelo módulo de lotes.');

  const stockIdOf = async (code) => {
    const { rows: [p] } = await pool.query(`SELECT product_stock_id FROM ${TB_PRODUCTS} WHERE product_code = $1`, [code]);
    return p?.product_stock_id || null;
  };

  let posted = false;
  if (canPost) {
    const finishedStockId = await stockIdOf(order.product_code);
    if (finishedStockId) await productsStock.adjust(finishedStockId, produced);
    else warnings.push(`Produto ${order.product_code} sem registro de estoque: entrada não lançada.`);

    // Material das peças refugadas também foi consumido.
    const used = produced + Number(order.quantity_scrap);
    for (const m of order.materials) {
      const consumed = Number(m.qty_per_unit) * used;
      const sid = await stockIdOf(m.component_code);
      if (sid) await productsStock.adjust(sid, -consumed);
      else warnings.push(`Componente ${m.component_code} sem registro de estoque: baixa não lançada.`);
      await pool.query(
        `UPDATE ${TB_ORDER_MATERIALS} SET qty_consumed = $2 WHERE order_material_id = $1`,
        [m.order_material_id, consumed]
      );
    }
    posted = true;
  }

  await pool.query(
    `UPDATE ${TB_ORDERS}
        SET status = 'CONCLUIDA', finished_at = NOW(), stock_posted = $2, updated_at = NOW()
      WHERE order_id = $1`,
    [order.order_id, posted]
  );
  return { ...(await getById(order.order_id)), warnings };
}

export async function remove(orderId) {
  const order = await getById(orderId);
  if (!order) throw notFound();
  if (order.status !== ORDER_STATUS.PLANNED) {
    throw badRequest('Só é possível excluir uma OP planejada. Para as demais, cancele.');
  }
  await pool.query(`DELETE FROM ${TB_ORDERS} WHERE order_id = $1`, [orderId]);
  return { removed: true };
}
