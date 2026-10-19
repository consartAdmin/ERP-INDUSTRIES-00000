// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeGetById.repository.js — getByCustomerId / getByUfCity ║
// ║ Tabela: public."customersIbge"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CUSTOMERS_IBGE } from './customersIbge.constants.js';
import { normUF, normCity } from './customersIbge.sanitizers.js';
import { rowToCustomersIbge } from './customersIbge.mappers.js';
import { ensureTable } from './customersIbgeSchema.repository.js';

// ----------------------------------------------------------------------
// Read
// ----------------------------------------------------------------------
export async function getByCustomerId(customerId) {
  await ensureTable();

  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  try {
    const r = await pool.query(
      `
      SELECT
        customer_id, uf, city, codigo_ibge,
        source, confidence, created_at, updated_at
      FROM ${TB_CUSTOMERS_IBGE}
      WHERE customer_id = $1
      `,
      [id],
    );
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToCustomersIbge(r.rows[0]) };
  } catch (err) {
    console.error('[customersIbgeApi.getByCustomerId] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  }
}

// Útil pro front: resolve por UF + City (retorna registro mais “confiável”)
export async function getByUfCity(uf, city) {
  await ensureTable();

  const u = normUF(uf);
  const c = normCity(city);
  if (!u || u.length !== 2) return { ok: false, error: 'UF inválida' };
  if (!c) return { ok: false, error: 'City inválida' };

  try {
    const r = await pool.query(
      `
      SELECT
        customer_id, uf, city, codigo_ibge,
        source, confidence, created_at, updated_at
      FROM ${TB_CUSTOMERS_IBGE}
      WHERE uf = $1 AND LOWER(city) = LOWER($2)
      ORDER BY confidence DESC, updated_at DESC
      LIMIT 1
      `,
      [u, c],
    );
    if (!r.rowCount) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, row: rowToCustomersIbge(r.rows[0]) };
  } catch (err) {
    console.error('[customersIbgeApi.getByUfCity] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  }
}
