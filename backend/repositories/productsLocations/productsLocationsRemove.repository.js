// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocationsRemove.repository.js — remove (DELETE físico)       ║
// ║ Tabela: public."productsLocations"                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_PRODUCTS } from './productsLocations.constants.js';
import { normalizeRow } from './productsLocations.mappers.js';

export async function remove(id) {
  // aqui não precisa join
  const { rows } = await pool.query(
    `DELETE FROM ${TB}
      WHERE id = $1
      RETURNING *;`,
    [id]
  );
  if (rows[0]) await clearPrimaryIfMatches(id);
  return rows[0] ? normalizeRow(rows[0]) : null;
}

/** Se a localização era a principal de algum produto, desfaz o vínculo (0 = sem localização) */
export async function clearPrimaryIfMatches(id) {
  await pool.query(
    `UPDATE ${TB_PRODUCTS} SET product_location_id = 0 WHERE product_location_id = $1;`,
    [id]
  );
}
