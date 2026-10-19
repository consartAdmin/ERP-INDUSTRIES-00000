// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersGetById.repository.js — leitura completa por ID           ║
// ║ Tabela: public."customers"                                         ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { tb } from './customers.table.js';
import { TB, ALIAS } from './customers.constants.js';
import { toNumOrNull } from './customers.utils.js';
import { mapRow } from './customers.mappers.js';
import { CUSTOMER_FULL_COLUMNS, CUSTOMER_FULL_JOINS } from './customers.sql.js';

/**
 * GET BY ID
 */
export async function getById(id) {
  const cid = toNumOrNull(id);

  if (!cid) {
    throw new Error('invalid customer_id');
  }

  const sql = `
    SELECT
      ${CUSTOMER_FULL_COLUMNS}

    FROM ${tb()} ${ALIAS}

    ${CUSTOMER_FULL_JOINS()}

    WHERE ${ALIAS}.customer_id = $1
    LIMIT 1;
  `;

  const { rows } = await pool.query(sql, [cid]);

  return rows[0] ? mapRow(rows[0]) : null;
}

export default getById;
