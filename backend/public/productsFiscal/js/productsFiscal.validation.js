// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscal.validation.js                                  ║
// ║ MODULE: Products Fiscal — Validation                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateProductsFiscal(payload) {
  const errors = [];

  if (!String(payload?.product_code || '').trim()) {
    errors.push({
      field: 'pf_nome',
      title: 'Selecione um produto',
      message: 'Use "Nome do Produto Fiscal" para escolher o produto.',
    });
  }

  if (!Number.isInteger(Number(payload?.fiscal_classification_id)) || Number(payload.fiscal_classification_id) <= 0) {
    errors.push({
      field: 'pf_classification_name',
      title: 'Selecione uma classificação',
      message: 'Escolha uma Classificação Fiscal antes de salvar.',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
