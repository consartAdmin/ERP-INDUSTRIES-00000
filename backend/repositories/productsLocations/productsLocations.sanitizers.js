// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocations.sanitizers.js — Normalização de entrada            ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const toBool = (v, def = true) =>
  (typeof v === 'boolean') ? v :
    (v == null ? def : String(v).match(/^(1|true|t|yes|y)$/i) != null);
