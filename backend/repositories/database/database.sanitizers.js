// ╔════════════════════════════════════════════════════════════════════╗
// ║ database.sanitizers.js — Validação de identificadores SQL          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { BLOCKED_TABLES } from './database.constants.js';

export function assertSafeIdentifier(value, label = 'identificador') {
  const v = String(value || '').trim();

  if (!v) {
    const err = new Error(`${label} obrigatório.`);
    err.status = 400;
    throw err;
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v)) {
    const err = new Error(`${label} inválido: ${v}`);
    err.status = 400;
    throw err;
  }

  return v;
}

export function quoteIdent(value) {
  const safe = assertSafeIdentifier(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

// Para objetos que JÁ EXISTEM no catálogo (ex.: constraint ".productsPrices_price_id_fkey").
// Só use depois de confirmar que o nome existe; nomes novos passam por quoteIdent.
export function quoteExistingIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function assertTableAllowed(tableName) {
  const safeTable = assertSafeIdentifier(tableName, 'Tabela');

  if (BLOCKED_TABLES.has(safeTable)) {
    const err = new Error(`Tabela bloqueada por segurança: ${safeTable}`);
    err.status = 403;
    throw err;
  }

  return safeTable;
}
