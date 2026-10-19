// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivableBoletoDownload.repository.js — Download boleto   ║
// ║ Prioriza PDF local → gera local → fallback URL remota              ║
// ║ updateBoletoLocalInfo grava local na ponte + raw                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import * as asaasApi from '../asaas/asaas.index.js';
import { TB_BRIDGE } from './accountsReceivable.constants.js';
import { toInt } from './accountsReceivable.sanitizers.js';
import {
  persistAsaasRawForAr,
  getBridgeBoletoFieldsByArId,
  resolveAsaasPaymentIdByAccountsReceivableId,
} from './accountsReceivableBridge.repository.js';
import { tryDownloadPdfBuffer, saveBoletoToDisk } from './accountsReceivableBoletoFiles.repository.js';

/**----------------------------------------------------
 * Garante que exista boleto_pdf_url_local no raw.
 * Se já existe, retorna.
 * Se não, tenta:
 *  - usar bankSlipPdfUrl/bankSlipUrl já salvo
 *  - senão, faz GET /payments/:id e pega urls
 *  - baixa e salva local
 *  - faz PATCH/MERGE no raw
 **-----------------------------------------------------**/
async function ensureLocalBoletoForArId(accountsReceivableId) {
  const arId = toInt(accountsReceivableId, 0);
  if (!arId) return { ok: false, error: 'ID inválido' };

  const bridge = await getBridgeBoletoFieldsByArId(arId);
  if (!bridge?.asaas_payment_id) {
    return { ok: false, error: 'Conta não possui vínculo com Asaas (asaas_payment_id).' };
  }

  // 1) Já tem local
  const local = String(bridge.boleto_pdf_url_local || '').trim();
  if (local) return { ok: true, localUrl: local, asaas_payment_id: bridge.asaas_payment_id };

  // 2) Pega URL disponível no raw
  let url =
    bridge.bankSlipPdfUrl ||
    bridge.bankSlipUrl ||
    bridge.invoiceUrl ||
    null;

  // 3) Se não tem, faz GET payment no Asaas (read-only)
  let pay = null;
  if (!url) {
    try {
      pay = await asaasApi.getPayment(bridge.asaas_payment_id);
      url = pay?.bankSlipPdfUrl || pay?.bankSlipUrl || pay?.invoiceUrl || null;

      // cacheia urls úteis no raw (merge)
      await persistAsaasRawForAr(arId, {
        bankSlipPdfUrl: pay?.bankSlipPdfUrl || null,
        bankSlipUrl: pay?.bankSlipUrl || null,
        invoiceUrl: pay?.invoiceUrl || null,
      });
    } catch (e) {
      // best effort
      console.warn('[AR] ensureLocalBoletoForArId: falha GET payment:', e?.message || e);
    }
  }

  if (!url) return { ok: false, error: 'Boleto ainda não disponível no Asaas (sem URL).' };

  // 4) Baixa e salva local
  const pdf = await tryDownloadPdfBuffer(url);
  if (!pdf) return { ok: false, error: 'URL do boleto não retornou PDF válido (HTML ou inválido).' };

  const localUrl = saveBoletoToDisk(pdf, bridge.asaas_payment_id, bridge.invoice_number || null);
  if (!localUrl) return { ok: false, error: 'Falha ao salvar boleto local.' };

  // 5) grava local no raw (merge)
  await persistAsaasRawForAr(arId, { boleto_pdf_url_local: localUrl });

  return { ok: true, localUrl, asaas_payment_id: bridge.asaas_payment_id };
}

// -------------------------------------------------------------------
// getExistingBoletoDownloadInfoByPaymentId (read-only)
// -------------------------------------------------------------------
export async function getExistingBoletoDownloadInfoByPaymentId(asaasPaymentId) {
  const pid = String(asaasPaymentId || '').trim();
  if (!pid) throw new Error('asaas_payment_id inválido.');

  const qBridge = `
    SELECT
      asa.asaas_payment_id,
      COALESCE(asa.raw->>'invoiceNumber', asa.asaas_payment_id) AS invoice_number,
      COALESCE(
        asa.raw->>'boleto_pdf_url_local',
        asa.raw->>'bankSlipPdfUrl',
        asa.raw->>'bankSlipUrl',
        asa.raw->>'invoiceUrl'
      ) AS best_url,
      asa.accounts_receivable_id
    FROM ${TB_BRIDGE} asa
    WHERE asa.asaas_payment_id = $1
    LIMIT 1;
  `;
  const { rows } = await pool.query(qBridge, [pid]);
  const row = rows[0] || null;

  let url = row?.best_url || null;

  if (!url) {
    const payment = await asaasApi.getPayment(pid);
    url = payment?.bankSlipPdfUrl || payment?.bankSlipUrl || payment?.invoiceUrl || null;

    if (url && row?.accounts_receivable_id) {
      await persistAsaasRawForAr(row.accounts_receivable_id, {
        bankSlipPdfUrl: payment?.bankSlipPdfUrl || null,
        bankSlipUrl: payment?.bankSlipUrl || null,
        invoiceUrl: payment?.invoiceUrl || null,
      });
    }
  }

  if (!url) throw new Error('Boleto ainda não disponível no Asaas para esta cobrança.');

  const invoice = String(row?.invoice_number || '').trim();
  const filename = invoice ? `boleto-${invoice}.pdf` : `boleto-${pid}.pdf`;

  return { url, filename, asaas_payment_id: pid };
}

