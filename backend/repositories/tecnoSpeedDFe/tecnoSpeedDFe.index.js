// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedDFe.index.js — Integração DF-e PlugNotas (CONSART ERP)     ║
// ║ Mantém a mesma API pública do antigo tecnoSpeedDFeApi.js             ║
// ║   GET https://api.plugnotas.com.br/nfe/destinada                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { http } from './tecnoSpeedDFeClient.repository.js';
import { mapNota, normalizeListResponse } from './tecnoSpeedDFe.mappers.js';
import { listDfe as listDfeTecnospeed, getByKey } from './tecnoSpeedDFeQuery.repository.js';
import { downloadXmlByKey as downloadXmlByKeyTecnospeed } from './tecnoSpeedDFeXml.repository.js';
import { isNfeApiProvider } from '../nfeApi/nfeApiClient.repository.js';
import * as nfeApiDfe from '../nfeApi/nfeApiDfe.repository.js';
import { solicitarManifestacao } from '../../services/plugNotasDfeService.js';

// ======================================================================
// NFE_PROVIDER=nfe-api: as NF-e recebidas vêm da NF-e API própria, que
// consulta a SEFAZ (Distribuição DF-e) a cada hora. Padrão: TecnoSpeed.
// ======================================================================
const listDfe = (params) => (isNfeApiProvider() ? nfeApiDfe.listDfe(params) : listDfeTecnospeed(params));

/** XML completo: NF-e API; se ela ainda não tiver (ex.: nota antiga), tenta a TecnoSpeed. */
async function downloadXmlByKey(chaveOuId, cnpj) {
  if (!isNfeApiProvider()) return downloadXmlByKeyTecnospeed(chaveOuId);
  const xml = await nfeApiDfe.downloadXmlByKey(chaveOuId, cnpj);
  if (xml) return xml;
  return downloadXmlByKeyTecnospeed(chaveOuId).catch(() => null);
}

// Operações aceitas pela PlugNotas (não há ciência pela API deles)
const PLUGNOTAS_OPERATION = {
  confirmation: 'CONFIRMACAODAOPERACAO',
  unknown: 'DESCONHECIMENTODAOPERACAO',
  notPerformed: 'OPERACAONAOREALIZADA',
};

/**
 * Manifestação do destinatário ({ chave, cpfCnpj, operacao, justificativa }). Lança erro em caso
 * de recusa. operacao: CIENCIA | CONFIRMACAO | DESCONHECIMENTO | NAO_REALIZADA (ou nomes PlugNotas).
 */
async function manifestarNfe(params = {}) {
  if (isNfeApiProvider()) return nfeApiDfe.manifestarNfe(params);

  const operacao = PLUGNOTAS_OPERATION[nfeApiDfe.manifestationTypeFromOperation(params.operacao)];
  if (!operacao) {
    const error = new Error(`Manifestação "${params.operacao}" não suportada pela TecnoSpeed.`);
    error.status = 400;
    throw error;
  }
  return solicitarManifestacao({ idNotaOrChave: params.chave, operacao, justificativa: params.justificativa });
}

export { mapNota, normalizeListResponse, listDfe, getByKey, downloadXmlByKey, manifestarNfe };

// ======================================================================
// Export default (padrão usado nos outros apis)
// ======================================================================

export default {
  http,
  listDfe,
  getByKey,
  downloadXmlByKey,   // ✅ ADD AQUI
  manifestarNfe,
  mapNota,
  normalizeListResponse,
};
