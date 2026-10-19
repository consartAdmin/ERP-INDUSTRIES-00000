// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsBarCodeUpsert.repository.js — upsertForUnit                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB_PRODUCTS_BAR_CODE, PK_PRODUCTS_BAR_CODE } from './productsBarCode.constants.js';
import { validationError, normalizeWritePayload } from './productsBarCode.sanitizers.js';

/* ================================================================ */
/* UPSERT                                                           */
/* ================================================================ */
export async function upsertForUnit(pgPool, payload = {}) {
  const data = normalizeWritePayload(
    {
      ...payload,
      is_active: payload.is_active ?? true,
      standard: payload.standard ?? false,
      fator: payload.fator ?? 1,
    },
    { insert: true }
  );

  if (!data.product_unit_id) {
    throw validationError([
      { field: 'product_unit_id', message: 'product_unit_id is required' },
    ]);
  }

  const client = await pgPool.connect();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
        SELECT
          ${PK_PRODUCTS_BAR_CODE},
          product_code,
          product_unit_id
        FROM ${TB_PRODUCTS_BAR_CODE}
        WHERE regexp_replace(barcode::text, '\\D', '', 'g') = $1
        LIMIT 1
        FOR UPDATE
        `,
      [data.barcode]
    );

    if (existing.rows.length > 0) {
      const current = existing.rows[0];

      if (
        String(current.product_code) !== String(data.product_code) ||
        Number(current.product_unit_id) !== Number(data.product_unit_id)
      ) {
        const error = new Error(
          `Barcode ${data.barcode} is already linked to another product or unit`
        );

        error.status = 409;
        error.code = 'BARCODE_ALREADY_LINKED';
        error.current = {
          barcode_id: current.barcode_id,
          product_code: current.product_code,
          product_unit_id: current.product_unit_id,
        };

        throw error;
      }

      const { rows } = await client.query(
        `
          UPDATE ${TB_PRODUCTS_BAR_CODE}
             SET product_code = $2,
                 product_unit_id = $3,
                 barcode = $4,
                 barcode_type = $5,
                 is_active = $6,
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
          current.barcode_id,
          data.product_code,
          data.product_unit_id,
          data.barcode,
          data.barcode_type,
          data.is_active,
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

      await client.query('COMMIT');
      return { success: true, updated: true, ...rows[0] };
    }

    const { rows } = await client.query(
      `
        INSERT INTO ${TB_PRODUCTS_BAR_CODE}
        (
          product_code,
          product_unit_id,
          barcode,
          barcode_type,
          is_active,
          unit,
          fator,
          description,
          standard,
          unit_id,
          width_cm,
          length_cm,
          height_cm,
          weight_kg
        )
        VALUES
        (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14
        )
        RETURNING *
        `,
      [
        data.product_code,
        data.product_unit_id,
        data.barcode,
        data.barcode_type,
        data.is_active,
        data.unit ?? null,
        data.fator ?? 1,
        data.description ?? null,
        data.standard ?? false,
        data.unit_id ?? null,
        data.width_cm ?? null,
        data.length_cm ?? null,
        data.height_cm ?? null,
        data.weight_kg ?? null,
      ]
    );

    await client.query('COMMIT');
    return { success: true, created: true, ...rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[productsBarCodeApi.upsertForUnit]', error);
    throw error;
  } finally {
    client.release();
  }
}
