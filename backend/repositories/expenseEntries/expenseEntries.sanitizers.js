// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.sanitizers.js — Normaliza payload de create/update  ║
// ╚════════════════════════════════════════════════════════════════════╝

/** Normaliza payload de create/update */
export function normalizeEntryPayload(body = {}) {
  const toNum = (v) => (v === '' || v == null ? null : Number(v));
  const toStr = (v) => (v == null ? null : String(v));
  const toBool = (v) => (v === true || v === 'true' || v === 1 || v === '1');

  return {
    supplierId: toNum(body.supplierId),
    supplierName: toStr(body.supplierName),
    supplierDocument: toStr(body.supplierDocument),

    documentType: (toStr(body.documentType) || 'NFE').toUpperCase(),
    documentNumber: toStr(body.documentNumber),
    documentSeries: toStr(body.documentSeries),
    documentKey: toStr(body.documentKey),

    issueDate: toStr(body.issueDate),
    entryDate: toStr(body.entryDate),

    totalProductsValue: toNum(body.totalProductsValue) ?? 0,
    totalDiscountValue: toNum(body.totalDiscountValue) ?? 0,
    totalTaxValue: toNum(body.totalTaxValue) ?? 0,
    totalExpenseValue: toNum(body.totalExpenseValue) ?? 0,

    generatesTaxCredit: body.generatesTaxCredit != null ? toBool(body.generatesTaxCredit) : false,
    fiscalStatus: toStr(body.fiscalStatus) || 'NO_CREDIT',

    costCenterId: toNum(body.costCenterId),
    vehicleId: toNum(body.vehicleId),
    notes: toStr(body.notes),

    xmlPath: toStr(body.xmlPath),
    pdfPath: toStr(body.pdfPath),

    status: toStr(body.status) ? String(body.status).toUpperCase() : null,
    createdBy: toNum(body.createdBy),
  };
}
