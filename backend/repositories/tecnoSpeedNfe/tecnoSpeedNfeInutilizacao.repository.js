// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeInutilizacao.repository.js — Inutilização NF-e          ║
// ║ ✔ inutilizarNumeracao + consultarInutilizacao                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  api,
  refreshApiConfig,
} from './tecnoSpeedNfeClient.repository.js';
import {
  sanitizeCpfCnpj,
} from '../nfe/nfe.sanitizers.js';

// ╔════════════════════════════════════════════════════════════╗
// ║ INUTILIZAR NUMERAÇÃO NF-e                                 ║
// ╚════════════════════════════════════════════════════════════╝
export async function inutilizarNumeracao(payload = {}) {
  refreshApiConfig();

  try {
    const body = {
      justificativa: String(payload.justification || '')
        .trim()
        .replace(/^"+|"+$/g, ''),
      ano: Number(payload.year),
      serie: Number(payload.serie),
      numeracao: {
        inicial: Number(payload.numberStart),
        final: Number(payload.numberEnd),
      },
      cpfCnpj: sanitizeCpfCnpj(payload.companyCnpj),
    };

    if (!body.cpfCnpj || body.cpfCnpj.length !== 14) {
      return {
        success: false,
        status: 400,
        error: 'cpfCnpj inválido para inutilização.',
      };
    }

    if (!body.justificativa || body.justificativa.length < 15) {
      return {
        success: false,
        status: 400,
        error: 'Justificativa deve conter ao menos 15 caracteres.',
      };
    }

    if (
      !Number.isFinite(body.serie) ||
      !Number.isFinite(body.numeracao.inicial) ||
      !Number.isFinite(body.numeracao.final) ||
      body.serie < 0 ||
      body.numeracao.inicial <= 0 ||
      body.numeracao.final <= 0 ||
      body.numeracao.final < body.numeracao.inicial
    ) {
      return {
        success: false,
        status: 400,
        error: 'Faixa de inutilização inválida.',
      };
    }

    console.log('[NFE][INUTILIZAR][REQUEST]', JSON.stringify(body, null, 2));

    const response = await api.post('/nfe/inutilizacao', body);

    console.log(
      '[NFE][INUTILIZAR][RESPONSE]',
      JSON.stringify(response.data, null, 2),
    );

    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error) {
    const status = error?.response?.status || 500;
    const errorData = error?.response?.data || error.message;

    console.error(
      '[NFE][INUTILIZAR][ERROR]',
      JSON.stringify(errorData, null, 2),
    );

    return {
      success: false,
      status,
      error: errorData,
    };
  }
}

// ╔════════════════════════════════════════════════════════════╗
// ║ CONSULTAR STATUS DA INUTILIZAÇÃO NF-e                     ║
// ╚════════════════════════════════════════════════════════════╝
export async function consultarInutilizacao(idOuProtocolo) {
  return {
    success: true,
    status: 200,
    message: 'Consulta de inutilização não suportada pela API PlugNotas.',
    data: null,
  };
}
