// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.modal.js                                         ║
// ║ MODULE: Products Kits — Messages and Confirmation                   ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function showMessage(message, type = 'info') {
  if (type === 'error') {
    window.alert(`Erro: ${message}`);
    return;
  }

  window.alert(message);
}

export function confirmDeactivateKit() {
  return window.confirm('Deseja realmente inativar este kit?');
}
