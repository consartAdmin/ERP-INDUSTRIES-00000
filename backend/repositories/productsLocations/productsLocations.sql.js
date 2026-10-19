// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocations.sql.js — buildWhere (filtros + busca global q)     ║
// ║ ✅ Busca (q) também procura na descrição do produto                    ║
// ║ ✅ Busca (q) também procura por BARCODE (JOIN em productsBarCode)     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ALIAS,
  PRODUCTS_ALIAS,
  PRODUCT_DESC_COL,
  BARCODE_COL,
  TB_BARCODES,
} from './productsLocations.constants.js';

/**
 * buildWhere suporta busca também na descrição do produto (p.description)
 * e no barcode (pb.barcode).
 */
export function buildWhere({
  q,
  product_code,
  store_id,
  onlyActive,
  corredor,
  prateleira,
  bandeja
} = {}) {
  const clauses = [];
  const params = [];

  // 🔎 BUSCA GLOBAL (q)
  if (q) {
    const qRaw = String(q).trim();
    params.push(`%${qRaw}%`.toLowerCase());
    const pLike = `$${params.length}`;

    params.push(qRaw);
    const pExact = `$${params.length}`;

    clauses.push(`
      (
        LOWER(${ALIAS}.product_code) LIKE ${pLike}
        OR LOWER(COALESCE(${ALIAS}.corredor,    '')) LIKE ${pLike}
        OR LOWER(COALESCE(${ALIAS}.prateleira,  '')) LIKE ${pLike}
        OR LOWER(COALESCE(${ALIAS}.bandeja,     '')) LIKE ${pLike}
        OR LOWER(COALESCE(${ALIAS}.box,         '')) LIKE ${pLike}
        OR LOWER(COALESCE(${ALIAS}.observacao,  '')) LIKE ${pLike}
        OR LOWER(COALESCE(${PRODUCTS_ALIAS}."${PRODUCT_DESC_COL}", '')) LIKE ${pLike}

        -- qualquer barcode do produto (EXISTS: não duplica a linha da localização)
        OR EXISTS (
          SELECT 1 FROM ${TB_BARCODES} pbq
          WHERE pbq.product_code = ${ALIAS}.product_code
            AND (pbq."${BARCODE_COL}" = ${pExact}
              OR LOWER(COALESCE(pbq."${BARCODE_COL}", '')) LIKE ${pLike})
        )
      )
    `);
  }

  // 🔎 FILTRO EXATO POR SKU
  if (product_code) {
    params.push(product_code);
    clauses.push(`${ALIAS}.product_code = $${params.length}`);
  }

  // 🏪 STORE
  if (store_id != null && store_id !== '') {
    params.push(Number(store_id));
    clauses.push(`${ALIAS}.store_id = $${params.length}`);
  }

  // 🧭 CORREDOR
  if (corredor) {
    params.push(`%${String(corredor).toLowerCase()}%`);
    clauses.push(`LOWER(COALESCE(${ALIAS}.corredor,'')) LIKE $${params.length}`);
  }

  // 🧱 GÔNDOLA (prateleira)
  if (prateleira) {
    params.push(`%${String(prateleira).toLowerCase()}%`);
    clauses.push(`LOWER(COALESCE(${ALIAS}.prateleira,'')) LIKE $${params.length}`);
  }

  // 📦 BANDEJA
  if (bandeja) {
    params.push(`%${String(bandeja).toLowerCase()}%`);
    clauses.push(`LOWER(COALESCE(${ALIAS}.bandeja,'')) LIKE $${params.length}`);
  }

  // ✅ ATIVOS
  if (onlyActive) {
    clauses.push(`${ALIAS}.is_active = TRUE`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  return { where, params };
}
