// ╔══════════════════════════════════════════════════════════════════════╗
// ║ labelParameters.sql.js — Query builders (INSERT / UPDATE dinâmicos) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { LABEL_PARAMETERS_TABLE, WRITABLE_COLUMNS } from './labelParameters.constants.js';

/* ======================================================================
   QUERY BUILDERS
   ====================================================================== */

export function buildInsertQuery(payload) {
  const keys = Object.keys(payload).filter((k) => WRITABLE_COLUMNS.includes(k));

  if (!keys.length) {
    throw new Error('[labelParametersApi] No valid columns provided for INSERT');
  }

  const columnsSql = keys.join(', ');
  const valuesSql = keys
    .map((key, idx) => (key === 'layout_json' ? `$${idx + 1}::jsonb` : `$${idx + 1}`))
    .join(', ');

  const values = keys.map((k) => (k === 'layout_json' ? JSON.stringify(payload[k]) : payload[k]));

  const text = `
    INSERT INTO ${LABEL_PARAMETERS_TABLE} (${columnsSql})
    VALUES (${valuesSql})
    RETURNING *
  `;

  return { text, values };
}

export function buildUpdateQuery(id, payload) {
  const keys = Object.keys(payload).filter((k) => WRITABLE_COLUMNS.includes(k));

  if (!keys.length) {
    throw new Error('[labelParametersApi] No valid columns provided for UPDATE');
  }

  const setSql = keys
    .map((k, idx) => {
      if (k === 'layout_json') {
        return `${k} = $${idx + 1}::jsonb`;
      }
      return `${k} = $${idx + 1}`;
    })
    .join(', ');

  const values = keys.map((k) => (k === 'layout_json' ? JSON.stringify(payload[k]) : payload[k]));
  values.push(id);

  const text = `
    UPDATE ${LABEL_PARAMETERS_TABLE}
       SET ${setSql},
           updated_at = now()
     WHERE id = $${values.length}
     RETURNING *
  `;

  return { text, values };
}
