// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ findProductByLmRef.repository.js — CONSART ERP | Notas de Entrada       ║
// ║ Vínculo referência NF-e do fornecedor -> produto interno                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  TB_PRODUCTS_LM_REF,
  q,
} from './_shared.js';

export async function findProductByLmRef({ supplierId, nfProductCode } = {}) {
  const supplier_id = Number(supplierId);
  const nf_product_code = String(nfProductCode || '').trim();

  if (!Number.isInteger(supplier_id) || supplier_id <= 0 || !nf_product_code) {
    return null;
  }

  const res = await q(
    `
      SELECT
        r.product_lm_ref_id,
        r.supplier_id,
        r.nf_product_code,
        r.product_code,
        r.description,
        r.is_active,
        p.product_id,
        p.product_stock_id,
        p.product_code AS canonical_product_code,
        p.description AS canonical_product_description
      FROM ${TB_PRODUCTS_LM_REF} r
      JOIN public.products p
        ON p.product_code = r.product_code
      WHERE r.supplier_id = $1
        AND BTRIM(r.nf_product_code) = $2
        AND r.is_active = TRUE
      LIMIT 1
    `,
    [supplier_id, nf_product_code]
  );

  return res.rows[0] || null;
}

export default findProductByLmRef;
