// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationCategories.repository.js — Categorias         ║
// ║ listCategories / createCategory / updateCategory / removeCategory  ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CATEGORIES } from './shortCutsProgramation.constants.js';
import { toBool, normalizeCategoryPayload } from './shortCutsProgramation.sanitizers.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';

export async function listCategories(params = {}) {
    await ensureTable();

    const active = params.active === undefined || params.active === ''
        ? true
        : toBool(params.active, true);

    const result = await pool.query(
        `
    SELECT *
    FROM ${TB_CATEGORIES}
    WHERE active = $1
    ORDER BY sort_order ASC, name ASC
    `,
        [active]
    );

    return result.rows;
}

export async function createCategory(body) {
    await ensureTable();

    const p = normalizeCategoryPayload(body);

    if (!p.name) throw new Error('name is required');

    const result = await pool.query(
        `
        INSERT INTO ${TB_CATEGORIES}
        (
            name,
            description,
            icon,
            color,
            sort_order,
            active
        )
        VALUES
        (
            $1, $2, $3, $4, $5, $6
        )
        RETURNING *
        `,
        [
            p.name,
            p.description,
            p.icon,
            p.color,
            p.sort_order,
            p.active,
        ]
    );

    return result.rows[0];
}

export async function updateCategory(id, body) {
    await ensureTable();

    const p = normalizeCategoryPayload(body);

    if (!p.name) throw new Error('name is required');

    const result = await pool.query(
        `
        UPDATE ${TB_CATEGORIES}
        SET
            name = $1,
            description = $2,
            icon = $3,
            color = $4,
            sort_order = $5,
            active = $6,
            updated_at = NOW()
        WHERE category_id = $7
        RETURNING *
        `,
        [
            p.name,
            p.description,
            p.icon,
            p.color,
            p.sort_order,
            p.active,
            id,
        ]
    );

    return result.rows[0] || null;
}

export async function removeCategory(id) {
    await ensureTable();

    const result = await pool.query(
        `
        UPDATE ${TB_CATEGORIES}
        SET active = FALSE,
            updated_at = NOW()
        WHERE category_id = $1
        RETURNING *
        `,
        [id]
    );

    return result.rows[0] || null;
}
