// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalLookup.repository.js — Consultas auxiliares          ║
// ║ resolveProductCode / fiscalProfile / fiscalClassification          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS } from './productsFiscal.constants.js';
import {
  isFiniteNum,
  toTrimOrNull,
} from './productsFiscal.sanitizers.js';

/* ──────────────────────────────────────────────────────────
   Resolve product_code
   - productsFiscal é por product_code (SEM FK)
   - compat: se vier product_id, resolve via public."products"
────────────────────────────────────────────────────────── */
export async function resolveProductCode(client, { product_code, productCode, product_id, productId } = {}) {
  const code = toTrimOrNull(product_code ?? productCode);
  if (code) return code;

  const pid = product_id ?? productId;
  if (pid == null) return null;
  if (!isFiniteNum(pid)) return null;

  const { rows } = await client.query(
    `SELECT product_code FROM ${TB_PRODUCTS} WHERE product_id = $1 LIMIT 1`,
    [Number(pid)]
  );
  return rows[0]?.product_code ? String(rows[0].product_code) : null;
}

/* ──────────────────────────────────────────────────────────
   Integração com fiscalProfile / fiscalClassification
────────────────────────────────────────────────────────── */
export async function getFiscalProfileByIdOrName(client, { id, name }) {
  if (!id && !name) return null;
  if (id) {
    const { rows } = await client.query(
      `SELECT * FROM public."fiscalProfile" WHERE fiscal_profile_id = $1 LIMIT 1`,
      [Number(id)]
    );
    if (rows[0]) return rows[0];
  }
  if (name) {
    const { rows } = await client.query(
      `SELECT * FROM public."fiscalProfile" WHERE LOWER(profile_name) = LOWER($1) LIMIT 1`,
      [String(name).trim()]
    );
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function getFiscalClassificationByIdOrName(client, { id, name }) {
  if (!id && !name) return null;
  if (id) {
    const { rows } = await client.query(
      `SELECT * FROM public."fiscalClassification" WHERE fiscal_classification_id = $1 LIMIT 1`,
      [Number(id)]
    );
    if (rows[0]) return rows[0];
  }
  if (name) {
    const { rows } = await client.query(
      `SELECT * FROM public."fiscalClassification" WHERE LOWER(classification_name) = LOWER($1) LIMIT 1`,
      [String(name).trim()]
    );
    if (rows[0]) return rows[0];
  }
  return null;
}
