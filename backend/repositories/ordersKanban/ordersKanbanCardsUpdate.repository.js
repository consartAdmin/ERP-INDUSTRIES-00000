// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanCardsUpdate.repository.js — editar/mover/urgente/fim   ║
// ║ Tabela: public."ordersKanbanCards"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CARDS, TB_COLUMNS } from './ordersKanban.constants.js';
import { countOpenPendingsByCard } from './ordersKanbanCardsQuery.repository.js';

// ✅ Editar card (cliente, nº separação, observação)
export async function updateCard(cardId, { customer_id, separation_number, note } = {}) {
  const id = Number(cardId);
  const customerId = Number(customer_id);

  if (!id || Number.isNaN(id)) throw new Error('cardId inválido');
  if (!Number.isInteger(customerId) || customerId <= 0) {
    const err = new Error('Cliente obrigatório.');
    err.statusCode = 400;
    throw err;
  }

  const { rows, rowCount } = await pool.query(
    `UPDATE ${TB_CARDS}
        SET customer_id       = $2,
            separation_number = $3,
            note              = $4,
            updated_at        = NOW()
      WHERE card_id = $1
    RETURNING *`,
    [
      id,
      customerId,
      String(separation_number ?? '').trim() || null,
      String(note ?? '').trim() || null,
    ]
  );
  if (!rowCount) return null;
  return rows[0];
}

export async function moveCardToColumn({ cardId, columnId }) {
  const sql = `
    UPDATE ${TB_CARDS} k
       SET status = s.name,
           updated_at = NOW()
      FROM ${TB_COLUMNS} s
     WHERE k.card_id = $1
       AND s.column_id = $2
    RETURNING
      k.*,
      s.column_id,
      s.name       AS column_name,
      s.sort_order AS column_order;
  `;
  const { rows, rowCount } = await pool.query(sql, [Number(cardId), Number(columnId)]);
  if (!rowCount) return null;
  return rows[0];
}

export async function setCardUrgent({ cardId, isUrgent }) {
  const { rows, rowCount } = await pool.query(
    `UPDATE ${TB_CARDS}
        SET is_urgent = $1,
            updated_at = NOW()
      WHERE card_id = $2
    RETURNING card_id, is_urgent`,
    [!!isUrgent, Number(cardId)]
  );
  if (!rowCount) return null;
  return rows[0];
}

export async function finishCard(cardId) {
  const id = Number(cardId);
  if (!id || Number.isNaN(id)) throw new Error('cardId inválido');

  const openPendings = await countOpenPendingsByCard(id);

  if (openPendings > 0) {
    const err = new Error(
      `Este card possui ${openPendings} pendência(s) aberta(s) e não pode ser finalizado.`
    );
    err.statusCode = 409;
    err.code = 'CARD_HAS_OPEN_PENDINGS';
    err.openPendings = openPendings;
    throw err;
  }

  const sql = `
    UPDATE ${TB_CARDS}
       SET is_finished  = true,
           finished_at  = NOW(),
           updated_at   = NOW()
     WHERE card_id = $1
       AND COALESCE(is_finished, false) = false
    RETURNING card_id, is_finished, finished_at;
  `;

  const { rows, rowCount } = await pool.query(sql, [id]);

  if (!rowCount) return null;

  return rows[0];
}
