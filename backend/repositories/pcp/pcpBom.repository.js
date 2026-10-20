// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpBom.repository.js — Ficha técnica (estrutura de produto)        ║
// ║ Cabeçalho + componentes (pcpBomItems) + roteiro (pcpBomOperations) ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_BOM, TB_BOM_ITEMS, TB_BOM_OPERATIONS, TB_WORK_CENTERS, TB_PRODUCTS,
} from './pcp.constants.js';
import { notEmpty, toText, toNum, toInt, badRequest, notFound } from './pcp.sanitizers.js';

export async function list({ q = '', onlyActive = 'false' } = {}) {
  const params = [];
  const where = [];
  if (String(onlyActive) === 'true') where.push('b.is_active = TRUE');
  if (notEmpty(q)) {
    params.push(`%${q.trim()}%`);
    where.push(`(b.product_code ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT b.*, p.description AS product_description,
            (SELECT COUNT(*) FROM ${TB_BOM_ITEMS} i WHERE i.bom_id = b.bom_id)::int AS items_count,
            (SELECT COUNT(*) FROM ${TB_BOM_OPERATIONS} o WHERE o.bom_id = b.bom_id)::int AS operations_count
       FROM ${TB_BOM} b
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = b.product_code
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY b.product_code, b.version`,
    params
  );
  return rows;
}

/** Ficha completa com componentes, roteiro e custo estimado de material. */
export async function getById(bomId) {
  const { rows: [bom] } = await pool.query(
    `SELECT b.*, p.description AS product_description
       FROM ${TB_BOM} b
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = b.product_code
      WHERE b.bom_id = $1`,
    [bomId]
  );
  if (!bom) return null;

  const { rows: items } = await pool.query(
    `SELECT i.*, p.description AS component_description,
            COALESCE(p.cost_price, 0) AS component_cost
       FROM ${TB_BOM_ITEMS} i
       LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = i.component_code
      WHERE i.bom_id = $1
      ORDER BY i.sort_order, i.bom_item_id`,
    [bomId]
  );

  const { rows: operations } = await pool.query(
    `SELECT o.*, w.code AS work_center_code, w.name AS work_center_name,
            COALESCE(w.hourly_cost, 0) AS hourly_cost
       FROM ${TB_BOM_OPERATIONS} o
       LEFT JOIN ${TB_WORK_CENTERS} w ON w.work_center_id = o.work_center_id
      WHERE o.bom_id = $1
      ORDER BY o.seq`,
    [bomId]
  );

  // Custo por unidade do produto: material (com perda) + operação (tempo × custo/hora).
  const base = Number(bom.base_qty) || 1;
  const materialCost = items.reduce((sum, i) =>
    sum + (Number(i.quantity) / base) * (1 + Number(i.loss_percent) / 100) * Number(i.component_cost), 0);
  const operationCost = operations.reduce((sum, o) =>
    sum + ((Number(o.setup_minutes) / base) + Number(o.run_minutes_per_unit)) / 60 * Number(o.hourly_cost), 0);

  return {
    ...bom,
    items,
    operations,
    cost: {
      material: round(materialCost),
      operation: round(operationCost),
      total: round(materialCost + operationCost),
    },
  };
}

function round(n, d = 4) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function cleanHeader(body = {}) {
  const product_code = toText(body.product_code);
  if (!product_code) throw badRequest('Informe o produto da ficha técnica.');
  const base_qty = toNum(body.base_qty, 1);
  if (!(base_qty > 0)) throw badRequest('A quantidade base deve ser maior que zero.');
  return {
    product_code,
    version: toText(body.version) || '1',
    base_qty,
    notes: toText(body.notes),
    is_active: body.is_active !== false && body.is_active !== 'false',
  };
}

function cleanItems(items = []) {
  return (Array.isArray(items) ? items : []).map((it, i) => {
    const component_code = toText(it.component_code);
    const quantity = toNum(it.quantity);
    if (!component_code) throw badRequest(`Componente da linha ${i + 1} sem produto.`);
    if (!(quantity > 0)) throw badRequest(`Quantidade da linha ${i + 1} deve ser maior que zero.`);
    return {
      component_code,
      quantity,
      loss_percent: Math.max(0, toNum(it.loss_percent, 0)),
      notes: toText(it.notes),
      sort_order: i,
    };
  });
}

function cleanOperations(ops = []) {
  return (Array.isArray(ops) ? ops : []).map((op, i) => {
    const description = toText(op.description);
    if (!description) throw badRequest(`Operação ${i + 1} sem descrição.`);
    return {
      seq: toInt(op.seq, (i + 1) * 10),
      work_center_id: toInt(op.work_center_id),
      description,
      setup_minutes: Math.max(0, toNum(op.setup_minutes, 0)),
      run_minutes_per_unit: Math.max(0, toNum(op.run_minutes_per_unit, 0)),
    };
  });
}

/**
 * Acha o código do produto a partir do que foi digitado: o código, ou a
 * descrição exata (sem diferenciar maiúsculas) quando não foi escolhido da lista.
 * Devolve o product_code ou lança 400 com uma mensagem clara.
 */
export async function resolveProductCode(client, value, label = 'Produto') {
  const typed = toText(value);
  if (!typed) throw badRequest(`Informe o ${label.toLowerCase()}.`);

  const byCode = await client.query(
    `SELECT product_code FROM ${TB_PRODUCTS} WHERE product_code = $1 LIMIT 1`,
    [typed]
  );
  if (byCode.rowCount) return byCode.rows[0].product_code;

  const byDescription = await client.query(
    `SELECT product_code FROM ${TB_PRODUCTS}
      WHERE LOWER(TRIM(description)) = LOWER($1)
      ORDER BY COALESCE(is_active, TRUE) DESC
      LIMIT 2`,
    [typed]
  );
  if (byDescription.rowCount === 1) return byDescription.rows[0].product_code;
  if (byDescription.rowCount > 1) {
    throw badRequest(`${label} "${typed}": há mais de um produto com essa descrição. Escolha o produto na lista.`);
  }
  throw badRequest(`${label} "${typed}" não está cadastrado em Produtos. Cadastre o produto ou escolha um da lista.`);
}

/** Cria ou atualiza a ficha inteira (cabeçalho + itens + roteiro) numa transação. */
export async function save(bomId, body = {}) {
  const head = cleanHeader(body);
  const items = cleanItems(body.items);
  const operations = cleanOperations(body.operations);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    head.product_code = await resolveProductCode(client, head.product_code, 'Produto');
    for (const [i, it] of items.entries()) {
      it.component_code = await resolveProductCode(client, it.component_code, `Componente da linha ${i + 1}`);
      if (it.component_code === head.product_code) {
        throw badRequest('Um produto não pode ser componente dele mesmo.');
      }
    }

    let id = bomId;
    if (id) {
      const { rowCount } = await client.query(
        `UPDATE ${TB_BOM}
            SET product_code = $2, version = $3, base_qty = $4, notes = $5, is_active = $6, updated_at = NOW()
          WHERE bom_id = $1`,
        [id, head.product_code, head.version, head.base_qty, head.notes, head.is_active]
      );
      if (!rowCount) throw notFound();
      await client.query(`DELETE FROM ${TB_BOM_ITEMS} WHERE bom_id = $1`, [id]);
      await client.query(`DELETE FROM ${TB_BOM_OPERATIONS} WHERE bom_id = $1`, [id]);
    } else {
      ({ rows: [{ bom_id: id }] } = await client.query(
        `INSERT INTO ${TB_BOM} (product_code, version, base_qty, notes, is_active)
         VALUES ($1, $2, $3, $4, $5) RETURNING bom_id`,
        [head.product_code, head.version, head.base_qty, head.notes, head.is_active]
      ));
    }

    for (const it of items) {
      await client.query(
        `INSERT INTO ${TB_BOM_ITEMS} (bom_id, component_code, quantity, loss_percent, notes, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, it.component_code, it.quantity, it.loss_percent, it.notes, it.sort_order]
      );
    }
    for (const op of operations) {
      await client.query(
        `INSERT INTO ${TB_BOM_OPERATIONS} (bom_id, seq, work_center_id, description, setup_minutes, run_minutes_per_unit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, op.seq, op.work_center_id, op.description, op.setup_minutes, op.run_minutes_per_unit]
      );
    }

    await client.query('COMMIT');
    return getById(id);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw badRequest('Já existe uma ficha ativa para este produto (ou esta versão já existe).');
    throw e;
  } finally {
    client.release();
  }
}

