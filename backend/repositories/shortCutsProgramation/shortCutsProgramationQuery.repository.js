// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationQuery.repository.js — list / getById          ║
// ║ List com JOIN de nomes de categoria/subcategoria                   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_CATEGORIES, TB_SUBCATEGORIES } from './shortCutsProgramation.constants.js';
import { toStrOrNull, toBool, toInt, toBigIntOrNull } from './shortCutsProgramation.sanitizers.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';

export async function list(params = {}) {
    await ensureTable();

    const page = Math.max(toInt(params.page, 1), 1);
    const limit = Math.min(Math.max(toInt(params.limit, 50), 1), 200);
    const offset = (page - 1) * limit;

    const q = toStrOrNull(params.q);
    const category = toStrOrNull(params.category);
    const language = toStrOrNull(params.language);
    const categoryId = toBigIntOrNull(params.category_id);
    const subcategoryId = toBigIntOrNull(params.subcategory_id);
    const active = params.active === undefined || params.active === ''
        ? null
        : toBool(params.active, true);

    const where = [];
    const values = [];

    if (q) {
        values.push(`%${q}%`);
        where.push(`(
      sc.title ILIKE $${values.length}
      OR sc.shortcut_key ILIKE $${values.length}
      OR sc.category ILIKE $${values.length}
      OR sc.subcategory ILIKE $${values.length}
      OR cat.name ILIKE $${values.length}
      OR sub.name ILIKE $${values.length}
      OR sc.language ILIKE $${values.length}
      OR sc.tags ILIKE $${values.length}
      OR sc.description ILIKE $${values.length}
      OR sc.code ILIKE $${values.length}
    )`);
    }

    if (category) {
        values.push(category.trim());
        where.push(`TRIM(category) ILIKE TRIM($${values.length})`);
    }

    if (categoryId) {
        values.push(categoryId);
        where.push(`sc.category_id = $${values.length}`);
    }

    if (subcategoryId) {
        values.push(subcategoryId);
        where.push(`sc.subcategory_id = $${values.length}`);
    }

    if (language) {
        values.push(language);
        where.push(`sc.language = $${values.length}`);
    }

    if (active !== null) {
        values.push(active);
        where.push(`sc.active = $${values.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalSql = `
    SELECT COUNT(*)::int AS total
    FROM ${TB} sc
    LEFT JOIN ${TB_CATEGORIES} cat ON cat.category_id = sc.category_id
    LEFT JOIN ${TB_SUBCATEGORIES} sub ON sub.subcategory_id = sc.subcategory_id
    ${whereSql}
  `;

    const totalResult = await pool.query(totalSql, values);

    values.push(limit, offset);

    const rowsSql = `
    SELECT
      sc.*,
      COALESCE(cat.name, sc.category) AS category_name,
      COALESCE(sub.name, sc.subcategory) AS subcategory_name
    FROM ${TB} sc
    LEFT JOIN ${TB_CATEGORIES} cat ON cat.category_id = sc.category_id
    LEFT JOIN ${TB_SUBCATEGORIES} sub ON sub.subcategory_id = sc.subcategory_id
    ${whereSql}
    ORDER BY sc.favorite DESC, sc.sort_order ASC, sc.shortcut_id DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

    const rowsResult = await pool.query(rowsSql, values);

    return {
        rows: rowsResult.rows,
        total: totalResult.rows[0]?.total || 0,
        page,
        limit,
    };
}

export async function getById(id) {
    await ensureTable();

    const result = await pool.query(
        `
    SELECT
      sc.*,
      COALESCE(cat.name, sc.category) AS category_name,
      COALESCE(sub.name, sc.subcategory) AS subcategory_name
    FROM ${TB} sc
    LEFT JOIN ${TB_CATEGORIES} cat ON cat.category_id = sc.category_id
    LEFT JOIN ${TB_SUBCATEGORIES} sub ON sub.subcategory_id = sc.subcategory_id
    WHERE sc.shortcut_id = $1
    `,
        [id]
    );

    return result.rows[0] || null;
}
