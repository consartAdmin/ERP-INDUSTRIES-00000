// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ groupsAndSubgroupsBatchController.js — Controller Batch (Grupo/Subgrupo)   ║
// ║ CONSART ERP | ESM                                                          ║
// ║                                                                            ║
// ║ Endpoints:                                                                  ║
// ║   GET  /api/products-groups/batch/list                                      ║
// ║   POST /api/products-groups/batch/assign                                    ║
// ║   POST /api/products-groups/batch/clear                                     ║
// ║                                                                            ║
// ║ Controller = valida/normaliza + chama service                               ║
// ║ Service/API = executa SQL e retorna resultado                               ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import GroupsBatchApi from '../repositories/groupsAndSubgroupsBatch/groupsAndSubgroupsBatch.index.js';

/* ──────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const toInt = (v, fb = null) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : fb;
};

const toBool = (v, fb = null) => {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fb;
};

const toStr = (v) => String(v ?? '').trim();

const toStrArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => toStr(x)).filter(Boolean);
  // permite csv "1,2,3"
  return toStr(v)
    .split(',')
    .map((x) => toStr(x))
    .filter(Boolean);
};

function pickBody(req) {
  return req?.body && typeof req.body === 'object' ? req.body : {};
}

/* ──────────────────────────────────────────────────────────────
   GET /api/products-groups/batch/list
   Query:
     page, limit, q, linked(true/false), only_active_products(true/false)
───────────────────────────────────────────────────────────── */
export async function listBatchProducts(req, res) {
  // ✅ seu GroupsBatchApi atual é handler Express (req,res)
  // então só encaminha
  return GroupsBatchApi.batchListProducts(req, res);
}

/* ──────────────────────────────────────────────────────────────
   POST /api/products-groups/batch/assign
   Body:
     {
       product_group_id,
       product_subgroup_id?,
       product_ids? (array ou csv),
       q?,
       only_active_products?,
       where_group_id?,
       where_subgroup_id?
     }
───────────────────────────────────────────────────────────── */
export async function assignBatchGroups(req, res) {
  try {
    const body = pickBody(req);

    const product_group_id = toInt(body.product_group_id);
    const product_subgroup_id =
      body.product_subgroup_id != null ? toInt(body.product_subgroup_id) : undefined;

    if (!Number.isInteger(product_group_id) || product_group_id <= 0) {
      return res.status(400).json({ ok: false, error: 'product_group_id must be an integer.' });
    }

    if (body.product_subgroup_id != null && (!Number.isInteger(product_subgroup_id) || product_subgroup_id <= 0)) {
      return res.status(400).json({ ok: false, error: 'product_subgroup_id must be an integer (or omit).' });
    }

    // ✅ normaliza e injeta em req.body
    req.body = {
      product_group_id,
      ...(product_subgroup_id !== undefined ? { product_subgroup_id } : {}),

      product_ids: toStrArray(body.product_ids),
      q: toStr(body.q) || undefined,
      only_active_products: toBool(body.only_active_products, undefined),

      where_group_id: body.where_group_id != null ? toInt(body.where_group_id) : undefined,
      where_subgroup_id: body.where_subgroup_id != null ? toInt(body.where_subgroup_id) : undefined,
    };

    // ✅ chama o handler Express do service
    return GroupsBatchApi.batchAssignGroups(req, res);
  } catch (err) {
    console.error('[groupsAndSubgroupsBatchController:assignBatchGroups] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to assign batch groups.' });
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/products-groups/batch/clear
   Body:
     {
       product_ids? (array ou csv),
       q?,
       only_active_products?,
       where_group_id?,
       where_subgroup_id?
     }
───────────────────────────────────────────────────────────── */
export async function clearBatchGroups(req, res) {
  try {
    const body = pickBody(req);

    req.body = {
      product_ids: toStrArray(body.product_ids),
      q: toStr(body.q) || undefined,
      only_active_products: toBool(body.only_active_products, undefined),

      where_group_id: body.where_group_id != null ? toInt(body.where_group_id) : undefined,
      where_subgroup_id: body.where_subgroup_id != null ? toInt(body.where_subgroup_id) : undefined,
    };

    return GroupsBatchApi.batchClearGroups(req, res);
  } catch (err) {
    console.error('[groupsAndSubgroupsBatchController:clearBatchGroups] error:', err);
    return res.status(500).json({ ok: false, error: 'Failed to clear batch groups.' });
  }
}

export default {
  listBatchProducts,
  assignBatchGroups,
  clearBatchGroups,
};
