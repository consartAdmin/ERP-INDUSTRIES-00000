// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsGroups.utils.js — Helpers de erro do Postgres              ║
// ╚════════════════════════════════════════════════════════════════════╝

export const uniqueViolation = (err) => err && err.code === '23505';
