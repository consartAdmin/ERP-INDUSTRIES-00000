// ╔════════════════════════════════════════════════════════════════════╗
// ║ users.mappers.js — Linha do banco → objeto de domínio              ║
// ╚════════════════════════════════════════════════════════════════════╝

import { ALL_COLS } from './users.constants.js';

/** Mapeia a linha crua do banco para o objeto de domínio (colunas do catálogo) */
export function mapRow(r = {}) {
  const out = {};
  for (const c of ALL_COLS) out[c] = r[c];
  return out;
}
