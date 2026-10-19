/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: budgetsPaymentInstallments.index.js                           ║
   ║ MODULE: Budget Payment Installments                                 ║
   ║ DESCRIPTION: DAL/API para parcelas de pagamento dos budgets         ║
   ║ CONSART ERP · PostgreSQL · ESM                                      ║
   ║                                                                      ║
   ║ Tabelas relacionadas:                                                ║
   ║ - public."budgetsPayments"                                           ║
   ║ - public."budgetsPaymentInstallments"                                ║
   ║ - public."paymentMethods"                                            ║
   ║ - public.budgets                                                     ║
   ║                                                                      ║
   ║ Estrutura de public."budgetsPaymentInstallments" vem do              ║
   ║ catalog_schema: colunas, defaults, enums/CHECKs, tamanhos, UNIQUE    ║
   ║ e FK. Tabelas de pagamentos/formas de pagamento vêm do catálogo      ║
   ║ de budgetsPayments.                                                  ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

import { getById, listByBudget, listByBudgetPayment } from './budgetsPaymentInstallmentsQuery.repository.js';
import { create } from './budgetsPaymentInstallmentsCreate.repository.js';
import { update } from './budgetsPaymentInstallmentsUpdate.repository.js';
import { remove, removeByBudgetPayment } from './budgetsPaymentInstallmentsRemove.repository.js';
import { generateFromBudgetPayment, generateFromBudget } from './budgetsPaymentInstallmentsGenerate.repository.js';

export default {
  getById,
  listByBudget,
  listByBudgetPayment,
  create,
  update,
  remove,
  removeByBudgetPayment,
  generateFromBudgetPayment,
  generateFromBudget
};
