// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsDescriptionsRemove.repository.js — remove (DELETE físico)  ║
// ║ Tabela: public."productsDescriptions"                              ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './productsDescriptions.constants.js';

/**
 * DELETE físico (caso precise)
 */
export async function remove(id) {
  await pool.query(`DELETE FROM ${TABLE} WHERE product_description_id = $1;`, [id]);
  return true;
}
