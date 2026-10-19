// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesReport.index.js — ponto de entrada (relatório de vendas)      ║
// ║ Mantém a mesma API pública do antigo salesReportApi.js             ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  getSalesSummary,
  getSalesByDay,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesOrders,
} from './salesReportQuery.repository.js';
import { getSalesOrderItems } from './salesReportOrderItems.repository.js';
import { getFullSalesReport } from './salesReportFull.repository.js';

export {
  getSalesSummary,
  getSalesByDay,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesOrders,
  getSalesOrderItems,
  getFullSalesReport,
};

export default {
  getSalesSummary,
  getSalesByDay,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesOrders,
  getSalesOrderItems,
  getFullSalesReport,
};
