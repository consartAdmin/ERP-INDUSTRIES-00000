// ╔══════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.index.js — ponto de entrada do módulo  ║
// ║ Mantém a mesma API pública do antigo reportsProductsStockApi║
// ╚══════════════════════════════════════════════════════════════╝

export {
  getReportData,
  getStockPositionSummary,
} from './reportsProductsStockQuery.repository.js';
