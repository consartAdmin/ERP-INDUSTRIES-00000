// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceipts.state.js — Estado do Canhoto Digital (mobile)           ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  // { type: 'number' | 'key', value: string } — como a NF-e foi identificada
  identifier: null,
  receipt: null,
  location: {
    latitude: null,
    longitude: null
  },
  isSubmitting: false
};

export function resetReceiptState() {
  state.identifier = null;
  state.receipt = null;
  state.isSubmitting = false;
}
