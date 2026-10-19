// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanCardsQuery.repository.js — listagem/contagem de cards  ║
// ║ Tabela: public."ordersKanbanCards"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CARDS, TB_COLUMNS, TB_CUSTOMERS, TB_PENDINGS } from './ordersKanban.constants.js';
import { STATUS_TO_COLUMN, IS_DONE_PENDING } from './ordersKanban.sql.js';

// ===========================================================================
// 📦 CARDS
// ===========================================================================
export async function listCards() {
  const sql = `
    SELECT
      k.card_id,
      k.customer_id,
      k.separation_number,
      k.note,
      k.status,
      k.created_at,
      k.is_urgent,
      k.is_finished,
      k.finished_at,

      s.column_id,
      s.name       AS column_name,
      s.sort_order AS column_order,

      c.trade_name AS customer_name,
      c.tax_id     AS customer_tax_id
    FROM ${TB_CARDS} k
    LEFT JOIN ${TB_CUSTOMERS} c
           ON c.customer_id = k.customer_id
    LEFT JOIN ${TB_COLUMNS} s
           ON s.name = ${STATUS_TO_COLUMN}
    WHERE (s.column_type IN ('orders','pedidos') OR s.column_id IS NULL)
      AND COALESCE(k.is_finished, false) = false
    ORDER BY s.sort_order NULLS LAST, k.card_id DESC;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

export async function countOpenPendingsByCard(cardId) {
  const id = Number(cardId);
  if (!id || Number.isNaN(id)) throw new Error('cardId inválido');

  const sql = `
    SELECT COUNT(*)::int AS total
    FROM ${TB_PENDINGS} p
    WHERE p.card_id = $1
      AND NOT (${IS_DONE_PENDING});
  `;

  const { rows } = await pool.query(sql, [id]);
  return rows[0]?.total ?? 0;
}

export async function countFinished({ period } = {}) {
  let where = 'COALESCE(is_finished,false) = true';

  if (period === 'today' || period === 'hoje') {
    where += ' AND finished_at::date = CURRENT_DATE';
  } else if (period === 'month' || period === 'mes') {
    where += " AND date_trunc('month', finished_at) = date_trunc('month', CURRENT_DATE)";
  } else if (period === 'year' || period === 'ano') {
    where += " AND date_trunc('year', finished_at) = date_trunc('year', CURRENT_DATE)";
  }

  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total FROM ${TB_CARDS} WHERE ${where}`);
  return rows[0]?.total ?? 0;
}
