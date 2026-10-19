// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedQuery.repository.js — NF-e Bonificação                  ║
// ║ Pesquisa / listagem de bonificações                                   ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BONUS, TB_OPERATION_TYPES, TB_CUSTOMERS } from './nfeBonusIssued.constants.js';
import { normalizeInteger, normalizePositiveInteger } from './nfeBonusIssued.sanitizers.js';
import { rowToBonus } from './nfeBonusIssued.mappers.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';

// ======================================================================
// SEARCH / LIST
// ======================================================================

export async function search({
  q = '',
  status = null,
  customerId = null,
  limit = 50,
  offset = 0,
} = {}) {
  await ensureTables();

  const where = [];
  const args = [];

  let ai = 1;


  // ------------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------------

  if (q && String(q).trim()) {
    const value =
      `%${String(q).trim().toLowerCase()}%`;

    where.push(`
      (
        LOWER(COALESCE(c.legal_name, '')) LIKE $${ai}
        OR LOWER(COALESCE(c.trade_name, '')) LIKE $${ai}
        OR LOWER(COALESCE(c.tax_id, '')) LIKE $${ai}
        OR CAST(b.bonus_id AS TEXT) LIKE $${ai}
      )
    `);

    args.push(value);

    ai++;
  }


  // ------------------------------------------------------------------
  // STATUS
  // ------------------------------------------------------------------

  if (
    status &&
    String(status).trim().toUpperCase() !== 'TODOS'
  ) {
    where.push(
      `UPPER(b.status) = UPPER($${ai})`
    );

    args.push(
      String(status).trim()
    );

    ai++;
  }


  // ------------------------------------------------------------------
  // CUSTOMER
  // ------------------------------------------------------------------

  const safeCustomerId =
    normalizePositiveInteger(customerId);

  if (safeCustomerId) {
    where.push(
      `b.customer_id = $${ai}`
    );

    args.push(safeCustomerId);

    ai++;
  }


  const whereSql =
    where.length
      ? `WHERE ${where.join(' AND ')}`
      : '';


  // ------------------------------------------------------------------
  // LIMIT
  // ------------------------------------------------------------------

  const safeLimit =
    Math.min(
      Math.max(
        normalizePositiveInteger(limit, 50) || 50,
        1
      ),
      500
    );

  const safeOffset =
    Math.max(
      normalizeInteger(offset, 0) || 0,
      0
    );


  // ------------------------------------------------------------------
  // QUERY
  // ------------------------------------------------------------------

  const sqlRows = `
    SELECT
      b.*,

      c.legal_name AS customer_name,
      c.trade_name AS customer_trade_name,
      c.tax_id AS customer_tax_id,
      c.state AS customer_state,
      c.city AS customer_city,

      ot.code AS operation_code,
      ot.name AS operation_name,
      ot.nature_operation,

      ot.cfop_internal,
      ot.cfop_interstate,

      ot.generates_receivable,
      ot.moves_stock

    FROM ${TB_BONUS} b

    INNER JOIN ${TB_CUSTOMERS} c
      ON c.customer_id = b.customer_id

    INNER JOIN ${TB_OPERATION_TYPES} ot
      ON ot.operation_type_id = b.operation_type_id

    ${whereSql}

    ORDER BY
      b.created_at DESC,
      b.bonus_id DESC

    LIMIT $${ai}
    OFFSET $${ai + 1}
  `;


  const sqlCount = `
    SELECT
      COUNT(*) AS total

    FROM ${TB_BONUS} b

    INNER JOIN ${TB_CUSTOMERS} c
      ON c.customer_id = b.customer_id

    INNER JOIN ${TB_OPERATION_TYPES} ot
      ON ot.operation_type_id = b.operation_type_id

    ${whereSql}
  `;


  const rowsArgs = [
    ...args,
    safeLimit,
    safeOffset,
  ];


  const [
    rowsRes,
    countRes,
  ] = await Promise.all([
    pool.query(
      sqlRows,
      rowsArgs
    ),

    pool.query(
      sqlCount,
      args
    ),
  ]);


  return {
    ok: true,

    rows:
      rowsRes.rows.map(
        rowToBonus
      ),

    total:
      Number(
        countRes.rows?.[0]?.total || 0
      ),
  };
}