export async function remove(bomId) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM ${TB_BOM} WHERE bom_id = $1`, [bomId]);
    if (!rowCount) throw notFound();
    return { removed: true };
  } catch (e) {
    if (e.code !== '23503') throw e;
    // Já usada em ordens de produção: apenas inativa.
    await pool.query(`UPDATE ${TB_BOM} SET is_active = FALSE, updated_at = NOW() WHERE bom_id = $1`, [bomId]);
    return { removed: false, deactivated: true };
  }
}

/** Ficha ativa de um produto (usada ao criar a OP). */
export async function getActiveByProduct(productCode, client = pool) {
  const { rows: [bom] } = await client.query(
    `SELECT * FROM ${TB_BOM} WHERE product_code = $1 AND is_active = TRUE LIMIT 1`,
    [productCode]
  );
  if (!bom) return null;
  const { rows: items } = await client.query(
    `SELECT * FROM ${TB_BOM_ITEMS} WHERE bom_id = $1 ORDER BY sort_order, bom_item_id`,
    [bom.bom_id]
  );
  return { ...bom, items };
}

/** Busca rápida de produtos para os campos de seleção do PCP. */
export async function searchProducts({ q = '', limit = 20 } = {}) {
  const term = String(q || '').trim();
  if (!term) return [];
  const { rows } = await pool.query(
    `SELECT product_code, description, COALESCE(cost_price, 0) AS cost_price
       FROM ${TB_PRODUCTS}
      WHERE COALESCE(is_active, TRUE)
        AND (product_code ILIKE $1 OR description ILIKE $1)
      ORDER BY (product_code ILIKE $2) DESC, description
      LIMIT $3`,
    [`%${term}%`, `${term}%`, Math.min(Number(limit) || 20, 50)]
  );
  return rows;
}
