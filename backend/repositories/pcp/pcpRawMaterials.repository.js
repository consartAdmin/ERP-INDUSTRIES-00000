// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcpRawMaterials.repository.js — Matérias-primas (cadastro próprio) ║
// ║ Estoque, custo médio e movimentações (NF-e, OP, ajuste).           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_RAW_MATERIALS, TB_RAW_MOVEMENTS } from './pcp.constants.js';
import { notEmpty, toText, toNum, badRequest, notFound } from './pcp.sanitizers.js';

/** Origem de uma movimentação de estoque da matéria-prima. */
export const MOVEMENT_SOURCE = Object.freeze({
  INITIAL: 'INICIAL',
  ADJUSTMENT: 'AJUSTE',
  INBOUND: 'NFE',
  PRODUCTION: 'OP',
});

export async function list({ q = '', onlyActive = 'false' } = {}) {
  const params = [];
  const where = [];
  if (String(onlyActive) === 'true') where.push('is_active = TRUE');
  if (notEmpty(q)) {
    params.push(`%${q.trim()}%`);
    where.push(`(code ILIKE $${params.length} OR description ILIKE $${params.length})`);
  }
  const { rows } = await pool.query(
    `SELECT * FROM ${TB_RAW_MATERIALS}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY description`,
    params
  );
  return rows;
}

export async function getById(id) {
  const { rows: [row] } = await pool.query(
    `SELECT * FROM ${TB_RAW_MATERIALS} WHERE raw_material_id = $1`,
    [id]
  );
  if (!row) return null;
  const { rows: movements } = await pool.query(
    `SELECT * FROM ${TB_RAW_MOVEMENTS}
      WHERE raw_material_id = $1
      ORDER BY created_at DESC, movement_id DESC
      LIMIT 50`,
    [id]
  );
  return { ...row, movements };
}

/** Busca rápida para os campos de componente da ficha técnica. */
export async function search({ q = '', limit = 20 } = {}) {
  const term = String(q || '').trim();
  if (!term) return [];
  const { rows } = await pool.query(
    `SELECT raw_material_id, code, description, unit, average_cost, last_cost, stock_qty
       FROM ${TB_RAW_MATERIALS}
      WHERE is_active = TRUE
        AND (code ILIKE $1 OR description ILIKE $1)
      ORDER BY (code ILIKE $2) DESC, description
      LIMIT $3`,
    [`%${term}%`, `${term}%`, Math.min(Number(limit) || 20, 50)]
  );
  return rows;
}

/**
 * Acha a matéria-prima pelo código ou pela descrição exata (sem diferenciar
 * maiúsculas). Devolve { raw_material_id, code } ou lança 400 com mensagem clara.
 */
export async function resolveRawMaterial(client, value, label = 'Matéria-prima') {
  const typed = toText(value);
  if (!typed) throw badRequest(`Informe a ${label.toLowerCase()}.`);

  const byCode = await client.query(
    `SELECT raw_material_id, code FROM ${TB_RAW_MATERIALS} WHERE UPPER(code) = UPPER($1) LIMIT 1`,
    [typed]
  );
  if (byCode.rowCount) return byCode.rows[0];

  const byDescription = await client.query(
    `SELECT raw_material_id, code FROM ${TB_RAW_MATERIALS}
      WHERE LOWER(TRIM(description)) = LOWER($1)
      ORDER BY is_active DESC
      LIMIT 2`,
    [typed]
  );
  if (byDescription.rowCount === 1) return byDescription.rows[0];
  if (byDescription.rowCount > 1) {
    throw badRequest(`${label} "${typed}": há mais de uma matéria-prima com essa descrição. Escolha na lista.`);
  }
  throw badRequest(`${label} "${typed}" não está cadastrada em Matérias-primas.`);
}

function clean(body = {}) {
  const description = toText(body.description);
  if (!description) throw badRequest('Informe a descrição da matéria-prima.');
  const unit = (toText(body.unit) || 'UN').toUpperCase();
  if (unit.length > 10) throw badRequest('A unidade deve ter no máximo 10 caracteres.');
  const ncm = toText(body.ncm)?.replace(/\D/g, '') || null;
  if (ncm && ncm.length !== 8) throw badRequest('O NCM deve ter 8 dígitos.');
  const stock_qty = toNum(body.stock_qty, null);
  const last_cost = toNum(body.last_cost, null);
  if (last_cost !== null && last_cost < 0) throw badRequest('O custo não pode ser negativo.');
  return {
    code: toText(body.code)?.toUpperCase() || null,
    description,
    unit,
    ncm,
    last_cost,
    stock_qty,
    min_stock: Math.max(0, toNum(body.min_stock, 0)),
    notes: toText(body.notes),
    is_active: body.is_active !== false && body.is_active !== 'false',
  };
}

async function nextCode(client) {
  const { rows: [{ n }] } = await client.query(
    `SELECT COALESCE(MAX(SUBSTRING(code FROM '^MP(\\d+)$')::int), 0) + 1 AS n
       FROM ${TB_RAW_MATERIALS}`
  );
  return `MP${String(n).padStart(5, '0')}`;
}

