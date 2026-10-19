// ╔════════════════════════════════════════════════════════════════════╗
// ║ asaasPayments.repository.js — Cobranças Asaas (por id)             ║
// ║ getPayment / updatePayment / cancelPayment                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { asaasClient } from './asaasClient.repository.js';
import { logAsaasError } from './asaas.utils.js';

/* ---------------------------------------------------------------------- */
/* getPayment                                                             */
/* ---------------------------------------------------------------------- */
export async function getPayment(paymentId) {
  if (!paymentId) throw new Error('[AsaasAPI] getPayment: paymentId inválido.');

  console.log('[AsaasAPI] 🔎 Buscando pagamento no Asaas:', paymentId);

  try {
    const { data } = await asaasClient.get(`/payments/${paymentId}`);
    return data;
  } catch (error) {
    logAsaasError('getPayment', error);
    throw error;
  }
}

/* ---------------------------------------------------------------------- */
/* updatePayment — Atualiza vencimento e valor da cobrança                 */
/* PUT /payments/{id}                                                      */
/* ---------------------------------------------------------------------- */

export async function updatePayment(
  paymentId,
  {
    dueDate,
    value,
  } = {}
) {
  const normalizedPaymentId =
    String(paymentId || '').trim();

  const normalizedDueDate =
    String(dueDate || '').trim();

  const normalizedValue =
    Number(value);

  if (!normalizedPaymentId) {
    throw new Error(
      '[AsaasAPI] updatePayment: paymentId não informado.'
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalizedDueDate
    )
  ) {
    throw new Error(
      '[AsaasAPI] updatePayment: vencimento inválido.'
    );
  }

  if (
    !Number.isFinite(normalizedValue) ||
    normalizedValue <= 0
  ) {
    throw new Error(
      '[AsaasAPI] updatePayment: valor inválido.'
    );
  }

  const payload = {
    billingType: 'BOLETO',
    dueDate: normalizedDueDate,
    value: normalizedValue,
  };

  console.log(
    '[AsaasAPI] ✏️ Atualizando boleto:',
    {
      paymentId: normalizedPaymentId,
      dueDate: normalizedDueDate,
      value: normalizedValue,
    }
  );

  try {
    const { data } =
      await asaasClient.put(
        `/payments/${encodeURIComponent(
          normalizedPaymentId
        )}`,
        payload
      );

    console.log(
      '[AsaasAPI] ✅ Boleto atualizado:',
      {
        paymentId:
          data?.id || normalizedPaymentId,
        dueDate:
          data?.dueDate || normalizedDueDate,
        value:
          data?.value ?? normalizedValue,
        status:
          data?.status || null,
      }
    );

    return data;
  } catch (error) {
    logAsaasError(
      'updatePayment',
      error
    );

    throw error;
  }
}

/* ---------------------------------------------------------------------- */
/* cancelPayment (DELETE /payments/{id})                                   */
/* ---------------------------------------------------------------------- */
export async function cancelPayment(paymentId) {
  if (!paymentId) throw new Error('[AsaasAPI] cancelPayment: paymentId inválido.');

  console.log('[AsaasAPI] 🗑 Excluindo/Cancelando cobrança no Asaas:', paymentId);

  try {
    const { data } = await asaasClient.delete(`/payments/${paymentId}`);
    console.log('[AsaasAPI] ✅ Cobrança removida no Asaas:', data);
    return data;
  } catch (error) {
    logAsaasError('cancelPayment', error);
    throw error;
  }
}
