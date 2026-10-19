// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaasCharge.repository.js — createCharge (PIX / BOLETO / etc.)     ║
// ║ BOLETO: baixa e salva o PDF localmente ao criar a cobrança         ║
// ║ OBS: NÃO envia fine/interest como número (corrige parse_error)     ║
// ╚════════════════════════════════════════════════════════════════════╝

import { asaasClient } from './asaasClient.repository.js';
import { sanitizeString, normalizeNumber, toPercentField, logAsaasError } from './asaas.utils.js';
import { tryDownloadPdfBuffer, saveBoletoToDisk, getBoletoPdf } from './asaasBoleto.repository.js';

/* ---------------------------------------------------------------------- */
/* createCharge                                                           */
/* ---------------------------------------------------------------------- */
export async function createCharge({
  customerId,
  billingType, // 'PIX', 'BOLETO', 'CREDIT_CARD', etc.
  value,
  description,
  dueDate, // 'YYYY-MM-DD'
  finePercent, // opcional, ex: 2
  interestPercent, // opcional, ex: 1
  externalReference, // recomenda: orderId, orderNumber, etc
}) {
  const payload = {
    customer: customerId,
    billingType,
    value: normalizeNumber(value),
    description: sanitizeString(description),
    dueDate: sanitizeString(dueDate),
    externalReference: sanitizeString(externalReference),
  };

  const fineField = toPercentField(finePercent);
  const interestField = toPercentField(interestPercent);

  if (fineField) payload.fine = fineField;
  if (interestField) payload.interest = interestField;

  console.log('[AsaasAPI] 💸 Criando cobrança no Asaas...', payload);

  try {
    const { data } = await asaasClient.post('/payments', payload);
    console.log('[AsaasAPI] ✅ Cobrança criada no Asaas:', data?.id);

    let boleto_pdf_url_local = null;
    let boleto_pdf_abs_path = null;

    // ✅ BOLETO: tenta baixar e salvar o PDF já aqui
    if (String(billingType || '').toUpperCase() === 'BOLETO' && data?.id) {
      const boletoUrl =
        data?.bankSlipPdfUrl ||
        data?.bankSlipUrl ||
        data?.invoiceUrl ||
        null;

      if (boletoUrl) {
        const pdf = await tryDownloadPdfBuffer(boletoUrl, console);

        if (pdf) {
          const saved = saveBoletoToDisk(pdf, data.id, data?.invoiceNumber || null);
          boleto_pdf_url_local = saved.urlLocal;
          boleto_pdf_abs_path = saved.absPath;

          if (boleto_pdf_url_local) {
            console.log('[AsaasAPI] 📄 Boleto salvo localmente:', boleto_pdf_url_local);
          }
        } else {
          console.warn('[AsaasAPI] ⚠️ Boleto URL retornou conteúdo não-PDF (não anexável).');
        }
      } else {
        // Mesmo que não venha no retorno do POST, pode vir no GET /payments/:id
        console.warn('[AsaasAPI] ⚠️ Asaas não retornou URL do boleto no createCharge. Tentando GET /payments/:id...');
        const fallback = await getBoletoPdf({
          paymentId: data.id,
          boleto_pdf_url_local: null,
          boleto_pdf_abs_path: null,
          logger: console,
        });

        if (fallback?.ok) {
          boleto_pdf_url_local = fallback.urlLocal;
          boleto_pdf_abs_path = fallback.absPath;
        }
      }
    }

    return {
      ...data,
      boleto_pdf_url_local,
      boleto_pdf_abs_path,
    };
  } catch (error) {
    logAsaasError('createCharge', error);
    throw error;
  }
}
