// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeApi.index.js — provedor NF-e API própria (substitui a TecnoSpeed) ║
// ║ Mesmas funções e formatos de retorno de nfe/nfe.index.js            ║
// ║ ✔ emitirNFe, listarNFe, consultarNFe, obterXml, obterPdf, cancelarNFe║
// ║ Ativado por NFE_PROVIDER=nfe-api (padrão: tecnospeed)                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  errorMessageFrom,
  getCompanyEnvironment,
  getIssuerCnpj,
  isHomologationEnvironment,
  isNfeApiProvider,
  request,
} from './nfeApiClient.repository.js';
import { toApiInvoicePayload, toProviderDocument } from './nfeApi.mappers.js';
import * as cce from './nfeApiCce.repository.js';
import { inutilizarNumeracao } from './nfeApiInutilizacao.repository.js';

const ACCESS_KEY = /^\d{44}$/;

const failure = (response, context) => {
  const message = errorMessageFrom(response);
  return {
    ok: false,
    status: response.status,
    message,
    error: { message, context: `NfeApi.${context}`, raw: response.data },
  };
};

/* =========================================================================
 * 📤 Emitir NF-e
 * ========================================================================= */
export async function emitirNFe(dadosNFe) {
  const nfe = Array.isArray(dadosNFe) ? dadosNFe[0] : dadosNFe;

  let body;
  try {
    body = toApiInvoicePayload(nfe);
  } catch (error) {
    return { ok: false, status: error.status || 422, message: error.message, error: { message: error.message, code: error.code, context: 'NfeApi.emitirNFe' } };
  }

  console.log('[NFE][NFE-API][ENVIO]', JSON.stringify({ idIntegracao: body.externalId, numero: body.number ?? 'automático (NF-e API)', serie: body.series }));
  const res = await request('POST', '/v1/invoices', { data: body });

  // 201 autorizada · 202 processando/sem retorno · 422 COM accessKey = rejeitada/denegada pela SEFAZ
  if (res.data?.accessKey) {
    return { ok: true, status: 200, data: { documents: [toProviderDocument(res.data)] } };
  }
  return failure(res, 'emitirNFe');
}

/* =========================================================================
 * 🔎 Listar (lookup exato por idIntegracao, usado antes de reenviar)
 * ========================================================================= */
export async function listarNFe({ q } = {}) {
  const term = String(q ?? '').trim();
  const res = await request('GET', `/v1/companies/${getIssuerCnpj()}/invoices?search=${encodeURIComponent(term)}&limit=50`);
  if (res.status !== 200) return failure(res, 'listarNFe');

  // A busca da API é por substring: 'BUD-1-A1' também casa 'BUD-1-A10'. Só o id exato serve.
  const documents = (res.data.invoices ?? [])
    .filter((record) => !term || record.externalId === term)
    .map(toProviderDocument);
  return { ok: true, status: 200, data: documents, meta: {} };
}

/* =========================================================================
 * 🔍 Consultar / XML / PDF
 * ========================================================================= */
export async function consultarNFe(idOuChave) {
  const key = String(idOuChave ?? '').trim();
  if (!ACCESS_KEY.test(key)) {
    return { ok: false, status: 400, error: `NfeApi.consultarNFe: chave de acesso inválida (${key})` };
  }

  // Situação real na SEFAZ; se a SEFAZ estiver fora, devolve o último registro salvo
  let res = await request('POST', `/v1/invoices/${key}/sync`, { data: {} });
  if (res.status === 502 || res.status === 503) {
    console.warn('[NFE][NFE-API][CONSULTA] SEFAZ indisponível, usando registro local:', errorMessageFrom(res));
    res = await request('GET', `/v1/invoices/${key}`);
  }
  if (res.status !== 200) return { ok: false, status: res.status, error: res.data };
  return { ok: true, status: 200, data: toProviderDocument(res.data) };
}

export async function obterXml(idOuChave) {
  const res = await request('GET', `/v1/invoices/${String(idOuChave).trim()}/xml`, { responseType: 'text' });
  if (res.status !== 200) return { ok: false, status: res.status, error: res.data };
  const xml = String(res.data || '');
  return {
    ok: true,
    status: 200,
    xml,
    hasNfeNamespace: xml.includes('xmlns="http://www.portalfiscal.inf.br/nfe"'),
    hasSignatureNamespace: xml.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"'),
  };
}

export async function obterPdf(idOuChave) {
  const res = await request('GET', `/v1/invoices/${String(idOuChave).trim()}/pdf`, { responseType: 'arraybuffer' });
  if (res.status !== 200) return { ok: false, status: res.status, error: errorMessageFrom(res) };
  return { ok: true, buffer: res.data };
}

/* =========================================================================
 * 🚫 Cancelar (síncrono: a SEFAZ responde na hora; a reconciliação lê CANCELADA)
 * ========================================================================= */
