// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.validation.js                            ║
// ║ MODULE: Products Fiscal Batch — Validation                         ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateBatchLink(currentState) {
  if (!currentState.selected.size) {
    return {
      valid: false,
      title: 'Nenhum produto selecionado',
      message: 'Selecione ao menos um produto para aplicar o vínculo fiscal.',
    };
  }

  if (!currentState.classification?.id) {
    return {
      valid: false,
      title: 'Classificação Fiscal obrigatória',
      message: 'Escolha uma Classificação Fiscal (NCM/CEST).',
    };
  }

  return { valid: true };
}

