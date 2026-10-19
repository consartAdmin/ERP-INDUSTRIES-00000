// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashCategories.utils.js — Helpers puros                            ║
// ╚════════════════════════════════════════════════════════════════════╝

export function isUniqueViolation(err) {
  // Postgres unique violation: 23505
  return err?.code === '23505';
}
