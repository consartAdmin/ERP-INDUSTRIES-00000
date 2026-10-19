// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntriesController.js — Controller — CONSART ERP              ║
// ║ Path: backend/controllers/expenseEntriesController.js                ║
// ║ ESM • CRUD + Import XML (NF-e) + POST -> accountsPayable + Caixa    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  expenseEntriesApi,
  parseNfeXmlToExpenseEntryDraft,
} from '../repositories/expenseEntries/expenseEntries.index.js';

import caixaApi from '../repositories/cashMoviments/cashMoviments.index.js';

function ok(res, data, extra = {}) {
  return res.json({ ok: true, ...extra, data });
}

function fail(res, status, message, extra = {}) {
  return res.status(status).json({ ok: false, message, ...extra });
}

function toNumber(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function buildCaixaObservation(entry, expenseEntryId) {
  return [
    'Lançamento automático via Entrada de Despesa/XML',
    `expenseEntryId=${expenseEntryId}`,
    entry?.documentType ? `Documento: ${entry.documentType}` : null,
    entry?.documentNumber ? `Número: ${entry.documentNumber}` : null,
    entry?.documentSeries ? `Série: ${entry.documentSeries}` : null,
    entry?.documentKey ? `Chave NF-e: ${entry.documentKey}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

async function ensureCaixaMovementFromExpenseEntry({ expenseEntry }) {
  if (!expenseEntry?.expenseEntryId) {
    throw new Error('expenseEntryId não encontrado para lançar no Caixa.');
  }

  const expenseEntryId = expenseEntry.expenseEntryId;
  const total = toNumber(expenseEntry.totalExpenseValue, 0);

  if (total <= 0) {
    throw new Error('Valor da despesa inválido para lançar no Caixa.');
  }

  const searchRef = `expenseEntryId=${expenseEntryId}`;

  const existing = await caixaApi.listMovements({
    search: searchRef,
    limit: 1,
    offset: 0,
  });

  if (existing?.items?.length) {
    return existing.items[0];
  }

  return await caixaApi.createMovement({
    data_hora: expenseEntry.entryDate || expenseEntry.issueDate || new Date(),
    tipo_movimentacao: 'SAIDA',
    conta_caixa: 'CAIXA',
    valor: total,
    tipo_documento: expenseEntry.documentType || 'NF-e',
    numero_documento:
      expenseEntry.documentKey ||
      expenseEntry.documentNumber ||
      String(expenseEntryId),
    fornecedor: expenseEntry.supplierName || null,
    observacao: buildCaixaObservation(expenseEntry, expenseEntryId),
    multa: 0,
    juros: 0,
    encargos: 0,
    categoria: null,
    subcategoria: null,
    is_active: true,
  });
}

export const expenseEntriesController = {
  async list(req, res) {
    try {
      const result = await expenseEntriesApi.list({
        page: req.query.page,
        pageSize: req.query.pageSize,
        orderBy: req.query.orderBy,
        status: req.query.status,
        supplierDocument: req.query.supplierDocument,
        q: req.query.q,
        dateFrom: req.query.dateFrom,
        dateTo: req.query.dateTo,
      });

      return ok(res, result.rows, { paging: result.paging });
    } catch (e) {
      console.error('[expenseEntries] list error', e);
      return fail(res, 500, e.message || 'Internal error');
    }
  },

  async getById(req, res) {
    try {
      const expenseEntryId = Number(req.params.id);
      if (!expenseEntryId) return fail(res, 400, 'Invalid id');

      const row = await expenseEntriesApi.getById({ expenseEntryId });
      if (!row) return fail(res, 404, 'Not found');

      return ok(res, row);
    } catch (e) {
      console.error('[expenseEntries] getById error', e);
      return fail(res, 500, e.message || 'Internal error');
    }
  },

  async create(req, res) {
    try {
      // ─────────────────────────────────────────────
      // Cria entrada da despesa
      // ─────────────────────────────────────────────
      const created = await expenseEntriesApi.create(req.body || {});

      // ─────────────────────────────────────────────
      // Lança automaticamente no Caixa
      // ─────────────────────────────────────────────
      let caixaMovement = null;

      try {
        caixaMovement = await ensureCaixaMovementFromExpenseEntry({
          expenseEntry: created,
        });

        console.log('[expenseEntries][CAIXA][AUTO_CREATED]', {
          expenseEntryId: created?.expenseEntryId,
          caixaMovementId: caixaMovement?.id,
        });

      } catch (caixaError) {
        console.error('[expenseEntries][CAIXA][ERROR]', caixaError);

        return ok(res, created, {
          warning: 'Entrada salva, mas não foi lançada no Caixa.',
          caixaError: caixaError.message,
        });
      }

      // ─────────────────────────────────────────────
      // Retorno final
      // ─────────────────────────────────────────────
      return ok(res, {
        ...created,
        caixaMovement,
      });

    } catch (e) {
      console.error('[expenseEntries] create error', e);
      return fail(res, 400, e.message || 'Invalid payload');
    }
  },

  async update(req, res) {
    try {
      const expenseEntryId = Number(req.params.id);
      if (!expenseEntryId) return fail(res, 400, 'Invalid id');

      const updated = await expenseEntriesApi.update({
        expenseEntryId,
        body: req.body || {},
      });

      if (!updated) return fail(res, 404, 'Not found');
      return ok(res, updated);
    } catch (e) {
      console.error('[expenseEntries] update error', e);
      return fail(res, 400, e.message || 'Invalid payload');
    }
  },

  async cancel(req, res) {
    try {
      const expenseEntryId = Number(req.params.id);
      if (!expenseEntryId) return fail(res, 400, 'Invalid id');

      const row = await expenseEntriesApi.cancel({ expenseEntryId });
      if (!row) return fail(res, 404, 'Not found');

      return ok(res, row);
    } catch (e) {
      console.error('[expenseEntries] cancel error', e);
      return fail(res, 400, e.message || 'Internal error');
    }
  },

  async remove(req, res) {
    try {
      const expenseEntryId = Number(req.params.id);
      if (!expenseEntryId) return fail(res, 400, 'Invalid id');

      const r = await expenseEntriesApi.remove({ expenseEntryId });
      if (!r) return fail(res, 404, 'Not found');

      return ok(res, {
        expenseEntryId: r.expenseentryid ?? r.expenseEntryId ?? expenseEntryId,
      });
    } catch (e) {
      console.error('[expenseEntries] remove error', e);
      return fail(res, 400, e.message || 'Internal error');
    }
  },

  async post(req, res) {
    try {
      const expenseEntryId = Number(req.params.id);
      if (!expenseEntryId) return fail(res, 400, 'Invalid id');

      const result = await expenseEntriesApi.post({
        expenseEntryId,
        dueDate: req.body?.dueDate || null,
      });

      const caixaMovement = await ensureCaixaMovementFromExpenseEntry({
        expenseEntry: result.expenseEntry,
      });

      return ok(res, {
        ...result,
        caixaMovement,
      });
    } catch (e) {
      console.error('[expenseEntries] post error', e);
      return fail(res, 400, e.message || 'Internal error');
    }
  },

  async importXml(req, res) {
    try {
      if (!req.file || !req.file.buffer) {
        return fail(res, 400, 'XML file is required (multipart field: xml)');
      }

      const { entryDraft, items } = await parseNfeXmlToExpenseEntryDraft(req.file.buffer);

      return ok(res, {
        entryDraft,
        items,
        fileName: req.file.originalname,
      });
    } catch (e) {
      console.error('[expenseEntries] importXml error', e);
      return fail(res, 400, e.message || 'Invalid XML');
    }
  },
};