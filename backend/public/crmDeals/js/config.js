// ╔══════════════════════════════════════════════════════════════════════╗
// ║ config.js — CRM Deals (PRODNEX ERP)                                 ║
// ║ ✅ Exporta apiBase e apiUrl                                          ║
// ║ ✅ Permite configurar API_ORIGIN                                     ║
// ║ ✅ Rotas do CRM alinhadas com /api/crm                               ║
// ║ ✅ Compatível com o novo app.use('/api/crm', ...)                    ║
// ║ ✅ Inclui rota de motivos de perda (crmLossReasons)                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

/* --------------------------------------------------------------------- */
/* ORIGEM DA API                                                         */
/* --------------------------------------------------------------------- */

export const API_ORIGIN =
  window.CONSART_API_ORIGIN ||
  localStorage.getItem('CONSART_API_ORIGIN') ||
  window.location.origin;

/* --------------------------------------------------------------------- */
/* BASE DA API                                                           */
/* --------------------------------------------------------------------- */

export const apiBase = `${String(API_ORIGIN).replace(/\/$/, '')}/api`;

/* --------------------------------------------------------------------- */
/* HELPER PARA MONTAR URLS                                               */
/* --------------------------------------------------------------------- */

export function apiUrl(path) {
  const p = String(path || '').trim();
  const normalized = p.startsWith('/') ? p : `/${p}`;
  return `${apiBase}${normalized}`;
}

/* --------------------------------------------------------------------- */
/* BASE CRM                                                              */
/* --------------------------------------------------------------------- */

export const CRM_BASE = '/crm';

/* --------------------------------------------------------------------- */
/* CATÁLOGOS                                                             */
/* --------------------------------------------------------------------- */

export const ROUTE_STAGES = `${CRM_BASE}/stages`;
export const ROUTE_STATUS_TYPES = `${CRM_BASE}/status-types`;
export const ROUTE_LEAD_SOURCES = `${CRM_BASE}/lead-sources`;
export const ROUTE_DEAL_OUTCOMES = `${CRM_BASE}/deal-outcomes`;

/* --------------------------------------------------------------------- */
/* LOSS REASONS                                                          */
/* --------------------------------------------------------------------- */

export const ROUTE_LOSS_REASONS = '/crm-loss-reasons';

/* --------------------------------------------------------------------- */
/* DEALS                                                                 */
/* --------------------------------------------------------------------- */

export const ROUTE_DEALS = `${CRM_BASE}/deals`;
export const ROUTE_CREATE_DEAL = ROUTE_DEALS;

export const ROUTE_UPDATE_DEAL = (id) =>
  `${CRM_BASE}/deals/${encodeURIComponent(String(id))}`;

export const ROUTE_GET_DEAL = ROUTE_UPDATE_DEAL;
export const ROUTE_DELETE_DEAL = ROUTE_UPDATE_DEAL;

export const ROUTE_MOVE_DEAL = (id) =>
  `${CRM_BASE}/deals/${encodeURIComponent(String(id))}/move`;

/* --------------------------------------------------------------------- */
/* STATUS TYPE / CONCLUSÃO LEGADO                                        */
/* --------------------------------------------------------------------- */

export const ROUTE_SET_STATUS_TYPE = (id) =>
  `${CRM_BASE}/deals/${encodeURIComponent(String(id))}/status-type`;

export const ROUTE_LEAD_CONCLUSION_SUMMARY = `${CRM_BASE}/conclusion/summary`;

/* --------------------------------------------------------------------- */
/* OUTCOMES                                                              */
/* --------------------------------------------------------------------- */

export const ROUTE_REGISTER_OUTCOME = (id) =>
  `${CRM_BASE}/deals/${encodeURIComponent(String(id))}/outcome`;

export const ROUTE_OUTCOMES = `${CRM_BASE}/outcomes`;
export const ROUTE_OUTCOMES_SUMMARY = `${CRM_BASE}/outcomes/summary`;