// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanRemove.repository.js — deleteCard / deletePending      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CARDS, TB_PENDINGS } from './ordersKanban.constants.js';

export async function deleteCard(cardId) {
  const { rowCount } = await pool.query(`DELETE FROM ${TB_CARDS} WHERE card_id = $1`, [Number(cardId)]);
  return rowCount > 0;
}

export async function deletePending(pendingId) {
  const id = Number(pendingId);
  if (!id || Number.isNaN(id)) throw new Error('pendingId inválido');

  await pool.query(`DELETE FROM ${TB_PENDINGS} WHERE pending_id = $1`, [id]);
  return true;
}
