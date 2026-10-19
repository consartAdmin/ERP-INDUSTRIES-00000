// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroups.sanitizers.js — Validação/normalização de entrada   ║
// ╚════════════════════════════════════════════════════════════════════╝

import { COLS, ORDERABLE } from './productsGroups.constants.js';

export const toBool = (v) =>
  typeof v === 'boolean'
    ? v
    : v === 'true'
    ? true
    : v === 'false'
    ? false
    : null;

export const notEmptyStr = (s) => typeof s === 'string' && s.trim().length > 0;

export function sanitizeOrder(orderBy = COLS.name, dir = 'ASC') {
  const safeCol = ORDERABLE.has(orderBy) ? orderBy : COLS.name;
  const safeDir = String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return { orderBy: safeCol, dir: safeDir };
}
