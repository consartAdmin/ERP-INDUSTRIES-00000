// ╔══════════════════════════════════════════════════════════════════╗
// ║ nfeAsaasSync.utils.js — helpers puros                            ║
// ║ datas, boleto ASAAS, externalReference, status, parcelas         ║
// ╚══════════════════════════════════════════════════════════════════╝

// ============================================================================
// HELPERS BÁSICOS
// ============================================================================

export const round2 = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : 0;
};

export const cleanText = (value) => String(value ?? '').trim();

export function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = cleanText(value);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

export function isBoletoMethod(row = {}) {
  const text = [
    row.payment_method_name,
    row.payment_method_type,
  ]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return text.includes('BOLETO') || text.includes('BANK_SLIP');
}

export function isAutomaticAsaasBoleto(row = {}) {
  const bankAccountId = Number(row.bank_account_id || 0);
  const provider = cleanText(row.collection_provider).toUpperCase();
  const boletoMode = cleanText(row.boleto_mode).toUpperCase();

  return (
    isBoletoMethod(row) &&
    Number.isInteger(bankAccountId) &&
    bankAccountId > 0 &&
    provider === 'ASAAS' &&
    boletoMode === 'AUTOMATIC'
  );
}

export function makeExternalReference({ nfeKey, nfeNumber, orderId, paymentId, installment }) {
  const fiscal = cleanText(nfeKey) || `NFE-${cleanText(nfeNumber) || 'SN'}`;
  return `${fiscal}-ORD-${orderId}-BP-${paymentId}-P-${installment}`.slice(0, 100);
}

// ============================================================================
// EXTERNAL REFERENCE — ORÇAMENTO
// ============================================================================

export function makeBudgetExternalReference({
  nfeKey,
  nfeNumber,
  budgetId,
  paymentId,
  installment,
}) {
  const fiscal =
    cleanText(nfeKey) ||
    `NFE-${cleanText(nfeNumber) || 'SN'}`;

  return (
    `${fiscal}` +
    `-BUD-${budgetId}` +
    `-BP-${paymentId}` +
    `-P-${installment}`
  ).slice(0, 100);
}

export function mapAsaasStatus(status) {
  switch (cleanText(status).toUpperCase()) {
    case 'RECEIVED':
    case 'CONFIRMED':
      return 'PAID';
    case 'OVERDUE':
      return 'OVERDUE';
    case 'REFUNDED':
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'PENDING';
  }
}


// accountsReceivable currently accepts only ASAAS / OTHER_BANK / NO_INTEGRATION.
// budgetsPayments also has MANUAL / OTHER_API. Keep the original source in notes
// and map it to the closest valid AR collection provider.
export function normalizeReceivableCollectionProvider(value) {
  const provider = cleanText(value).toUpperCase();

  if (provider === 'ASAAS') return 'ASAAS';
  if (provider === 'OTHER_BANK' || provider === 'OTHER_API') return 'OTHER_BANK';
  return 'NO_INTEGRATION';
}

export function buildInvoiceNumber(nfeNumber, sequence) {
  return `${cleanText(nfeNumber || 'SN')}/${String(sequence).padStart(3, '0')}`;
}

export function buildDescription(nfeNumber, sequence) {
  return `NF-e ${cleanText(nfeNumber || 'SN')} - Parcela ${String(sequence).padStart(3, '0')}`;
}

export function buildFinancialInstallments(rows = []) {
  return rows
    .map((row, index) => {
      const installment = Number(row.installment_number || index + 1);
      const sequence = index + 1;
      const value = round2(row.installment_amount ?? row.payment_amount);
      const dueDate = normalizeDate(row.due_date || row.manual_due_date);

      if (!value || value <= 0 || !dueDate) return null;

      return {
        ...row,
        installment,
        sequence,
        value,
        dueDate,
        automaticAsaas: isAutomaticAsaasBoleto(row),
      };
    })
    .filter(Boolean);
}
