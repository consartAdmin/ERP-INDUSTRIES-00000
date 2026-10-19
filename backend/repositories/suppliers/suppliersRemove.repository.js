// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersRemove.repository.js — remove                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './suppliers.constants.js';
import { ok, fail } from './suppliers.utils.js';

/* ──────────────────────────────────────────────────────────────
   remove — remove fornecedor
────────────────────────────────────────────────────────────── */
export async function remove(id) {
  try {
    const supplierId = Number(id);
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      return fail('ID inválido', 400);
    }

    const { rowCount } = await pool.query(
      `DELETE FROM ${TB} WHERE supplier_id = $1;`,
      [supplierId]
    );

    if (rowCount === 0) {
      return fail('Fornecedor não encontrado', 404);
    }

    return ok({ supplier_id: supplierId });
  } catch (err) {
    console.error('[suppliersApi:remove] Erro:', err);

    if (err.code === '23503') {
      return fail(
        'Não é possível excluir este fornecedor porque existem registros vinculados (ex.: contas a pagar).',
        400
      );
    }

    return fail(err.message || 'Erro ao remover fornecedor', 500);
  }
}
