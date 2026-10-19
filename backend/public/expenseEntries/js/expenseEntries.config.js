// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.config.js — Configuration (PRODNEX ERP)              ║
// ║ Path: backend/public/expenseEntries/expenseEntries.config.js         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const apiBase = window.apiBase || window.location.origin;
export const API = `${apiBase}/api/expense-entries`;
export const DEFAULT_PAGE_SIZE = 50;
export const DEFAULT_ORDER_BY = 'issueDate desc';

