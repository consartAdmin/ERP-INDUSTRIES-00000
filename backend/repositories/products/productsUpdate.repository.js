// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsUpdate.repository.js — updateByCode / updateBarcodeByCode    ║
// ║ Inclui upsertLocation (localização física do produto)                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PRODUCTS_TABLE, PRODUCTS_SCHEMA, prepareProductUpdate } from './products.catalog.js';
import { TABLE_LOCATIONS } from './products.constants.js';
import { ProductsApiError, normalizePgError, throwValidation } from './products.utils.js';
import { requiredProductCode, positiveInteger, normalizeInput } from './products.sanitizers.js';

async function upsertLocation(client, productCode, location = {}) {
    const fields = ['corredor', 'prateleira', 'bandeja', 'box'];
    const hasLocation = fields.some((field) => {
        const value = location[field];
        return value !== undefined && value !== null && String(value).trim() !== '';
    });

    if (!hasLocation) return null;

    const storeId = positiveInteger(location.store_id ?? location.local_id, 6);
    const values = fields.map((field) => {
        const value = location[field];
        return value === undefined || value === null || String(value).trim() === ''
            ? null
            : String(value).trim();
    });

    const existing = await client.query(
        `
      SELECT id
      FROM ${TABLE_LOCATIONS}
      WHERE product_code = $1
        AND store_id = $2
        AND COALESCE(corredor, '') = COALESCE($3, '')
        AND COALESCE(prateleira, '') = COALESCE($4, '')
        AND COALESCE(bandeja, '') = COALESCE($5, '')
        AND COALESCE(box, '') = COALESCE($6, '')
      ORDER BY is_active DESC, updated_at DESC
      LIMIT 1
    `,
        [productCode, storeId, ...values],
    );

    let locationId = existing.rows[0]?.id;

    if (!locationId) {
        const inserted = await client.query(
            `
        INSERT INTO ${TABLE_LOCATIONS}
          (product_code, store_id, corredor, prateleira, bandeja, box, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id
      `,
            [productCode, storeId, ...values],
        );
        locationId = inserted.rows[0].id;
    }

    await client.query(
        `
      UPDATE ${TABLE_LOCATIONS}
      SET is_active = (id = $2),
          updated_at = NOW()
      WHERE product_code = $1
    `,
        [productCode, locationId],
    );

    await client.query(
        `
      UPDATE ${PRODUCTS_TABLE}
      SET product_location_id = $1,
          updated_at = NOW()
      WHERE product_code = $2
    `,
        [locationId, productCode],
    );

    return Number(locationId);
}

export async function updateByCode(currentProductCode, payload = {}) {
    const currentCode = requiredProductCode(currentProductCode);
    const prepared = prepareProductUpdate(normalizeInput(payload));
    if (!prepared.valid) throwValidation(prepared.errors);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const data = prepared.data;
        const columns = Object.keys(data);
        const values = Object.values(data);
        const setSql = columns.map((column, index) => `${column} = $${index + 1}`);
        setSql.push('updated_at = NOW()');
        values.push(currentCode);

        const { rows } = await client.query(
            `
        UPDATE ${PRODUCTS_TABLE}
        SET ${setSql.join(', ')}
        WHERE product_code = $${values.length}
        RETURNING ${PRODUCTS_SCHEMA.selectProjection}
      `,
            values,
        );

        if (!rows.length) {
            throw new ProductsApiError('Produto não encontrado.', {
                code: 'PRODUCT_NOT_FOUND',
                status: 404,
            });
        }

        const updated = rows[0];
        const locationId = await upsertLocation(client, updated.product_code, payload);

        await client.query('COMMIT');
        return locationId === null
            ? updated
            : { ...updated, product_location_id: locationId, realLocationId: locationId };
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* noop */ }
        throw normalizePgError(error);
    } finally {
        client.release();
    }
}

export async function updateBarcodeByCode(productCode, barcode) {
    const code = requiredProductCode(productCode);
    const cleanBarcode = barcode === null || barcode === undefined
        ? null
        : String(barcode).trim().replace(/[^\d]/g, '');

    const { rows } = await pool.query(
        `
      UPDATE ${PRODUCTS_TABLE}
      SET barcode = $1,
          updated_at = NOW()
      WHERE product_code = $2
      RETURNING ${PRODUCTS_SCHEMA.selectProjection}
    `,
        [cleanBarcode || null, code],
    );

    if (!rows.length) {
        throw new ProductsApiError('Produto não encontrado.', {
            code: 'PRODUCT_NOT_FOUND',
            status: 404,
        });
    }

    return rows[0];
}
