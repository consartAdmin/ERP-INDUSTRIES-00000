// ╔═════════════════════════════════════════════════════════╗
// ║ nfeIssuanceReference.repository.js — referência da NF-e ║
// ║ última tentativa do orçamento e id no provedor          ║
// ╚═════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as tecnospeedNfeApi from '../nfe/nfe.index.js';
import { ATTEMPTS_TABLE, STATUS_TABLE } from './nfeIssuance.constants.js';
import { positiveInteger } from './nfeIssuance.utils.js';
import { providerIdFrom, findProviderDocumentByIntegrationId } from './nfeIssuance.provider.js';

export async function getBudgetNfeReference(budgetId) {
  const id = positiveInteger(budgetId);

  if (!id) {
    const error = new Error('ID de orçamento inválido.');
    error.status = 400;
    error.code = 'INVALID_BUDGET_ID';
    throw error;
  }

  const { rows } = await pool.query(
    `
      SELECT
        a.attempt_id,
        a.budget_id,
        a.provider_id AS nfe_provider_id,
        a.integration_id AS nfe_id_integracao,
        s.code AS nfe_issue_status,
        a.protocol AS nfe_protocol,
        a.nfe_environment,
        a.requested_at AS nfe_issued_at,
        a.nfe_number,
        a.access_key,
        a.invoice_id
      FROM ${ATTEMPTS_TABLE} a
      JOIN ${STATUS_TABLE} s
        ON s.nfe_status_id = a.nfe_status_id
      WHERE a.budget_id = $1
      ORDER BY a.attempt_number DESC, a.attempt_id DESC
      LIMIT 1
    `,
    [id],
  );

  const row = rows[0];
  if (!row) {
    const budgetExists = await pool.query(
      'SELECT 1 FROM public.budgets WHERE budget_id = $1 LIMIT 1',
      [id],
    );
    const error = new Error(
      budgetExists.rowCount
        ? 'Este orçamento ainda não possui tentativa de emissão de NF-e.'
        : 'Orçamento não encontrado.',
    );
    error.status = 404;
    error.code = budgetExists.rowCount ? 'BUDGET_NFE_NOT_FOUND' : 'BUDGET_NOT_FOUND';
    throw error;
  }

  if (!row.nfe_provider_id && !row.nfe_id_integracao) {
    const error = new Error('Este orçamento ainda não possui NF-e vinculada.');
    error.status = 404;
    error.code = 'BUDGET_NFE_NOT_FOUND';
    throw error;
  }

  return row;
}

export async function resolveProviderId(reference) {
  if (reference.nfe_provider_id) return String(reference.nfe_provider_id);

  const listed = await tecnospeedNfeApi.listarNFe({
    q: reference.nfe_id_integracao,
  });

  if (!listed?.ok) {
    const error = new Error('Não foi possível localizar a NF-e no provedor.');
    error.status = Number(listed?.status) || 502;
    error.code = 'NFE_PROVIDER_LOOKUP_FAILED';
    error.details = listed?.error || null;
    throw error;
  }

  const exact = findProviderDocumentByIntegrationId(
    listed,
    reference.nfe_id_integracao,
  );

  const providerId = providerIdFrom(exact, exact);
  if (!providerId) {
    const error = new Error('A NF-e vinculada não foi encontrada no provedor.');
    error.status = 404;
    error.code = 'NFE_PROVIDER_DOCUMENT_NOT_FOUND';
    throw error;
  }

  return String(providerId);
}
