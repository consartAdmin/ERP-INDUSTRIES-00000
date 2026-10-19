// ╔════════════════════════════════════════════════════════════════════╗
// ║ pcp.index.js — Ponto de entrada do módulo PCP / Produção           ║
// ║ USO: import * as Pcp from '.../pcp/pcp.index.js'                   ║
// ╚════════════════════════════════════════════════════════════════════╝

export { ensureTables, ensureOnce } from './pcpSchema.repository.js';
export * as WorkCenters from './pcpWorkCenters.repository.js';
export * as Bom from './pcpBom.repository.js';
export * as Orders from './pcpProductionOrders.repository.js';
export * as Mrp from './pcpMrp.repository.js';
export { ORDER_STATUS, ORDER_TRANSITIONS } from './pcp.constants.js';
