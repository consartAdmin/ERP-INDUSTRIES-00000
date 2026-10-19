// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssuedGetById.repository.js — NF-e Bonificação                ║
// ║ Busca bonificação por id (com itens)                                  ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_BONUS, TB_OPERATION_TYPES, TB_CUSTOMERS } from './nfeBonusIssued.constants.js';
import { normalizePositiveInteger } from './nfeBonusIssued.sanitizers.js';
import { rowToBonus } from './nfeBonusIssued.mappers.js';
import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { listItems } from './nfeBonusIssuedItemsQuery.repository.js';

// ======================================================================
// GET BY ID
// ======================================================================

export async function getById(bonusId) {
  await ensureTables();

  const id = normalizePositiveInteger(bonusId);

  if (!id) {
    return {
      ok: false,
      error: 'bonus_id inválido',
    };
  }

  const { rows } = await pool.query(
    `
    SELECT
      b.*,

      c.legal_name AS customer_name,
      c.trade_name AS customer_trade_name,
      c.tax_id AS customer_tax_id,
      c.state AS customer_state,
      c.city AS customer_city,

      COALESCE(
        NULLIF(TRIM(c.invoice_email), ''),
        NULLIF(TRIM(c.email), '')
      ) AS customer_email,

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

    WHERE b.bonus_id = $1

    LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    return {
      ok: false,
      error: 'NOT_FOUND',
    };
  }

  const itemsResult = await listItems(id);

  return {
    ok: true,

    bonus: rowToBonus(rows[0]),

    items:
      itemsResult.ok
        ? itemsResult.rows
        : [],
  };
}
