// ╔══════════════════════════════════════════════════════════════════════╗
// ║ salesReportController.js — Controller Relatório de Vendas (ESM)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getFullSalesReport } from '../repositories/salesReport/salesReport.index.js';
import { generateSalesReportPdf } from '../generationPdf/generationSalesReportPdf.js';
import { generateSalesReportOrdersPdf } from '../generationPdf/generationSalesReportOrdersPdf.js';

const MODES = new Set(['full', 'products', 'customers', 'orders']);

function sendOk(res, data) {
  return res.status(200).json({ ok: true, ...data });
}

function sendError(res, error) {
  console.error('[salesReport][CTRL]', error);
  return res.status(500).json({
    ok: false,
    message: 'Erro interno ao gerar relatório de vendas',
    detail: error?.message || String(error),
  });
}

function normalizeCostMode(value) {
  return value === 'saleDay' ? 'saleDay' : 'current';
}

function normalizeMode(value) {
  const mode = String(value || 'full').trim().toLowerCase();
  return MODES.has(mode) ? mode : 'full';
}

function toISODateOrNull(value) {
  if (!value) return null;
  const normalized = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return normalized;
}

function toPositiveIntOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeFilenamePart(value, maxLength = 80) {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
  return normalized || 'x';
}

function utcTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addUtcDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildFiltersFromQuery(query = {}) {
  const parsedStart = toISODateOrNull(
    query.dateStart
    ?? query.startDate
    ?? query.dateFrom
    ?? query.fromDate
    ?? query.dataInicial
  );
  const parsedEnd = toISODateOrNull(
    query.dateEnd
    ?? query.endDate
    ?? query.dateTo
    ?? query.toDate
    ?? query.dataFinal
  );
  const today = utcTodayISO();

  let dateStart = parsedStart || addUtcDays(today, -30);
  let dateEnd = parsedEnd || today;

  if (dateStart > dateEnd) {
    [dateStart, dateEnd] = [dateEnd, dateStart];
  }

  const productId = String(query.productId ?? '').trim() || null;

  return {
    dateStart,
    dateEnd,
    customerId: toPositiveIntOrNull(query.customerId),
    productId,
    sellerId: toPositiveIntOrNull(query.sellerId),
    costMode: normalizeCostMode(query.costMode),
  };
}

function makeSalesReportFilename({ mode, costMode, dateStart, dateEnd }) {
  const modeLabels = {
    full: 'completo',
    products: 'produtos',
    customers: 'clientes',
    orders: 'pedidos',
  };
  const costLabel = costMode === 'saleDay' ? 'custo-dia-venda' : 'custo-atual';
  return [
    'relatorio-vendas',
    modeLabels[mode] || modeLabels.full,
    costLabel,
    safeFilenamePart(dateStart || 'inicio'),
    'a',
    safeFilenamePart(dateEnd || 'fim'),
  ].join('-') + '.pdf';
}

export async function handleGetSalesReport(req, res) {
  try {
    const filters = buildFiltersFromQuery(req.query || {});
    const data = await getFullSalesReport(filters);
    return sendOk(res, { filters, ...data });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function handleGetSalesReportPdf(req, res) {
  try {
    const filters = buildFiltersFromQuery(req.query || {});
    const mode = normalizeMode(req.query?.mode);
    const pdfBuffer = mode === 'orders'
      ? await generateSalesReportOrdersPdf(filters)
      : await generateSalesReportPdf(filters, mode);

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      return res.status(500).json({
        ok: false,
        message: 'O gerador não retornou um PDF válido.',
      });
    }

    const filename = makeSalesReportFilename({
      mode,
      costMode: filters.costMode,
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
    });

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.end(pdfBuffer);
  } catch (error) {
    if (res.headersSent) return res.end();
    return sendError(res, error);
  }
}

export { buildFiltersFromQuery };
