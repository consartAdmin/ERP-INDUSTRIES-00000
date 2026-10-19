// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationsQuery.repository.js — Consultas IBGE Locations        ║
// ║ listUfs, resolveCity, list, search, countByState, getById,         ║
// ║ getByIbgeCode, getCitiesByState                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ALIAS } from './ibgeLocations.constants.js';
import { toNumOrNull, toTrimOrNull, toBoolOrNull, toState2, toInt } from './ibgeLocations.sanitizers.js';
import { rowToModel } from './ibgeLocations.mappers.js';

/* =======================================================================
 * ✅ LIST UFS (distinct)
 * Retorno: [{ uf:"MG", name:"MG" }, ...]
 * ======================================================================= */
export async function listUfs(params = {}) {
  const st = toBoolOrNull(params.status);

  const wh = ['1=1'];

  if (st === true) wh.push(`${ALIAS}.status = TRUE`);
  else if (st === false) wh.push(`${ALIAS}.status = FALSE`);

  const sql = `
    SELECT DISTINCT ${ALIAS}.state AS uf
    FROM ${TB} ${ALIAS}
    WHERE ${wh.join(' AND ')}
    ORDER BY ${ALIAS}.state ASC;
  `;

  const { rows } = await pool.query(sql);
  return (rows || []).map(r => ({
    uf: String(r.uf || '').trim(),
    name: String(r.uf || '').trim(),
  }));
}

/* =======================================================================
 * ✅ RESOLVE CITY -> IBGE CODE (DB)
 * Input: { uf, city }
 * Saída: { name, uf, ibgeCode }  (compatível com extractors do frontend)
 * ======================================================================= */
export async function resolveCity({ uf, city } = {}) {
  const UF = toState2(uf);
  const CITY = toTrimOrNull(city);

  if (!UF) throw new Error('uf is required.');
  if (!CITY) throw new Error('city is required.');

  // 1) match exato (case-insensitive)
  let r = await pool.query(
    `
    SELECT state, city, ibge_code
    FROM ${TB}
    WHERE state = $1
      AND LOWER(city) = LOWER($2)
    ORDER BY status DESC, ibge_location_id ASC
    LIMIT 1
    `,
    [UF, CITY]
  );

  if (r.rows?.[0]) {
    const row = r.rows[0];
    return { name: row.city, uf: row.state, ibgeCode: row.ibge_code };
  }

  // 2) fallback ILIKE (variações)
  r = await pool.query(
    `
    SELECT state, city, ibge_code
    FROM ${TB}
    WHERE state = $1
      AND city ILIKE $2
    ORDER BY status DESC, ibge_location_id ASC
    LIMIT 1
    `,
    [UF, CITY]
  );

  if (!r.rows?.[0]) return null;

  const row = r.rows[0];
  return { name: row.city, uf: row.state, ibgeCode: row.ibge_code };
}

/* =======================================================================
 * LIST / SEARCH
 * - Compatível:
 *   - padrão: retorna array
 *   - includeTotal=true: retorna { rows, total, limit, offset }
 * ======================================================================= */
export async function list(params = {}) {
  const {
    q,
    state,
    status,
    limit = 100,
    offset = 0,
    includeTotal = false,
  } = params;

  const wh = ['1=1'];
  const values = [];
  let i = 1;

  if (state) {
    wh.push(`${ALIAS}.state = $${i}`);
    values.push(toState2(state));
    i++;
  }

  if (q) {
    wh.push(`(
      ${ALIAS}.state ILIKE $${i} OR
      ${ALIAS}.city  ILIKE $${i} OR
      CAST(${ALIAS}.ibge_code AS TEXT) ILIKE $${i}
    )`);
    values.push(`%${String(q).trim()}%`);
    i++;
  }

  const st = toBoolOrNull(status);
  if (st === true) wh.push(`${ALIAS}.status = TRUE`);
  else if (st === false) wh.push(`${ALIAS}.status = FALSE`);

  let total = null;
  if (includeTotal) {
    const sqlTotal = `
      SELECT COUNT(*)::int AS total
      FROM ${TB} ${ALIAS}
      WHERE ${wh.join(' AND ')};
    `;
    const rTotal = await pool.query(sqlTotal, values);
    total = Number(rTotal.rows?.[0]?.total ?? 0);
  }

  const sql = `
    SELECT ${ALIAS}.*
    FROM ${TB} ${ALIAS}
    WHERE ${wh.join(' AND ')}
    ORDER BY ${ALIAS}.state ASC, ${ALIAS}.city ASC, ${ALIAS}.ibge_location_id ASC
    LIMIT $${i} OFFSET $${i + 1};
  `;

  const valuesPaged = [...values, Number(limit), Number(offset)];
  const { rows } = await pool.query(sql, valuesPaged);
  const mapped = (rows || []).map(rowToModel);

  if (!includeTotal) return mapped;

  return {
    rows: mapped,
    total,
    limit: Number(limit),
    offset: Number(offset),
  };
}

