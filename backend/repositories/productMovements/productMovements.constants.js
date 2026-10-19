// ╔══════════════════════════════════════════════════════════════╗
// ║ productMovements.constants.js — Limites e tipos de movimento║
// ╚══════════════════════════════════════════════════════════════╝

export const TB_PRODUCT_MOVEMENTS = 'public."productMovements"';

export const MAX_ROWS = 500;

export const MOVEMENT_TYPES = Object.freeze({
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA',
  INVENTARIO: 'INVENTARIO',
  AJUSTE: 'AJUSTE',
});
