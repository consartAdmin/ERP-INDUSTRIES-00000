// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeQuery.repository.js — Consulta / XML / PDF de NF-e      ║
// ║ ✔ consultarNFe, obterXml, obterPdf, extrairTpAmb                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  api,
  refreshApiConfig,
} from './tecnoSpeedNfeClient.repository.js';

/* =========================================================================
 * 🔍 Consultar / XML / PDF
 * ========================================================================= */
export async function consultarNFe(idOuChave) {
  refreshApiConfig();

  try {
    const res = await api.get(
      `/nfe/${encodeURIComponent(idOuChave)}/resumo`,
    );

    return {
      ok: true,
      status: res.status,
      data: res.data,
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 500,
      error: err.response?.data || err.message,
    };
  }
}

export async function obterXml(idOuChave) {
  refreshApiConfig();

  try {
    const res = await api.get(
      `/nfe/${encodeURIComponent(idOuChave)}/xml`,
      {
        responseType: 'text',
        headers: {
          Accept: 'application/xml, text/xml, */*',
        },
        transformResponse: [(raw) => raw],
      },
    );

    const xml = typeof res.data === 'string'
      ? res.data
      : String(res.data || '');

    return {
      ok: true,
      status: res.status,
      xml,
      hasNfeNamespace:
        xml.includes('xmlns="http://www.portalfiscal.inf.br/nfe"'),
      hasSignatureNamespace:
        xml.includes('xmlns="http://www.w3.org/2000/09/xmldsig#"'),
    };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || 500,
      error: err.response?.data || err.message,
    };
  }
}

export async function obterPdf(idOuChave) {
  refreshApiConfig();
  try {
    const res = await api.get(`/nfe/${encodeURIComponent(idOuChave)}/pdf`, {
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

export function extrairTpAmb(xmlStr = '') {
  const m = String(xmlStr).match(/<tpAmb>(\d)<\/tpAmb>/);
  return m ? m[1] : null;
}
