// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customerSegmentsController.js — Controller de Segmentos de Cliente   ║
// ║ CONSART ERP | ESM                                                    ║
// ║ ✅ segment_code gerado automaticamente pelo service                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove
} from '../repositories/customerSegments/customerSegments.index.js';

// ======================================================================
// Bootstrap
// ======================================================================
export async function initCustomerSegmentsController() {
  try {
    await ensureTable();
    console.log('✅ customerSegmentsController: tabela customerSegments garantida.');
  } catch (err) {
    console.error('❌ initCustomerSegmentsController() failed:', err);
  }
}

// ======================================================================
// Helpers
// ======================================================================
function parsePagination(query = {}) {
  const limit = Math.min(
    100,
    Math.max(1, Number.isFinite(Number(query.limit)) ? Number(query.limit) : 20)
  );

  const offset = Math.max(
    0,
    Number.isFinite(Number(query.offset)) ? Number(query.offset) : 0
  );

  return { limit, offset };
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra
  });
}

// ======================================================================
// Handlers
// ======================================================================

export async function listCustomerSegments(req, res) {
  try {
    const { q = '', active } = req.query || {};
    const { limit, offset } = parsePagination(req.query);

    const result = await list({ q, active, limit, offset });

    return res.json({
      ok: true,
      data: result.rows,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset
      }
    });
  } catch (err) {
    console.error('❌ listCustomerSegments error:', err);
    return sendError(res, 500, 'Falha ao listar segmentos de cliente.');
  }
}

export async function getCustomerSegmentById(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido para segmento de cliente.');
    }

    const row = await getById(id);

    if (!row) {
      return sendError(res, 404, 'Segmento de cliente não encontrado.');
    }

    return res.json({
      ok: true,
      data: row
    });
  } catch (err) {
    console.error('❌ getCustomerSegmentById error:', err);
    return sendError(res, 500, 'Falha ao buscar segmento de cliente.');
  }
}

export async function createCustomerSegment(req, res) {
  try {
    const { segment_name, description, is_active } = req.body || {};

    if (!segment_name) {
      return sendError(res, 400, 'segment_name é obrigatório.');
    }

    const created = await create({
      segment_name,
      description,
      is_active
    });

    return res.status(201).json({
      ok: true,
      message: 'Segmento de cliente criado com sucesso.',
      data: created
    });
  } catch (err) {
    console.error('❌ createCustomerSegment error:', err);

    if (err.code === '23505') {
      return sendError(res, 409, 'Já existe um segmento com este código.');
    }

    return sendError(res, 500, 'Falha ao criar segmento de cliente.', {
      detail: err?.message
    });
  }
}

export async function updateCustomerSegment(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido para segmento de cliente.');
    }

    const { segment_name, description, is_active } = req.body || {};

    const updated = await update(id, {
      segment_name,
      description,
      is_active
    });

    if (!updated) {
      return sendError(res, 404, 'Segmento de cliente não encontrado para atualização.');
    }

    return res.json({
      ok: true,
      message: 'Segmento de cliente atualizado com sucesso.',
      data: updated
    });
  } catch (err) {
    console.error('❌ updateCustomerSegment error:', err);

    if (err.code === '23505') {
      return sendError(res, 409, 'Já existe um segmento com este código.');
    }

    return sendError(res, 500, 'Falha ao atualizar segmento de cliente.', {
      detail: err?.message
    });
  }
}

export async function removeCustomerSegment(req, res) {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return sendError(res, 400, 'ID inválido para segmento de cliente.');
    }

    const hard = String(req.query.hard || '').toLowerCase() === 'true';

    const info = await remove(id, { hard });

    return res.json({
      ok: true,
      message: hard
        ? 'Segmento de cliente removido definitivamente.'
        : 'Segmento de cliente desativado (soft delete).',
      meta: info
    });
  } catch (err) {
    console.error('❌ removeCustomerSegment error:', err);
    return sendError(res, 500, 'Falha ao remover segmento de cliente.', {
      detail: err?.message
    });
  }
}

export async function listCustomerSegmentsLegacy(req, res) {
  try {
    const { q = '', active } = req.query || {};
    const { limit, offset } = parsePagination(req.query);

    const result = await list({ q, active, limit, offset });

    return res.json({
      rows: result.rows,
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (err) {
    console.error('❌ listCustomerSegmentsLegacy error:', err);
    return sendError(res, 500, 'Falha ao listar segmentos de cliente (legacy).');
  }
}

export default {
  initCustomerSegmentsController,
  listCustomerSegments,
  getCustomerSegmentById,
  createCustomerSegment,
  updateCustomerSegment,
  removeCustomerSegment,
  listCustomerSegmentsLegacy
};