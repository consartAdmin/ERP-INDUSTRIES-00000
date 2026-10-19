// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramation.utils.js — hydrateCategoryText               ║
// ║ Preenche category/subcategory (texto legado) a partir dos IDs      ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CATEGORIES, TB_SUBCATEGORIES } from './shortCutsProgramation.constants.js';

export async function hydrateCategoryText(p) {
    if (p.category_id) {
        const cat = await pool.query(
            `SELECT name FROM ${TB_CATEGORIES} WHERE category_id = $1`,
            [p.category_id]
        );

        p.category = cat.rows[0]?.name || p.category;
    }

    if (p.subcategory_id) {
        const sub = await pool.query(
            `SELECT name FROM ${TB_SUBCATEGORIES} WHERE subcategory_id = $1`,
            [p.subcategory_id]
        );

        p.subcategory = sub.rows[0]?.name || p.subcategory;
    }

    return p;
}