/**
 * Lança uma movimentação e atualiza o saldo. Entradas com custo recalculam o
 * custo médio ponderado e o último custo. Use dentro de uma transação.
 */
export async function moveStock(client, rawMaterialId, quantity, {
  source, unitCost = null, reference = null, notes = null, user = null,
} = {}) {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty === 0) return null;

  const { rows: [current] } = await client.query(
    `SELECT stock_qty, average_cost FROM ${TB_RAW_MATERIALS} WHERE raw_material_id = $1 FOR UPDATE`,
    [rawMaterialId]
  );
  if (!current) throw notFound('Matéria-prima não encontrada.');

  const oldQty = Number(current.stock_qty);
  const balance = oldQty + qty;
  const cost = unitCost === null || unitCost === undefined ? null : Number(unitCost);

  let averageCost = Number(current.average_cost);
  if (qty > 0 && cost !== null && Number.isFinite(cost)) {
    const base = Math.max(oldQty, 0);
    averageCost = base + qty > 0 ? (base * averageCost + qty * cost) / (base + qty) : cost;
  }

  await client.query(
    `UPDATE ${TB_RAW_MATERIALS}
        SET stock_qty = $2,
            average_cost = $3,
            last_cost = CASE WHEN $4::numeric IS NULL THEN last_cost ELSE $4::numeric END,
            updated_at = NOW()
      WHERE raw_material_id = $1`,
    [rawMaterialId, balance, averageCost, qty > 0 ? cost : null]
  );

  const { rows: [movement] } = await client.query(
    `INSERT INTO ${TB_RAW_MOVEMENTS}
       (raw_material_id, quantity, unit_cost, balance_after, source, reference, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [rawMaterialId, qty, cost, balance, source, reference, notes, user]
  );
  return movement;
}

const userName = (user) => user?.name || user?.email || null;

export async function create(body, user = null) {
  const d = clean(body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = d.code || await nextCode(client);
    const cost = d.last_cost ?? 0;
    const { rows: [row] } = await client.query(
      `INSERT INTO ${TB_RAW_MATERIALS}
         (code, description, unit, ncm, last_cost, average_cost, min_stock, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8) RETURNING raw_material_id`,
      [code, d.description, d.unit, d.ncm, cost, d.min_stock, d.notes, d.is_active]
    );
    if (d.stock_qty) {
      await moveStock(client, row.raw_material_id, d.stock_qty, {
        source: MOVEMENT_SOURCE.INITIAL, unitCost: cost, notes: 'Saldo inicial', user: userName(user),
      });
    }
    await client.query('COMMIT');
    return getById(row.raw_material_id);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw badRequest('Já existe uma matéria-prima com este código.');
    throw e;
  } finally {
    client.release();
  }
}

/** Atualiza o cadastro. Mudança no estoque vira uma movimentação de ajuste. */
export async function update(id, body, user = null) {
  const d = clean(body);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [current] } = await client.query(
      `SELECT code, stock_qty FROM ${TB_RAW_MATERIALS} WHERE raw_material_id = $1 FOR UPDATE`,
      [id]
    );
    if (!current) throw notFound('Matéria-prima não encontrada.');

    await client.query(
      `UPDATE ${TB_RAW_MATERIALS}
          SET code = $2, description = $3, unit = $4, ncm = $5,
              last_cost = COALESCE($6, last_cost), min_stock = $7, notes = $8, is_active = $9,
              updated_at = NOW()
        WHERE raw_material_id = $1`,
      [id, d.code || current.code, d.description, d.unit, d.ncm, d.last_cost, d.min_stock, d.notes, d.is_active]
    );

    if (d.stock_qty !== null) {
      const diff = d.stock_qty - Number(current.stock_qty);
      if (Math.abs(diff) > 1e-9) {
        await moveStock(client, id, diff, {
          source: MOVEMENT_SOURCE.ADJUSTMENT,
          notes: toText(body.adjustment_reason) || 'Ajuste manual pelo cadastro',
          user: userName(user),
        });
      }
    }
    await client.query('COMMIT');
    return getById(id);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw badRequest('Já existe uma matéria-prima com este código.');
    throw e;
  } finally {
    client.release();
  }
}

export async function remove(id) {
  try {
    const { rowCount } = await pool.query(`DELETE FROM ${TB_RAW_MATERIALS} WHERE raw_material_id = $1`, [id]);
    if (!rowCount) throw notFound();
    return { removed: true };
  } catch (e) {
    if (e.code !== '23503') throw e;
    // Usada em fichas técnicas ou OPs: apenas inativa.
    await pool.query(
      `UPDATE ${TB_RAW_MATERIALS} SET is_active = FALSE, updated_at = NOW() WHERE raw_material_id = $1`,
      [id]
    );
    return { removed: false, deactivated: true };
  }
}
