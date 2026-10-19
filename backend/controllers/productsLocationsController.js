// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsController.js — CONSART ERP (ESM)                   ║
// ║ Tabela: public."productsLocations"                                   ║
// ║ Endpoints:                                                           ║
// ║   GET  /api/products-locations/by-product/:product_code               ║
// ║   GET  /api/products-locations                                       ║
// ║   GET  /api/products-locations/:id                                   ║
// ║   POST /api/products-locations                                       ║
// ║   PUT  /api/products-locations/:id                                   ║
// ║   PATCH /api/products-locations/:id/deactivate                        ║
// ║   DELETE /api/products-locations/:id                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';

// ✅ NEW: use your DAL that now searches SKU/description/barcode
import productsLocationsApi from '../repositories/productsLocations/productsLocations.index.js';

const TB = 'public."productsLocations"';

const toInt = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

const sanitizeBoolean = (v, def = true) => {
  if (v === undefined || v === null || v === '') return def;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 't', 'y', 'yes', 'sim'].includes(s)) return true;
  if (['false', '0', 'f', 'n', 'no', 'nao', 'não'].includes(s)) return false;
  return def;
};

const toTextOrNull = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return String(v);
};

const toVarcharOrNull = (v, max = 50) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, max) : null;
};

const toStoreIdOrNull = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

function normalizeRow(r = {}) {
  return {
    id: Number(r.id),
    product_code: r.product_code,
    store_id: r.store_id == null ? null : Number(r.store_id),
    corredor: r.corredor ?? null,
    prateleira: r.prateleira ?? null,
    bandeja: r.bandeja ?? null,
    box: r.box ?? null,
    observacao: r.observacao ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    is_active: !!r.is_active,
  };
}

function buildLabel(r) {
  const parts = [
    r.store_id ? `LOCAL ${r.store_id}` : 'LOCAL —',
    r.corredor ? `CORREDOR ${r.corredor}` : 'CORREDOR —',
    r.prateleira ? `GÔNDOLA ${r.prateleira}` : 'GÔNDOLA —',
    r.bandeja ? `BANDEJA ${r.bandeja}` : 'BANDEJA —',
    r.box ? `POSIÇÃO ${r.box}` : 'POSIÇÃO —',
  ];
  if (r.observacao) parts.push(`OBS: ${r.observacao}`);
  return parts.join(' | ');
}

/* ============================================================
   GET /api/products-locations/by-product/:product_code
   Query: onlyActive=true|false
   ============================================================ */
export async function listByProduct(req, res) {
  try {
    const product_code = String(req.params.product_code || '').trim();
    if (!product_code) {
      return res.status(400).json({ error: 'product_code é obrigatório.' });
    }

    const onlyActive = sanitizeBoolean(req.query.onlyActive, true);

    const where = ['product_code = $1'];
    const params = [product_code];

    if (onlyActive) where.push('is_active = TRUE');

    // is_primary: é a localização salva no produto (products.product_location_id)
    const sql = `
      SELECT l.*,
        COALESCE((
          SELECT p.product_location_id = l.id
          FROM public."products" p
          WHERE p.product_code = l.product_code
          LIMIT 1
        ), FALSE) AS is_primary
      FROM ${TB} l
      WHERE ${where.map((w) => `l.${w}`).join(' AND ')}
      ORDER BY l.id ASC;
    `;

    const { rows } = await pool.query(sql, params);

    const data = rows.map((r) => {
      const normalized = normalizeRow(r);
      return { ...normalized, is_primary: !!r.is_primary, label: buildLabel(normalized) };
    });

    return res.json({ data });
  } catch (err) {
    console.error('[productsLocations][listByProduct]', err);
    return res.status(500).json({ error: 'Erro ao listar localizações do produto.' });
  }
}

/* ============================================================
   REST padrão
   ============================================================ */

