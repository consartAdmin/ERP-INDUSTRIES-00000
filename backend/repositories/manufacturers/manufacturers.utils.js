// ╔════════════════════════════════════════════════════════════════════╗
// ║ manufacturers.utils.js — Envelopes de retorno { ok, ... }          ║
// ╚════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────
// HELPERS PADRONIZADOS
// ─────────────────────────────────────────────────────────────
export function ok(data) {
  return { ok: true, data };
}
export function fail(error, status = 400) {
  return { ok: false, error, status };
}
