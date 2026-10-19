// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeApiClient.repository.js — Cliente HTTP da NF-e API própria        ║
// ║ ✔ NFE_PROVIDER / NFE_API_URL / NFE_API_KEY lidos em tempo de uso     ║
// ║ ✔ Ambiente da empresa na API conferido com NFE_AMBIENTE do ERP       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';

/* =========================================================================
 * 🔧 Configuração
 * ========================================================================= */

/** true quando o ERP deve emitir pela NF-e API própria em vez da TecnoSpeed. */
export function isNfeApiProvider() {
  return String(process.env.NFE_PROVIDER || 'tecnospeed').trim().toLowerCase() === 'nfe-api';
}

export function getBaseUrl() {
  return String(process.env.NFE_API_URL || 'https://api.producao.consart.com.br').trim().replace(/\/+$/, '');
}

/**
 * Cabeçalho de autenticação para URLs da NF-e API (ex.: xml/pdf gravados em
 * invoicesIssued ou orders). Devolve null para URLs de outros provedores.
 */
export function nfeApiAuthHeaders(url) {
  if (!String(url || '').startsWith(`${getBaseUrl()}/`)) return null;
  return { 'x-api-key': getApiKey() };
}

function getApiKey() {
  const key = String(process.env.NFE_API_KEY || '').trim();
  if (!key) throw new Error('[NfeApi] NFE_API_KEY ausente no .env.');
  return key;
}

export function getIssuerCnpj() {
  const cnpj = String(process.env.EMPRESA_CNPJ || '').replace(/\D/g, '');
  if (cnpj.length !== 14) throw new Error('[NfeApi] EMPRESA_CNPJ ausente ou inválido no .env.');
  return cnpj;
}

export const NFE_API_TIMEOUT = Number(process.env.NFE_API_TIMEOUT || 90000);

/* =========================================================================
 * 🔐 Requisição
 * ========================================================================= */

/**
 * Chamada HTTP que nunca lança por status: 4xx/5xx voltam em { status, data }.
 * A NF-e API responde 422 com o registro da nota quando a SEFAZ rejeita,
 * então o status HTTP sozinho não diz se houve documento.
 */
export async function request(method, path, { data, responseType } = {}) {
  try {
    const res = await axios({
      method,
      url: `${getBaseUrl()}${path}`,
      data,
      responseType,
      timeout: NFE_API_TIMEOUT,
      headers: { 'x-api-key': getApiKey(), ...(data ? { 'Content-Type': 'application/json' } : {}) },
      validateStatus: () => true,
      ...(responseType === 'text' ? { transformResponse: [(raw) => raw] } : {}),
    });
    return { status: res.status, data: res.data };
  } catch (err) {
    // Rede/timeout: o resultado é desconhecido, quem chamou decide o que fazer
    return { status: 503, data: { message: `NF-e API indisponível: ${err.message}` }, networkError: true };
  }
}

/** Mensagem legível de uma resposta de erro da NF-e API. */
export function errorMessageFrom(response) {
  const data = response?.data;
  if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
    try {
      return JSON.parse(Buffer.from(data).toString('utf8')).message;
    } catch {
      return `NF-e API respondeu HTTP ${response.status}`;
    }
  }
  const details = Array.isArray(data?.details) ? ` (${data.details.join('; ')})` : '';
  return `${data?.message || `NF-e API respondeu HTTP ${response?.status}`}${details}`;
}

/* =========================================================================
 * 🧭 Ambiente
 *
 * Com NFE_PROVIDER=nfe-api quem define homologação/produção é o painel da
 * NF-e API (/admin → Empresas → Ambiente), por empresa. NFE_AMBIENTE do ERP
 * só vale para a TecnoSpeed.
 * ========================================================================= */

/** Ambiente da NF-e API → nomenclatura já gravada pelo ERP (NFE_AMBIENTE). */
export function toErpEnvironment(environment) {
  return environment === 'production' ? 'producao' : 'homologacao';
}

export const isHomologationEnvironment = (environment) => /homolog|sandbox/i.test(String(environment || ''));

/**
 * Ambiente atual da empresa no painel da NF-e API, sem cache: uma troca no
 * painel vale já na próxima emissão.
 * @returns {Promise<{ environment: 'producao'|'homologacao', company: object }>}
 */
export async function getCompanyEnvironment(cnpj = getIssuerCnpj()) {
  const res = await request('GET', `/v1/companies/${cnpj}`);
  if (res.status !== 200) {
    const error = new Error(`Empresa ${cnpj} não encontrada na NF-e API: ${errorMessageFrom(res)}`);
    error.status = res.status === 404 ? 422 : 502;
    error.code = 'NFE_API_COMPANY_UNAVAILABLE';
    throw error;
  }
  return { environment: toErpEnvironment(res.data.environment), company: res.data };
}
