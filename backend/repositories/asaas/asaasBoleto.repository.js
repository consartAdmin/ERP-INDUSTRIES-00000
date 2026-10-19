// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaasBoleto.repository.js — PDF do boleto (download + disco)       ║
// ║ getBoletoPdf: local → fallback Asaas → salva → retorna             ║
// ║ Salva em /backend/public/boletos; valida PDF por assinatura %PDF   ║
// ╚════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DIR, BOLETOS_DIR } from './asaas.constants.js';
import { ensureDir, safeFilename, isProbablyHtml, fileExists } from './asaas.utils.js';
import { asaasClient } from './asaasClient.repository.js';
import { getPayment } from './asaasPayments.repository.js';

/* ---------------------------------------------------------------------- */
/* PDF Download Helpers                                                   */
/* ---------------------------------------------------------------------- */
export async function tryDownloadPdfBuffer(url, logger = console) {
  if (!url) return null;

  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        'Cache-Control': 'no-store',
      },
    });

    const buf = Buffer.from(resp.data || []);
    const ct = String(resp.headers?.['content-type'] || '').toLowerCase();

    if (isProbablyHtml(buf, ct)) {
      logger.warn?.('[AsaasAPI] URL retornou HTML (provável URL/base inválida).', {
        contentType: ct || null,
        url: String(url).slice(0, 180),
      });
      return null;
    }

    const sig = buf.slice(0, 4).toString(); // %PDF
    const isPdf = sig === '%PDF' || ct.includes('pdf');

    if (!isPdf || buf.length < 800) {
      logger.warn?.('[AsaasAPI] Conteúdo não é PDF válido ao baixar boleto.', {
        contentType: ct || null,
        signature: sig || null,
        size: buf.length || 0,
        url: String(url).slice(0, 180),
      });
      return null;
    }

    return buf;
  } catch (e) {
    logger.warn?.('[AsaasAPI] Falha ao baixar PDF do boleto:', e?.message || e);
    return null;
  }
}

/**
 * Salva o PDF do boleto em /backend/public/boletos e retorna:
 * - urlLocal: "/public/boletos/xxx.pdf"
 * - absPath : ".../backend/public/boletos/xxx.pdf"
 */
export function saveBoletoToDisk(pdfBuffer, paymentId, invoiceNumber = null) {
  if (!pdfBuffer || !paymentId) return { urlLocal: null, absPath: null };

  ensureDir(BOLETOS_DIR);

  const base = invoiceNumber
    ? `boleto-${safeFilename(invoiceNumber)}-${safeFilename(paymentId)}.pdf`
    : `boleto-${safeFilename(paymentId)}.pdf`;

  const filename = safeFilename(base);
  const absPath = path.join(BOLETOS_DIR, filename);

  try {
    fs.writeFileSync(absPath, pdfBuffer);
    const urlLocal = `/public/boletos/${filename}`;
    return { urlLocal, absPath };
  } catch (e) {
    console.warn('[AsaasAPI] Falha ao salvar boleto em disco:', e?.message || e);
    return { urlLocal: null, absPath: null };
  }
}

/**
 * Converte uma URL pública "/public/boletos/x.pdf" para path absoluto em disco.
 * Serve para usar res.download(absPath) no controller sem fetch.
 */
