// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsSubcategories.repository.js — CRUD subcategorias      ║
// ║ Tabela: "cashSubcategories"                                        ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q } from './cashMoviments.utils.js';
import { toBool } from './cashMoviments.sanitizers.js';

/* =========================================================================
   SUBCATEGORIAS
============================================================================*/

export async function listSubcategorias({ categoria_id, category_id } = {}) {
  const params = [];
  let where = '';

  const finalCategoryId = category_id ?? categoria_id;

  if (finalCategoryId) {
    where = ' WHERE category_id = $1 ';
    params.push(Number(finalCategoryId));
  }

  const res = await q(
    `
    SELECT
      id,
      category_id,
      category_id AS categoria_id,
      name,
      name AS nome,
      is_active,
      is_deductible,
      dre_type,
      dre_type AS dre_tipo,
      created_at,
      updated_at
    FROM "cashSubcategories"
    ${where}
    ORDER BY name ASC
    `,
    params
  );

  return res.rows;
}

export async function createSubcategoria({
  categoria_id,
  category_id,
  nome,
  name,
  is_active = true,
  is_deductible = true,
  dre_tipo = null,
  dre_type = null,
}) {
  const finalCategoryId = category_id ?? categoria_id;
  const finalName = name ?? nome;
  const finalDreType = dre_type ?? dre_tipo;

  const res = await q(
    `
    INSERT INTO "cashSubcategories"
    (
      category_id,
      name,
      is_active,
      is_deductible,
      dre_type
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      category_id,
      category_id AS categoria_id,
      name,
      name AS nome,
      is_active,
      is_deductible,
      dre_type,
      dre_type AS dre_tipo,
      created_at,
      updated_at
    `,
    [
      Number(finalCategoryId),
      finalName,
      is_active,
      is_deductible ?? true,
      finalDreType,
    ]
  );

  return res.rows[0];
}

export async function updateSubcategoria(id, {
  categoria_id,
  category_id,
  nome,
  name,
  is_active,
  is_deductible,
  dre_tipo,
  dre_type,
} = {}) {
  const sets = [];
  const params = [];
  let i = 1;

  const finalCategoryId = category_id ?? categoria_id;
  const finalName = name ?? nome;
  const finalDreType = dre_type ?? dre_tipo;

  if (finalCategoryId !== undefined) {
    sets.push(`category_id = $${i++}`);
    params.push(Number(finalCategoryId));
  }

  if (finalName !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(finalName);
  }

  if (is_active !== undefined) {
    sets.push(`is_active = $${i++}`);
    params.push(is_active);
  }

  if (is_deductible !== undefined) {
    sets.push(`is_deductible = $${i++}`);
    params.push(is_deductible === null ? null : toBool(is_deductible, true));
  }

  if (finalDreType !== undefined) {
    sets.push(`dre_type = $${i++}`);
    params.push(finalDreType || null);
  }

  if (!sets.length) {
    const res = await q(
      `
      SELECT
        id,
        category_id,
        category_id AS categoria_id,
        name,
        name AS nome,
        is_active,
        is_deductible,
        dre_type,
        dre_type AS dre_tipo,
        created_at,
        updated_at
      FROM "cashSubcategories"
      WHERE id = $1
      `,
      [Number(id)]
    );

    return res.rows[0] || null;
  }

  sets.push('updated_at = now()');

  const sql = `
    UPDATE "cashSubcategories"
    SET ${sets.join(', ')}
    WHERE id = $${i}
    RETURNING
      id,
      category_id,
      category_id AS categoria_id,
      name,
      name AS nome,
      is_active,
      is_deductible,
      dre_type,
      dre_type AS dre_tipo,
      created_at,
      updated_at
  `;

  const res = await q(sql, [...params, Number(id)]);
  return res.rows[0] || null;
}

export async function deleteSubcategoria(id) {
  const res = await q(
    `DELETE FROM "cashSubcategories" WHERE id = $1 RETURNING id`,
    [Number(id)]
  );

  return res.rowCount > 0;
}

export async function listSubcategoriasByCategoria({
  categoria_id,
  category_id,
  incluirInativos = true,
} = {}) {
  const finalCategoryId = category_id ?? categoria_id;
  const catId = Number(finalCategoryId);

  if (!Number.isFinite(catId)) throw new Error('categoria_id inválido');

  const inc = toBool(incluirInativos, true);

  const sql = inc
    ? `
      SELECT
        id,
        category_id,
        category_id AS categoria_id,
        name,
        name AS nome,
        is_active,
        is_deductible,
        dre_type,
        dre_type AS dre_tipo,
        created_at,
        updated_at
      FROM "cashSubcategories"
      WHERE category_id = $1
      ORDER BY name ASC
    `
    : `
      SELECT
        id,
        category_id,
        category_id AS categoria_id,
        name,
        name AS nome,
        is_active,
        is_deductible,
        dre_type,
        dre_type AS dre_tipo,
        created_at,
        updated_at
      FROM "cashSubcategories"
      WHERE category_id = $1
        AND is_active = true
      ORDER BY name ASC
    `;

  const res = await q(sql, [catId]);
  return res.rows;
}

export async function setSubcategoriaActive(id, { is_active } = {}) {
  const _id = Number(id);
  if (!Number.isFinite(_id)) throw new Error('id inválido');

  const ativo = toBool(is_active, true);

  const res = await q(
    `
    UPDATE "cashSubcategories"
    SET is_active = $1,
        updated_at = now()
    WHERE id = $2
    RETURNING
      id,
      category_id,
      category_id AS categoria_id,
      name,
      name AS nome,
      is_active,
      is_deductible,
      dre_type,
      dre_type AS dre_tipo,
      created_at,
      updated_at
    `,
    [ativo, _id]
  );

  return res.rows[0] || null;
}
