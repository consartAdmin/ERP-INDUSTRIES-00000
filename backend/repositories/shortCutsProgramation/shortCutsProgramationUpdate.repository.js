// ╔════════════════════════════════════════════════════════════════════╗
// ║ shortCutsProgramationUpdate.repository.js — update                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './shortCutsProgramation.constants.js';
import { normalizePayload } from './shortCutsProgramation.sanitizers.js';
import { hydrateCategoryText } from './shortCutsProgramation.utils.js';
import { ensureTable } from './shortCutsProgramationSchema.repository.js';

export async function update(id, body) {
    await ensureTable();

    const p = await hydrateCategoryText(normalizePayload(body));

    if (!p.category_id && !p.category) throw new Error('category or category_id is required');
    if (!p.title) throw new Error('title is required');
    if (!p.shortcut_key) throw new Error('shortcut_key is required');
    if (!p.language) throw new Error('language is required');
    if (!p.code) throw new Error('code is required');

    const result = await pool.query(
        `
    UPDATE ${TB}
    SET
      category_id = $1,
      subcategory_id = $2,
      category = $3,
      subcategory = $4,
      title = $5,
      shortcut_key = $6,
      shortcut_type = $7,
      language = $8,
      description = $9,
      code = $10,
      code_template = $11,
      example = $12,
      observations = $13,
      tags = $14,
      difficulty = $15,
      favorite = $16,
      active = $17,
      sort_order = $18,
      updated_at = NOW()
    WHERE shortcut_id = $19
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
            id,
        ]
    );

    return result.rows[0] || null;
}