// ✅ UPDATED: list now supports q/store_id/corredor/prateleira/bandeja/onlyActive
export async function list(req, res) {
  try {
    const q = String(req.query.q || '').trim() || undefined;

    const product_code =
      String(
        req.query.product_code ??
        req.query.productCode ??
        req.query.sku ??
        ''
      ).trim() || undefined;

    // accept both store_id and storeId
    const store_id = req.query.store_id ?? req.query.storeId ?? undefined;

    // ✅ accept filters used by modal
    const corredor = String(req.query.corredor || '').trim() || undefined;
    const prateleira =
      String(req.query.prateleira || req.query.gondola || '').trim() || undefined;
    const bandeja = String(req.query.bandeja || '').trim() || undefined;

    const limit = toInt(req.query.limit, 50);
    const offset = toInt(req.query.offset, 0);

    // ✅ accept both onlyActive and active
    const onlyActive = sanitizeBoolean(
      req.query.onlyActive ?? req.query.active,
      false
    );

    const result = await productsLocationsApi.list({
      q,
      product_code,
      store_id,
      corredor,
      prateleira,
      bandeja,
      limit,
      offset,
      onlyActive,
    });

    return res.json(result); // { rows, total, limit, offset }
  } catch (err) {
    console.error('[productsLocations][list]', err);
    return res.status(500).json({ error: 'Erro ao listar.' });
  }
}

export async function getById(req, res) {
  try {
    const id = toInt(req.params.id, -1);
    if (id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    const { rows } = await pool.query(`SELECT * FROM ${TB} WHERE id = $1;`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });

    return res.json(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[productsLocations][getById]', err);
    return res.status(500).json({ error: 'Erro ao buscar.' });
  }
}

export async function create(req, res) {
  try {
    const body = req.body || {};

    const product_code = String(body.product_code || '').trim();
    if (!product_code) return res.status(400).json({ error: 'product_code é obrigatório.' });

    const store_id = toStoreIdOrNull(body.store_id);
    const corredor = toVarcharOrNull(body.corredor, 50);
    const prateleira = toVarcharOrNull(body.prateleira, 50);
    const bandeja = toVarcharOrNull(body.bandeja, 50);
    const box = toVarcharOrNull(body.box, 50);
    const observacao = toTextOrNull(body.observacao);
    const is_active = sanitizeBoolean(body.is_active, true);

    const sql = `
      INSERT INTO ${TB}
      (product_code, store_id, corredor, prateleira, bandeja, box, observacao, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      product_code,
      store_id,
      corredor,
      prateleira,
      bandeja,
      box,
      observacao,
      is_active,
    ]);

    return res.status(201).json(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[productsLocations][create]', err);
    return res.status(500).json({ error: 'Erro ao criar.' });
  }
}

export async function update(req, res) {
  try {
    const id = toInt(req.params.id, -1);
    if (id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    const body = req.body || {};

    const product_code = String(body.product_code || '').trim();
    if (!product_code) return res.status(400).json({ error: 'product_code é obrigatório.' });

    const store_id = toStoreIdOrNull(body.store_id);
    const corredor = toVarcharOrNull(body.corredor, 50);
    const prateleira = toVarcharOrNull(body.prateleira, 50);
    const bandeja = toVarcharOrNull(body.bandeja, 50);
    const box = toVarcharOrNull(body.box, 50);
    const observacao = toTextOrNull(body.observacao);
    const is_active = sanitizeBoolean(body.is_active, true);

    const sql = `
      UPDATE ${TB}
      SET product_code=$1, store_id=$2, corredor=$3,
          prateleira=$4, bandeja=$5, box=$6,
          observacao=$7, is_active=$8, updated_at=NOW()
      WHERE id=$9
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      product_code,
      store_id,
      corredor,
      prateleira,
      bandeja,
      box,
      observacao,
      is_active,
      id,
    ]);

    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });

    return res.json(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[productsLocations][update]', err);
    return res.status(500).json({ error: 'Erro ao atualizar.' });
  }
}

export async function deactivate(req, res) {
  try {
    const id = toInt(req.params.id, -1);
    if (id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    const { rows } = await pool.query(
      `UPDATE ${TB} SET is_active=FALSE, updated_at=NOW() WHERE id=$1 RETURNING *;`,
      [id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });

    return res.json(normalizeRow(rows[0]));
  } catch (err) {
    console.error('[productsLocations][deactivate]', err);
    return res.status(500).json({ error: 'Erro ao desativar.' });
  }
}

export async function remove(req, res) {
  try {
    const id = toInt(req.params.id, -1);
    if (id <= 0) return res.status(400).json({ error: 'ID inválido.' });

    const { rows } = await pool.query(`DELETE FROM ${TB} WHERE id=$1 RETURNING id;`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Não encontrado.' });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[productsLocations][remove]', err);
    return res.status(500).json({ error: 'Erro ao excluir.' });
  }
}

export default {
  list,
  listByProduct,
  getById,
  create,
  update,
  deactivate,
  remove,
};