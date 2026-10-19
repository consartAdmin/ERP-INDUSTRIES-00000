// ╔════════════════════════════════════════════════════════════════════╗
// ║ paymentFormsUpdate.repository.js — update / softDelete             ║
// ║ Tabela: public."paymentForms"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE, PK } from './paymentForms.constants.js';
import { mapRow } from './paymentForms.mappers.js';
import { normalizeTpag } from './paymentForms.sanitizers.js';
import { getById } from './paymentFormsQuery.repository.js';

export async function update(id, { name, nfe_tpag, active } = {}) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw new Error('paymentForms.update: id inválido.');
  }

  const sets = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    sets.push(`name = $${idx++}`);
    values.push(name.trim());
  }

  if (nfe_tpag !== undefined) {
    const tpag = normalizeTpag(nfe_tpag);
    if (!tpag) {
      throw new Error('paymentForms.update: nfe_tpag inválido.');
    }
    sets.push(`nfe_tpag = $${idx++}`);
    values.push(tpag);
  }

  if (active !== undefined) {
    sets.push(`active = $${idx++}`);
    values.push(!!active);
  }

  if (!sets.length) {
    // nada pra atualizar → apenas retorna o registro atual
    return getById(numericId);
  }

  sets.push(`updated_at = NOW()`);

  const sql = `
    UPDATE ${TABLE}
    SET ${sets.join(', ')}
    WHERE ${PK} = $${idx}
    RETURNING *;
  `;
  values.push(numericId);

  const { rows } = await pool.query(sql, values);
  return rows[0] ? mapRow(rows[0]) : null;
}

// "Delete" lógico (desativa o meio de pagamento)
export async function softDelete(id) {
  return update(id, { active: false });
}
