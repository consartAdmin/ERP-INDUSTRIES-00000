// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesReportFull.repository.js — getFullSalesReport                 ║
// ║ Garante invoicesIssued e agrega todos os blocos do relatório       ║
// ╚════════════════════════════════════════════════════════════════════╝

import invoicesIssuedApi from '../invoicesIssued/invoicesIssued.index.js';
import {
  getSalesSummary,
  getSalesByDay,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesOrders,
} from './salesReportQuery.repository.js';

export async function getFullSalesReport(filters = {}) {
  await invoicesIssuedApi.ensureTable();

  const [summary, byDay, byCustomer, byProduct, orders] = await Promise.all([
    getSalesSummary(filters),
    getSalesByDay(filters),
    getSalesByCustomer(filters),
    getSalesByProduct(filters),
    getSalesOrders(filters),
  ]);

  return { summary, byDay, byCustomer, byProduct, orders };
}
