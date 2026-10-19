// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeCceDocuments.repository.js — PDF e XML da CC-e                    ║
// ║ Resolve a URL via consulta de status e baixa o arquivo               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import { TIMEOUT, getApiKey, refreshApiConfig } from './nfeCceClient.repository.js';
import { consultarStatusCCe } from './nfeCceQuery.repository.js';

/* =========================================================================
 * 📄 PDF CC-e
 * ========================================================================= */

export async function obterPdfCCe(idOuChaveOuProtocolo) {
  refreshApiConfig();

  const identifier = String(
    idOuChaveOuProtocolo || ''
  ).trim();

  if (!identifier) {
    return {
      ok: false,
      status: 400,
      error: 'Id, chave ou protocolo não informado.',
    };
  }

  try {
    /*
     * A rota /cce/pdf da PlugNotas espera o ID/chave da NF-e,
     * não necessariamente o protocolo da CC-e.
     *
     * A consulta de status aceita o protocolo e devolve a URL
     * correta do PDF vinculada à NF-e.
     */
    const statusResult = await consultarStatusCCe(
      identifier,
      false
    );

    if (!statusResult.ok) {
      return statusResult;
    }

    const statusPayload =
      statusResult.data?.data ??
      statusResult.data ??
      {};

    const statusItem =
      Array.isArray(statusPayload)
        ? statusPayload[0] || {}
        : statusPayload;

    const situacao = String(
      statusItem.status ||
      statusItem.situacao ||
      ''
    ).toUpperCase();

    const pdfUrl =
      statusItem.pdf ||
      statusItem.pdfUrl ||
      statusItem.urlPdf ||
      null;

    if (!pdfUrl) {
      const emProcessamento =
        situacao.includes('PROCESS');

      return {
        ok: false,
        status: emProcessamento ? 202 : 404,
        processing: emProcessamento,
        error: emProcessamento
          ? 'CC-e ainda em processamento.'
          : 'URL do PDF da CC-e não disponível.',
      };
    }

    const res = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: TIMEOUT,
      headers: {
        Accept: 'application/pdf',
        'X-API-KEY': getApiKey(),
        'x-api-key': getApiKey(),
      },
      validateStatus: () => true,
    });

    const contentType = String(
      res.headers?.['content-type'] || ''
    ).toLowerCase();

    const buffer = Buffer.from(res.data || []);

    const isPdf =
      contentType.includes('application/pdf') ||
      buffer.subarray(0, 4).toString() === '%PDF';

    if (res.status >= 400 || !isPdf) {
      return {
        ok: false,
        status:
          res.status >= 400
            ? res.status
            : 502,
        error:
          buffer.toString('utf8') ||
          'A PlugNotas não retornou um PDF válido.',
      };
    }

    return {
      ok: true,
      status: res.status,
      buffer,
      contentType:
        contentType || 'application/pdf',
      pdfUrl,
    };
  } catch (err) {
    let error = err.response?.data || err.message;

    if (
      Buffer.isBuffer(error) ||
      error instanceof ArrayBuffer
    ) {
      error = Buffer.from(error).toString('utf8');
    }

    return {
      ok: false,
      status: err.response?.status || 500,
      error,
    };
  }
}

/* =========================================================================
 * 📄 XML CC-e
 * ========================================================================= */

export async function obterXmlCCe(idOuChaveOuProtocolo) {
  refreshApiConfig();

  try {
    const status = await consultarStatusCCe(idOuChaveOuProtocolo);

    if (!status.ok) return status;

    const xmlUrl =
      status?.data?.data?.xml ||
      status?.data?.xml ||
      null;

    if (!xmlUrl) {
      return {
        ok: false,
        status: 404,
        error: 'URL do XML da CC-e não disponível.',
      };
    }

    const res = await axios.get(xmlUrl, {
      responseType: 'text',
      headers: {
        'X-API-KEY': getApiKey(),
        'x-api-key': getApiKey(),
      },
      timeout: TIMEOUT,
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
