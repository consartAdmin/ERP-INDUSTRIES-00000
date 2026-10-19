// ╔════════════════════════════════════════════════════════════════════╗
// ║ modulePasswords.constants.js — Tabela e regras das senhas          ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."modulePasswords"';

// Custo do bcrypt para o hash das senhas
export const BCRYPT_ROUNDS = 10;

// Tamanho mínimo da senha
export const PASSWORD_MIN_LENGTH = 4;

// Códigos de módulo/ação: MAIÚSCULAS, números e "_"
export const CODE_RE = /^[A-Z0-9_]{2,60}$/;
