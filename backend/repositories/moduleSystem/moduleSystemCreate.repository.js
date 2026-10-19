// ╔════════════════════════════════════════════════════════════════════╗
// ║ moduleSystemCreate.repository.js — create                          ║
// ║ Tabela: public."moduleSystem"                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE, COLUMNS } from './moduleSystem.constants.js';
import { q } from './moduleSystem.utils.js';

/**
 * Cria novo módulo.
 * Sem sort_order informado, o item vai para o fim dos irmãos (máx. + 10).
 */
export async function create({
  name,
  path,
  is_active = true,
  menu_type = null,
  parent_id = null,
  sort_order = null,
  html_id = null,
  css_class = null,
  feature = null,
  is_external = false,
  is_public = false,
}) {
  const { rows } = await q(
    `
    INSERT INTO ${TABLE} (
      name, path, is_active, menu_type, parent_id, sort_order,
      html_id, css_class, feature, is_external, is_public
    )
    VALUES (
      $1, $2, $3, $4, $5::bigint,
      COALESCE($6::int, (
        SELECT COALESCE(MAX(sort_order), 0) + 10
        FROM ${TABLE}
        WHERE parent_id IS NOT DISTINCT FROM $5::bigint
      )),
      $7, $8, $9, $10, $11
    )
    RETURNING ${COLUMNS};
  `,
    [
      name, path, !!is_active, menu_type, parent_id, sort_order,
      html_id, css_class, feature, !!is_external, !!is_public,
    ]
  );
  return rows[0];
}
