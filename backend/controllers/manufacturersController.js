// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ manufacturersController.js — Controller HTTP de Fabricantes             ║
// ║ CONSART ERP | ESM                                                       ║
// ║                                                                          ║
// ║ Rotas esperadas (montadas em /api no server.js):                         ║
// ║   • GET    /products-manufacturers                                      ║
// ║   • GET    /products-manufacturers/:id                                  ║
// ║   • POST   /products-manufacturers                                      ║
// ║   • PUT    /products-manufacturers/:id                                  ║
// ║   • DELETE /products-manufacturers/:id                                  ║
// ║                                                                          ║
// ║ Alias opcionais (mesmos handlers):                                      ║
// ║   • /manufacturers                                                      ║
// ║   • /fabricantes                                                        ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import {
  ensureManufacturersTable,
  list as listApi,
  search as searchApi,
  getById as getByIdApi,
  create as createApi,
  update as updateApi,
  remove as removeApi,
} from '../repositories/manufacturers/manufacturers.index.js';

// ---------------------------------------------------------------------------
// Helper centralizado para respostas
// ---------------------------------------------------------------------------
function sendResult(res, result, context = 'manufacturers') {
  if (!result || result.ok === undefined) {
    console.error(`[${context}] Resultado inválido da API`, result);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno na API de fabricantes.',
    });
  }

  if (!result.ok) {
    const status = result.status || 400;
    console.error(
      `[${context}] Erro`,
      JSON.stringify(
        {
          status,
          error: result.error,
        },
        null,
        2,
      ),
    );

    return res.status(status).json({
      ok: false,
      error: result.error || 'Falha ao processar requisição de fabricantes.',
    });
  }

  return res.json({
    ok: true,
    data: result.data,
  });
}

// ---------------------------------------------------------------------------
// Inicialização opcional (para usar no boot do server.js)
// ---------------------------------------------------------------------------
async function initManufacturersModule() {
  const r = await ensureManufacturersTable();
  if (!r.ok) {
    console.error('[manufacturersController] Falha ao garantir tabela:', r.error);
  } else {
    console.log('[manufacturersController] Módulo de fabricantes inicializado.');
  }
}

// ---------------------------------------------------------------------------
// Handlers HTTP
// ---------------------------------------------------------------------------

// GET /products-manufacturers  (ou /manufacturers, /fabricantes)
async function listManufacturers(req, res) {
  try {
    const { q, page, limit, sort, dir } = req.query;

    const result = await listApi({
      q,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sort,
      dir,
    });

    return sendResult(res, result, 'manufacturers:list');
  } catch (err) {
    console.error('[manufacturersController:list] Erro inesperado:', err);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao listar fabricantes.',
    });
  }
}

// GET /products-manufacturers/:id
async function getManufacturer(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const result = await getByIdApi(id);
    return sendResult(res, result, 'manufacturers:getById');
  } catch (err) {
    console.error('[manufacturersController:getById] Erro inesperado:', err);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao buscar fabricante.',
    });
  }
}

// POST /products-manufacturers
async function createManufacturer(req, res) {
  try {
    const payload = req.body || {};
    const result = await createApi(payload);
    return sendResult(res, result, 'manufacturers:create');
  } catch (err) {
    console.error('[manufacturersController:create] Erro inesperado:', err);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao criar fabricante.',
    });
  }
}

// PUT /products-manufacturers/:id
async function updateManufacturer(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const payload = req.body || {};
    const result = await updateApi(id, payload);
    return sendResult(res, result, 'manufacturers:update');
  } catch (err) {
    console.error('[manufacturersController:update] Erro inesperado:', err);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao atualizar fabricante.',
    });
  }
}

// DELETE /products-manufacturers/:id  (soft delete: active = false)
async function deleteManufacturer(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const result = await removeApi(id);
    return sendResult(res, result, 'manufacturers:remove');
  } catch (err) {
    console.error('[manufacturersController:remove] Erro inesperado:', err);
    return res.status(500).json({
      ok: false,
      error: 'Erro interno ao remover fabricante.',
    });
  }
}

export default {
  initManufacturersModule,
  listManufacturers,
  getManufacturer,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
};
