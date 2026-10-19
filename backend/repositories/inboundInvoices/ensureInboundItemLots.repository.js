// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ ensureInboundItemLots.repository.js — CONSART ERP | Notas de Entrada    ║
// ║ Resolve/cria lotes e persiste inboundInvoiceItems.lot_id                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { TB_III } from './_shared.js';

const DEFAULT_LOT_CODE = 'LOTE PADRÃO';

function positiveInteger(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function firstScalar(value) {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const scalar = firstScalar(entry);
      if (scalar !== null) return scalar;
    }
    return null;
  }

  if (value && typeof value === 'object') {
    if (value._ !== undefined) return firstScalar(value._);
    if (value['#text'] !== undefined) return firstScalar(value['#text']);
    return null;
  }

  return textOrNull(value);
}

function findFirstByKeys(root, wantedKeys) {
  const wanted = new Set(
    wantedKeys.map((key) => String(key).replace(/[^a-z0-9]/gi, '').toLowerCase()),
  );

  const visited = new Set();
  const queue = [root];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = String(key).replace(/[^a-z0-9]/gi, '').toLowerCase();

      if (wanted.has(normalizedKey)) {
        const scalar = firstScalar(value);
        if (scalar !== null) return scalar;
      }

      if (Array.isArray(value)) {
        queue.push(...value);
      } else if (value && typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
}

function resolveLotCode(item = {}) {
  const direct = textOrNull(
    item.lot_code ??
    item.lotCode ??
    item.lote ??
    item.lot ??
    item.nLote,
  );

  if (direct) return direct;

  const payload = parseJson(item.raw_product_payload);
  const fromPayload = findFirstByKeys(payload, [
    'nLote',
    'lot_code',
    'lotCode',
    'lote',
    'lot',
  ]);

  return textOrNull(fromPayload) || DEFAULT_LOT_CODE;
}

function resolveExpirationDate(item = {}) {
  const direct = textOrNull(
    item.expires_at ??
    item.expiration_date ??
    item.validade ??
    item.dVal,
  );

  if (direct) return direct.slice(0, 10);

  const payload = parseJson(item.raw_product_payload);
  const fromPayload = findFirstByKeys(payload, [
    'dVal',
    'expires_at',
    'expiration_date',
    'validade',
  ]);

  return textOrNull(fromPayload)?.slice(0, 10) || null;
}

async function loadProductStock(client, productCode) {
  const { rows } = await client.query(
    `
      SELECT
        p.product_id,
        p.product_code,
        p.product_stock_id
      FROM public.products p
      WHERE TRIM(p.product_code) = $1
      LIMIT 1
    `,
    [productCode],
  );

  const row = rows[0] || null;
  if (!row || !positiveInteger(row.product_stock_id)) {
    const error = new Error(
      `SKU ${productCode}: product_stock_id não encontrado para vincular o lote da NF-e de entrada.`,
    );
    error.code = 'INBOUND_PRODUCT_STOCK_NOT_FOUND';
    error.status = 422;
    error.statusCode = 422;
    error.details = { productCode };
    throw error;
  }

  return row;
}

async function validateExistingLot(client, item, productStockId) {
  const lotId = positiveInteger(item.lot_id);
  if (!lotId) return null;

  const { rows } = await client.query(
    `
      SELECT
        lot_id,
        product_stock_id,
        product_grade_id,
        lot_code,
        expires_at,
        qty_on_hand,
        qty_reserved,
        is_active,
        deleted_at
      FROM public."productsStockLots"
      WHERE lot_id = $1
        AND product_stock_id = $2
        AND COALESCE(is_active, TRUE) = TRUE
        AND deleted_at IS NULL
      LIMIT 1
      FOR UPDATE
    `,
    [lotId, productStockId],
  );

  const lot = rows[0] || null;
  if (!lot) {
    const error = new Error(
      `SKU ${item.product_code}: lote ${lotId} não pertence ao estoque do produto ou está inativo.`,
    );
    error.code = 'INBOUND_ITEM_LOT_INVALID';
    error.status = 422;
    error.statusCode = 422;
    error.details = {
      productCode: item.product_code,
      lotId,
      productStockId,
    };
    throw error;
  }

  const itemGradeId = positiveInteger(item.product_grade_id);
  const lotGradeId = positiveInteger(lot.product_grade_id);

  if (itemGradeId && lotGradeId && itemGradeId !== lotGradeId) {
    const error = new Error(
      `SKU ${item.product_code}: o lote ${lotId} pertence a outra grade do produto.`,
    );
    error.code = 'INBOUND_ITEM_LOT_GRADE_MISMATCH';
    error.status = 422;
    error.statusCode = 422;
    error.details = {
      productCode: item.product_code,
      lotId,
      productGradeId: itemGradeId,
      lotProductGradeId: lotGradeId,
    };
    throw error;
  }

  return lot;
}

async function findLotBySource(client, item, productStockId) {
  const nfeKey = textOrNull(item.nfe_key);
  const nfeItemSeq = positiveInteger(item.nfe_item_seq);
  if (!nfeKey || !nfeItemSeq) return null;

  const { rows } = await client.query(
    `
      SELECT *
      FROM public."productsStockLots"
      WHERE product_stock_id = $1
        AND nfe_key = $2
        AND nfe_item_seq = $3
        AND COALESCE(is_active, TRUE) = TRUE
        AND deleted_at IS NULL
      ORDER BY lot_id DESC
      LIMIT 1
      FOR UPDATE
    `,
    [productStockId, nfeKey, nfeItemSeq],
  );

  return rows[0] || null;
}

async function findLotByCode(client, item, productStockId, lotCode, expiresAt) {
  const productGradeId = positiveInteger(item.product_grade_id);

  if (productGradeId) {
    const { rows } = await client.query(
      `
        SELECT *
        FROM public."productsStockLots"
        WHERE product_stock_id = $1
          AND product_grade_id = $2
          AND LOWER(BTRIM(lot_code)) = LOWER(BTRIM($3))
          AND COALESCE(is_active, TRUE) = TRUE
          AND deleted_at IS NULL
          AND (
            $4::date IS NULL
            OR expires_at IS NULL
            OR expires_at = $4::date
          )
        ORDER BY
          CASE WHEN expires_at = $4::date THEN 0 ELSE 1 END,
          lot_id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [productStockId, productGradeId, lotCode, expiresAt],
    );

    return rows[0] || null;
  }

  // XMLs antigos podem não trazer product_grade_id. Nessa situação, reutiliza
  // o lote somente quando o código identifica um único lote ativo do produto.
  // Se houver várias grades com o mesmo código, não escolhemos uma arbitrariamente.
  const { rows } = await client.query(
    `
      SELECT *
      FROM public."productsStockLots"
      WHERE product_stock_id = $1
        AND LOWER(BTRIM(lot_code)) = LOWER(BTRIM($2))
        AND COALESCE(is_active, TRUE) = TRUE
        AND deleted_at IS NULL
        AND (
          $3::date IS NULL
          OR expires_at IS NULL
          OR expires_at = $3::date
        )
      ORDER BY
        CASE WHEN expires_at = $3::date THEN 0 ELSE 1 END,
        lot_id DESC
      LIMIT 2
      FOR UPDATE
    `,
    [productStockId, lotCode, expiresAt],
  );

  if (rows.length === 1) return rows[0];

  if (rows.length > 1) {
    const error = new Error(
      `SKU ${item.product_code}: existem vários lotes "${lotCode}" em grades diferentes. Vincule a grade/lote correto antes de postar a NF-e.`,
    );
    error.code = 'INBOUND_ITEM_LOT_AMBIGUOUS';
    error.status = 422;
    error.statusCode = 422;
    error.details = {
      productCode: item.product_code,
      productStockId,
      lotCode,
      candidateLotIds: rows.map((row) => Number(row.lot_id)),
    };
    throw error;
  }

  return null;
}

async function createLot(client, item, productStockId, lotCode, expiresAt) {
  const productGradeId = positiveInteger(item.product_grade_id);
  const unitPrice = numberOrNull(item.unit_price);
  const nfeKey = textOrNull(item.nfe_key);
  const nfeItemSeq = positiveInteger(item.nfe_item_seq);

  try {
    const { rows } = await client.query(
      `
        INSERT INTO public."productsStockLots" (
          product_stock_id,
          product_grade_id,
          lot_code,
          expires_at,
          qty_on_hand,
          qty_reserved,
          cost_unit,
          nfe_key,
          nfe_item_seq,
          is_active,
          deleted_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::date,
          0,
          0,
          $5,
          $6,
          $7,
          TRUE,
          NULL
        )
        RETURNING *
      `,
      [
        productStockId,
        productGradeId,
        lotCode,
        expiresAt,
        unitPrice,
        nfeKey,
        nfeItemSeq,
      ],
    );

    return rows[0];
  } catch (error) {
    // Outra requisição pode ter criado o mesmo lote entre o SELECT e o INSERT.
    if (error?.code !== '23505') throw error;

    const existing = await findLotByCode(
      client,
      item,
      productStockId,
      lotCode,
      expiresAt,
    );

    if (existing) return existing;
    throw error;
  }
}

async function enrichLotSourceMetadata(client, lot, item) {
  if (!lot?.lot_id) return lot;

  const nfeKey = textOrNull(item.nfe_key);
  const nfeItemSeq = positiveInteger(item.nfe_item_seq);
  const unitPrice = numberOrNull(item.unit_price);

  const { rows } = await client.query(
    `
      UPDATE public."productsStockLots"
      SET
        nfe_key = COALESCE(nfe_key, $2),
        nfe_item_seq = COALESCE(nfe_item_seq, $3),
        cost_unit = COALESCE(cost_unit, $4),
        updated_at = NOW()
      WHERE lot_id = $1
      RETURNING *
    `,
    [lot.lot_id, nfeKey, nfeItemSeq, unitPrice],
  );

  return rows[0] || lot;
}

async function persistInboundItemLot(client, inboundItemId, lotId) {
  const { rows } = await client.query(
    `
      UPDATE ${TB_III}
      SET
        lot_id = $2,
        updated_at = NOW()
      WHERE inbound_item_id = $1
      RETURNING inbound_item_id, inbound_id, product_code, product_grade_id, lot_id
    `,
    [inboundItemId, lotId],
  );

  return rows[0] || null;
}

export async function ensureInboundItemLot(client, item = {}) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('client PostgreSQL inválido em ensureInboundItemLot().');
  }

  const inboundItemId = positiveInteger(item.inbound_item_id);
  const productCode = textOrNull(item.product_code);

  if (!inboundItemId || !productCode) {
    return { ...item, lot_id: item.lot_id ?? null, skipped: true };
  }

  const product = await loadProductStock(client, productCode);
  const productStockId = positiveInteger(product.product_stock_id);

  let lot = await validateExistingLot(client, item, productStockId);

  if (!lot) {
    lot = await findLotBySource(client, item, productStockId);
  }

  const lotCode = resolveLotCode(item);
  const expiresAt = resolveExpirationDate(item);

  if (!lot) {
    lot = await findLotByCode(
      client,
      item,
      productStockId,
      lotCode,
      expiresAt,
    );
  }

  if (!lot) {
    lot = await createLot(
      client,
      item,
      productStockId,
      lotCode,
      expiresAt,
    );
  }

  lot = await enrichLotSourceMetadata(client, lot, item);

  await persistInboundItemLot(client, inboundItemId, lot.lot_id);

  return {
    ...item,
    lot_id: Number(lot.lot_id),
    lot_code: lot.lot_code,
    expires_at: lot.expires_at ?? expiresAt ?? null,
    product_stock_id: productStockId,
    lot_created_or_resolved: true,
  };
}

export async function ensureInboundItemLots(client, items = []) {
  const output = [];

  for (const item of Array.isArray(items) ? items : []) {
    output.push(await ensureInboundItemLot(client, item));
  }

  return output;
}

export default ensureInboundItemLots;
