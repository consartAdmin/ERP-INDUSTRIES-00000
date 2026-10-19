// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesCommissionsFromInvoices.utils.js — Helpers numéricos          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function clampInt(n, def, min, max) {
    const x = Number(n);

    if (!Number.isFinite(x)) {
        return def;
    }

    return Math.min(max, Math.max(min, Math.trunc(x)));
}
