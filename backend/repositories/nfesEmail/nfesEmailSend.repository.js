// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfesEmailSend.repository.js — createNfesEmailApi / sendNfeEmail      ║
// ║ - Monta e envia e-mail com DANFE + XML + BOLETO (se existir)         ║
// ║ - Prioridade BOLETO: /public/... local → URL remota Asaas → sem PDF  ║
// ║ - Fallback: se raw não tem bankSlipPdfUrl, consulta Asaas            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import axios from 'axios';
import { safeKeyStr, isPublicUrl, buildEmailBodies } from './nfesEmail.utils.js';
import { createNfesEmailBoletoRepository } from './nfesEmailBoleto.repository.js';

export function createNfesEmailApi(deps = {}) {
  const {
    pool,
    tecnospeedNfeApi,
    resolvePlugNotasId,
    extractResumoFromConsultarNFe,
    mapPlugNotasStatus,
    getBaseUrl,
    getApiKey,
    sendAndLogEmail,
    resolveAccountsReceivableIdFromOrder,
    getBoletoDownloadInfo, // (arId) => { url, filename, local? }
    getAsaasPayment,       // (asaasPaymentId) => payment (com bankSlipPdfUrl/bankSlipUrl/invoiceUrl)
    logger = console,
  } = deps;

  // -------------------------------
  // Required deps
  // -------------------------------
  if (!pool) throw new Error('[nfesEmailApi] pool é obrigatório');
  if (!tecnospeedNfeApi) throw new Error('[nfesEmailApi] tecnospeedNfeApi é obrigatório');
  if (typeof resolvePlugNotasId !== 'function') throw new Error('[nfesEmailApi] resolvePlugNotasId é obrigatório');
  if (typeof extractResumoFromConsultarNFe !== 'function') throw new Error('[nfesEmailApi] extractResumoFromConsultarNFe é obrigatório');
  if (typeof mapPlugNotasStatus !== 'function') throw new Error('[nfesEmailApi] mapPlugNotasStatus é obrigatório');
  if (typeof getBaseUrl !== 'function') throw new Error('[nfesEmailApi] getBaseUrl é obrigatório');
  if (typeof getApiKey !== 'function') throw new Error('[nfesEmailApi] getApiKey é obrigatório');
  if (typeof sendAndLogEmail !== 'function') throw new Error('[nfesEmailApi] sendAndLogEmail é obrigatório');

  const {
    persistAsaasRawForAr,
    getBankSlipInfoFromArId,
    tryReadLocalPdfBuffer,
    tryDownloadPdfBuffer,
  } = createNfesEmailBoletoRepository({ pool, logger });

  /* ===============================================================
     MAIN SEND
  =============================================================== */
  async function sendNfeEmail({
    idParam,
    to,
    cc,
    bcc,
    subject,
    provider = 'hostinger_smtp',
  }) {
    const plugId = await resolvePlugNotasId(idParam);
    if (!plugId) return { ok: false, error: 'NF-e não encontrada.' };

    const sum = await tecnospeedNfeApi.consultarNFe(plugId);
    const resumo = extractResumoFromConsultarNFe(sum);

    const chave = resumo?.chave || plugId;
    const numero = resumo?.numero;
    const statusNorm = mapPlugNotasStatus(resumo?.status, resumo?.cStat);
    const safeKey = safeKeyStr(chave);

    const baseUrl = getBaseUrl().replace(/\/$/, '');
    const headers = { 'X-API-KEY': getApiKey() };

    const [pdfResp, xmlResp] = await Promise.all([
      axios.get(`${baseUrl}/nfe/${plugId}/pdf`, { responseType: 'arraybuffer', headers }),
      axios.get(`${baseUrl}/nfe/${plugId}/xml`, { responseType: 'arraybuffer', headers }),
    ]);

    const danfeBuf = Buffer.from(pdfResp.data || []);
    const xmlBuf = Buffer.from(xmlResp.data || []);

    let boletoAttachment = null;
    let boletoUrl = null;
    let arId = null;

    // Resolve AR via função injetada
    if (typeof resolveAccountsReceivableIdFromOrder === 'function') {
      try {
        arId = await resolveAccountsReceivableIdFromOrder(idParam);
      } catch (e) {
        logger.warn('[NFES][EMAIL] resolveAccountsReceivableIdFromOrder falhou:', e?.message || e);
      }
    }

    if (arId) {
      let url = null;
      let asaasPaymentId = null;
      let invoiceNumber = null;

      // 1) Prioriza getBoletoDownloadInfo (ele pode retornar /public/... ou URL remota)
      if (typeof getBoletoDownloadInfo === 'function') {
        try {
          const info = await getBoletoDownloadInfo(arId);
          url = info?.url || null;

          // se retornou local, cacheia no raw como boleto_pdf_url_local (merge)
          if (url && isPublicUrl(url)) {
            await persistAsaasRawForAr(arId, { boleto_pdf_url_local: url });
          }
        } catch (e) {
          logger.warn('[NFES][EMAIL] getBoletoDownloadInfo falhou:', e?.message || e);
        }
      }

      // 2) Se ainda não tem, pega da ponte (prioriza local + PDF)
      if (!url) {
        try {
          const infoDb = await getBankSlipInfoFromArId(arId);
          url = infoDb?.url || null;
          asaasPaymentId = infoDb?.asaas_payment_id || null;
          invoiceNumber = infoDb?.invoice_number || null;
        } catch (e) {
          logger.warn('[NFES][EMAIL] getBankSlipInfoFromArId falhou:', e?.message || e);
        }
      }

      // 3) Se não tem URL e tem paymentId, consulta Asaas (read-only) e cacheia campos úteis
      if (!url && asaasPaymentId && typeof getAsaasPayment === 'function') {
        try {
          const pay = await getAsaasPayment(asaasPaymentId);
          url = pay?.bankSlipPdfUrl || pay?.bankSlipUrl || pay?.invoiceUrl || null;

          if (url) {
            await persistAsaasRawForAr(arId, {
              bankSlipPdfUrl: pay?.bankSlipPdfUrl || null,
              bankSlipUrl: pay?.bankSlipUrl || null,
              invoiceUrl: pay?.invoiceUrl || null,
            });
          }
        } catch (e) {
          logger.warn('[NFES][EMAIL] getAsaasPayment falhou:', e?.message || e);
        }
      }

      boletoUrl = url || null;

      // 4) Monta attachment (prioriza local /public/)
      let buf = null;

      if (url && isPublicUrl(url)) {
        buf = tryReadLocalPdfBuffer(url);
      }

      // 5) Se não conseguiu local, tenta download remoto
      if (!buf && url && !isPublicUrl(url)) {
        buf = await tryDownloadPdfBuffer(url);
      }

      // 6) Se conseguiu buf, cria attachment
      if (buf) {
        const baseName =
          invoiceNumber ? `boleto-${invoiceNumber}.pdf` :
          asaasPaymentId ? `boleto-${asaasPaymentId}.pdf` :
          `boleto-${arId}.pdf`;

        boletoAttachment = {
          filename: safeKeyStr(baseName).replace(/_pdf$/i, '.pdf'),
          content: buf,
          contentType: 'application/pdf',
        };
      }
    }

    const { bodyText, bodyHtml } = buildEmailBodies({
      statusNorm,
      safeKey,
      boletoAttachment,
      boletoUrl,
    });

    const attachments = [
      { filename: `DANFE_${safeKey}.pdf`, content: danfeBuf, contentType: 'application/pdf' },
      { filename: `NFE_${safeKey}.xml`, content: xmlBuf, contentType: 'application/xml' },
      ...(boletoAttachment ? [boletoAttachment] : []),
    ];

    const out = await sendAndLogEmail({
      to_address: to,
      cc_address: cc,
      bcc_address: bcc,
      subject: subject || `NF-e ${numero} (${statusNorm}) — ${safeKey}`,
      body_text: bodyText,
      body_html: bodyHtml,
      attachments,
      provider,
    });

    return {
      ok: !!out?.ok,
      boletoAnexado: !!boletoAttachment,
      boletoUrl,
      accountsReceivableId: arId || null,
      nfeKey: safeKey,
      nfeNumero: numero || null,
      status: statusNorm || null,
    };
  }

  return Object.freeze({
    sendNfeEmail,
  });
}
