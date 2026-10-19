// ╔══════════════════════════════════════════════════════════════════════╗
// ║ plugnotasNfceQuery.repository.js — getNfceResumo                     ║
// ║ PlugNotas: GET /nfce/{idNotaOrChaveOrProtocol}/resumo                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { http } from './plugnotasNfceClient.repository.js';
import { normalizeResumoResponse } from './plugnotasNfce.mappers.js';

/**
 * Consulta RESUMO da NFC-e na PlugNotas.
 * Aceita: id da nota, chave ou protocolo.
 */
export async function getNfceResumo(idNotaOrChaveOrProtocol) {
  if (!idNotaOrChaveOrProtocol) {
    throw new Error('idNotaOrChaveOrProtocol é obrigatório');
  }

  const path = `/nfce/${encodeURIComponent(idNotaOrChaveOrProtocol)}/resumo`;

  try {
    const { data } = await http.get(path);
    const list = normalizeResumoResponse(data);

    console.log(
      '[plugnotasNfceApi.getNfceResumo] OK:',
      idNotaOrChaveOrProtocol,
      `→ ${list.length} item(ns)`
    );

    return list;
  } catch (err) {
    const status = err.response?.status;
    const body = err.response?.data;

    console.error(
      '[plugnotasNfceApi.getNfceResumo] ERRO:',
      'id/chave =',
      idNotaOrChaveOrProtocol,
      '| status =',
      status,
      '| data =',
      body || err.message
    );

    throw err;
  }
}
