// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cancelarNfe.utils.js — Helpers puros (texto, erros, datas)           ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function normalizeJustificativa(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractErrorMessage(errorData, fallback = 'Falha ao cancelar NF-e.') {
  if (!errorData) return fallback;

  if (typeof errorData === 'string') return errorData;

  return (
    errorData?.error?.message ||
    errorData?.message ||
    errorData?.mensagem ||
    fallback
  );
}

export function normalizeConsultaData(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

export function pickFirst(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return null;
}

/**
 * O PlugNotas devolve datas em dd/MM/yyyy. O frontend grava esse valor em
 * invoicesIssued.cancelled_at, entao normalizamos para ISO antes de responder.
 */
export function toIsoDate(value) {
  const text = String(value || '').trim();

  if (!text) return null;

  const [datePart, timePart] = text.split(/[ T]/);
  const parts = String(datePart || '').split('/');

  if (parts.length !== 3) return text;

  const [dia, mes, ano] = parts;

  if (dia.length !== 2 || mes.length !== 2 || ano.length !== 4) return text;

  const iso = `${ano}-${mes}-${dia}`;

  return timePart ? `${iso}T${timePart}` : iso;
}
