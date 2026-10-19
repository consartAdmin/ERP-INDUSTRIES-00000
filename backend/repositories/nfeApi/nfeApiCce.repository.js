// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeApiCce.repository.js — CC-e (carta de correção) pela NF-e API     ║
// ║ Mesmas funções/retornos de repositories/nfeCce (emitir, status,      ║
// ║ PDF e XML). A NF-e API é síncrona: a CC-e já volta registrada.       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { errorMessageFrom, getIssuerCnpj, request } from './nfeApiClient.repository.js';

const ACCESS_KEY = /^\d{44}$/;
const PROTOCOL = /^\d{15}$/;

/** Letra da NF-e API → formato lido por extractStatusPayload() do nfeCceController. */
function toCceDocument(accessKey, letter) {
  return {
    chave: accessKey,
    protocolo: letter.protocolNumber,
    numeroSequencia: letter.sequence,
    correcao: letter.correction,
    status: 'CONCLUIDO',
    cStat: '135',
    respostaSefaz: 'Evento registrado e vinculado a NF-e',
    data: letter.registeredAt,
  };
}

const fail = (res) => ({ ok: false, status: res.status, error: errorMessageFrom(res) });

/**
 * Chave (44 dígitos) → última CC-e da nota; protocolo (15 dígitos) → CC-e exata.
 * @returns {Promise<{ ok: true, accessKey: string, letter: object, letters: object[] } | { ok: false, status: number, error: string }>}
 */
async function locate(identifier) {
  const id = String(identifier ?? '').trim();

  if (ACCESS_KEY.test(id)) {
    const res = await request('GET', `/v1/invoices/${id}/corrections`);
    if (res.status !== 200) return fail(res);
    const letters = res.data ?? [];
    if (!letters.length) return { ok: false, status: 404, error: 'A NF-e não possui carta de correção.' };
    return { ok: true, accessKey: id, letter: letters.at(-1), letters };
  }

  if (PROTOCOL.test(id)) {
    const res = await request('GET', `/v1/correction-letters/${id}?issuerCnpj=${getIssuerCnpj()}`);
    if (res.status !== 200) return fail(res);
    const { accessKey, number, series, ...letter } = res.data;
    return { ok: true, accessKey, letter, letters: [letter] };
  }

  return { ok: false, status: 404, error: 'Identificador não pertence à NF-e API.' };
}

export async function emitirCCe(idOuChave, correcao) {
  const key = String(idOuChave ?? '').trim();
  const text = String(correcao ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, status: 400, error: 'Texto da carta de correção não informado.' };

  const res = await request('POST', `/v1/invoices/${key}/correction`, { data: { correction: text } });
  if (res.status !== 200) return fail(res);

  const letter = (res.data.correctionLetters ?? []).at(-1);
  return { ok: true, status: 200, data: toCceDocument(key, letter) };
}

export async function consultarStatusCCe(idOuChaveOuProtocolo, listaCce = false) {
  const found = await locate(idOuChaveOuProtocolo);
  if (!found.ok) return found;
  return {
    ok: true,
    status: 200,
    data: listaCce
      ? found.letters.map((letter) => toCceDocument(found.accessKey, letter))
      : toCceDocument(found.accessKey, found.letter),
  };
}

export async function obterPdfCCe(idOuChaveOuProtocolo) {
  const found = await locate(idOuChaveOuProtocolo);
  if (!found.ok) return found;
  const res = await request('GET', `/v1/invoices/${found.accessKey}/corrections/${found.letter.sequence}/pdf`, { responseType: 'arraybuffer' });
  if (res.status !== 200) return fail(res);
  return { ok: true, status: 200, buffer: Buffer.from(res.data), contentType: 'application/pdf' };
}

export async function obterXmlCCe(idOuChaveOuProtocolo) {
  const found = await locate(idOuChaveOuProtocolo);
  if (!found.ok) return found;
  const res = await request('GET', `/v1/invoices/${found.accessKey}/corrections/${found.letter.sequence}/xml`, { responseType: 'text' });
  if (res.status !== 200) return fail(res);
  return { ok: true, xml: String(res.data) };
}
