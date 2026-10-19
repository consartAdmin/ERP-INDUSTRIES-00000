// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.validation.js — Regras antes de confirmar o recebimento ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

/**
 * Retorna { message, field } do primeiro problema encontrado, ou null.
 * `field` é a chave do elemento que deve receber o foco.
 */
export function validateReceiptForm(values, signaturePad) {
  if (!values.receiverName) {
    return { message: 'Informe o nome do recebedor.', field: 'receiverName' };
  }

  if (values.receiverName.length < 3) {
    return { message: 'O nome do recebedor está muito curto.', field: 'receiverName' };
  }

  if (!signaturePad || signaturePad.isEmpty()) {
    return { message: 'Por favor, assine no campo indicado.', field: 'signatureWrap' };
  }

  if (!signaturePad.hasEnoughInk()) {
    return { message: 'A assinatura está muito curta. Assine novamente no campo indicado.', field: 'signatureWrap' };
  }

  if (!values.confirmed) {
    return { message: 'Confirme o recebimento antes de continuar.', field: 'confirmCheck' };
  }

  return null;
}

export function validateNfeNumber(number) {
  if (!number) return 'Informe o número da NF-e.';
  return null;
}

export function validateRefuseReason(reason) {
  if (!reason) return 'Informe o motivo da recusa.';
  if (reason.length < 5) return 'Descreva o motivo da recusa com mais detalhes.';
  return null;
}
