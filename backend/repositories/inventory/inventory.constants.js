// ╔════════════════════════════════════════════════════════════════════╗
// ║ inventory.constants.js — Tabelas e flag de debug do inventário     ║
// ╚════════════════════════════════════════════════════════════════════╝

// ──────────────────────────────────────────────────────────────
// Constantes
// ──────────────────────────────────────────────────────────────
export const TB_INV = 'public.inventories';
export const TB_ITEMS = 'public."inventoryItems"';
export const TB_LOGS = 'public."inventoryLogs"';
export const TB_LOTS = 'public."productsStockLots"';

export const INVENTORY_DEBUG = String(process.env.CONSART_INVENTORY_DEBUG ?? 'true').toLowerCase() !== 'false';
