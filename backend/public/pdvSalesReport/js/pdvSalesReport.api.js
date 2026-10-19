import {
  REPORT_ENDPOINT,
  REPORT_PDF_ENDPOINT,
  REPORT_CSV_ENDPOINT
} from './pdvSalesReport.config.js';

export async function fetchReport(params) {
  const query = params.toString();
  const response = await fetch(query ? `${REPORT_ENDPOINT}?${query}` : REPORT_ENDPOINT);
  if (!response.ok) {
    throw new Error(`Erro ao carregar relatório PDV: ${response.status}`);
  }
  return response.json();
}

export function buildPdfUrl(params, mode) {
  const query = new URLSearchParams(params);
  query.set('mode', mode);
  return `${REPORT_PDF_ENDPOINT}?${query}`;
}

export function buildCsvUrl(params, view) {
  const query = new URLSearchParams(params);
  query.set('view', view);
  return `${REPORT_CSV_ENDPOINT}?${query}`;
}
