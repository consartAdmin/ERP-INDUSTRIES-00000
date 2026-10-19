// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanColumnsQuery.repository.js — colunas / status          ║
// ║ Tabela: public."ordersKanbanColumns"                               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CARDS, TB_COLUMNS, TB_PENDINGS } from './ordersKanban.constants.js';
import { STATUS_TO_COLUMN, IS_OPEN_PENDING, IS_DONE_PENDING } from './ordersKanban.sql.js';

// ===========================================================================
// 📊 COLUNAS / STATUS
// ===========================================================================
export async function listColumns() {
  const sql = `
    SELECT
      column_id   AS id,
      name        AS status,
      sort_order  AS ordem
    FROM ${TB_COLUMNS}
    WHERE column_type IN ('orders','pedidos')
    ORDER BY sort_order;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}

export async function listColumnsWithCounts() {
  const sql = `
    SELECT
      s.column_id               AS id,
      s.name                    AS status,
      s.sort_order              AS ordem,
      COUNT(DISTINCT k.card_id) AS qtde_cards,

      COALESCE(SUM(CASE WHEN ${IS_OPEN_PENDING} THEN 1 ELSE 0 END), 0)  AS pendencias_abertas,
      COALESCE(SUM(CASE WHEN ${IS_DONE_PENDING} THEN 1 ELSE 0 END), 0)  AS pendencias_concluidas

    FROM ${TB_COLUMNS} s
    LEFT JOIN ${TB_CARDS} k
           ON ${STATUS_TO_COLUMN} = s.name
          AND COALESCE(k.is_finished,false) = false
    LEFT JOIN ${TB_PENDINGS} p
           ON p.card_id = k.card_id
    WHERE s.column_type IN ('orders','pedidos')
    GROUP BY s.column_id, s.name, s.sort_order
    ORDER BY s.sort_order;
  `;
  const { rows } = await pool.query(sql);
  return rows;
}
