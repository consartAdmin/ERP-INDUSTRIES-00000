// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsCreate.repository.js — create                                ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { PRODUCTS_TABLE, PRODUCTS_SCHEMA, prepareProductInsert } from './products.catalog.js';
import { normalizePgError, throwValidation } from './products.utils.js';
import { normalizeInput } from './products.sanitizers.js';

export async function create(payload = {}) {
    const prepared = prepareProductInsert(normalizeInput(payload));
    if (!prepared.valid) throwValidation(prepared.errors);

    const data = prepared.data;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const sql = columns.length
        ? `
        INSERT INTO ${PRODUCTS_TABLE} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING ${PRODUCTS_SCHEMA.selectProjection}
      `
        : `
        INSERT INTO ${PRODUCTS_TABLE} DEFAULT VALUES
        RETURNING ${PRODUCTS_SCHEMA.selectProjection}
      `;

    try {
        const { rows } = await pool.query(sql, values);
        return rows[0];
    } catch (error) {
        throw normalizePgError(error);
    }
}
