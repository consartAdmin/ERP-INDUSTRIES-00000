// ╔══════════════════════════════════════════════════════════════════════╗
// ║ paymentFormsController.js — Formas de Pagamento (API REST)          ║
// ║ Tabela: public."paymentForms"                                       ║
// ║ Colunas:                                                            ║
// ║   "paymentForms_id" (PK, int)                                       ║
// ║   name            (varchar)                                         ║
// ║   nfe_tpag        (char(2))                                         ║
// ║   active          (boolean)                                         ║
// ║   created_at      (timestamp)                                       ║
// ║   updated_at      (timestamp)                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import db from '../config/db.js';

const pool = db.pool || db;

// Nome da tabela (com aspas para manter CamelCase)
const TABLE = 'public."paymentForms"';
const ID_COL = '"paymentForms_id"';

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function mapRow(row) {
  if (!row) return null;

  return {
    id: row.paymentForms_id,
    name: row.name,
    nfe_tpag: row.nfe_tpag,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// ---------------------------------------------------------------------
// GET /api/paymentForms
// ---------------------------------------------------------------------
export async function listPaymentForms(req, res) {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ID_COL}      AS "paymentForms_id",
        name,
        nfe_tpag,
        active,
        created_at,
        updated_at
      FROM ${TABLE}
      ORDER BY active DESC, name ASC
      `
    );

    const data = rows.map(mapRow);
    return res.json(data);
  } catch (err) {
    console.error('[paymentFormsController] Erro ao listar:', err);
    return res.status(500).json({
      message: 'Erro ao listar formas de pagamento.'
    });
  }
}

// ---------------------------------------------------------------------
// GET /api/paymentForms/:id
// ---------------------------------------------------------------------
export async function getPaymentFormById(req, res) {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        ${ID_COL}      AS "paymentForms_id",
        name,
        nfe_tpag,
        active,
        created_at,
        updated_at
      FROM ${TABLE}
      WHERE ${ID_COL} = $1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada.' });
    }

    return res.json(mapRow(rows[0]));
  } catch (err) {
    console.error('[paymentFormsController] Erro ao buscar por ID:', err);
    return res.status(500).json({
      message: 'Erro ao buscar forma de pagamento.'
    });
  }
}

// ---------------------------------------------------------------------
// POST /api/paymentForms
// body: { name, nfe_tpag, active }
// ---------------------------------------------------------------------
export async function createPaymentForm(req, res) {
  try {
    const { name, nfe_tpag, active } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: 'Nome da forma de pagamento é obrigatório.' });
    }

    const isActive =
      active === true ||
      active === 'true' ||
      active === 1 ||
      active === '1';

    const { rows } = await pool.query(
      `
      INSERT INTO ${TABLE} (name, nfe_tpag, active, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      RETURNING
        ${ID_COL}      AS "paymentForms_id",
        name,
        nfe_tpag,
        active,
        created_at,
        updated_at
      `,
      [name, nfe_tpag || null, isActive]
    );

    return res.status(201).json(mapRow(rows[0]));
  } catch (err) {
    console.error('[paymentFormsController] Erro ao criar:', err);
    return res.status(500).json({
      message: 'Erro ao criar forma de pagamento.'
    });
  }
}

// ---------------------------------------------------------------------
// PUT /api/paymentForms/:id
// body: { name, nfe_tpag, active }
// ---------------------------------------------------------------------
export async function updatePaymentForm(req, res) {
  const { id } = req.params;
  const { name, nfe_tpag, active } = req.body || {};

  try {
    const isActive =
      active === true ||
      active === 'true' ||
      active === 1 ||
      active === '1';

    const { rows } = await pool.query(
      `
      UPDATE ${TABLE}
      SET
        name       = COALESCE($1, name),
        nfe_tpag   = COALESCE($2, nfe_tpag),
        active     = COALESCE($3, active),
        updated_at = NOW()
      WHERE ${ID_COL} = $4
      RETURNING
        ${ID_COL}      AS "paymentForms_id",
        name,
        nfe_tpag,
        active,
        created_at,
        updated_at
      `,
      [name ?? null, nfe_tpag ?? null, isActive, id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada.' });
    }

    return res.json(mapRow(rows[0]));
  } catch (err) {
    console.error('[paymentFormsController] Erro ao atualizar:', err);
    return res.status(500).json({
      message: 'Erro ao atualizar forma de pagamento.'
    });
  }
}

// ---------------------------------------------------------------------
// DELETE /api/paymentForms/:id
// ---------------------------------------------------------------------
export async function deletePaymentForm(req, res) {
  const { id } = req.params;

  try {
    const { rowCount } = await pool.query(
      `
      DELETE FROM ${TABLE}
      WHERE ${ID_COL} = $1
      `,
      [id]
    );

    if (!rowCount) {
      return res.status(404).json({ message: 'Forma de pagamento não encontrada.' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[paymentFormsController] Erro ao excluir:', err);
    return res.status(500).json({
      message: 'Erro ao excluir forma de pagamento.'
    });
  }
}
