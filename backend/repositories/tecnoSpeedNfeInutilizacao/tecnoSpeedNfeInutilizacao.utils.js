// ╔══════════════════════════════════════════════════════════════════╗
// ║ tecnoSpeedNfeInutilizacao.utils.js — helpers puros               ║
// ║ onlyDigits, isNum, normalizeStatus, normAxiosError, cryptoRandom ║
// ╚══════════════════════════════════════════════════════════════════╝

export function onlyDigits(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

export function isNum(v) {
  return /^[0-9]+$/.test(String(v ?? ''));
}

export function normalizeStatus(s) {
  return String(s || '').trim().toUpperCase();
}

export function normAxiosError(err) {
  const status = err?.response?.status || 0;
  const data = err?.response?.data;
  const msg =
    (typeof data === 'string' && data) ||
    data?.message ||
    data?.erro ||
    err?.message ||
    'Erro inesperado';
  return { status, message: msg, data };
}

// Helpers: UUID simples para MOCK (sem depender de libs)
export function cryptoRandom() {
  // fallback simples (não-críptico) só para MOCK
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}
