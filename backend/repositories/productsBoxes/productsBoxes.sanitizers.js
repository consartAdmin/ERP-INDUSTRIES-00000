// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsBoxes.sanitizers.js — normalização de entrada / ORDER BY   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function asBool(v) {
  if (v === true || v === false) return v;
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 't', 'yes', 'y', 'sim'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;
  return null;
}

export function asNum(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function safeStr(v, max = 255) {
  return String(v ?? '').trim().slice(0, max);
}

/** ORDER BY seguro */
export function parseOrder(orderBy, allowed = []) {
  if (!orderBy) return '';
  const [col, dirRaw] = String(orderBy).trim().split(/\s+/);
  const colSafe = allowed.includes(col) ? col : null;
  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? dirRaw.toUpperCase() : 'ASC';
  return colSafe ? ` ORDER BY ${colSafe} ${dir} ` : '';
}

export function ensureInt(v, def = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function ensureBoxId(box_id) {
  const id = ensureInt(box_id, NaN);
  if (!Number.isFinite(id)) {
    const err = new Error('invalid box_id');
    err.status = 400;
    throw err;
  }
  return id;
}
