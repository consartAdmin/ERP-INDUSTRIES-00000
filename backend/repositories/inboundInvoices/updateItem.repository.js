// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ updateItem.repository.js — CONSART ERP | Notas de Entrada               ║
// ║ Atualiza um item em transação, com lock e registro de auditoria          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

import { createAuditLog } from '../auditLogs/auditLogs.index.js';

import {
  TB_III,
  pool,
  q,
  itemResponse,
} from './_shared.js';

import { ITEM_WRITE_COLUMNS } from './_itemColumns.js';

export async function updateItem(
  id,
  payload,
  { userCtx = {} } = {}
) {
  const normalizedPayload = {
    ...payload,
    ...(payload.invoice_id !== undefined && payload.inbound_id === undefined
      ? { inbound_id: payload.invoice_id }
      : {}),
    ...(payload.ipi !== undefined && payload.ipi_value === undefined
      ? { ipi_value: payload.ipi }
      : {}),
    ...(payload.icms !== undefined && payload.icms_value === undefined
      ? { icms_value: payload.icms }
      : {}),
  };

  const sets = [];
  const params = [];
  let paramIndex = 1;

  for (const column of ITEM_WRITE_COLUMNS) {
    if (normalizedPayload[column] === undefined) continue;

    sets.push(`${column} = $${paramIndex++}`);
    params.push(normalizedPayload[column]);
  }

  if (!sets.length) {
    const result = await q(
      `SELECT * FROM ${TB_III} WHERE inbound_item_id = $1`,
      [id]
    );

    return itemResponse(result.rows[0]);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Bloqueia e captura o estado anterior.
    const beforeResult = await client.query(
      `
        SELECT *
        FROM ${TB_III}
        WHERE inbound_item_id = $1
        FOR UPDATE
      `,
      [id]
    );

    const before = beforeResult.rows[0];

    if (!before) {
      const error = new Error(
        `Item de nota de entrada ${id} não encontrado.`
      );

      error.code = 'INBOUND_INVOICE_ITEM_NOT_FOUND';
      throw error;
    }

    const updateResult = await client.query(
      `
        UPDATE ${TB_III}
        SET ${sets.join(', ')}
        WHERE inbound_item_id = $${paramIndex}
        RETURNING *
      `,
      [...params, id]
    );

    const after = updateResult.rows[0];

    await createAuditLog({
      tabela: 'inboundInvoiceItems',
      register_id: after.inbound_item_id,
      operation: 'UPDATE',
      user_id:
        userCtx?.id ??
        userCtx?.user_id ??
        null,
      before,
      after,
      db: client,
    });

    await client.query('COMMIT');

    return itemResponse(after);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default updateItem;
