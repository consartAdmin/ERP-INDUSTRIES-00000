// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanCardsCreate.repository.js — createCard / fromBudget    ║
// ║ Tabela: public."ordersKanbanCards"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CARDS, TB_COLUMNS, TB_BUDGETS } from './ordersKanban.constants.js';

export async function createCard({ customer_id, separation_number, note, status }) {
  if (!customer_id || !status) throw new Error('customer_id e status são obrigatórios.');

  const sql = `
    INSERT INTO ${TB_CARDS} (
      customer_id,
      separation_number,
      note,
      status,
      created_at,
      updated_at,
      is_urgent,
      is_finished
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW(), false, false)
    RETURNING *;
  `;
  const values = [customer_id, separation_number ?? null, note ?? null, status];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

// ✅ Importa um orçamento como card (Nº Separação = "ORÇ.: <budget_id>")
export async function createCardFromBudget(budgetId) {
  const id = Number(budgetId);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('budget_id inválido.');
    err.statusCode = 400;
    throw err;
  }

  const { rows: budgets } = await pool.query(
    `SELECT budget_id, customer_id, customer_name, notes
       FROM ${TB_BUDGETS}
      WHERE budget_id = $1`,
    [id]
  );
  const budget = budgets[0];

  if (!budget) {
    const err = new Error(`Orçamento ${id} não encontrado.`);
    err.statusCode = 404;
    throw err;
  }

  if (!budget.customer_id) {
    const err = new Error(`O orçamento ${id} não possui cliente cadastrado.`);
    err.statusCode = 400;
    throw err;
  }

  // Já existe card em aberto para este orçamento? (aceita "ORÇ.: 1177", "ORÇ. : 1177", "ORÇ. 1177"…)
  const { rows: dup } = await pool.query(
    `SELECT card_id, status
       FROM ${TB_CARDS}
      WHERE COALESCE(is_finished, false) = false
        AND separation_number ILIKE 'OR%'
        AND regexp_replace(separation_number, '[^0-9]', '', 'g') = $1
      LIMIT 1`,
    [String(id)]
  );
  if (dup[0]) {
    const err = new Error(`O orçamento ${id} já está no Kanban (card #${dup[0].card_id}, coluna "${dup[0].status}").`);
    err.statusCode = 409;
    throw err;
  }

  const { rows: cols } = await pool.query(
    `SELECT name
       FROM ${TB_COLUMNS}
      WHERE column_type IN ('orders','pedidos')
      ORDER BY sort_order
      LIMIT 1`
  );

  return createCard({
    customer_id: budget.customer_id,
    separation_number: `ORÇ.: ${id}`,
    note: budget.notes || null,
    status: cols[0]?.name || 'Enviado/Recebido',
  });
}
