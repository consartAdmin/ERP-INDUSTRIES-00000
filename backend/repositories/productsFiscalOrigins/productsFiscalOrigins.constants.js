// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOrigins.constants.js — tabela e projeções              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import PRODUCTS_FISCAL_ORIGINS_SCHEMA, { PRODUCTS_FISCAL_ORIGINS_TABLE, PRODUCTS_FISCAL_ORIGINS_ST_COLUMNS } from './productsFiscalOrigins.catalog.js';

export const TB = PRODUCTS_FISCAL_ORIGINS_TABLE;
export const SELECT_COLUMNS = PRODUCTS_FISCAL_ORIGINS_SCHEMA.selectProjection;
export const ST_PROJECTION = PRODUCTS_FISCAL_ORIGINS_ST_COLUMNS.join(',\n      ');
