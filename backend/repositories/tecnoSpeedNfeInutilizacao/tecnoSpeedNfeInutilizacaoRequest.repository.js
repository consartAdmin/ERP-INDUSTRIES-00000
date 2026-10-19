// ╔═════════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeInutilizacaoRequest.repository.js — solicitar inutilização ║
// ║ POST /nfe/inutilizacao                                                  ║
// ╚═════════════════════════════════════════════════════════════════════════╝

import { onlyDigits, normAxiosError, cryptoRandom } from './tecnoSpeedNfeInutilizacao.utils.js';
import { isMock, client } from './tecnoSpeedNfeInutilizacaoClient.repository.js';

/**
 * Solicita inutilização de numeração.
 * Esperado: retorno com "protocol" (protocolo para consulta em /status).
 */
export async function solicitarInutilizacao({
  cpfCnpj,
  ano,
  serie,
  inicial,
  final,
  justificativa,
} = {}) {
  try {
    // Validações básicas
    const doc = onlyDigits(cpfCnpj);
    if (!(doc.length === 11 || doc.length === 14)) {
      return { ok: false, status: 400, error: 'cpfCnpj inválido (11 ou 14 dígitos).' };
    }

    const _ano = Number(ano);
    const _serie = Number(serie);
    const _ini = Number(inicial);
    const _fim = Number(final);

    if (!Number.isFinite(_ano) || _ano < 2000 || _ano > 2100) {
      return { ok: false, status: 400, error: 'ano inválido.' };
    }
    if (!Number.isFinite(_serie) || _serie < 0) {
      return { ok: false, status: 400, error: 'serie inválida.' };
    }
    if (!Number.isFinite(_ini) || !Number.isFinite(_fim) || _ini <= 0 || _fim <= 0 || _fim < _ini) {
      return { ok: false, status: 400, error: 'Faixa inválida (inicial/final).' };
    }

    const just = String(justificativa || '').trim();
    if (just.length < 15) {
      return { ok: false, status: 400, error: 'Justificativa deve ter no mínimo 15 caracteres.' };
    }

    // Body (mantive nomes simples; se seu provedor exigir outros nomes, ajuste aqui)
    const payload = {
      cpfCnpj: doc,
      ano: _ano,
      serie: _serie,
      numeracao: { inicial: _ini, final: _fim },
      justificativa: just,
    };

    // MOCK (opcional): devolve um exemplo compatível com o seu JSON
    if (isMock()) {
      const protocol = 'mock-' + cryptoRandom();
      return {
        ok: true,
        status: 200,
        message: 'Solicitação de inutilização processada (MOCK)',
        data: {
          ...payload,
          protocol,
          data: new Date().toISOString(),
          status: 'PROCESSANDO',
        },
      };
    }

    const http = client();
    const resp = await http.post('/nfe/inutilizacao', payload);

    // Normalização: alguns retornos vêm em data.protocol, outros em data.data.protocol etc.
    const body = resp.data || {};
    const protocol = body?.protocol || body?.data?.protocol || null;

    return {
      ok: true,
      status: resp.status,
      message: body?.message || 'Solicitação de inutilização enviada',
      data: body?.data ?? body,
      protocol,
    };
  } catch (err) {
    const e = normAxiosError(err);
    return { ok: false, status: e.status || 502, error: e.message, detail: e.data };
  }
}
