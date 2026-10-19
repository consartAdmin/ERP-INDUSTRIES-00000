// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsGroupsController.js — HTTP Controller Grupos de Produtos    ║
// ║ CONSART ERP | ESM                                                   ║
// ║ Usa ProductsGroupsAPI (camada de banco)                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import ProductsGroupsAPI from '../repositories/productsGroups/productsGroups.index.js';

function sendError(res, err, context = 'productsGroups') {
  const status = err?.status || 500;
  console.error(`[${context}]`, err);

  return res.status(status).json({
    ok: false,
    context,
    error:
      err?.message ||
      'Erro inesperado ao processar requisição de grupos de produtos.',
    details: err?.details || undefined,
  });
}

const productsGroupsController = {
  // Apenas pra forçar criação/ajuste da tabela se quiser chamar via rota
  async ensureTable(req, res) {
    try {
      await ProductsGroupsAPI.ensureProductsGroupsTable();
      return res.json({ ok: true });
    } catch (err) {
      return sendError(res, err, 'productsGroups.ensureTable');
    }
  },

  async list(req, res) {
    try {
      const {
        q,
        is_active,
        limit,
        offset,
        orderBy,
        dir,
      } = req.query;

      const result = await ProductsGroupsAPI.list({
        q,
        is_active,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0,
        orderBy,
        dir,
      });

      return res.json({ ok: true, data: result });
    } catch (err) {
      return sendError(res, err, 'productsGroups.list');
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const row = await ProductsGroupsAPI.getById(Number(id));

      if (!row) {
        return res.status(404).json({
          ok: false,
          error: 'Grupo de produto não encontrado.',
        });
      }

      return res.json({ ok: true, data: row });
    } catch (err) {
      return sendError(res, err, 'productsGroups.getById');
    }
  },

  async create(req, res) {
    try {
      const payload = req.body || {};
      const created = await ProductsGroupsAPI.create(payload);
      return res.status(201).json({ ok: true, data: created });
    } catch (err) {
      return sendError(res, err, 'productsGroups.create');
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const patch = req.body || {};
      const updated = await ProductsGroupsAPI.update(Number(id), patch);

      if (!updated) {
        return res
          .status(404)
          .json({ ok: false, error: 'Grupo de produto não encontrado.' });
      }

      return res.json({ ok: true, data: updated });
    } catch (err) {
      return sendError(res, err, 'productsGroups.update');
    }
  },

  async deactivate(req, res) {
    try {
      const { id } = req.params;
      const row = await ProductsGroupsAPI.deactivate(Number(id));

      if (!row) {
        return res
          .status(404)
          .json({ ok: false, error: 'Grupo de produto não encontrado.' });
      }

      return res.json({ ok: true, data: row });
    } catch (err) {
      return sendError(res, err, 'productsGroups.deactivate');
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      const ok = await ProductsGroupsAPI.remove(Number(id));

      if (!ok) {
        return res
          .status(404)
          .json({ ok: false, error: 'Grupo de produto não encontrado.' });
      }

      return res.json({ ok: true, data: true });
    } catch (err) {
      return sendError(res, err, 'productsGroups.remove');
    }
  },

  async upsertByName(req, res) {
    try {
      const { name, is_active } = req.body || {};
      const row = await ProductsGroupsAPI.upsertByName({ name, is_active });
      return res.json({ ok: true, data: row });
    } catch (err) {
      return sendError(res, err, 'productsGroups.upsertByName');
    }
  },
};

export default productsGroupsController;
