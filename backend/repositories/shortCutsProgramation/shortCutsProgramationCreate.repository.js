// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationCreate.repository.js — create                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './shortCutsProgramation.constants.js';
import { normalizePayload } from './shortCutsProgramation.sanitizers.js';
import { hydrateCategoryText } from './shortCutsProgramation.utils.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';

export async function create(body) {
    await ensureTable();

    const p = await hydrateCategoryText(normalizePayload(body));

    if (!p.category_id && !p.category) throw new Error('category or category_id is required');
    if (!p.title) throw new Error('title is required');
    if (!p.shortcut_key) throw new Error('shortcut_key is required');
    if (!p.language) throw new Error('language is required');
    if (!p.code) throw new Error('code is required');

    const result = await pool.query(
        `
    INSERT INTO ${TB}
    (
      category_id, subcategory_id,
      category, subcategory,
      title, shortcut_key, shortcut_type,
      language, description, code, code_template, example,
      observations, tags, difficulty, favorite, active, sort_order
    )
    VALUES
    (
      $1,$2,
      $3,$4,
      $5,$6,$7,
      $8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18
    )
    RETURNING *
    `,
        [
            p.category_id,
            p.subcategory_id,
            p.category,
            p.subcategory,
            p.title,
            p.shortcut_key,
            p.shortcut_type,
            p.language,
            p.description,
            p.code,
            p.code_template,
            p.example,
            p.observations,
            p.tags,
            p.difficulty,
            p.favorite,
            p.active,
            p.sort_order,
        ]
    );

    return result.rows[0];
}
