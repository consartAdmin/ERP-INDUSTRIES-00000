// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ 🧮 batchProductsPricesController.js — Batch Product Prices (CONSART | ESM)║
// ║                                                                          ║
// ║  Tabela base: public."productsPrices"                                    ║
// ║                                                                          ║
// ║  Endpoints principais (via routes):                                      ║
// ║    POST /api/products-prices/batch/upsert                                ║
// ║      → upsertBatchPrices()                                               ║
// ║         Body: { items: [ { product_id, price_id, sale_price?,            ║
// ║                          markup_percent?, gross_profit_pct? }, ... ] }   ║
// ║                                                                          ║
// ║    POST /api/products-prices/batch/adjust                                ║
// ║      → adjustBatchByPriceTable()                                         ║
// ║         Body: {                                                          ║
// ║           price_id: number,                                             ║
// ║           mode?: 'percent' | 'amount' | 'set',                          ║
// ║           operation?: 'increase' | 'decrease',                           ║
// ║           value: number,                                                ║
// ║           product_ids?: string[]                                        ║
// ║         }                                                                ║
// ║                                                                          ║
// ║  Observação:                                                             ║
// ║   - As FKs assumem product_id (varchar) + price_id (integer).           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';

/* ──────────────────────────────────────────────────────────────
   Tables & Helpers
   ────────────────────────────────────────────────────────────── */

const TB = 'public."productsPrices"';
const ALIAS = 'pp';

const isFiniteNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n);
};
const toNumOrNull = (v) => (isFiniteNum(v) ? Number(v) : null);
const toNumOrZero = (v) => (isFiniteNum(v) ? Number(v) : 0);

/** Map DB row → objeto API canônico */
function mapRow(r = {}) {
  return {
    product_price_id: r.product_price_id,
    product_id: String(r.product_id),
    price_id: toNumOrZero(r.price_id),
    sale_price: toNumOrNull(r.sale_price),
    markup_percent: toNumOrNull(r.markup_percent),
    gross_profit_pct: toNumOrNull(r.gross_profit_pct),
    updated_at: r.updated_at,
  };
}

/* ──────────────────────────────────────────────────────────────
   1) Upsert em lote (vários produtos, várias tabelas)
   ────────────────────────────────────────────────────────────── */
/**
 * POST /api/products-prices/batch/upsert
 * Body:
 *  {
 *    items: [
 *      {
 *        product_id: "SKU001",
 *        price_id: 1,
 *        sale_price?: 49.9,
 *        markup_percent?: 100.4,
 *        gross_profit_pct?: 50.1
 *      },
 *      ...
 *    ]
 *  }
 */
export async function upsertBatchPrices(req, res) {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

  if (!rawItems.length) {
    return res
      .status(400)
      .json({ ok: false, error: 'Body.items must be a non-empty array.' });
  }

  // Normaliza entradas
  const items = rawItems
    .map((it) => {
      const product_id = String(it.product_id ?? '').trim();
      const price_id = Number(it.price_id ?? it.tabela_preco_id);
      if (!product_id || !Number.isInteger(price_id)) return null;

      return {
        product_id,
        price_id,
        sale_price: toNumOrNull(it.sale_price ?? it.preco_venda),
        markup_percent: toNumOrNull(it.markup_percent),
        gross_profit_pct: toNumOrNull(it.gross_profit_pct),
      };
    })
    .filter(Boolean);

  if (!items.length) {
    return res.status(400).json({
      ok: false,
      error:
        'Every item must include a valid product_id (string) and price_id (integer).',
    });
  }

  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');

    for (const it of items) {
      const { rows } = await client.query(
        `
        INSERT INTO ${TB} (
          product_id,
          price_id,
          sale_price,
          markup_percent,
          gross_profit_pct,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, now())
        ON CONFLICT (product_id, price_id)
        DO UPDATE SET
          sale_price       = EXCLUDED.sale_price,
          markup_percent   = EXCLUDED.markup_percent,
          gross_profit_pct = EXCLUDED.gross_profit_pct,
          updated_at       = now()
        RETURNING
          product_price_id,
          product_id,
          price_id,
          sale_price,
          markup_percent,
          gross_profit_pct,
          updated_at
        `,
        [
          it.product_id,
          it.price_id,
          it.sale_price,
          it.markup_percent,
          it.gross_profit_pct,
        ]
      );

      if (rows[0]) results.push(mapRow(rows[0]));
    }

    await client.query('COMMIT');
    return res.status(201).json({ ok: true, data: results, rows: results });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[batchProductsPrices:upsertBatchPrices] error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Failed to upsert batch product prices.' });
  } finally {
    client.release();
  }
}

