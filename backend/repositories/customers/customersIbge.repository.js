// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbge.repository.js                                        ║
// ║ Tabela: public."customersIbge" (1 linha por customer_id)           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_IBGE } from './customers.constants.js';
import { toNumOrNull } from './customers.utils.js';

/* ──────────────────────────────────────────────────────────
   IBGE helpers
────────────────────────────────────────────────────────── */

function cleanUf(v) {
  return String(v || '').trim().toUpperCase().slice(0, 2);
}

function cleanCity(v) {
  return String(v || '').trim();
}

function cleanIbgeCode(v) {
  const s = String(v ?? '')
    .replace(/\D+/g, '')
    .slice(0, 7);

  return s || null;
}

/**
 * UPSERT customersIbge (idempotente).
 * - codigo_ibge undefined => não altera código.
 * - codigo_ibge null/string => atualiza com COALESCE.
 * - db: pool (padrão) ou client de uma transação.
 */
export async function upsertCustomersIbge({
  customer_id,
  uf,
  city,
  codigo_ibge,
  source = 'manual',
  confidence = 100,
  db = pool,
} = {}) {
  const cid = toNumOrNull(customer_id);
  const UF = cleanUf(uf);
  const CITY = cleanCity(city);

  if (!cid) return;
  if (!UF || UF.length !== 2) return;
  if (!CITY || CITY.length < 2) return;

  const codeProvided = codigo_ibge !== undefined;
  const CODE = codeProvided ? cleanIbgeCode(codigo_ibge) : null;

  const sqlNoCode = `
    INSERT INTO ${TB_IBGE}
      (customer_id, uf, city, codigo_ibge, source, confidence, updated_at)
    VALUES
      ($1, $2, $3, NULL, COALESCE(NULLIF($4,''), 'manual'), COALESCE($5, 100), now())
    ON CONFLICT (customer_id)
    DO UPDATE SET
      uf          = EXCLUDED.uf,
      city        = EXCLUDED.city,
      source      = EXCLUDED.source,
      confidence  = EXCLUDED.confidence,
      updated_at  = now();
  `;

  const sqlWithCode = `
    INSERT INTO ${TB_IBGE}
      (customer_id, uf, city, codigo_ibge, source, confidence, updated_at)
    VALUES
      ($1, $2, $3, $4, COALESCE(NULLIF($5,''), 'manual'), COALESCE($6, 100), now())
    ON CONFLICT (customer_id)
    DO UPDATE SET
      uf           = EXCLUDED.uf,
      city         = EXCLUDED.city,
      codigo_ibge  = COALESCE(EXCLUDED.codigo_ibge, ${TB_IBGE}.codigo_ibge),
      source       = EXCLUDED.source,
      confidence   = EXCLUDED.confidence,
      updated_at   = now();
  `;

  const src = String(source || '').trim();
  const conf = Number(confidence) || 100;

  if (!codeProvided) {
    await db.query(sqlNoCode, [cid, UF, CITY, src, conf]);
    return;
  }

  await db.query(sqlWithCode, [cid, UF, CITY, CODE, src, conf]);
}

export default {
  upsertCustomersIbge,
};
