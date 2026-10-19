// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationSubCategories.repository.js — Subcategorias   ║
// ║ listSubCategories / create / update / removeSubCategory            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_SUBCATEGORIES } from './shortCutsProgramation.constants.js';
import { toBool, toBigIntOrNull, normalizeSubCategoryPayload } from './shortCutsProgramation.sanitizers.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';

export async function listSubCategories(params = {}) {
    await ensureTable();

    const categoryId = toBigIntOrNull(params.category_id);
    const active = params.active === undefined || params.active === ''
        ? true
        : toBool(params.active, true);

    const values = [active];
    const where = ['active = $1'];

    if (categoryId) {
        values.push(categoryId);
        where.push(`category_id = $${values.length}`);
    }

    const result = await pool.query(
        `
    SELECT *
    FROM ${TB_SUBCATEGORIES}
    WHERE ${where.join(' AND ')}
    ORDER BY sort_order ASC, name ASC
    `,
        values
    );

    return result.rows;
}

export async function createSubCategory(body) {
    await ensureTable();

    const p = normalizeSubCategoryPayload(body);

    if (!p.category_id) throw new Error('category_id is required');
    if (!p.name) throw new Error('name is required');

    const result = await pool.query(
        `
        INSERT INTO ${TB_SUBCATEGORIES}
        (
            category_id,
            name,
            description,
            sort_order,
            active
        )
        VALUES
        (
            $1, $2, $3, $4, $5
        )
        RETURNING *
        `,
        [
            p.category_id,
            p.name,
            p.description,
            p.sort_order,
            p.active,
        ]
    );

    return result.rows[0];
}

export async function updateSubCategory(id, body) {
    await ensureTable();

    const p = normalizeSubCategoryPayload(body);

    if (!p.category_id) throw new Error('category_id is required');
    if (!p.name) throw new Error('name is required');

    const result = await pool.query(
        `
        UPDATE ${TB_SUBCATEGORIES}
        SET
            category_id = $1,
            name = $2,
            description = $3,
            sort_order = $4,
            active = $5,
            updated_at = NOW()
        WHERE subcategory_id = $6
        RETURNING *
        `,
        [
            p.category_id,
            p.name,
            p.description,
            p.sort_order,
            p.active,
            id,
        ]
    );

    return result.rows[0] || null;
}

export async function removeSubCategory(id) {
    await ensureTable();

    const result = await pool.query(
        `
        UPDATE ${TB_SUBCATEGORIES}
        SET active = FALSE,
            updated_at = NOW()
        WHERE subcategory_id = $1
        RETURNING *
        `,
        [id]
    );

    return result.rows[0] || null;
}
