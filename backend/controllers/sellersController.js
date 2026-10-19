// ╔══════════════════════════════════════════════════════════════════╗
// ║ sellersController.js — HTTP Controller de Vendedores (ESM)      ║
// ║ - Conecta rotas Express ao sellersApi                           ║
// ║ - Padrão de resposta: { ok, data?, error? }                     ║
// ╚══════════════════════════════════════════════════════════════════╝

import sellersApi from '../repositories/sellers/sellers.index.js';
import generateSellersPdf from '../generationPdf/generationSellersPdf.js';
import buildSellersWorkbook from '../generationPdf/generationSellersExcel.js';

/* ====================================================================
 * Helpers
 * ==================================================================== */
function parseActiveFlag(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const s = String(raw).trim().toLowerCase();
  if (['1', 'true', 't', 'sim', 'yes', 'y', 'ativo', 'active'].includes(s)) return true;
  if (['0', 'false', 'f', 'nao', 'não', 'no', 'n', 'inativo', 'inactive'].includes(s)) return false;
  return undefined;
}

/* ====================================================================
 * LIST / SEARCH
 * ==================================================================== */
export async function listSellers(req, res) {
  try {
    const {
      q,
      active,
      limit,
      offset,
    } = req.query;

    const params = {
      q: q || undefined,
      active: parseActiveFlag(active),
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    };

    const data = await sellersApi.list(params);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[sellersController] listSellers error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao listar vendedores.' });
  }
}

export async function searchSellers(req, res) {
  try {
    const { q, limit } = req.query;
    const data = await sellersApi.search(q || '', limit ? Number(limit) : 20);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[sellersController] searchSellers error:', err);
    return res.status(500).json({ ok: false, error: 'Erro na busca de vendedores.' });
  }
}

/* ====================================================================
 * GET BY ID
 * ==================================================================== */
export async function getSellerById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const data = await sellersApi.getById(id);
    if (!data) {
      return res.status(404).json({ ok: false, error: 'Vendedor não encontrado.' });
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error('[sellersController] getSellerById error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao buscar vendedor.' });
  }
}

/* ====================================================================
 * CREATE
 * ==================================================================== */
export async function createSeller(req, res) {
  try {
    const payload = req.body || {};
    const created = await sellersApi.create(payload);
    return res.status(201).json({ ok: true, data: created });
  } catch (err) {
    console.error('[sellersController] createSeller error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao criar vendedor.' });
  }
}

/* ====================================================================
 * UPDATE
 * ==================================================================== */
export async function updateSeller(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const payload = req.body || {};
    const updated = await sellersApi.update(id, payload);
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Vendedor não encontrado para atualizar.' });
    }

    return res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('[sellersController] updateSeller error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao atualizar vendedor.' });
  }
}

/* ====================================================================
 * REMOVE (soft delete: active = false)
 * ==================================================================== */
export async function deleteSeller(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: 'ID inválido.' });
    }

    const removed = await sellersApi.remove(id);
    if (!removed) {
      return res.status(404).json({ ok: false, error: 'Vendedor não encontrado para remoção.' });
    }

    return res.json({ ok: true, data: removed });
  } catch (err) {
    console.error('[sellersController] deleteSeller error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao remover vendedor.' });
  }
}

/* ====================================================================
 * EXPORT (PDF / EXCEL)
 * - Mesmos filtros da tela: busca (sem acento) + status
 * ==================================================================== */
function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function loadSellersForExport(query = {}) {
  const q = String(query.q || '').trim();
  const active = parseActiveFlag(query.active);

  const all = await sellersApi.list({ active, limit: 10000, offset: 0 });
  const term = normalizeSearchText(q);

  const sellers = term
    ? all.filter((s) => [s.id, s.name, s.nickname, s.document, s.email, s.phone, s.mobile]
      .map(normalizeSearchText)
      .join(' ')
      .includes(term))
    : all;

  return { filters: { q, active }, sellers };
}

export async function exportSellersPdf(req, res) {
  try {
    const data = await loadSellersForExport(req.query);
    const pdf = await generateSellersPdf(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="vendedores-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.end(pdf);
  } catch (err) {
    console.error('[sellersController] exportSellersPdf error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao gerar PDF de vendedores.' });
  }
}

export async function exportSellersExcel(req, res) {
  try {
    const data = await loadSellersForExport(req.query);
    const workbook = await buildSellersWorkbook(data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="vendedores-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('[sellersController] exportSellersExcel error:', err);
    return res.status(500).json({ ok: false, error: 'Erro ao gerar Excel de vendedores.' });
  }
}

/* ====================================================================
 * Export default
 * ==================================================================== */
export default {
  listSellers,
  searchSellers,
  getSellerById,
  createSeller,
  updateSeller,
  deleteSeller,
  exportSellersPdf,
  exportSellersExcel,
};
