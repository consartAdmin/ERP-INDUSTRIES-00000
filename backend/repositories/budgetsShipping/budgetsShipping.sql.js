// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsShipping.sql.js — SQL montado uma vez a partir do catálogo    ║
// ║ SELECT_SQL / UPSERT_SQL / DELETE_SQL                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TABLE,
  LOOKUP_KEY,
  SELECT_COLUMNS,
  WRITE_COLUMNS,
  API,
} from './budgetsShipping.constants.js';

// ── SQL (built once from the catalog schema) ─────────────────────────

export const SELECT_SQL = `
  SELECT
    ${SELECT_COLUMNS.join(',\n    ')}
  FROM ${TABLE}
  WHERE ${LOOKUP_KEY} = $1
  LIMIT 1
`;

const CONFLICT_TARGET = API.upsert.conflictTarget;

const UPDATE_ASSIGNMENTS = [
  ...WRITE_COLUMNS
    .filter((column) => !CONFLICT_TARGET.includes(column))
    .map((column) => `${column} = EXCLUDED.${column}`),
  ...Object.entries(API.upsert.touch || {}).map(([column, expr]) => `${column} = ${expr}`),
];

export const UPSERT_SQL = `
  INSERT INTO ${TABLE} (
    ${WRITE_COLUMNS.join(',\n    ')}
  )
  VALUES (
    ${WRITE_COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}
  )
  ON CONFLICT (${CONFLICT_TARGET.join(', ')})
  DO UPDATE SET
    ${UPDATE_ASSIGNMENTS.join(',\n    ')}
  RETURNING ${API.upsert.returning || '*'}
`;

export const DELETE_SQL = `
  DELETE FROM ${TABLE}
  WHERE ${LOOKUP_KEY} = $1
`;
