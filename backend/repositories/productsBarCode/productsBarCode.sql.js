// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCode.sql.js — projeção de colunas (selectProjection)      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SELECT_COLUMNS } from './productsBarCode.constants.js';

export function selectProjection(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return SELECT_COLUMNS.map((column) => `${prefix}${column}`).join(',\n        ');
}
