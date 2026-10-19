// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeUpdate.repository.js — update parcial por customer_id ║
// ║ Tabela: public."customersIbge"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CUSTOMERS_IBGE } from './customersIbge.constants.js';
import {
  normUF,
  normCity,
  normIbge,
  normSource,
  clampConfidence,
} from './customersIbge.sanitizers.js';
import { rowToCustomersIbge } from './customersIbge.mappers.js';
import { ensureTable } from './customersIbgeSchema.repository.js';

// Update parcial (opcional — só campos enviados)
export async function update(customerId, patch = {}) {
  await ensureTable();

  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  const sets = [];
  const args = [];
  let ai = 1;

  if (patch.uf != null) {
    const uf = normUF(patch.uf);
    if (!uf || uf.length !== 2) return { ok: false, error: 'UF inválida' };
    sets.push(`uf = $${ai++}`);
    args.push(uf);
  }

  if (patch.city != null) {
    const city = normCity(patch.city);
    if (!city) return { ok: false, error: 'Cidade inválida' };
    sets.push(`city = $${ai++}`);
    args.push(city);
  }

  if (patch.codigo_ibge !== undefined) {
    // permite limpar enviando null
    const code = patch.codigo_ibge == null ? null : normIbge(patch.codigo_ibge);
    sets.push(`codigo_ibge = $${ai++}`);
    args.push(code);
  }

  if (patch.source != null) {
    sets.push(`source = $${ai++}`);
    args.push(normSource(patch.source));
  }

  if (patch.confidence != null) {
    sets.push(`confidence = $${ai++}`);
    args.push(clampConfidence(patch.confidence));
  }

  if (!sets.length) return { ok: false, error: 'Nenhum campo para atualizar' };

  const sql = `
    UPDATE ${TB_CUSTOMERS_IBGE}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE customer_id = $${ai}
    RETURNING
      customer_id, uf, city, codigo_ibge, source, confidence, created_at, updated_at
  `;
  args.push(id);

  try {
    const r = await pool.query(sql, args);
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToCustomersIbge(r.rows[0]) };
  } catch (err) {
    console.error('[customersIbgeApi.update] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  }
}

export default update;
