// ╔══════════════════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeInutilizacaoStatus.repository.js — consultar status da inutilização ║
// ║ GET /nfe/inutilizacao/{protocol}/status                                          ║
// ╚══════════════════════════════════════════════════════════════════════════════════╝

import { normalizeStatus, normAxiosError } from './tecnoSpeedNfeInutilizacao.utils.js';
import { isMock, client } from './tecnoSpeedNfeInutilizacaoClient.repository.js';

/**
 * Consulta status da inutilização via protocolo:
 * GET /nfe/inutilizacao/{protocol}/status
 */
export async function consultarStatus(protocol) {
  try {
    const p = String(protocol || '').trim();
    if (!p) return { ok: false, status: 400, error: 'protocol não informado.' };

    if (isMock()) {
      return {
        ok: true,
        status: 200,
        message: 'Consulta de inutilização (MOCK)',
        data: {
          numeracao: { inicial: 14, final: 15 },
          retorno: { cStat: 102, mensagem: 'Inutilizacao de numero homologado', protocolo: '123456789012345' },
          serie: 1,
          ano: 2023,
          justificativa: 'Inutilização de numeração de NFe.',
          cpfCnpj: '12345678901234',
          protocol: p,
          data: new Date().toISOString(),
          status: 'CONCLUIDO',
        },
      };
    }

    const http = client();
    const resp = await http.get(`/nfe/inutilizacao/${encodeURIComponent(p)}/status`);
    const body = resp.data || {};

    // Garante status consistente no topo
    const data = body?.data ?? body;
    if (data?.status) data.status = normalizeStatus(data.status);

    return {
      ok: true,
      status: resp.status,
      message: body?.message || 'Status da inutilização consultado',
      data,
    };
  } catch (err) {
    const e = normAxiosError(err);
    return { ok: false, status: e.status || 502, error: e.message, detail: e.data };
  }
}
