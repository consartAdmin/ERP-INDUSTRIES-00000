// ╔════════════════════════════════════════════════════════════════════╗
// ║ pdvSalesReport.index.js — ponto de entrada do relatório PDV        ║
// ║ Mantém a mesma API pública do antigo pdvSalesReportApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getPdvSalesReportData } from './pdvSalesReportQuery.repository.js';

export { getPdvSalesReportData };

const pdvSalesReportApi = {
  getPdvSalesReportData
};

export default pdvSalesReportApi;
