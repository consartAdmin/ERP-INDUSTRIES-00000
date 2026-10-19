// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfesEmailBoleto.repository.js — Boleto: ponte AR↔Asaas + PDF         ║
// ║ Tabela: public."accountsReceivableAsaas" (raw JSONB merge)           ║
// ║ Fábrica: recebe { pool, logger } injetados por createNfesEmailApi    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import fs from 'node:fs';
import { TB_AR_ASAAS } from './nfesEmail.constants.js';
import { publicUrlToAbsPath } from './nfesEmail.utils.js';

export function createNfesEmailBoletoRepository({ pool, logger }) {
  /* ===============================================================
     DB: PATCH/MERGE raw sem apagar JSON antigo
  =============================================================== */
  async function persistAsaasRawForAr(arId, patchObj) {
    try {
      if (!arId) return;
      const patch = JSON.stringify(patchObj || {});
      await pool.query(
        `
        UPDATE ${TB_AR_ASAAS}
           SET raw = COALESCE(raw, '{}'::jsonb) || $2::jsonb,
               updated_at = now()
         WHERE accounts_receivable_id = $1
        `,
        [arId, patch]
      );
    } catch (e) {
      logger.warn('[NFES][EMAIL] persistAsaasRawForAr falhou:', e?.message || e);
    }
  }

  /* ===============================================================
     GET BOLETO INFO FROM BRIDGE (prioriza local + PDF)
  =============================================================== */
  async function getBankSlipInfoFromArId(arId) {
    const { rows } = await pool.query(
      `
      SELECT
        raw->>'boleto_pdf_url_local' AS local_url,
        raw->>'bankSlipPdfUrl'       AS pdf_url,
        raw->>'bankSlipUrl'          AS url,
        raw->>'invoiceUrl'           AS invoice_url,
        raw->>'invoiceNumber'        AS invoice_number,
        asaas_payment_id
      FROM ${TB_AR_ASAAS}
      WHERE accounts_receivable_id = $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `,
      [arId]
    );

    const r = rows?.[0] || {};
    const best =
      (r.local_url && String(r.local_url).trim()) ||
      (r.pdf_url && String(r.pdf_url).trim()) ||
      (r.url && String(r.url).trim()) ||
      (r.invoice_url && String(r.invoice_url).trim()) ||
      null;

    return {
      url: best,
      local_url: r.local_url || null,
      asaas_payment_id: r.asaas_payment_id || null,
      invoice_number: r.invoice_number || null,
    };
  }

  /* ===============================================================
     READ LOCAL PDF (when url starts with /public/)
  =============================================================== */
  function tryReadLocalPdfBuffer(publicUrl) {
    try {
      const abs = publicUrlToAbsPath(publicUrl);
      if (!abs) return null;
      if (!fs.existsSync(abs)) {
        logger.warn('[NFES][EMAIL] Boleto local não encontrado no disco:', abs);
        return null;
      }
      const buf = fs.readFileSync(abs);
      const signature = buf.slice(0, 4).toString();

      if (signature === '%PDF' && buf.length > 800) {
        return buf;
      }

      logger.warn('[NFES][EMAIL] Arquivo local não parece ser PDF válido:', {
        abs,
        size: buf.length,
        signature,
      });

      return null;
    } catch (e) {
      logger.warn('[NFES][EMAIL] Erro lendo boleto local:', e?.message || e);
      return null;
    }
  }

  /* ===============================================================
     DOWNLOAD PDF VALIDATED (remote)
  =============================================================== */
  async function tryDownloadPdfBuffer(url) {
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
      const signature = buf.slice(0, 4).toString();
      const contentType = String(resp.headers?.['content-type'] || '').toLowerCase();

      if ((signature === '%PDF' || contentType.includes('pdf')) && buf.length > 800) {
        return buf;
      }

      logger.warn('[NFES][EMAIL] Conteúdo remoto não é PDF válido.', {
        url: String(url).slice(0, 240),
        size: buf.length,
        contentType,
        signature,
      });

      return null;
    } catch (e) {
      logger.warn('[NFES][EMAIL] Erro download boleto:', e?.message || e);
      return null;
    }
  }

  return {
    persistAsaasRawForAr,
    getBankSlipInfoFromArId,
    tryReadLocalPdfBuffer,
    tryDownloadPdfBuffer,
  };
}
