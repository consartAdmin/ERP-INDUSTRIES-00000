// ╔═══════════════════════════════════════════════════════════════╗
// ║ nfeIssuanceIssue.repository.js — emissão da NF-e do orçamento ║
// ║ claim da tentativa + envio ao provedor                        ║
// ╚═══════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as tecnospeedNfeApi from '../nfe/nfe.index.js';
import { ATTEMPTS_TABLE } from './nfeIssuance.constants.js';
import { providerDocument, providerIdFrom, providerProtocolFrom, providerMessageFrom, findProviderDocumentByIntegrationId, normalizeProviderStatus, logProviderResult } from './nfeIssuance.provider.js';
import { getBudgetIssuedData } from './nfeIssuanceFiscalContext.repository.js';
import { getBudgetFiscalItems, assertBudgetItemsAreIssuable } from './nfeIssuanceItems.repository.js';
import { claimBudgetForIssuance, persistIssueResult, persistIssueError } from './nfeIssuanceAttempts.repository.js';
import { routeProvider, resolveBudgetIssueTarget } from '../nfeApi/nfeApi.index.js';

// Orçamentos: NFE_PROVIDER=nfe-api emite pela NF-e API própria; senão, TecnoSpeed.
const emitirNFe = routeProvider('emitirNFe', tecnospeedNfeApi.emitirNFe);

// Homologação pela NF-e API: o builder exige um número (senão reserva um da
// sequência real), então recebe este marcador, que é removido antes do envio.
const API_NUMBERING_PLACEHOLDER = 999999999;

export async function issueBudgetNfe(budgetId, { userId } = {}) {
  const budget = await getBudgetIssuedData(budgetId);

  const items = await getBudgetFiscalItems(budget.budget_id);

  assertBudgetItemsAreIssuable(items);

  // Ambiente e numeração: TecnoSpeed → NFE_AMBIENTE; NF-e API → painel /admin
  const target = await resolveBudgetIssueTarget();

  const attempt = await claimBudgetForIssuance(budget, items, userId, target);
  const builderNumber = attempt.nfe_number ?? API_NUMBERING_PLACEHOLDER;

  try {
    const payload = await tecnospeedNfeApi.buildNFeFromOrder({
      header: {
        ...budget,
        id: null,
        order_id: null,
        budget_id: budget.budget_id,
        numero: builderNumber,
        nfe_number: builderNumber,

        // The authorized production NF-e used indFinal=1. Do not derive
        // consumidorFinal from the existence of a state registration:
        // taxpayer status (indIEDest) and final-consumer status (indFinal)
        // are independent fiscal concepts. This flag applies only to the
        // direct Budget issuance flow and does not modify Orders.
        consumidor_final: true,
        consumidorFinal: true,

        shipping: budget.shipping || null,
      },
      items,
    });

    let idIntegracao = attempt.integration_id;
    payload.idIntegracao = idIntegracao;
    // Enforce the atomically reserved number even if the generic builder
    // receives another legacy/default sequence value.
    payload.numero = attempt.nfe_number;

    if (target.apiNumbering) {
      // A NF-e API numera; o marcador não pode chegar à nota
      delete payload.numero;
      if (payload.cobranca) delete payload.cobranca.numero;
      if (payload.informacoesComplementares) {
        payload.informacoesComplementares = String(payload.informacoesComplementares)
          .replace(new RegExp(`\\s*\\|?\\s*Fatura:\\s*${API_NUMBERING_PLACEHOLDER}`, 'g'), '')
          .trim();
      }
    }

    // Recovery path: if a previous HTTP call reached the provider but the
    // local persistence failed, reuse the provider document instead of
    // transmitting another NF-e.
    const existing = await tecnospeedNfeApi.listarNFe({ q: idIntegracao });
    logProviderResult('[BUDGET NFE][CONSULTA PROVIDER]', existing);

    let result;

    const existingDocument = findProviderDocumentByIntegrationId(
      existing,
      idIntegracao,
    );
    const existingStatus = String(existingDocument?.status || '').toUpperCase();

    if (existingDocument && !['REJEITADA', 'REJEITADO', 'ERRO'].includes(existingStatus)) {
      result = { ok: true, data: existingDocument, recovered: true };
    } else {
      if (existingDocument) {
        idIntegracao = `${attempt.integration_id}-R${Date.now()}`;
        payload.idIntegracao = idIntegracao;
      }

      console.log('[BUDGET NFE][ANTES DO ENVIO]', {
        budgetId: budget.budget_id,
        idIntegracao,
        ambiente: target.environment || process.env.NFE_AMBIENTE || null,
        consumidorFinal: payload.consumidorFinal,
      });

      result = await emitirNFe(payload);
      logProviderResult('[BUDGET NFE][RESPOSTA COMPLETA]', result);
    }

    await pool.query(
      `UPDATE ${ATTEMPTS_TABLE} SET integration_id = $2, request_payload = $3::jsonb, updated_at = NOW() WHERE attempt_id = $1`,
      [attempt.attempt_id, idIntegracao, JSON.stringify(payload)],
    );

    if (!result?.ok) {
      const message =
        result?.error?.message?.message ||
        result?.error?.message ||
        result?.message ||
        result?.error ||
        'O provedor recusou a emissão da NF-e.';

      const error = new Error(String(message));
      error.status = Number(result?.status) || 502;
      error.code = 'NFE_PROVIDER_ERROR';
      error.details = result?.error || null;
      throw error;
    }

    const document = providerDocument(result.data);
    const providerId = providerIdFrom(document, result.data);
    const protocol = providerProtocolFrom(document, result.data);
    let status = normalizeProviderStatus(document, result.data);

    if (!providerId) {
      const error = new Error(
        'A API fiscal não retornou o identificador da NF-e. O envio não pôde ser confirmado.',
      );
      error.status = 502;
      error.code = 'NFE_PROVIDER_ID_MISSING';
      error.details = result.data || result;
      throw error;
    }

    if (!status && providerId) status = 'PROCESSANDO';

    if (['REJEITADA', 'REJEITADO', 'ERRO'].includes(status)) {
      const error = new Error(
        providerMessageFrom(document, result.data) ||
        'A NF-e foi rejeitada pelo provedor fiscal.',
      );
      error.status = 422;
      error.code = 'NFE_REJECTED';
      error.details = document;
      throw error;
    }
    const environment =
      document.ambiente || result.data?.ambiente ||
      target.environment || process.env.NFE_AMBIENTE || null;

    await persistIssueResult(attempt.attempt_id, {
      status,
      providerId,
      idIntegracao,
      protocol,
      environment,
      // Homologação pela NF-e API: o número vem da API, não da reserva do ERP
      nfeNumber: target.apiNumbering && document.numero ? Number(document.numero) : null,
      providerResponse: result.data || {},
    });

    return {
      budget_id: budget.budget_id,
      attempt_id: attempt.attempt_id,
      provider_id: providerId,
      id_integracao: idIntegracao,
      protocol,
      status,
      environment,
      recovered: !!result.recovered,
    };
  } catch (error) {
    await persistIssueError(attempt.attempt_id, error).catch((persistError) => {
      console.error('[nfeIssuanceApi][persistBudgetIssueError]', persistError);
    });
    throw error;
  }
}
