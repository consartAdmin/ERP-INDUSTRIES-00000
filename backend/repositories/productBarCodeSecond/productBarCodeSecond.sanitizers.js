// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ productBarCodeSecond.sanitizers.js — Validação / ordenação segura       ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { COLS, ORDERABLE } from './productBarCodeSecond.constants.js';

export const notEmptyStr = (s) => typeof s === 'string' && s.trim().length > 0;
export const uniqueViolation = (err) => err && err.code === '23505';

export const sanitizeOrder = (orderBy = COLS.second_bar_code, dir = 'ASC') => {
  const safeCol = ORDERABLE.has(orderBy) ? orderBy : COLS.second_bar_code;
  const safeDir = String(dir).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return { orderBy: safeCol, dir: safeDir };
};
