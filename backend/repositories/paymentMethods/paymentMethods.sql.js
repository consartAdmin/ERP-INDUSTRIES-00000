// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentMethods.sql.js — Lista de colunas do SELECT/RETURNING       ║
// ╚════════════════════════════════════════════════════════════════════╝

import { PK, GAP_COLUMNS } from './paymentMethods.constants.js';

export const SELECT_COLUMNS = `
  ${PK} AS "paymentMethods_id",
  "name", "type", "installments",
  ${GAP_COLUMNS.map((column) => `"${column}"`).join(', ')},
  "nfe_tpag", "active", "created_at", "updated_at"
`;
