// ╔════════════════════════════════════════════════════════════════════╗
// ║ units.sanitizers.js — Validação/conversão de entrada               ║
// ╚════════════════════════════════════════════════════════════════════╝

export const notEmpty = (s) => typeof s === 'string' && s.trim().length > 0;
export const toInt = (v, def = null) => (v === undefined || v === null || v === '' ? def : parseInt(v, 10));
export const toNum = (v, def = null) => (v === undefined || v === null || v === '' ? def : Number(v));
