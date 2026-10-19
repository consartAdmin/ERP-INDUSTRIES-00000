'use strict';
const ROOT = (window.API_BASE || window.apiBase || window.location.origin).replace(/\/$/, '');
export const BANK_ACCOUNTS_API = `${ROOT}/api/bank-accounts`;
export const BANKS_API = `${ROOT}/api/banks`;
