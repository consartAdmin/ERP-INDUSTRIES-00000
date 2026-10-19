// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsSuppliersRemove.repository.js — remove vínculo             ║
// ║ Tabela: public."productsSuppliers"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './productsSuppliers.constants.js';
import { ok, fail } from './productsSuppliers.utils.js';

/* ──────────────────────────────────────────────────────────────
   remove — remove vínculo produto x fornecedor
────────────────────────────────────────────────────────────── */
export async function remove(product_supplier_id) {
  const id = Number(product_supplier_id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail('product_supplier_id inválido.', 400);
  }

  try {
    const { rowCount } = await pool.query(
      `
      DELETE FROM ${TB}
      WHERE product_supplier_id = $1
      `,
      [id]
    );

    if (rowCount === 0) {
      return fail('Vínculo não encontrado.', 404);
    }

    return ok({ product_supplier_id: id });
  } catch (err) {
    console.error('[productsSuppliersApi:remove] error:', err);
    return fail('Erro ao remover vínculo produto x fornecedor.', 500);
  }
}
