// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeUpdate.repository.js — updateById / setActive         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS_BAR_CODE, PK_PRODUCTS_BAR_CODE } from './productsBarCode.constants.js';
import { selectProjection } from './productsBarCode.sql.js';
import {
  toPositiveIntegerOrNull,
  toBoolean,
  validationError,
  normalizeWritePayload,
} from './productsBarCode.sanitizers.js';

/* ================================================================ */
/* UPDATE BY ID                                                     */
/* ================================================================ */
export async function updateById(pgPool, payload = {}) {
  const barcode_id = toPositiveIntegerOrNull(payload.barcode_id ?? payload.id);
  if (!barcode_id) {
    throw validationError([{ field: 'barcode_id', message: 'barcode_id is required' }]);
  }

  const data = normalizeWritePayload(payload, { insert: false });

  const { rows } = await pgPool.query(
    `
      UPDATE ${TB_PRODUCTS_BAR_CODE}
         SET product_code = COALESCE(NULLIF($2, ''), product_code),
             product_unit_id = COALESCE($3, product_unit_id),
             barcode = COALESCE(NULLIF($4, ''), barcode),
             barcode_type = COALESCE(NULLIF($5, ''), barcode_type),
             is_active = COALESCE($6, is_active),
             unit = COALESCE(NULLIF($7, ''), unit),
             fator = COALESCE($8, fator),
             description = COALESCE(NULLIF($9, ''), description),
             standard = COALESCE($10, standard),
             unit_id = COALESCE($11, unit_id),
             width_cm = COALESCE($12, width_cm),
             length_cm = COALESCE($13, length_cm),
             height_cm = COALESCE($14, height_cm),
             weight_kg = COALESCE($15, weight_kg),
             updated_at = NOW()
       WHERE ${PK_PRODUCTS_BAR_CODE} = $1
       RETURNING *
      `,
    [
      barcode_id,
      data.product_code ?? null,
      data.product_unit_id ?? null,
      data.barcode ?? null,
      data.barcode_type ?? null,
      data.is_active ?? null,
      data.unit ?? null,
      data.fator ?? null,
      data.description ?? null,
      data.standard ?? null,
      data.unit_id ?? null,
      data.width_cm ?? null,
      data.length_cm ?? null,
      data.height_cm ?? null,
      data.weight_kg ?? null,
    ]
  );

  return rows[0] || null;
}

/* ================================================================ */
/* SET ACTIVE                                                       */
/* ================================================================ */
export async function setActive(pgPool, { barcode_id, is_active }) {
  const id = toPositiveIntegerOrNull(barcode_id);
  if (!id) {
    throw validationError([{ field: 'barcode_id', message: 'barcode_id is required' }]);
  }

  const activeValue = toBoolean(is_active, true);

  const { rows } = await pgPool.query(
    `
      UPDATE ${TB_PRODUCTS_BAR_CODE}
         SET is_active = $2,
             updated_at = NOW()
       WHERE ${PK_PRODUCTS_BAR_CODE} = $1
       RETURNING
         ${selectProjection()}
      `,
    [id, activeValue]
  );

  return rows[0] || null;
}
