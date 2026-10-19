// ╔═════════════════════════════════════════════════╗
// ║ nfeIssuanceDocuments.repository.js — documentos ║
// ║ download do XML e da DANFE da NF-e do orçamento ║
// ╚═════════════════════════════════════════════════╝

import * as tecnospeedNfeApi from '../nfe/nfe.index.js';
import { getBudgetNfeReference, resolveProviderId } from './nfeIssuanceReference.repository.js';

export async function getBudgetNfeXml(budgetId) {
  const reference = await getBudgetNfeReference(budgetId);
  const providerId = await resolveProviderId(reference);
  const response = await tecnospeedNfeApi.obterXml(providerId);

  if (!response?.ok || !response.xml) {
    const error = new Error('Não foi possível obter o XML da NF-e.');
    error.status = Number(response?.status) || 502;
    error.code = 'BUDGET_NFE_XML_FAILED';
    error.details = response?.error || null;
    throw error;
  }

  return { xml: response.xml, providerId };
}

export async function getBudgetNfeDanfe(budgetId) {
  const reference = await getBudgetNfeReference(budgetId);
  const providerId = await resolveProviderId(reference);
  const response = await tecnospeedNfeApi.obterPdf(providerId);

  if (!response?.ok || !response.buffer) {
    const error = new Error('Não foi possível obter o DANFE da NF-e.');
    error.status = Number(response?.status) || 502;
    error.code = 'BUDGET_NFE_DANFE_FAILED';
    error.details = response?.error || null;
    throw error;
  }

  return { buffer: Buffer.from(response.buffer), providerId };
}
