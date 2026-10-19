// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsReceivable.constants.js — Tabelas, status e caminhos       ║
// ║ Contas a Receber + ponte Asaas + caixa                             ║
// ╚════════════════════════════════════════════════════════════════════╝

import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TB = 'public."accountsReceivable"';
export const TB_BRIDGE = 'public."accountsReceivableAsaas"';
export const TB_CUSTOMERS = 'public."customers"';
export const TB_BANK_ACCOUNTS = 'public."bankAccounts"';
export const TB_CASH_CATEGORIES = 'public."cashCategories"';
export const TB_CASH_SUBCATEGORIES = 'public."cashSubcategories"';
export const TB_CASH_DOCUMENT_TYPES = 'public."cashDocumentTypes"';
export const TB_CHART_OF_ACCOUNTS = 'public."chartOfAccounts"';

export const AR_DIAGNOSTIC_FIELDS = [
  'customer_id',
  'invoice_number',
  'document_number',
  'issue_date',
  'due_date',
  'payment_date',
  'payment_method_id',
  'document_type_id',
  'category_id',
  'subcategory_id',
  'cash_account_id',
  'bank_account_id',
  'chart_account_id',
  'fine',
  'interest',
  'charges',
  'status',
];

// -------------------------------------------------------------------
// CAIXA — ENTRADA automática para contas recebidas
// -------------------------------------------------------------------
export const TB_CASH_MOVEMENTS = 'public."cashMoviments"';
export const RECEIVED_STATUSES = new Set(['PAID', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED']);
export const AR_CASH_MOVEMENT_START_DATE =
  process.env.AR_CASH_MOVEMENT_START_DATE || '2026-09-23';

// -------------------------------------------------------------------
// Paths (ESM)
// -------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// este arquivo fica em backend/repositories/accountsReceivable/
// então ../../public aponta para backend/public
export const PUBLIC_DIR = path.resolve(__dirname, '../../public');
export const BOLETOS_DIR = path.resolve(PUBLIC_DIR, 'boletos');
