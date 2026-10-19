// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalUpdate.repository.js — update                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, FISCAL_FIELDS } from './productsFiscal.constants.js';
import {
  toTrimOrNull,
  q,
  normalizeCFOPList,
  normalizePayload,
} from './productsFiscal.sanitizers.js';
import { rowToModel } from './productsFiscal.mappers.js';
import { getById } from './productsFiscalQuery.repository.js';

export async function update(id, data = {}) {
  const normalized = normalizePayload(data);
  const sets = [];
  const values = [];
  let i = 1;

  for (const k of FISCAL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(normalized, k)) {
      let v = normalized[k];
      if (k === 'cfops_entrada' || k === 'cfops_saida') {
        v = v == null ? null : (Array.isArray(v) ? v : normalizeCFOPList(v));
      }
      sets.push(`${q(k)} = $${i}`);
      values.push(v);
      i++;
    }
  }

  // opcional: permitir atualizar product_code via update()
  if (Object.prototype.hasOwnProperty.call(data, 'product_code') || Object.prototype.hasOwnProperty.call(data, 'productCode')) {
    const pc = toTrimOrNull(data.product_code ?? data.productCode);
    if (pc) {
      sets.push(`${q('product_code')} = $${i}`);
      values.push(pc);
      i++;
    }
  }

  if (!sets.length) return getById(id);

  const sql = `
    UPDATE ${TB}
    SET ${sets.join(', ')}, ${q('updated_at')} = NOW()
    WHERE ${q('products_fiscal_id')} = $${i}
    RETURNING *;
  `;
  values.push(Number(id));

  const { rows } = await pool.query(sql, values);
  return rowToModel(rows[0]);
}
