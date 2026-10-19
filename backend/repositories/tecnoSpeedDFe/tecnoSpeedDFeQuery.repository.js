// ╔══════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedDFeQuery.repository.js — listagem DF-e                 ║
// ║ listDfe (GET /nfe/destinada), getByKey                           ║
// ╚══════════════════════════════════════════════════════════════════╝

import { PLUGNOTAS_BASE_URL, NFE_LIST_DEBUG, EMPRESA_CNPJ } from './tecnoSpeedDFe.constants.js';
import { requestWithRetry, axiosErrInfo } from './tecnoSpeedDFeClient.repository.js';
import { mapNota, normalizeListResponse } from './tecnoSpeedDFe.mappers.js';

// ======================================================================
// Funções de API — DF-e (Notas Destinadas)
// ======================================================================

/**
 * Lista DF-e via PlugNotas:
 *   GET /nfe/destinada
 */
export async function listDfe(params = {}) {
  const {
    cpfCnpj,
    cnpjDestinatario,
    manifestada,
    status,
    dataInicial,
    dataFinal,
    hashProximaPagina,
    resume,
  } = params;

  const cpfCnpjFinal =
    (cpfCnpj || cnpjDestinatario || EMPRESA_CNPJ || '').replace(/\D/g, '');

  if (!cpfCnpjFinal) {
    throw new Error(
      'cpfCnpj (ou EMPRESA_CNPJ no .env) é obrigatório para listDfe()'
    );
  }

  const query = { cpfCnpj: cpfCnpjFinal };

  if (typeof manifestada === 'boolean') query.manifestada = manifestada;
  if (status) query.status = status;
  if (dataInicial) query.dataInicial = dataInicial;
  if (dataFinal) query.dataFinal = dataFinal;
  if (hashProximaPagina) query.hashProximaPagina = hashProximaPagina;
  if (typeof resume === 'boolean') query.resume = resume;

  if (NFE_LIST_DEBUG) {
    console.log('🔍 [DF-e] GET /nfe/destinada', {
      baseURL: PLUGNOTAS_BASE_URL,
      query,
    });
  }

  try {
    const { data } = await requestWithRetry(
      {
        method: 'GET',
        url: '/nfe/destinada',
        params: query,
      },
      { retries: 5, baseDelayMs: 700 }
    );

    if (NFE_LIST_DEBUG) {
      console.log(
        '📥 [DF-e] Resposta bruta resumida:',
        `hashProximaPagina=${data?.hashProximaPagina || null}`,
        `qtdeNotas=${Array.isArray(data?.notas) ? data.notas.length : 0}`
      );
    }

    return normalizeListResponse(data);
  } catch (err) {
    // 🔥 log enxuto (não polui), mas útil
    console.error('listDfe() failed:', axiosErrInfo(err));

    // rethrow para o controller decidir status 502/500
    throw err;
  }
}

/**
 * getByKey(chave)
 *
 * STUB simples usando listDfe(), apenas para não quebrar seu teste.
 * Depois podemos evoluir para /nfe/sincronizarDestinada.
 */
export async function getByKey(chave, cpfCnpjInput) {
  if (!chave) {
    throw new Error('Chave de acesso é obrigatória para getByKey()');
  }

  const cpfCnpj =
    (cpfCnpjInput || EMPRESA_CNPJ || '').replace(/\D/g, '') || null;

  if (!cpfCnpj) {
    throw new Error(
      'cpfCnpj (ou EMPRESA_CNPJ no .env) é obrigatório para getByKey()'
    );
  }

  const page = await listDfe({
    cpfCnpj,
    resume: true,
  });

  const notaBruta =
    page.notas.map((n) => n.raw).find((n) => n.chave === chave) || null;

  if (!notaBruta) {
    return { nota: null, raw: null };
  }

  return { nota: mapNota(notaBruta), raw: notaBruta };
}
