// ╔════════════════════════════════════════════════════════════════════╗
// ║ dashBoardAlerts.index.js — ponto de entrada do módulo              ║
// ║ Mantém a mesma API pública do antigo dashBoardAlertsApi.js         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { getDashboardAlertsSummary } from './dashBoardAlertsSummary.repository.js';

export { getDashboardAlertsSummary };

const dashBoardAlertsApi = {
  getDashboardAlertsSummary,
};

export default dashBoardAlertsApi;
