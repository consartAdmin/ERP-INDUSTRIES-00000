/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: budgetsPayments.index.js                                      ║
   ║ MODULE: Budgets Payments                                            ║
   ║ DESCRIPTION: DAL/API para pagamentos do orçamento                   ║
   ║ CONSART ERP · PostgreSQL · ESM                                      ║
   ║                                                                      ║
   ║ Tabelas relacionadas:                                                ║
   ║ - public.budgets                                                     ║
   ║ - public."budgetsPayments"                                           ║
   ║ - public."paymentMethods"                                            ║
   ║ - public."budgetsPaymentInstallments"                                ║
   ║                                                                      ║
   ║ Estrutura de public."budgetsPayments" vem do catalog_schema:         ║
   ║ nomes de tabela/colunas, defaults, enums (CHECK), tamanhos e FKs.    ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

import { getById, listByBudget } from './budgetsPaymentsQuery.repository.js';
import { create } from './budgetsPaymentsCreate.repository.js';
import { update } from './budgetsPaymentsUpdate.repository.js';
import { remove, removeByBudget } from './budgetsPaymentsRemove.repository.js';
import {
  regenerateInstallmentsFromPayment,
  regenerateInstallmentsFromBudget
} from './budgetsPaymentsInstallments.repository.js';
import { validateBudgetPaymentsTotal } from './budgetsPaymentsValidate.repository.js';
import { replaceBudgetPayments } from './budgetsPaymentsReplace.repository.js';

export default {
  getById,
  listByBudget,
  create,
  update,
  remove,
  removeByBudget,
  regenerateInstallmentsFromPayment,
  regenerateInstallmentsFromBudget,
  validateBudgetPaymentsTotal,
  replaceBudgetPayments
};
