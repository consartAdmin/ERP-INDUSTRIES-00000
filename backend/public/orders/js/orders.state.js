// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: orders.state.js                                                ║
// ║ MODULE: Orders                                                       ║
// ║ PRODNEX ERP                                                          ║
// ║ Shared state container                                               ║
// ║ ✅ UPDATED: payments normalized (ordersPayments)                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {

  // ------------------------------------------------------------------
  // List / pagination
  // ------------------------------------------------------------------
  list: [],
  total: 0,

  page: 1,
  limit: 50,

  q: '',
  dateFrom: '',
  dateTo: '',
  status: 'TODOS',

  // ------------------------------------------------------------------
  // Selection / editing
  // ------------------------------------------------------------------
  selectedId: null,
  editing: null,

  // ------------------------------------------------------------------
  // 🔹 NEW: normalized payments (SOURCE OF TRUTH)
  // ------------------------------------------------------------------
  payments: [],              // ← ordersPayments
  installments: [],          // ← ordersPaymentInstallments

  // ------------------------------------------------------------------
  // 🔹 Optional (UI helpers)
  // ------------------------------------------------------------------
  paymentMethods: [],        // ← catalog (still useful for dropdowns)

};