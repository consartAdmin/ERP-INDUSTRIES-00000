// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeApiDfe.repository.js — NF-e recebidas (DF-e) pela NF-e API        ║
// ║ Mesmas funções/retornos de repositories/tecnoSpeedDFe: listDfe,      ║
// ║ downloadXmlByKey e manifestarNfe (usados pelo NF-e Inbox).           ║
// ║ A NF-e API busca na SEFAZ sozinha (a cada hora); aqui só lemos.      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { errorMessageFrom, getIssuerCnpj, request } from './nfeApiClient.repository.js';
import { mapNota, normalizeListResponse } from '../tecnoSpeedDFe/tecnoSpeedDFe.mappers.js';

const digits = (value) => String(value ?? '').replace(/\D/g, '');

const SITUATION = { authorized: 'AUTORIZADA', cancelled: 'CANCELADA', denied: 'DENEGADA' };

// Manifestação: NF-e API ⇄ valores usados pelo NF-e Inbox (nfeInbox.html / getManifestLabel)
const OPERATION_BY_TYPE = {
  awareness: 'CIENCIA',
  confirmation: 'CONFIRMACAO',
  unknown: 'DESCONHECIMENTO',
  notPerformed: 'NAO_REALIZADA',
};

/** Aceita os valores do Inbox e também os nomes da PlugNotas. */
export function manifestationTypeFromOperation(operacao) {
  const op = String(operacao ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (op.includes('CIEN')) return 'awareness';
  if (op.includes('CONFIRM')) return 'confirmation';
  if (op.includes('DESCONHEC')) return 'unknown';
  if (op.includes('NAO') && op.includes('REALIZ')) return 'notPerformed';
  return null;
}

const companyCnpj = (cnpj) => (digits(cnpj).length === 14 ? digits(cnpj) : getIssuerCnpj());

/** Registro da NF-e API → documento "destinada" da PlugNotas (entrada de mapNota). */
function toDestinada(record, cnpj) {
  const m = record.manifestation;
  return {
    idIntegracao: null,
    chave: record.accessKey,
    nsu: record.nsu ? Number(record.nsu) : null,
    numero: record.number ? String(record.number) : null,
    serie: record.series ?? null,
    status: SITUATION[record.situation] ?? String(record.situation ?? '').toUpperCase(),
    dataEmissao: record.issuedAt ?? null,
    dataAutorizacao: record.authorizedAt ?? null,
    saida: record.operationType !== 'inbound',
    emitente: {
      cpfCnpj: record.issuer?.cnpj ?? null,
      razaoSocial: record.issuer?.name ?? null,
      inscricaoEstadual: record.issuer?.stateRegistration ?? null,
    },
    destinatario: { cpfCnpj: cnpj },
    total: { valorNfe: record.totalValue ?? null },
    manifestacao: m
      ? [{
          data: m.registeredAt ?? null,
          operacao: OPERATION_BY_TYPE[m.type] ?? m.type,
          status: 'CONCLUIDO',
          respostaSefaz: 'Evento registrado',
          cStat: '135',
          retorno: m.protocolNumber ?? null,
        }]
      : [],
    xmlCompleto: Boolean(record.hasXml),
  };
}

/**
 * Mesmo retorno de tecnoSpeedDFe.listDfe: { nextPageHash, totalNotas, notas: mapNota[], raw }.
 * Traz todas as NF-e recebidas guardadas pela API (sem paginação).
 */
export async function listDfe(params = {}) {
  const cnpj = companyCnpj(params.cpfCnpj ?? params.cnpjDestinatario);
  const query = new URLSearchParams({ limit: '2000' });
  if (params.dataInicial) query.set('from', String(params.dataInicial).slice(0, 10));
  if (params.dataFinal) query.set('to', String(params.dataFinal).slice(0, 10));

  const res = await request('GET', `/v1/companies/${cnpj}/dfe?${query}`);
  if (res.status !== 200) {
    const error = new Error(`NF-e API (DF-e): ${errorMessageFrom(res)}`);
    error.status = res.status;
    throw error;
  }
  const notas = res.data.map((record) => toDestinada(record, cnpj));
  return normalizeListResponse({ notas, totalNotas: notas.length, hashProximaPagina: null });
}

/** XML completo pela chave; null quando ainda não disponível (só resumo, antes da ciência). */
export async function downloadXmlByKey(chave, cnpj) {
  const key = digits(chave);
  if (key.length !== 44) return null;
  const res = await request('GET', `/v1/companies/${companyCnpj(cnpj)}/dfe/${key}/xml`, { responseType: 'text' });
  if (res.status === 200) return String(res.data);
  if ([404, 409].includes(res.status)) return null;
  const error = new Error(`NF-e API (DF-e XML): ${errorMessageFrom(res)}`);
  error.status = res.status;
  throw error;
}

/**
 * Manifestação do destinatário. Lança erro se a SEFAZ recusar (o controller trata como falha).
 * @param {{ chave: string, cpfCnpj?: string, operacao: string, justificativa?: string }} params
 */
export async function manifestarNfe({ chave, cpfCnpj, operacao, justificativa } = {}) {
  const type = manifestationTypeFromOperation(operacao);
  if (!type) {
    const error = new Error(`Manifestação desconhecida: ${operacao}`);
    error.status = 400;
    throw error;
  }
  const res = await request('POST', `/v1/companies/${companyCnpj(cpfCnpj)}/dfe/${digits(chave)}/manifest`, {
    data: { type, ...(justificativa ? { reason: String(justificativa).trim() } : {}) },
  });
  if (res.status !== 200) {
    const error = new Error(errorMessageFrom(res));
    error.status = res.status === 422 ? 422 : 502;
    throw error;
  }
  return { ok: true, status: 200, data: toDestinada(res.data, companyCnpj(cpfCnpj)), nota: mapNota(toDestinada(res.data, companyCnpj(cpfCnpj))) };
}
