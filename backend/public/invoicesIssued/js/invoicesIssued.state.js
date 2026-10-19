// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.state.js — Estado global da tela                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULT_LIMIT } from './invoicesIssued.config.js';

export const state = {
  statusMap: [],
  statusByCode: new Map(),

  rows: [],
  total: 0,
  totalAmount: 0,

  kpis: {
    total: 0,
    authorized: 0,
    cancelled: 0,
    total_amount: 0,
  },

  // ====================================================================
  // PAGINATION
  // ====================================================================

  limit: DEFAULT_LIMIT,
  offset: 0,

  // ====================================================================
  // SORT
  // ====================================================================
  // Default: highest/latest NF-e number first
  // ====================================================================

  sortBy: 'nfe_number',
  sortDirection: 'desc',
};