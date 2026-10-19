// ╔══════════════════════════════════════════════════════════════════════╗
// ║ supplierReturns.modal.js — Diálogos de confirmação e alerta          ║
// ║ PRODNEX ERP | Devolução ao Fornecedor                                ║
// ║ Ponto único para trocar os diálogos nativos por modais do ERP.       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function confirmAction(message) {
  return window.confirm(message);
}

export function showAlert(message) {
  window.alert(message);
}
