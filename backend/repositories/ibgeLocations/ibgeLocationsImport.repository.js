// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocationsImport.repository.js — Importa cidades por UF         ║
// ║ API pública do IBGE → Banco (upsert por ibge_code)                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ibgeLocations.constants.js';
import { toNumOrNull, toTrimOrNull, toState2 } from './ibgeLocations.sanitizers.js';

/* =======================================================================
 * ✅ Importar cidades + ibge_code por UF (IBGE → Banco)
 * ======================================================================= */
async function fetchIbgeCitiesByState(state2) {
  const st = toState2(state2);
  if (!st) throw new Error('State (UF) is required.');

  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(st)}/municipios`;

  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`IBGE API error ${res.status}: ${text || res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('IBGE API returned invalid payload.');

  return { st, municipios: data };
}

export async function importByState(state) {
  const { st, municipios } = await fetchIbgeCitiesByState(state);

  const rows = [];
  for (const m of municipios) {
    const ibge_code = toNumOrNull(m?.id);
    const city = toTrimOrNull(m?.nome);
    if (!city || ibge_code == null) continue;
    rows.push({ state: st, city, ibge_code, status: true });
  }

  if (!rows.length) {
    return { ok: true, state: st, total: 0, inserted: 0, updated: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const values = [];
    const placeholders = [];
    let i = 1;

    for (const r of rows) {
      placeholders.push(`($${i++}, $${i++}, $${i++}, $${i++})`);
      values.push(r.state, r.city, Number(r.ibge_code), true);
    }

    const sql = `
      INSERT INTO ${TB} (state, city, ibge_code, status)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (ibge_code)
      DO UPDATE SET
        state = EXCLUDED.state,
        city = EXCLUDED.city,
        status = TRUE,
        updated_at = NOW()
      RETURNING (xmax = 0) AS inserted;
    `;

    const r = await client.query(sql, values);

    const inserted = r.rows.filter(x => x.inserted).length;
    const updated = r.rows.length - inserted;

    await client.query('COMMIT');
    return { ok: true, state: st, total: r.rows.length, inserted, updated };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
