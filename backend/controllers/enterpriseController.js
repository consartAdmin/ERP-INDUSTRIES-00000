// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseController.js                                             ║
// ║ Descrição: Controller do módulo de empresas                         ║
// ║ Projeto: CONSART ERP                                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import enterpriseApi from '../repositories/enterprise/enterprise.index.js';

function parsePagination(req) {
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 20)));
  const page = Math.max(1, Number(req.query.page || 1));
  const offset = (page - 1) * limit;
  return { limit, page, offset };
}

export async function listEnterprises(req, res) {
  try {
    const { limit, page, offset } = parsePagination(req);
    const q = String(req.query.q || '').trim();
    const is_active = req.query.is_active;

    const [rows, total] = await Promise.all([
      enterpriseApi.list({ q, is_active, limit, offset }),
      enterpriseApi.count({ q, is_active })
    ]);

    return res.json({
      ok: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    console.error('listEnterprises:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Error listing enterprises.'
    });
  }
}

export async function getEnterpriseById(req, res) {
  try {
    const row = await enterpriseApi.findById(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        message: 'Enterprise not found.'
      });
    }

    return res.json({
      ok: true,
      data: row
    });
  } catch (error) {
    console.error('getEnterpriseById:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Error fetching enterprise.'
    });
  }
}

export async function createEnterprise(req, res) {
  try {
    const created = await enterpriseApi.create(req.body);

    return res.status(201).json({
      ok: true,
      message: 'Enterprise created successfully.',
      data: created
    });
  } catch (error) {
    console.error('createEnterprise:', error);
    return res.status(400).json({
      ok: false,
      message: error.message || 'Error creating enterprise.'
    });
  }
}

export async function updateEnterprise(req, res) {
  try {
    const updated = await enterpriseApi.update(req.params.id, req.body);

    return res.json({
      ok: true,
      message: 'Enterprise updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('updateEnterprise:', error);
    return res.status(400).json({
      ok: false,
      message: error.message || 'Error updating enterprise.'
    });
  }
}

export async function deleteEnterprise(req, res) {
  try {
    const removed = await enterpriseApi.remove(req.params.id);

    if (!removed) {
      return res.status(404).json({
        ok: false,
        message: 'Enterprise not found.'
      });
    }

    return res.json({
      ok: true,
      message: 'Enterprise deleted successfully.'
    });
  } catch (error) {
    console.error('deleteEnterprise:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Error deleting enterprise.'
    });
  }
}

export async function toggleEnterpriseStatus(req, res) {
  try {
    const updated = await enterpriseApi.setActive(req.params.id, req.body.is_active);

    if (!updated) {
      return res.status(404).json({
        ok: false,
        message: 'Enterprise not found.'
      });
    }

    return res.json({
      ok: true,
      message: 'Enterprise status updated successfully.',
      data: updated
    });
  } catch (error) {
    console.error('toggleEnterpriseStatus:', error);
    return res.status(400).json({
      ok: false,
      message: error.message || 'Error updating enterprise status.'
    });
  }
}