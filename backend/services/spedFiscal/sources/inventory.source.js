// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.source.js                                                 ║
// ║ Fonte de inventário para o Bloco H do SPED Fiscal                   ║
// ║ CONSART ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../../config/db.js';

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeFiscalProductCode(value) {
  const code = String(value ?? '').trim();
  if (!/^\d+$/.test(code)) return code;

  const significant = code.replace(/^0+/, '') || '0';
  return significant.padStart(6, '0');
}

function normalizeInventoryRow(row) {
  const quantidade = toNumber(row.quantidade);
  const valor_unitario = toNumber(row.valor_unitario);
  const valor_total = toNumber(row.valor_total, quantidade * valor_unitario);

  return {
    codigo_produto: normalizeFiscalProductCode(row.codigo_produto),
    unidade: row.unidade || 'UN',
    quantidade,
    valor_unitario,
    valor_total,
    ind_prop: row.ind_prop || '0',
    cod_part: row.cod_part || '',
    txt_compl: row.txt_compl || '',
    cod_cta: row.cod_cta || ''
  };
}

export async function getInventorySource() {
  const sql = `
    SELECT
      p.product_code::text AS codigo_produto,
      COALESCE(u.unit, 'UN') AS unidade,
      COALESCE(ps.stock_qty, 0) AS quantidade,
      COALESCE(p.cost_price, 0) AS valor_unitario,
      COALESCE(ps.stock_qty, 0) * COALESCE(p.cost_price, 0) AS valor_total,
      '0'::text AS ind_prop,
      ''::text AS cod_part,
      ''::text AS txt_compl,
      ''::text AS cod_cta
    FROM products p
    LEFT JOIN "productsStock" ps
      ON ps.product_stock_id = p.product_stock_id
    LEFT JOIN units u
      ON u.unit_id = p.product_unit_id
    WHERE COALESCE(p.is_active, true) = true
      AND COALESCE(ps.stock_qty, 0) > 0
    ORDER BY p.description ASC, p.product_id ASC
  `;

  try {
    const { rows } = await pool.query(sql);
    const inventory = rows.map(normalizeInventoryRow);

    console.log('[SPED Fiscal] inventory rows:', inventory.length);

    return inventory;
  } catch (err) {
    console.error('[SPED Fiscal] getInventorySource error:', err.message);
    return [];
  }
}

export default {
  getInventorySource
};
