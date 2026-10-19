'use strict';

import { SALES_REPORT_ENDPOINT, SALES_REPORT_PDF_ENDPOINT } from './salesReport.config.js';
import { buildQuery } from './salesReport.utils.js';

export async function fetchSalesReport(filters = {}) {
  const query = buildQuery(filters);
  const url = `${SALES_REPORT_ENDPOINT}${query ? `?${query}` : ''}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha ao buscar relatório: ${response.status} – ${detail}`);
  }

  const data = await response.json();
  if (!data?.ok) throw new Error(data?.message || 'Erro na API de relatório de vendas.');
  return data;
}

export function buildPdfUrl(filters = {}, mode = 'full') {
  const query = buildQuery(filters, { mode });
  return `${SALES_REPORT_PDF_ENDPOINT}${query ? `?${query}` : ''}`;
}
