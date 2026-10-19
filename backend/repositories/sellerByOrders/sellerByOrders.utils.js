// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrders.utils.js — Helpers de resposta ok/bad               ║
// ╚════════════════════════════════════════════════════════════════════╝

export const ok = (data = {}) => ({ ok: true, ...data });
export const bad = (error, extra = {}) => ({ ok: false, error, ...extra });
