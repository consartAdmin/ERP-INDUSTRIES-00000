// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsCategories.repository.js — CRUD de categorias         ║
// ║ Tabela: "cashCategories"                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './cashMoviments.utils.js';
import { toBool } from './cashMoviments.sanitizers.js';

/* =========================================================================
   CATEGORIAS
============================================================================*/

export async function listCategorias() {
  const res = await q(
    `
    SELECT
      id,
      name,
      name AS nome,
      is_active,
      created_at,
      updated_at
    FROM "cashCategories"
    ORDER BY name ASC
    `
  );

  return res.rows;
}

export async function createCategoria({ nome, name, is_active = true }) {
  const finalName = name ?? nome;

  const res = await q(
    `
    INSERT INTO "cashCategories" (name, is_active)
    VALUES ($1, $2)
    RETURNING
      id,
      name,
      name AS nome,
      is_active,
      created_at,
      updated_at
    `,
    [finalName, is_active]
  );

  return res.rows[0];
}

export async function updateCategoria(id, { nome, name, is_active } = {}) {
  const sets = [];
  const params = [];
  let i = 1;

  const finalName = name ?? nome;

  if (finalName !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(finalName);
  }

  if (is_active !== undefined) {
    sets.push(`is_active = $${i++}`);
    params.push(is_active);
  }

  if (!sets.length) {
    const res = await q(
      `
      SELECT
        id,
        name,
        name AS nome,
        is_active,
        created_at,
        updated_at
      FROM "cashCategories"
      WHERE id = $1
      `,
      [Number(id)]
    );

    return res.rows[0] || null;
  }

  sets.push('updated_at = now()');

  const sql = `
    UPDATE "cashCategories"
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING
      id,
      name,
      name AS nome,
      is_active,
      created_at,
      updated_at
  `;

  const res = await q(sql, [...params, Number(id)]);
  return res.rows[0] || null;
}

export async function deleteCategoria(id) {
  await q(`DELETE FROM "cashSubcategories" WHERE category_id = $1`, [Number(id)]);

  const res = await q(
    `DELETE FROM "cashCategories" WHERE id = $1 RETURNING id`,
    [Number(id)]
  );

  return res.rowCount > 0;
}

export async function setCategoriaActive(id, { is_active } = {}) {
  const _id = Number(id);
  if (!Number.isFinite(_id)) throw new Error('id inválido');

  const ativo = toBool(is_active, true);

  const res = await q(
    `
    UPDATE "cashCategories"
    SET is_active = $1,
        updated_at = now()
    WHERE id = $2
    RETURNING
      id,
      name,
      name AS nome,
      is_active,
      created_at,
      updated_at
    `,
    [ativo, _id]
  );

  return res.rows[0] || null;
}