/* ──────────────────────────────────────────────────────────────
   2) Ajuste em lote por tabela de preço (percentual, valor, set)
   ────────────────────────────────────────────────────────────── */
/**
 * POST /api/products-prices/batch/adjust
 *
 * Body:
 *  {
 *    price_id: 1,                 // obrigatório
 *    mode: 'percent' | 'amount' | 'set',   // default: 'percent'
 *    operation: 'increase' | 'decrease',   // default: 'increase' (para percent/amount)
 *    value: 5.0,                  // obrigatório (percentual, valor, ou novo preço)
 *    product_ids?: ["SKU001", "SKU002"] // opcional; se vazio, aplica em todos da tabela
 *  }
 *
 * - mode 'percent': ajusta sale_price por multiplicação
 *     increase → sale_price = sale_price * (1 + value/100)
 *     decrease → sale_price = sale_price * (1 - value/100)
 *
 * - mode 'amount': ajusta sale_price por soma/subtração
 *     increase → sale_price = sale_price + value
 *     decrease → sale_price = sale_price - value
 *
 * - mode 'set': define sale_price = value (ignora operation)
 */
/* ──────────────────────────────────────────────────────────────
   2) Ajuste em lote por tabela de preço (percent/amount/set/margin)
   ────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────
   2) Ajuste em lote por tabela de preço
   ────────────────────────────────────────────────────────────── */
/**
 * POST /api/products-prices/batch/adjust
 *
 * Body:
 *  {
 *    price_id: 1,                 // obrigatório
 *    mode: 'percent' | 'amount' | 'set' | 'margin', // default: 'percent'
 *    operation: 'increase' | 'decrease',            // percent/amount
 *    value: 5.0,                  // obrigatório
 *    product_ids?: ["3140","3141"] // IDs internos (products.product_id)
 *  }
 *
 *  🔹 mode = 'margin'
 *    - value = Lucro Bruto (%) sobre o PREÇO de venda
 *    - Fórmula:  margem = (preço - custo) / preço
 *      → preço = custo / (1 - margem/100)
 *    - Grava:
 *        sale_price       = preço calculado
 *        gross_profit_pct = margem (value)
 *        markup_percent   = (preço - custo) / custo * 100
 *    - Usa INSERT ... ON CONFLICT para CRIAR ou ATUALIZAR linhas
 */