export async function cancelarNFe(idNota, justificativa = 'Cancelamento solicitado pelo emissor') {
  const key = String(idNota ?? '').trim();
  const reason = String(justificativa ?? '').replace(/\s+/g, ' ').trim();

  if (!ACCESS_KEY.test(key)) {
    return { ok: false, status: 400, message: 'Chave de acesso da NF-e inválida para a NF-e API.' };
  }
  if (reason.length < 15) {
    return { ok: false, status: 400, message: 'A justificativa deve conter ao menos 15 caracteres.' };
  }

  const res = await request('POST', `/v1/invoices/${key}/cancel`, { data: { reason: reason.slice(0, 255) } });
  if (res.status !== 200) return failure(res, 'cancelarNFe');
  return { ok: true, status: 200, data: toProviderDocument(res.data) };
}

/* =========================================================================
 * 🧭 Ambiente da emissão de orçamentos
 * ========================================================================= */

/**
 * Onde a próxima NF-e de orçamento será emitida.
 *   · TecnoSpeed: NFE_AMBIENTE do ERP, numeração do ERP (public.nfe).
 *   · NF-e API: ambiente escolhido no painel. Em homologação a própria API
 *     numera (sequência de testes) e a sequência real do ERP não é consumida.
 * @returns {Promise<{ environment: string, apiNumbering: boolean, provider: string }>}
 */
export async function resolveBudgetIssueTarget() {
  if (!isNfeApiProvider()) {
    return { provider: 'tecnospeed', environment: process.env.NFE_AMBIENTE || null, apiNumbering: false };
  }
  const { environment } = await getCompanyEnvironment();
  return { provider: 'nfe-api', environment, apiNumbering: isHomologationEnvironment(environment) };
}

/** Nota de testes da NF-e API: não deve mexer em estoque, status do orçamento nem boletos. */
export function isNfeApiHomologationDocument(document, fallbackEnvironment) {
  return isNfeApiProvider() && isHomologationEnvironment(document?.ambiente || fallbackEnvironment);
}

/* =========================================================================
 * 🔀 Roteamento TecnoSpeed ⇄ NF-e API
 * ========================================================================= */
/*
 * Com NFE_PROVIDER=nfe-api, as notas antigas emitidas pela TecnoSpeed continuam
 * sendo lidas/canceladas lá: o provider_id delas é o id interno da PlugNotas,
 * enquanto a NF-e API sempre usa a chave de acesso (44 dígitos).
 *   · emitir            → sempre NF-e API
 *   · por id/chave      → chave de 44 dígitos na NF-e API; 404 ou outro id → TecnoSpeed
 *   · listar (idIntegr.) → NF-e API; sem resultado → TecnoSpeed (evita reenviar nota já emitida lá)
 */
const ROUTES = {
  emitirNFe: { fn: emitirNFe, mode: 'always' },
  consultarNFe: { fn: consultarNFe, mode: 'byKey' },
  obterXml: { fn: obterXml, mode: 'byKey' },
  obterPdf: { fn: obterPdf, mode: 'byKey' },
  cancelarNFe: { fn: cancelarNFe, mode: 'byKey' },
  listarNFe: { fn: listarNFe, mode: 'list' },
  // CC-e: chave (44) ou protocolo da CC-e (15 dígitos) conhecidos pela NF-e API; o resto → TecnoSpeed
  emitirCCe: { fn: cce.emitirCCe, mode: 'byKey' },
  consultarStatusCCe: { fn: cce.consultarStatusCCe, mode: 'keyOrProtocol' },
  obterPdfCCe: { fn: cce.obterPdfCCe, mode: 'keyOrProtocol' },
  obterXmlCCe: { fn: cce.obterXmlCCe, mode: 'keyOrProtocol' },
  // Inutilização: a numeração é da empresa na NF-e API (ambiente do painel)
  inutilizarNumeracao: { fn: inutilizarNumeracao, mode: 'always' },
};

const PROTOCOL = /^\d{15}$/;

/**
 * Envolve uma função da TecnoSpeed. Com NFE_PROVIDER diferente de nfe-api
 * chama sempre a original. A decisão é feita a cada chamada.
 */
export function routeProvider(name, tecnospeedFn) {
  const route = ROUTES[name];
  if (!route) throw new Error(`[NfeApi] função sem implementação: ${name}`);

  return async (...args) => {
    if (!isNfeApiProvider()) return tecnospeedFn(...args);

    if (route.mode === 'always') return route.fn(...args);

    if (route.mode === 'byKey' || route.mode === 'keyOrProtocol') {
      const id = String(args[0] ?? '').trim();
      const ours = ACCESS_KEY.test(id) || (route.mode === 'keyOrProtocol' && PROTOCOL.test(id));
      if (!ours) return tecnospeedFn(...args);
      const result = await route.fn(...args);
      if (result?.status === 404) {
        console.log(`[NFE][NFE-API][${name}] ${id} não encontrado na NF-e API, consultando TecnoSpeed`);
        return tecnospeedFn(...args);
      }
      return result;
    }

    // list
    const result = await route.fn(...args);
    if (result?.ok && result.data.length) return result;
    try {
      const legacy = await tecnospeedFn(...args);
      return legacy?.ok ? legacy : result;
    } catch (error) {
      console.warn(`[NFE][NFE-API][${name}] TecnoSpeed indisponível para consulta legada:`, error.message);
      return result;
    }
  };
}

export { isNfeApiProvider };
