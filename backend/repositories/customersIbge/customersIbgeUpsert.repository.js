// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeUpsert.repository.js — upsert (por customer_id)       ║
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

// ----------------------------------------------------------------------
// Upsert (principal)
// ----------------------------------------------------------------------
export async function upsert(customerId, payload = {}) {
  await ensureTable();

  const id = Number(customerId);
  if (!Number.isFinite(id) || id <= 0) return { ok: false, error: 'ID inválido' };

  const uf = normUF(payload.uf);
  const city = normCity(payload.city);
  const codigo_ibge = payload.codigo_ibge == null ? null : normIbge(payload.codigo_ibge);

  if (!uf || uf.length !== 2) return { ok: false, error: 'UF inválida' };
  if (!city) return { ok: false, error: 'Cidade inválida' };

  const source = normSource(payload.source ?? 'manual');
  const confidence = clampConfidence(payload.confidence ?? 100);

  const sql = `
    INSERT INTO ${TB_CUSTOMERS_IBGE}
      (customer_id, uf, city, codigo_ibge, source, confidence)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (customer_id) DO UPDATE SET
      uf         = EXCLUDED.uf,
      city       = EXCLUDED.city,
      codigo_ibge= EXCLUDED.codigo_ibge,
      source     = EXCLUDED.source,
      confidence = EXCLUDED.confidence,
      updated_at = NOW()
    RETURNING
      customer_id, uf, city, codigo_ibge, source, confidence, created_at, updated_at
  `;

  try {
    const r = await pool.query(sql, [id, uf, city, codigo_ibge, source, confidence]);
    return { ok: true, row: rowToCustomersIbge(r.rows[0]) };
  } catch (err) {
    console.error('[customersIbgeApi.upsert] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  }
}

export default upsert;
