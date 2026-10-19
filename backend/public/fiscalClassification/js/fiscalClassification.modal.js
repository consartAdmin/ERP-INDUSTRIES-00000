// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.modal.js                                ║
// ║ MODULE: Fiscal Classification — User Feedback                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function confirmDeleteClassification(row) {
  return window.confirm(
    `Deseja realmente desativar a classificação "${row.classification_name}" ` +
    `(ID ${row.fiscal_classification_id})?`,
  );
}

export function showSuccess(message) {
  window.alert(message);
}

export function showError(message) {
  window.alert(message);
}
