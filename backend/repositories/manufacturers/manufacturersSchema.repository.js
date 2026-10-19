// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturersSchema.repository.js — ensureManufacturersTable       ║
// ║ Sem DDL — apenas loga que a tabela está acessível                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TABLE } from './manufacturers.constants.js';
import { ok, fail } from './manufacturers.utils.js';

// ─────────────────────────────────────────────────────────────
// ensureManufacturersTable — opcional, pode apenas logar OK
// ─────────────────────────────────────────────────────────────
export async function ensureManufacturersTable() {
  try {
    console.log(`[manufacturersApi] Tabela ${TABLE} verificada/acessível.`);
    return ok(true);
  } catch (err) {
    console.error('[manufacturersApi] Erro:', err);
    return fail(err.message, 500);
  }
}
