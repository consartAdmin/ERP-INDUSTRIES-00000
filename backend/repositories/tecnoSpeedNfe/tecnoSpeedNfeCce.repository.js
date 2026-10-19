// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeCce.repository.js — Carta de Correção (CC-e)            ║
// ║ ✔ Emitir, consultar status, PDF e XML                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import {
  getApiKey,
  PLUGNOTAS_TIMEOUT,
  api,
  refreshApiConfig,
} from './tecnoSpeedNfeClient.repository.js';

/* =========================================================================
 * 📝 CC-e
 * ========================================================================= */
export function normalizeCorrecaoText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function emitirCCe(idOuChave, correcao) {
  refreshApiConfig();

  const id = String(idOuChave || '').trim();
  const texto = normalizeCorrecaoText(correcao);

  if (!id) {
    return {
      ok: false,
      status: 400,
      error: 'Id, chave ou protocolo da NF-e não informado.',
    };
  }

  if (!texto) {
    return {
      ok: false,
      status: 400,
      error: 'Texto da carta de correção não informado.',
    };
  }

  try {
    const res = await api.post(`/nfe/${encodeURIComponent(id)}/cce`, {
      correcao: texto,
    });

    return {
      ok: true,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 400,
      error: err.response?.data || err.message,
    };
  }
}

export async function consultarStatusCCe(
  idOuChaveOuProtocolo,
  listaCce = false,
) {
  refreshApiConfig();

  try {
    const res = await api.get(
      `/nfe/${encodeURIComponent(idOuChaveOuProtocolo)}/cce/status`,
      {
        params: listaCce ? { listaCce: true } : {},
      },
    );

    return {
      ok: true,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 400,
      error: err.response?.data || err.message,
    };
  }
}

export async function obterPdfCCe(idOuChave) {
  refreshApiConfig();

  try {
    const res = await api.get(`/nfe/${encodeURIComponent(idOuChave)}/cce/pdf`, {
      responseType: 'arraybuffer',
    });

    return { ok: true, buffer: res.data };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status,
      error: err.response?.data || err.message,
    };
  }
}

export async function obterXmlCCe(idOuChaveOuProtocolo) {
  refreshApiConfig();

  try {
    const status = await consultarStatusCCe(idOuChaveOuProtocolo, false);

    if (!status.ok) {
      return status;
    }

    const xmlUrl = status?.data?.data?.xml || status?.data?.xml || null;

    if (!xmlUrl) {
      return {
        ok: false,
        status: 404,
        error: 'URL do XML da CC-e não disponível no status retornado.',
      };
    }

    const res = await axios.get(xmlUrl, {
      responseType: 'text',
      headers: {
        'X-API-KEY': getApiKey(),
        'x-api-key': getApiKey(),
      },
      timeout: PLUGNOTAS_TIMEOUT,
    });

    return { ok: true, xml: res.data };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 400,
      error: err.response?.data || err.message,
    };
  }
}
