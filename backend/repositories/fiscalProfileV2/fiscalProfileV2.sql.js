// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfileV2.sql.js — Fragmentos SQL (SELECT/RETURNING)         ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  FISCAL_PROFILE_V2_TABLE as TABLE,
  FISCAL_PROFILE_V2_SELECT_COLUMNS,
  FISCAL_PROFILE_V2_SELECT_SQL,
} from './fiscalProfileV2.catalog.js';

export const RETURNING = FISCAL_PROFILE_V2_SELECT_COLUMNS
  .map((column) => `"${column}"`)
  .join(', ');

export const SELECT = `SELECT ${FISCAL_PROFILE_V2_SELECT_SQL} FROM ${TABLE} fp`;
