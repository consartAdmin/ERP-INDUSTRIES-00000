// ╔════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReportPdfController.js — HTTP PDF/CSV Relatório PDV       ║
// ║ CONSART ERP — Usa generationPdvSalesReportPdf.js                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  generatePdvSalesReportPdf,
  generatePdvSalesReportCsv
} from '../generationPdf/generationPdvSalesReportPdf.js';

function buildFiltersFromQuery(query = {}) {
  const {
    startDate,
    endDate,
    month,
    year,
    customerId,
    productId
    // Se tiver mais filtros no futuro, adiciona aqui.
  } = query;

  const filters = {};

  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;
  if (month) filters.month = month;
  if (year) filters.year = year;
  if (customerId) filters.customerId = customerId;
  if (productId) filters.productId = productId;

  return filters;
}

// -------------------------------------------------------------------
// GET /api/reports/pdv-sales/pdf?mode=full|customers|coupons&...
// -------------------------------------------------------------------
export async function getPdvSalesReportPdf(req, res) {
  try {
    const { mode } = req.query || {};
    const filters = buildFiltersFromQuery(req.query);

    const buffer = await generatePdvSalesReportPdf(filters, mode);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="relatorio-vendas-pdv.pdf"'
    );
    return res.send(buffer);
  } catch (err) {
    console.error('[pdvSalesReportPdfController] Erro PDF PDV:', err);
    return res.status(500).json({
      error: 'Erro ao gerar PDF do relatório de vendas PDV.',
      details: err.message
    });
  }
}

// -------------------------------------------------------------------
// GET /api/reports/pdv-sales/csv?view=day|customer|coupon&...
// -------------------------------------------------------------------
export async function getPdvSalesReportCsv(req, res) {
  try {
    const { view } = req.query || {};
    const filters = buildFiltersFromQuery(req.query);

    const csv = await generatePdvSalesReportCsv(filters, view);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="relatorio-vendas-pdv.csv"'
    );
    return res.send(csv);
  } catch (err) {
    console.error('[pdvSalesReportPdfController] Erro CSV PDV:', err);
    return res.status(500).json({
      error: 'Erro ao gerar CSV do relatório de vendas PDV.',
      details: err.message
    });
  }
}