export function resolveLocalBoletoPath(publicUrlPath) {
  const p = String(publicUrlPath || '').trim();
  if (!p.startsWith('/public/')) return null;

  // remove /public/ e junta com PUBLIC_DIR (que já é /backend/public)
  const rel = p.replace(/^\/public\//, '');
  const abs = path.join(PUBLIC_DIR, rel);

  return abs;
}

/**
 * Fallback interno: algumas contas/ambientes expõem um endpoint de PDF (varia).
 * Tenta:
 *  - GET /payments/:id  -> pega bankSlipPdfUrl/bankSlipUrl/invoiceUrl
 *  - E opcionalmente tenta endpoints conhecidos quando URL não vier.
 */
async function tryFetchBoletoUrlFromPayment(paymentId, logger = console) {
  const payment = await getPayment(paymentId);

  let boletoUrl =
    payment?.bankSlipPdfUrl ||
    payment?.bankSlipUrl ||
    payment?.invoiceUrl ||
    null;

  if (boletoUrl) return { payment, boletoUrl };

  // Fallbacks comuns (nem sempre existem; se 404, ignora)
  const candidates = [
    `/payments/${paymentId}/pdf`,
    `/payments/${paymentId}/bankSlipPdf`,
    `/payments/${paymentId}/bankSlip/pdf`,
  ];

  for (const endpoint of candidates) {
    try {
      const { data } = await asaasClient.get(endpoint, { responseType: 'arraybuffer' });
      const buf = Buffer.from(data || []);
      const sig = buf.slice(0, 4).toString();
      if (sig === '%PDF' && buf.length > 800) {
        // não temos URL, mas temos o PDF direto
        return { payment, boletoUrl: null, directPdf: buf };
      }
    } catch (e) {
      const status = e?.response?.status;
      if (status && status !== 404) {
        logger.warn?.('[AsaasAPI] Fallback endpoint falhou:', endpoint, status);
      }
    }
  }

  return { payment, boletoUrl: null };
}

/* ---------------------------------------------------------------------- */
/* getBoletoPdf                                                            */
/* ---------------------------------------------------------------------- */
/**
 * Resolve boleto PDF pronto para download no backend:
 *   1) Se houver arquivo local (urlLocal ou absPath) e existir -> retorna.
 *   2) Senão, consulta o Asaas (getPayment) e tenta baixar PDF.
 *   3) Se baixar, salva e retorna urlLocal + absPath.
 *
 * Retorno:
 *  { ok, status, error, urlLocal, absPath }
 */
export async function getBoletoPdf({
  paymentId,
  boleto_pdf_url_local = null,
  boleto_pdf_abs_path = null,
  logger = console,
} = {}) {
  if (!paymentId) {
    return {
      ok: false,
      status: 400,
      error: 'paymentId não informado.',
      urlLocal: null,
      absPath: null,
    };
  }

  // 1) Se já veio absPath e existe, retorna
  if (boleto_pdf_abs_path && fileExists(boleto_pdf_abs_path)) {
    return {
      ok: true,
      status: 200,
      urlLocal: boleto_pdf_url_local || null,
      absPath: boleto_pdf_abs_path,
    };
  }

  // 2) Se já veio url local, tenta resolver e verificar
  if (boleto_pdf_url_local) {
    const resolved = resolveLocalBoletoPath(boleto_pdf_url_local);
    if (resolved && fileExists(resolved)) {
      return {
        ok: true,
        status: 200,
        urlLocal: boleto_pdf_url_local,
        absPath: resolved,
      };
    }
  }

  // 3) Fallback: busca no Asaas e tenta baixar
  try {
    const { payment, boletoUrl, directPdf } = await tryFetchBoletoUrlFromPayment(paymentId, logger);

    // 3a) Se fallback retornou PDF direto por endpoint interno
    if (directPdf && Buffer.isBuffer(directPdf)) {
      const saved = saveBoletoToDisk(directPdf, paymentId, payment?.invoiceNumber || null);

      if (!saved?.absPath || !fileExists(saved.absPath)) {
        return {
          ok: false,
          status: 500,
          error: 'Falha ao salvar o PDF do boleto no disco.',
          urlLocal: null,
          absPath: null,
        };
      }

      return {
        ok: true,
        status: 200,
        urlLocal: saved.urlLocal,
        absPath: saved.absPath,
      };
    }

    if (!boletoUrl) {
      return {
        ok: false,
        status: 404,
        error: 'Asaas não retornou URL do boleto para este paymentId.',
        urlLocal: null,
        absPath: null,
      };
    }

    const pdf = await tryDownloadPdfBuffer(boletoUrl, logger);

    if (!pdf) {
      return {
        ok: false,
        status: 502,
        error: 'URL do Asaas retornou conteúdo não-PDF ou inválido.',
        urlLocal: null,
        absPath: null,
      };
    }

    const saved = saveBoletoToDisk(pdf, paymentId, payment?.invoiceNumber || null);

    if (!saved?.absPath || !fileExists(saved.absPath)) {
      return {
        ok: false,
        status: 500,
        error: 'Falha ao salvar o PDF do boleto no disco.',
        urlLocal: null,
        absPath: null,
      };
    }

    return {
      ok: true,
      status: 200,
      urlLocal: saved.urlLocal,
      absPath: saved.absPath,
    };
  } catch (e) {
    logger?.warn?.('[AsaasAPI] getBoletoPdf falhou:', e?.message || e);
    return {
      ok: false,
      status: 500,
      error: e?.message || 'Erro inesperado ao obter boleto.',
      urlLocal: null,
      absPath: null,
    };
  }
}