export async function getExistingBoletoDownloadInfoByAccountsReceivableId(accountsReceivableId) {
  const pid = await resolveAsaasPaymentIdByAccountsReceivableId(accountsReceivableId);
  if (!pid) throw new Error('Esta conta não possui vínculo com cobrança do Asaas (asaas_payment_id).');
  return getExistingBoletoDownloadInfoByPaymentId(pid);
}

// -------------------------------------------------------------------
// ✅ BOLETO (DOWNLOAD PROXY) — compat + LOCAL
//  - Agora:
//    1) se existir boleto_pdf_url_local => retorna local
//    2) senão tenta gerar local (download + save + merge raw)
//    3) senão retorna URL remota (fallback)
// -------------------------------------------------------------------
export async function getBoletoDownloadInfo(accountsReceivableId) {
  const id = toInt(accountsReceivableId, 0);
  if (!id) throw new Error('ID inválido.');

  // 1) tenta garantir local
  const ensured = await ensureLocalBoletoForArId(id);
  if (ensured?.ok && ensured?.localUrl) {
    const filename = `boleto-${ensured.asaas_payment_id}.pdf`;
    return { url: ensured.localUrl, filename, local: true };
  }

  // 2) fallback: comportamento antigo (raw / GET payment)
  const q = `
    SELECT
      asa.asaas_payment_id,
      COALESCE(
        asa.raw->>'boleto_pdf_url_local',
        asa.raw->>'bankSlipPdfUrl',
        asa.raw->>'bankSlipUrl',
        asa.raw->>'invoiceUrl',
        asa.raw->>'bank_slip_pdf_url',
        asa.raw->>'bank_slip_url',
        asa.raw->>'boleto_pdf_url',
        asa.raw->>'boleto_url'
      ) AS bank_slip_url,
      COALESCE(asa.raw->>'invoiceNumber', asa.asaas_payment_id) AS invoice_number
    FROM ${TB_BRIDGE} asa
    WHERE asa.accounts_receivable_id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(q, [id]);
  const row = rows[0];

  if (!row?.asaas_payment_id) {
    throw new Error('Esta conta não possui vínculo com cobrança do Asaas.');
  }

  let url = row.bank_slip_url || null;

  if (!url) {
    const payment = await asaasApi.getPayment(row.asaas_payment_id);
    url = payment?.bankSlipPdfUrl || payment?.bankSlipUrl || payment?.invoiceUrl || null;

    if (url) {
      await persistAsaasRawForAr(id, {
        bankSlipPdfUrl: payment?.bankSlipPdfUrl || null,
        bankSlipUrl: payment?.bankSlipUrl || null,
        invoiceUrl: payment?.invoiceUrl || null,
      });
    }
  }

  if (!url) throw new Error('Boleto ainda não disponível no Asaas para esta cobrança.');

  const invoice = String(row.invoice_number || '').trim();
  const filename = invoice ? `boleto-${invoice}.pdf` : `boleto-${row.asaas_payment_id}.pdf`;

  return { url, filename, local: false };
}

// -------------------------------------------------------------------
// ✅ UPDATE: salva local do boleto na PONTE + raw (merge)
// -------------------------------------------------------------------
export async function updateBoletoLocalInfo(accountsReceivableId, {
  boleto_pdf_url_local = null,
  boleto_pdf_abs_path = null, // não existe em coluna -> salva no raw (opcional)
} = {}) {
  const id = toInt(accountsReceivableId, 0);
  if (!id) throw new Error('accountsReceivableId inválido.');

  // 1) atualiza coluna da ponte (se existir vínculo)
  const updBridge = `
    UPDATE ${TB_BRIDGE}
       SET boleto_pdf_url_local = COALESCE($2, boleto_pdf_url_local),
           updated_at = now()
     WHERE accounts_receivable_id = $1
     RETURNING id, asaas_payment_id, accounts_receivable_id, boleto_pdf_url_local;
  `;
  const { rows } = await pool.query(updBridge, [id, boleto_pdf_url_local]);

  // 2) merge no raw também (compatibilidade e para guardar abs_path)
  const patch = {
    boleto_pdf_url_local: boleto_pdf_url_local || null,
    boleto_pdf_abs_path: boleto_pdf_abs_path || null,
  };
  await persistAsaasRawForAr(id, patch);

  return { ok: true, bridge: rows?.[0] || null };
}