export async function search(q, limit = 50) {
  return list({ q, limit });
}

/* =======================================================================
 * ✅ COUNT BY STATE — quantidade de cidades por UF
 * Retorno: [{ state: "MG", total_cities: 853 }, ...]
 * ======================================================================= */
export async function countByState(params = {}) {
  const st = toBoolOrNull(params.status);

  const wh = ['1=1'];
  if (st === true) wh.push(`${ALIAS}.status = TRUE`);
  else if (st === false) wh.push(`${ALIAS}.status = FALSE`);

  const sql = `
    SELECT ${ALIAS}.state AS state, COUNT(*)::int AS total_cities
    FROM ${TB} ${ALIAS}
    WHERE ${wh.join(' AND ')}
    GROUP BY ${ALIAS}.state
    ORDER BY ${ALIAS}.state ASC;
  `;

  const { rows } = await pool.query(sql);
  return (rows || []).map(r => ({
    state: r.state,
    total_cities: r.total_cities,
  }));
}

/* =======================================================================
 * GET BY ID
 * ======================================================================= */
export async function getById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE ibge_location_id = $1 LIMIT 1`,
    [Number(id)]
  );
  return rowToModel(rows?.[0]);
}

/* =======================================================================
 * Extras úteis
 * ======================================================================= */
export async function getByIbgeCode(ibgeCode) {
  const code = toNumOrNull(ibgeCode);
  if (code == null) return null;

  const { rows } = await pool.query(
    `SELECT * FROM ${TB} WHERE ibge_code = $1 LIMIT 1`,
    [Number(code)]
  );
  return rowToModel(rows?.[0]);
}

/* =======================================================================
 * ✅ Cities by State (com q/limit/offset/status opcional)
 * - Compatível: getCitiesByState("MG") retorna tudo (status TRUE)
 * - Se enviar q, aplica paginação.
 * ======================================================================= */
export async function getCitiesByState(state, opts = {}) {
  const st = toState2(state);
  if (!st) return [];

  const q = toTrimOrNull(opts.q);
  const limit = toInt(opts.limit, 500);
  const offset = toInt(opts.offset, 0);

  // default: status TRUE
  const parsedStatus = (opts.status === undefined) ? true : toBoolOrNull(opts.status);
  const statusFinal = (parsedStatus === null) ? true : parsedStatus;

  const wh = [`state = $1`];
  const values = [st];
  let i = 2;

  if (statusFinal === true) wh.push(`status = TRUE`);
  else if (statusFinal === false) wh.push(`status = FALSE`);

  if (q && q.length >= 1) {
    wh.push(`(city ILIKE $${i} OR CAST(ibge_code AS TEXT) ILIKE $${i})`);
    values.push(`%${q}%`);
    i++;
  }

  const usePaging = !!q;

  const sql = `
    SELECT *
    FROM ${TB}
    WHERE ${wh.join(' AND ')}
    ORDER BY city ASC
    ${usePaging ? `LIMIT $${i} OFFSET $${i + 1}` : ``}
  `;

  const finalValues = usePaging ? [...values, Number(limit), Number(offset)] : values;

  const { rows } = await pool.query(sql, finalValues);
  return (rows || []).map(rowToModel);
}
