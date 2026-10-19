// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableBoletoFiles.repository.js — PDF do boleto        ║
// ║ Download (valida %PDF) e gravação em /public/boletos               ║
// ╚════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { BOLETOS_DIR } from './accountsReceivable.constants.js';
import { ensureDir, safeFilename } from './accountsReceivable.utils.js';

export async function tryDownloadPdfBuffer(url) {
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
    const sig = buf.slice(0, 4).toString(); // %PDF

    const isPdf = sig === '%PDF' || ct.includes('pdf');
    if (!isPdf || buf.length < 800) {
      console.warn('[AR] Conteúdo não é PDF válido ao baixar boleto.', {
        url: String(url).slice(0, 200),
        contentType: ct || null,
        signature: sig || null,
        size: buf.length || 0,
      });
      return null;
    }

    return buf;
  } catch (e) {
    console.warn('[AR] Falha ao baixar PDF do boleto:', e?.message || e);
    return null;
  }
}

export function saveBoletoToDisk(pdfBuffer, asaasPaymentId, invoiceNumber = null) {
  if (!pdfBuffer || !asaasPaymentId) return null;

  ensureDir(BOLETOS_DIR);

  const base = invoiceNumber
    ? `boleto-${safeFilename(invoiceNumber)}-${safeFilename(asaasPaymentId)}.pdf`
    : `boleto-${safeFilename(asaasPaymentId)}.pdf`;

  const filename = safeFilename(base);
  const absPath = path.join(BOLETOS_DIR, filename);

  try {
    fs.writeFileSync(absPath, pdfBuffer);
    return `/public/boletos/${filename}`; // URL servida pelo Express estático
  } catch (e) {
    console.warn('[AR] Falha ao salvar boleto em disco:', e?.message || e);
    return null;
  }
}
