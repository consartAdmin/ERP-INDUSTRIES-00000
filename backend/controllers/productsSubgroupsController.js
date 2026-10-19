// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsSubgroupsController.js — HTTP Controller Subgrupos Produtos  ║
// ║ CONSART ERP | ESM                                                    ║
// ║ Usa ProductsSubgroupsAPI (camada de banco)                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ProductsSubgroupsAPI from '../repositories/productsSubgroups/productsSubgroups.index.js';

function sendError(res, err, context = 'productsSubgroups') {
  const status = err?.status || 500;
  console.error(`[${context}]`, err);

  return res.status(status).json({
    ok: false,
    context,
    error:
      err?.message ||
      'Erro inesperado ao processar requisição de subgrupos de produtos.',
    details: err?.details || undefined,
  });
}

const productsSubgroupsController = {
  async ensureTable(req, res) {
    try {
      await ProductsSubgroupsAPI.ensureProductsSubgroupsTable();
      return res.json({ ok: true });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.ensureTable');
    }
  },

  async list(req, res) {
    try {
      const {
        q,
        group_id,
        product_group_id,   // ✅ aceita o nome usado no frontend
        is_active,
        limit,
        offset,
        orderBy,
        dir,
      } = req.query;

      // ✅ compat: se vier product_group_id, usa ele; senão usa group_id
      const resolvedGroupIdRaw =
        product_group_id ?? group_id ?? undefined;

      const resolvedGroupId =
        resolvedGroupIdRaw !== undefined && resolvedGroupIdRaw !== null && String(resolvedGroupIdRaw).trim() !== ''
          ? Number(resolvedGroupIdRaw)
          : undefined;

      const result = await ProductsSubgroupsAPI.list({
        q,
        group_id: Number.isFinite(resolvedGroupId) ? resolvedGroupId : undefined,
        is_active,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
        orderBy,
        dir,
      });

      return res.json({ ok: true, data: result });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.list');
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const row = await ProductsSubgroupsAPI.getById(Number(id));

      if (!row) {
        return res
          .status(404)
          .json({ ok: false, error: 'Subgrupo não encontrado.' });
      }

      return res.json({ ok: true, data: row });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.getById');
    }
  },

  async create(req, res) {
    try {
      const payload = req.body || {};
      const created = await ProductsSubgroupsAPI.create(payload);
      return res.status(201).json({ ok: true, data: created });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.create');
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const patch = req.body || {};
      const updated = await ProductsSubgroupsAPI.update(Number(id), patch);

      if (!updated) {
        return res
          .status(404)
          .json({ ok: false, error: 'Subgrupo não encontrado.' });
      }

      return res.json({ ok: true, data: updated });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.update');
    }
  },

  async deactivate(req, res) {
    try {
      const { id } = req.params;
      const row = await ProductsSubgroupsAPI.deactivate(Number(id));

      if (!row) {
        return res
          .status(404)
          .json({ ok: false, error: 'Subgrupo não encontrado.' });
      }

      return res.json({ ok: true, data: row });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.deactivate');
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      const ok = await ProductsSubgroupsAPI.remove(Number(id));

      if (!ok) {
        return res
          .status(404)
          .json({ ok: false, error: 'Subgrupo não encontrado.' });
      }

      return res.json({ ok: true, data: true });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.remove');
    }
  },

  async upsertByName(req, res) {
    try {
      const { name, group_id, is_active } = req.body || {};
      const row = await ProductsSubgroupsAPI.upsertByName({
        name,
        group_id,
        is_active,
      });
      return res.json({ ok: true, data: row });
    } catch (err) {
      return sendError(res, err, 'productsSubgroups.upsertByName');
    }
  },
};

export default productsSubgroupsController;
