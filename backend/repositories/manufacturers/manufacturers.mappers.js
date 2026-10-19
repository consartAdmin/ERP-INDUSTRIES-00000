// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturers.mappers.js — Linha do banco → objeto (1:1)           ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalize(row) {
  if (!row) return null;
  return row; // mantém 1:1 com o banco — igual seus outros módulos
}
