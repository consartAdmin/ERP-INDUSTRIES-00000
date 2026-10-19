// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliersSchema.repository.js — ensureSuppliersTable                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { SUPPLIERS_SCHEMA } from './suppliers.catalog.js';
import { TB } from './suppliers.constants.js';
import { ok, fail } from './suppliers.utils.js';

/* ──────────────────────────────────────────────────────────────
   ensureSuppliersTable — valida tabela contra o catálogo
────────────────────────────────────────────────────────────── */
export async function ensureSuppliersTable() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'suppliers';
    `);

    if (!rows.length) {
      return fail(`Tabela ${TB} não encontrada. Execute a migration correspondente.`, 500);
    }

    const existingColumns = new Set(rows.map(({ column_name }) => column_name));
    const missingColumns = SUPPLIERS_SCHEMA.selectColumns.filter(
      (column) => !existingColumns.has(column)
    );

    if (missingColumns.length) {
      return fail(
        `Tabela ${TB} incompatível com o catálogo. Colunas ausentes: ${missingColumns.join(', ')}.`,
        500
      );
    }

    console.log(`[suppliersApi] ${TB} validada pelo catálogo (${SUPPLIERS_SCHEMA.columns.length} colunas).`);
    return ok({ table: TB, columns: SUPPLIERS_SCHEMA.columns.length });
  } catch (err) {
    console.error('[suppliersApi] Erro ao validar tabela suppliers:', err);
    return fail(err.message || 'Erro ao validar tabela suppliers', 500);
  }
}
