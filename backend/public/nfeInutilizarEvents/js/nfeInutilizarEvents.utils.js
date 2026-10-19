// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.utils.js — Helpers DOM, texto e formatação      ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* =======================================================================
 * DOM — mapeamento centralizado de elementos
 * ======================================================================= */
export function getElements() {
  const byId = (id) => document.getElementById(id);

  return {
    formInutilizacao: byId('formInutilizacao'),
    formFiltros: byId('formFiltros'),

    companyCnpj: byId('companyCnpj'),
    model: byId('model'),
    serie: byId('serie'),
    numberStart: byId('numberStart'),
    numberEnd: byId('numberEnd'),
    year: byId('year'),
    justification: byId('justification'),

    filterStatus: byId('filterStatus'),
    filterModel: byId('filterModel'),
    filterSerie: byId('filterSerie'),
    filterYear: byId('filterYear'),
    filterNumber: byId('filterNumber'),
    filterProtocol: byId('filterProtocol'),
    filterCompanyCnpj: byId('filterCompanyCnpj'),

    btnSubmit: byId('btnSubmit'),
    btnRefresh: byId('btnRefresh'),
    btnLimparForm: byId('btnLimparForm'),
    btnLimparFiltros: byId('btnLimparFiltros'),

    tbodyInutilizacoes: byId('tbodyInutilizacoes'),
    detailsPanel: byId('detailsPanel'),
    detailTitleBadge: byId('detailTitleBadge'),

    feedback: byId('feedback'),
    tableStatus: byId('tableStatus'),
    totalRows: byId('totalRows'),

    summaryRange: byId('summaryRange'),
    summaryTotal: byId('summaryTotal'),
    justificationCounter: byId('justificationCounter'),
  };
}

/* =======================================================================
 * Strings / números
 * ======================================================================= */
export function onlyDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function toInt(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function truncate(value, max = 60) {
  const text = String(value ?? '');
  const limit = Number.isFinite(Number(max)) ? Number(max) : 60;

  if (limit <= 0) return '';
  if (text.length <= limit) return text;
  if (limit <= 3) return '.'.repeat(limit);

  return `${text.slice(0, limit - 3)}...`;
}

/* =======================================================================
 * CNPJ
 * ======================================================================= */
export function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return '';

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/* =======================================================================
 * Datas
 * ======================================================================= */
export function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

/* =======================================================================
 * JSON
 * ======================================================================= */
export function prettyJson(value) {
  if (value == null) return 'null';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

export function safeJsonString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}

export function getMessageText(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
