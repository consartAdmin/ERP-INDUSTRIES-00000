// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliers.utils.js — helpers de resposta (ok / fail)                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────
   Helpers de resposta
────────────────────────────────────────────────────────────── */
export function ok(data) {
  return { ok: true, data };
}

export function fail(error, status = 400) {
  return { ok: false, error, status };
}
