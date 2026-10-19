// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbgeQuery.repository.js — search / list                   ║
// ║ Tabela: public."customersIbge"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CUSTOMERS_IBGE } from './customersIbge.constants.js';
import {
  isFiniteNum,
  normUF,
  normIbge,
  normSource,
  clampConfidence,
} from './customersIbge.sanitizers.js';
import { rowToCustomersIbge } from './customersIbge.mappers.js';
import { ensureTable } from './customersIbgeSchema.repository.js';

// ----------------------------------------------------------------------
// Search / Listagem
// ----------------------------------------------------------------------
export async function search({
  q = '',
  uf,
  city,
  ibgeCode,
  source,
  minConfidence,
  limit = 20,
  offset = 0,
} = {}) {
  await ensureTable();

  const where = [];
  const args = [];
  let ai = 1;

  // 🔎 busca textual (city / ibge / customer_id)
  if (q && String(q).trim()) {
    const val = `%${String(q).toLowerCase().trim()}%`;
    where.push(`(
      LOWER(cib.city) LIKE $${ai}
      OR cib.codigo_ibge LIKE $${ai}
      OR CAST(cib.customer_id AS TEXT) LIKE $${ai}
    )`);
    args.push(val);
    ai++;
  }

  // UF
  if (uf && String(uf).trim()) {
    where.push(`cib.uf = $${ai}`);
    args.push(normUF(uf));
    ai++;
  }

  // City exata (útil pra resolver)
  if (city && String(city).trim()) {
    where.push(`LOWER(cib.city) = $${ai}`);
    args.push(String(city).trim().toLowerCase());
    ai++;
  }

  // Código IBGE
  if (ibgeCode && String(ibgeCode).trim()) {
    where.push(`cib.codigo_ibge = $${ai}`);
    args.push(normIbge(ibgeCode));
    ai++;
  }

  // source
  if (source && String(source).trim()) {
    where.push(`LOWER(cib.source) = $${ai}`);
    args.push(normSource(source));
    ai++;
  }

  // confidence mínima
  if (minConfidence != null && isFiniteNum(minConfidence)) {
    where.push(`cib.confidence >= $${ai}`);
    args.push(clampConfidence(minConfidence));
    ai++;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sqlRows = `
    SELECT
      cib.customer_id,
      cib.uf,
      cib.city,
      cib.codigo_ibge,
      cib.source,
      cib.confidence,
      cib.created_at,
      cib.updated_at
    FROM ${TB_CUSTOMERS_IBGE} cib
    ${whereSql}
    ORDER BY cib.updated_at DESC, cib.customer_id DESC
    LIMIT $${ai} OFFSET $${ai + 1}
  `;
  args.push(Number(limit) || 20, Number(offset) || 0);

  const sqlCount = `
    SELECT COUNT(*) AS total
    FROM ${TB_CUSTOMERS_IBGE} cib
    ${whereSql}
  `;

  const client = await pool.connect();
  try {
    const [rowsRes, countRes] = await Promise.all([
      client.query(sqlRows, args),
      client.query(sqlCount, args.slice(0, ai - 1)),
    ]);

    return {
      ok: true,
      rows: rowsRes.rows.map(rowToCustomersIbge),
      total: Number(countRes.rows?.[0]?.total || 0),
    };
  } catch (err) {
    console.error('[customersIbgeApi.search] ERR:', err);
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}

export async function list({ limit = 20, offset = 0 } = {}) {
  return search({ q: '', limit, offset });
}
