// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userTablePreferences.constants.js — Preferências de tabela por usuário║
// ╚══════════════════════════════════════════════════════════════════════╝

export const TB = 'public."userTablePreferences"';

// table_key identifica a tela/tabela (ex.: 'products.list')
export const TABLE_KEY_PATTERN = /^[a-zA-Z0-9._-]{1,80}$/;

// Limite de tamanho do JSON salvo (evita payloads abusivos)
export const MAX_PREFS_BYTES = 64 * 1024;
