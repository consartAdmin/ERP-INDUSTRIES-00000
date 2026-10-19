// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesPerformance.index.js — ponto de entrada (performance vendas)  ║
// ║ Mantém a mesma API pública do antigo salesPerformanceApi.js        ║
// ╚════════════════════════════════════════════════════════════════════╝

export {
  listSalesPerformanceSellers,
  listSalesPerformanceStatusTypes,
} from './salesPerformanceLookups.repository.js';

export {
  listSalesPerformanceMovements,
  listSalesPerformanceByStatus,
} from './salesPerformanceQuery.repository.js';

export {
  getLeadsAttendedDashboard,
  getSalesPerformanceTotalActions,
} from './salesPerformanceDashboard.repository.js';
