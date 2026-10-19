// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.validation.js                           ║
// ║ MODULE: Fiscal Classification — Validation                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateFiscalClassification(payload) {
  const errors = [];

  if (!payload?.classification_name) {
    errors.push({
      field: 'classification_name',
      message: 'Informe o nome da classificação.',
    });
  }

  const digits = (value) => String(value || '').replace(/\D/g, '');
  if (payload.ncm_code && digits(payload.ncm_code).length !== 8) {
    errors.push({ field: 'ncm_code', message: 'O NCM deve conter 8 dígitos.' });
  }
  if (payload.cest_code && digits(payload.cest_code).length !== 7) {
    errors.push({ field: 'cest_code', message: 'O CEST deve conter 7 dígitos.' });
  }
  if (payload.ibscbs_cst && !/^\d{3}$/.test(payload.ibscbs_cst)) {
    errors.push({ field: 'ibscbs_cst', message: 'O CST IBS/CBS deve conter 3 dígitos.' });
  }
  if (payload.ibscbs_classification && !/^\d{6}$/.test(payload.ibscbs_classification)) {
    errors.push({ field: 'ibscbs_classification', message: 'A classificação IBS/CBS deve conter 6 dígitos.' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