export async function adjustBatchByPriceTable(req, res) {
  const price_id = Number(req.body?.price_id);
  const modeRaw = req.body?.mode ?? 'percent';
  const mode = String(modeRaw).toLowerCase();
  const opRaw = req.body?.operation ?? 'increase';
  const operation = String(opRaw).toLowerCase();
  const rawValue = req.body?.value;

  if (!Number.isInteger(price_id)) {
    return res
      .status(400)
      .json({ ok: false, error: 'price_id (integer) is required.' });
  }

  const value = toNumOrNull(rawValue);
  if (value === null) {
    return res
      .status(400)
      .json({ ok: false, error: 'value (number) is required.' });
  }

  const rawProductIds = Array.isArray(req.body?.product_ids)
    ? req.body.product_ids
    : [];

  // IDs internos (products.product_id INTEGER)
  const productIdInts = rawProductIds
    .map((id) => Number(id))
    .filter((n) => Number.isInteger(n));

  /* ──────────────────────────────────────────────────────────
     🔹 Novo modo: margin (Lucro Bruto % sobre o PREÇO)
     ──────────────────────────────────────────────────────── */
  if (mode === 'margin') {
    // margem tem que ser > 0 e < 100 para evitar divisão por zero/inversa
    if (value <= 0 || value >= 100) {
      return res.status(400).json({
        ok: false,
        error: 'margin (gross_profit_pct) must be between 0 and 99.99.',
      });
    }

    const params = [price_id, value];
    const whereParts = ['prod.cost_price IS NOT NULL', 'prod.cost_price > 0'];

    if (productIdInts.length) {
      params.push(productIdInts);
      whereParts.push(`prod.product_id = ANY($${params.length})`);
    }

    const sql = `
      INSERT INTO ${TB} (
        product_id,
        price_id,
        sale_price,
        markup_percent,
        gross_profit_pct,
        updated_at
      )
      SELECT
        prod.product_id::varchar               AS product_id,
        $1::integer                             AS price_id,
        -- preço de venda pela margem de lucro bruto (%)
        ROUND(
          prod.cost_price / (1 - $2::numeric / 100.0),
          2
        )                                       AS sale_price,
        -- markup (%) apenas informativo (sobre o custo)
        CASE
          WHEN prod.cost_price > 0 THEN
            ROUND(
              (
                (prod.cost_price / (1 - $2::numeric / 100.0)) - prod.cost_price
              ) / prod.cost_price * 100.0,
              2
            )
          ELSE NULL
        END                                     AS markup_percent,
        $2::numeric                             AS gross_profit_pct,
        now()                                   AS updated_at
      FROM public."products" prod
      WHERE ${whereParts.join(' AND ')}
      ON CONFLICT (product_id, price_id)
      DO UPDATE SET
        sale_price       = EXCLUDED.sale_price,
        markup_percent   = EXCLUDED.markup_percent,
        gross_profit_pct = EXCLUDED.gross_profit_pct,
        updated_at       = now()
      RETURNING
        product_price_id,
        product_id,
        price_id,
        sale_price,
        markup_percent,
        gross_profit_pct,
        updated_at
    `;

    try {
      const { rows } = await pool.query(sql, params);

      if (!rows.length) {
        return res.status(404).json({
          ok: false,
          error:
            'No product prices could be updated/created for the given margin criteria.',
        });
      }

      const mapped = rows.map(mapRow);
      return res.json({ ok: true, data: mapped, rows: mapped });
    } catch (err) {
      console.error(
        '[batchProductsPrices:adjustBatchByPriceTable margin] error:',
        err
      );
      return res.status(500).json({
        ok: false,
        error: 'Failed to apply margin-based price adjustment.',
      });
    }
  }

  /* ──────────────────────────────────────────────────────────
     Modos antigos: percent / amount / set (mantidos)
     ──────────────────────────────────────────────────────── */
  const product_ids =
    rawProductIds
      ?.map((id) => String(id ?? '').trim())
      .filter((id) => !!id) ?? [];

  let updateExpr = '';
  const params = [price_id];
  const whereClauses = [`${ALIAS}.price_id = $1`];

  if (product_ids.length) {
    params.push(product_ids);
    whereClauses.push(`${ALIAS}.product_id = ANY($${params.length})`);
  }

  if (mode === 'percent') {
    params.push(value);
    const idx = params.length;
    const factorExpr =
      operation === 'decrease'
        ? `(1 - $${idx}::numeric / 100.0)`
        : `(1 + $${idx}::numeric / 100.0)`;
    updateExpr = `${ALIAS}.sale_price * ${factorExpr}`;
  } else if (mode === 'amount') {
    params.push(value);
    const idx = params.length;
    const sign = operation === 'decrease' ? '-' : '+';
    updateExpr = `${ALIAS}.sale_price ${sign} $${idx}`;
  } else if (mode === 'set') {
    params.push(value);
    const idx = params.length;
    updateExpr = `$${idx}`;
  } else {
    return res.status(400).json({
      ok: false,
      error: "mode must be 'percent', 'amount', 'set' or 'margin'.",
    });
  }

  const sql = `
    UPDATE ${TB} ${ALIAS}
    SET
      sale_price = ${updateExpr},
      updated_at = now()
    WHERE ${whereClauses.join(' AND ')}
    RETURNING
      ${ALIAS}.product_price_id,
      ${ALIAS}.product_id,
      ${ALIAS}.price_id,
      ${ALIAS}.sale_price,
      ${ALIAS}.markup_percent,
      ${ALIAS}.gross_profit_pct,
      ${ALIAS}.updated_at
  `;

  try {
    const { rows } = await pool.query(sql, params);
    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        error: 'No product prices found for the given criteria.',
      });
    }

    const mapped = rows.map(mapRow);
    return res.json({ ok: true, data: mapped, rows: mapped });
  } catch (err) {
    console.error('[batchProductsPrices:adjustBatchByPriceTable] error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Failed to adjust batch product prices.' });
  }
}

/* ──────────────────────────────────────────────────────────────
   Default Export
   ────────────────────────────────────────────────────────────── */
const BatchProductsPricesController = {
  upsertBatchPrices,
  adjustBatchByPriceTable,
};

export default BatchProductsPricesController;
