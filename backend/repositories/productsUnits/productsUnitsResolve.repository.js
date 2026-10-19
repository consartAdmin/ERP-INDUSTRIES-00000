// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsResolve.repository.js — resolve product_code / unit_id ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { UNITS_TB } from './productsUnits.constants.js';
import { notEmptyStr } from './productsUnits.sanitizers.js';
import { checkProductsIdColumns } from './productsUnitsCatalog.repository.js';

/* ──────────────────────────────────────────────────────────────────────────────
   Resolver SKU por ID numérico
───────────────────────────────────────────────────────────────────────────── */
export async function resolveProductCodeForBarcode(client, product_id) {
  const raw = String(product_id ?? '').trim();
  if (!raw) return null;

  const digits = raw.replace(/\D+/g, '');
  const asInt = digits ? Number(digits) : NaN;
  const isInt = Number.isFinite(asInt) && asInt > 0;

  const { hasId, hasProductId } = await checkProductsIdColumns();

  const byIdWhere = [];
  if (isInt && hasId) byIdWhere.push(`p.id = $1::bigint`);
  if (isInt && hasProductId) byIdWhere.push(`p.product_id = $1::bigint`);
  const byIdWhereSql = byIdWhere.length ? `(${byIdWhere.join(' OR ')}) OR` : '';

  const byIdOrder = [];
  if (isInt && hasId) byIdOrder.push(`WHEN p.id = $1::bigint THEN 1`);
  if (isInt && hasProductId) byIdOrder.push(`WHEN p.product_id = $1::bigint THEN 2`);
  const byIdOrderSql = byIdOrder.length ? byIdOrder.join('\n         ') + '\n         ' : '';

  // ✅ FIX: 3 params / 3 placeholders
  const params = [
    isInt ? asInt : 0, // $1
    raw,               // $2
    digits || null,    // $3
  ];

  const { rows } = await client.query(
    `
    SELECT p.product_code
      FROM public.products p
     WHERE
       ${byIdWhereSql}
       p.product_code = $2
       OR p.product_code = LPAD($2, 6, '0')
       OR p.product_code = LPAD($2, 7, '0')
       OR p.product_code = LPAD($2, 8, '0')
       OR p.product_code = LPAD($2, 9, '0')
       OR p.product_code = LPAD($2, 10, '0')
       OR p.product_code = LPAD($2, 12, '0')
       OR regexp_replace(p.product_code, '\\D+', '', 'g') = $3
     ORDER BY
       CASE
         ${byIdOrderSql}
         WHEN p.product_code = $2 THEN 10
         WHEN p.product_code = LPAD($2, 8, '0') THEN 11
         WHEN p.product_code = LPAD($2, 10, '0') THEN 12
         WHEN regexp_replace(p.product_code, '\\D+', '', 'g') = $3 THEN 20
         ELSE 99
       END
     LIMIT 1;
    `,
    params
  );

  return rows[0]?.product_code ? String(rows[0].product_code).trim() : null;
}

export async function resolveIncomingProductCodeMaybeId(rawCode) {
  if (!notEmptyStr(rawCode)) return rawCode;

  const raw = String(rawCode).trim();
  const digits = raw.replace(/\D+/g, '');
  const isPureDigits = !!digits && digits.length === raw.length;

  if (!isPureDigits) return raw;

  const asInt = Number(digits);
  if (!Number.isFinite(asInt) || asInt <= 0) return raw;

  const client = await pool.connect();
  try {
    const resolved = await resolveProductCodeForBarcode(client, raw);
    return resolved || raw;
  } finally {
    client.release();
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
   Resolver unit_id pela sigla
───────────────────────────────────────────────────────────────────────────── */
export async function resolveUnitId(sigla) {
  if (!notEmptyStr(sigla)) return null;
  const s = sigla.trim().toUpperCase();

  const withDot = s.endsWith('.') ? s : `${s}.`;
  const withoutDot = s.endsWith('.') ? s.slice(0, -1) : s;

  const { rows } = await pool.query(
    `
      SELECT unit_id
        FROM public.${UNITS_TB}
       WHERE UPPER(unit) IN ($1, $2)
          OR UPPER(description) IN ($1, $2)
       LIMIT 1;
    `,
    [withDot, withoutDot]
  );

  return rows[0]?.unit_id ?? null;
}
