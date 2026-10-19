// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalBatchController.js — Vínculo Fiscal em Lote           ║
// ║ ESM + PostgreSQL | CONSART ERP                                      ║
// ║ - GET  /api/products/fiscal/batch-list                              ║
// ║ - POST /api/products/fiscal/batch-link                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import * as productsFiscalApi from '../repositories/productsFiscal/productsFiscal.index.js';

const TB_PRODUCTS        = 'public."products"';
const TB_PRODUCTS_FISCAL = 'public."productsFiscal"';

/* ============================================================================
   GET /api/products/fiscal/batch-list
   Lista produtos + status de vínculo fiscal (para a grid)
   Query:
     q        → busca por SKU / descrição / código de barras
     limit    → paginação
     offset   → paginação
     linked   → 'true'  = só com fiscal vinculado
                'false' = só sem fiscal vinculado
                (omitido) = todos
============================================================================ */
export async function listProductsFiscalBatch(req, res) {
  try {
    const qRaw   = (req.query.q || '').trim();
    const limit  = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const linked = (req.query.linked || '').toString().toLowerCase(); // 'true' | 'false' | ''

    const wh = ['1=1'];
    const values = [];
    let i = 1;

    if (qRaw) {
      wh.push(`(
        p.product_code::text      ILIKE $${i} OR
        p.description             ILIKE $${i} OR
        COALESCE(p.barcode, '')   ILIKE $${i}
      )`);
      values.push(`%${qRaw}%`);
      i++;
    }

    // filtro de vínculo fiscal
    if (linked === 'true') {
      wh.push('pf.products_fiscal_id IS NOT NULL');
    } else if (linked === 'false') {
      wh.push('pf.products_fiscal_id IS NULL');
    }

    const sql = `
      SELECT
        p.product_id,
        p.product_code,
        p.description AS product_description,

        pf.fiscal_classification_id,
        pf.fiscal_profile_id,
        pf.classification_name,
        pf.profile_name,

        (pf.products_fiscal_id IS NOT NULL) AS fiscal_is_linked
      FROM ${TB_PRODUCTS} p
      LEFT JOIN ${TB_PRODUCTS_FISCAL} pf
        ON pf.product_id = p.product_id
       AND pf.is_current = TRUE
       AND pf.is_active  = TRUE
      WHERE ${wh.join(' AND ')}
      ORDER BY p.product_code ASC
      LIMIT $${i} OFFSET $${i + 1};
    `;

    values.push(limit, offset);

    const { rows } = await pool.query(sql, values);

    return res.json({
      ok: true,
      rows,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[productsFiscalBatch] listProductsFiscalBatch erro:', err);
    return res.status(500).json({
      ok: false,
      error: 'LIST_BATCH_ERROR',
      message: 'Erro ao listar produtos para vínculo fiscal em lote.',
      details: err.message,
    });
  }
}

/* ============================================================================
 * POST /api/products/fiscal/batch-link
 * Aplica Classificação Fiscal + Perfil Fiscal para múltiplos produtos
 * Body:
 *   {
 *     productIds: [7839, 8020, ...],
 *     fiscal_classification_id: 10,
 *     fiscal_profile_id: 3
 *   }
 * Internamente usa productsFiscalApi.importFromRefs (mesma lógica do controller
 * /api/productsFiscal/:productId/import-from-refs)
 * ========================================================================= */
export async function batchLinkProductsFiscal(req, res) {
  const { productIds, fiscal_classification_id, fiscal_profile_id } = req.body || {};

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'NO_PRODUCTS',
      message: 'Nenhum produto selecionado.',
    });
  }
  if (!fiscal_classification_id) {
    return res.status(400).json({
      ok: false,
      error: 'NO_CLASSIFICATION',
      message: 'fiscal_classification_id é obrigatório.',
    });
  }
  if (!fiscal_profile_id) {
    return res.status(400).json({
      ok: false,
      error: 'NO_PROFILE',
      message: 'fiscal_profile_id é obrigatório.',
    });
  }

  try {
    let updated = 0;

    for (const pid of productIds) {
      const product_id = Number(pid);
      if (!Number.isFinite(product_id)) continue;

      await productsFiscalApi.importFromRefs({
        product_id,
        fiscal_classification_id,
        fiscal_profile_id,
        // sem override aqui para deixar o service buscar icms_cst normalmente
      });

      updated++;
    }

    return res.json({
      ok: true,
      success: true,
      updated,
      message: `Vínculo fiscal aplicado para ${updated} produtos.`,
    });
  } catch (err) {
    console.error('[productsFiscalBatch] Erro batchLinkProductsFiscal:', err);
    return res.status(500).json({
      ok: false,
      error: 'BATCH_LINK_ERROR',
      message: 'Erro ao aplicar vínculo fiscal em lote.',
      details: err.message,
    });
  }
}

export default {
  listProductsFiscalBatch,
  batchLinkProductsFiscal,
};
