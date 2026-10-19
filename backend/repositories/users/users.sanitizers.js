// ╔════════════════════════════════════════════════════════════════════╗
// ║ users.sanitizers.js — Validação / normalização de entrada          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { COLUMNS, INDEXES, WRITABLE_COLS } from './users.constants.js';

/* ───────────────────────────── Helpers ───────────────────────────── */

export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNum = (v) => (isFiniteNum(v) ? Number(v) : null);

/**
 * Valida os dados contra o catálogo (NOT NULL e tamanho de varchar).
 * Com partial=true (update), só valida os campos enviados.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export function validate(data = {}, { partial = false } = {}) {
  for (const c of WRITABLE_COLS) {
    const col = COLUMNS[c];
    const v = data[c];

    if (v === undefined) {
      if (!partial && !col.nullable && col.default == null) return `${c} is required.`;
      continue;
    }
    if (v === null) {
      if (!col.nullable) return `${c} cannot be null.`;
      continue;
    }
    if (col.length && String(v).length > col.length) {
      return `${c} must be at most ${col.length} characters.`;
    }
  }
  return null;
}

/** Converte violação de UNIQUE (23505) em mensagem amigável */
export function uniqueViolationMessage(err) {
  if (err?.code !== '23505') return null;
  const idx = INDEXES.find((i) => i.name === err.constraint);
  if (!idx) return 'Duplicate value.';
  return `${idx.columns.join(', ')} already in use.`;
}
