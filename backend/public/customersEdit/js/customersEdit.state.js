// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.state.js — Estado compartilhado | PRODNEX ERP         ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

export const customersEditState = {
  customerId: null,
  customer: null,
  loading: false,
  saving: false,
  currentSellerLink: null,
  ibgeStates: [],
  citiesByUf: new Map(),
};

export function resetCustomersEditState() {
  customersEditState.customerId = null;
  customersEditState.customer = null;
  customersEditState.loading = false;
  customersEditState.saving = false;
  customersEditState.currentSellerLink = null;
  customersEditState.ibgeStates = [];
  customersEditState.citiesByUf.clear();
}
