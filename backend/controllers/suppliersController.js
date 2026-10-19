// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ suppliersController.js — HTTP Controller de Fornecedores (CONSART ERP)   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import suppliersAttachmentsApi from '../repositories/suppliersAttachments/suppliersAttachments.index.js';
import { ensureSuppliersTable, list, search, getById, create, update, remove } from '../repositories/suppliers/suppliers.index.js';
import { generateReportsSuppliersExcel } from '../generationExcel/generationReportsSuppliersExcel.js';
import { generateReportsSuppliersPdf } from '../generationPdf/generationReportsSuppliersPdf.js';

function sendResult(res, result, context = 'suppliers') {
  if (!result || typeof result !== 'object') {
    console.error(`[suppliersController:${context}] Resultado inválido:`, result);
    return res.status(500).json({ ok: false, error: 'Erro interno inesperado.' });
  }
  if (result.ok) return res.status(200).json({ ok: true, data: result.data });
  console.error(`[suppliersController:${context}] Erro:`, result.error || 'Erro sem mensagem');
  return res.status(result.status || 500).json({ ok: false, error: result.error || 'Erro interno ao processar requisição.' });
}

export async function ensureSuppliersBoot() {
  try {
    const result = await ensureSuppliersTable();

    if (!result?.ok) {
      console.error(
        '[suppliersController:ensureSuppliersBoot] Falha na validação:',
        result?.error
      );

      return result;
    }

    console.log(
      '[suppliersController] Tabela suppliers validada com o catálogo.'
    );

    return result;
  } catch (err) {
    console.error(
      '[suppliersController:ensureSuppliersBoot] Erro inesperado:',
      err
    );

    return {
      ok: false,
      error: err.message || 'Erro ao validar a tabela suppliers.',
      status: 500,
    };
  }
}

async function listSuppliers(req, res) {
  try {
    const { page, limit, sort, dir, q } = req.query;
    return sendResult(res, await list({ page, limit, sort, dir, q }), 'list');
  } catch (err) {
    console.error('[suppliersController:listSuppliers] Erro:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno ao listar fornecedores.' });
  }
}

async function searchSuppliers(req, res) {
  try {
    const { q, page, limit } = req.query;
    return sendResult(res, await search(q, { page, limit }), 'search');
  } catch (err) {
    console.error('[suppliersController:searchSuppliers] Erro:', err);
    return res.status(500).json({ ok: false, error: 'Erro interno ao buscar fornecedores.' });
  }
}

async function getSupplier(req, res) {
  try { return sendResult(res, await getById(req.params.id), 'getById'); }
  catch (err) { console.error('[suppliersController:getSupplier] Erro:', err); return res.status(500).json({ ok: false, error: 'Erro interno ao buscar fornecedor.' }); }
}

async function createSupplier(req, res) {
  try {
    const result = await create(req.body || {});
    if (result?.ok) return res.status(201).json({ ok: true, data: result.data });
    return sendResult(res, result, 'create');
  } catch (err) { console.error('[suppliersController:createSupplier] Erro:', err); return res.status(500).json({ ok: false, error: 'Erro interno ao criar fornecedor.' }); }
}

async function updateSupplier(req, res) {
  try { return sendResult(res, await update(req.params.id, req.body || {}), 'update'); }
  catch (err) { console.error('[suppliersController:updateSupplier] Erro:', err); return res.status(500).json({ ok: false, error: 'Erro interno ao atualizar fornecedor.' }); }
}

async function removeSupplier(req, res) {
  try { return sendResult(res, await remove(req.params.id), 'remove'); }
  catch (err) { console.error('[suppliersController:removeSupplier] Erro:', err); return res.status(500).json({ ok: false, error: 'Erro interno ao remover fornecedor.' }); }
}

async function listAttachments(req, res) {
  try { return res.status(200).json({ ok: true, data: await suppliersAttachmentsApi.list(req.params.id) }); }
  catch (err) { console.error('[suppliersController:listAttachments] Erro:', err); return res.status(500).json({ ok: false, error: err.message || 'Erro ao listar anexos do fornecedor.' }); }
}

async function uploadAttachment(req, res) {
  try { return res.status(201).json({ ok: true, data: await suppliersAttachmentsApi.upload(req.params.id, req.file) }); }
  catch (err) { console.error('[suppliersController:uploadAttachment] Erro:', err); return res.status(500).json({ ok: false, error: err.message || 'Erro ao enviar anexo do fornecedor.' }); }
}

async function deleteAttachment(req, res) {
  try {
    const removed = await suppliersAttachmentsApi.remove(req.params.id, req.params.attachmentId);
    if (!removed) return res.status(404).json({ ok: false, error: 'Anexo não encontrado.' });
    return res.status(200).json({ ok: true, data: { success: true } });
  } catch (err) { console.error('[suppliersController:deleteAttachment] Erro:', err); return res.status(500).json({ ok: false, error: err.message || 'Erro ao excluir anexo do fornecedor.' }); }
}

async function loadAllSuppliersForReport({ q, sort = 'supplier_id', dir = 'asc' } = {}) {
  const rows = []; let page = 1; let total = 0;
  do {
    const result = await list({ page, limit: 200, q, sort, dir });
    if (!result?.ok) throw new Error(result?.error || 'Erro ao carregar fornecedores para o relatório.');
    const pageRows = Array.isArray(result.data?.rows) ? result.data.rows : [];
    rows.push(...pageRows); total = Number(result.data?.total || 0); page += 1;
  } while (rows.length < total);
  return rows;
}

async function exportReport(req, res, type) {
  try {
    const { q, sort = 'supplier_id', dir = 'asc' } = req.query;
    const suppliers = await loadAllSuppliersForReport({ q, sort, dir });
    const isExcel = type === 'excel';
    const buffer = isExcel ? await generateReportsSuppliersExcel(suppliers) : await generateReportsSuppliersPdf(suppliers);
    const extension = isExcel ? 'xlsx' : 'pdf';
    res.setHeader('Content-Type', isExcel ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fornecedores-${new Date().toISOString().slice(0, 10)}.${extension}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).send(buffer);
  } catch (err) {
    console.error(`[suppliersController:export${type}] Erro:`, err);
    return res.status(500).json({ ok: false, error: err.message || 'Erro ao gerar relatório de fornecedores.' });
  }
}

export default {
  list: listSuppliers, search: searchSuppliers, getById: getSupplier,
  create: createSupplier, update: updateSupplier, remove: removeSupplier,
  exportExcel: (req, res) => exportReport(req, res, 'excel'),
  exportPdf: (req, res) => exportReport(req, res, 'pdf'),
  listAttachments, uploadAttachment, deleteAttachment,
};
