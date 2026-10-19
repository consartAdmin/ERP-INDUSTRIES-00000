// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeApiInutilizacao.repository.js — inutilização pela NF-e API        ║
// ║ Mesmo contrato de tecnoSpeedNfeInutilizacao.inutilizarNumeracao,     ║
// ║ lido por controllers/nfeInutilizarEventsController.js                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { errorMessageFrom, getIssuerCnpj, request } from './nfeApiClient.repository.js';

const digits = (value) => String(value ?? '').replace(/\D/g, '');

// SEFAZ: a faixa (ou parte dela) já estava inutilizada → para o ERP é "já autorizada"
const ALREADY_VOIDED = /\b(206|256|563)\b/;

/**
 * @param {{ justification: string, year: number, serie: number, numberStart: number, numberEnd: number, companyCnpj?: string }} payload
 * @returns {Promise<{ success: true, status: number, data: object } | { success: false, status: number, error: any }>}
 */
export async function inutilizarNumeracao(payload = {}) {
  const cnpj = digits(payload.companyCnpj).length === 14 ? digits(payload.companyCnpj) : getIssuerCnpj();
  const reason = String(payload.justification ?? '').trim().replace(/^"+|"+$/g, '');
  if (reason.length < 15) {
    return { success: false, status: 400, error: 'A justificativa deve conter ao menos 15 caracteres.' };
  }

  const res = await request('POST', '/v1/number-voids', {
    data: {
      issuerCnpj: cnpj,
      series: Number(payload.serie),
      start: Number(payload.numberStart),
      end: Number(payload.numberEnd),
      year: Number(payload.year),
      reason,
    },
  });

  if (res.status === 200) {
    // Campos lidos por extractProviderOk / normalizeStatus / extractProtocol do controller
    return {
      success: true,
      status: 200,
      data: {
        id: res.data.id,
        cStat: String(res.data.statusCode),
        status: 'CONCLUIDO',
        protocolo: res.data.protocolNumber,
        mensagem: res.data.reason,
      },
    };
  }

  const message = errorMessageFrom(res);
  if (ALREADY_VOIDED.test(message)) {
    // Formato de "duplicidade" que o controller reconhece (isProviderDuplicateInutilizacao)
    return {
      success: false,
      status: 409,
      error: { message: 'JA EXISTE UMA INUTILIZACAO para esta faixa', data: { current: { cStat: '102', status: 'CONCLUIDO', mensagem: message } } },
    };
  }
  return { success: false, status: res.status, error: message };
}
