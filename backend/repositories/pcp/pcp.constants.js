// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcp.constants.js — Tabelas e status do módulo PCP / Produção       ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB_WORK_CENTERS = 'public."pcpWorkCenters"';
export const TB_BOM = 'public."pcpBom"';
export const TB_BOM_ITEMS = 'public."pcpBomItems"';
export const TB_BOM_OPERATIONS = 'public."pcpBomOperations"';
export const TB_ORDERS = 'public."pcpProductionOrders"';
export const TB_ORDER_MATERIALS = 'public."pcpProductionOrderMaterials"';
export const TB_REPORTS = 'public."pcpProductionReports"';

export const TB_PRODUCTS = 'public."products"';
export const TB_STOCK = 'public."productsStock"';
export const TB_MODULES = 'public."moduleSystem"';

/** Ciclo de vida da ordem de produção (OP). */
export const ORDER_STATUS = Object.freeze({
  PLANNED: 'PLANEJADA',
  RELEASED: 'LIBERADA',
  IN_PROGRESS: 'EM_PRODUCAO',
  DONE: 'CONCLUIDA',
  CANCELED: 'CANCELADA',
});

/** Transições permitidas: status atual → próximos status. */
export const ORDER_TRANSITIONS = Object.freeze({
  PLANEJADA: ['LIBERADA', 'CANCELADA'],
  LIBERADA: ['EM_PRODUCAO', 'PLANEJADA', 'CANCELADA'],
  EM_PRODUCAO: ['CONCLUIDA', 'CANCELADA'],
  CONCLUIDA: [],
  CANCELADA: [],
});

/** Status que ainda geram necessidade de material (MRP). */
export const OPEN_STATUSES = ['PLANEJADA', 'LIBERADA', 'EM_PRODUCAO'];
