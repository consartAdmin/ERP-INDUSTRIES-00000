// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.utils.js — DOM, formatação e alertas fiscais         ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const $ = (id) => document.getElementById(id);

export function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

export function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function dateBR(value) {
  if (!value) return '—';

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);

  return d.toLocaleDateString('pt-BR');
}

export function toDateInput(value) {
  if (!value) return '';

  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return d.toISOString().slice(0, 10);
}

export function safe(value, fallback = '—') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  return Number(
    String(value)
      .replace('R$', '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  ) || 0;
}

const MESSAGE_KEYS = new Set([
  'message', 'mensagem', 'error', 'erro', 'detail', 'details', 'detalhe',
  'motivo', 'xmotivo', 'reason', 'description', 'descricao',
]);

const COLLECTION_KEYS = new Set([
  'errors', 'erros', 'warnings', 'avisos', 'rejections', 'rejeicoes',
  'failures', 'falhas', 'skipped', 'ignorados', 'issues', 'problemas',
  'validationerrors', 'validation_errors',
]);

const CODE_KEYS = new Set([
  'cstat', 'code', 'codigo', 'statuscode', 'status_code', 'httpstatus',
]);

function clean(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  return '';
}

function normalizedKey(key) {
  return String(key || '').replace(/[\s-]/g, '').toLowerCase();
}

function inferSeverity(text, fallback = 'error') {
  const value = String(text || '').toUpperCase();
  if (/AUTORIZAD|CONCLUID|SUCESS|IMPORTAD/.test(value)) return 'success';
  if (/PROCESS|PENDENTE|AGUARD|AVISO|WARNING/.test(value)) return 'warning';
  return fallback;
}

function pushUnique(alerts, alert, seen) {
  const message = clean(alert.message);
  if (!message) return;

  const code = clean(alert.code);
  const orderId = clean(alert.orderId);
  const key = `${code}|${orderId}|${message}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);

  alerts.push({
    severity: alert.severity || inferSeverity(message),
    code: code || null,
    orderId: orderId || null,
    message,
  });
}

function objectCode(value) {
  if (!value || typeof value !== 'object') return '';
  for (const [key, item] of Object.entries(value)) {
    if (CODE_KEYS.has(normalizedKey(key))) {
      const code = clean(item);
      if (code) return code;
    }
  }
  return '';
}

function objectOrder(value) {
  return clean(
    value?.order_id ?? value?.orderId ?? value?.pedido ??
    value?.order_number ?? value?.numeroPedido,
  );
}

function visit(value, context, alerts, seenAlerts, seenObjects) {
  if (value == null) return;

  if (typeof value === 'string' || typeof value === 'number') {
    pushUnique(alerts, { ...context, message: value }, seenAlerts);
    return;
  }

  if (typeof value !== 'object' || seenObjects.has(value)) return;
  seenObjects.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => visit(item, context, alerts, seenAlerts, seenObjects));
    return;
  }

  const local = {
    ...context,
    code: objectCode(value) || context.code,
    orderId: objectOrder(value) || context.orderId,
  };

  for (const [key, item] of Object.entries(value)) {
    const nk = normalizedKey(key);
    if (MESSAGE_KEYS.has(nk)) {
      if (typeof item === 'object') {
        visit(item, local, alerts, seenAlerts, seenObjects);
      } else {
        pushUnique(alerts, { ...local, message: item }, seenAlerts);
      }
    }
  }

  for (const [key, item] of Object.entries(value)) {
    const nk = normalizedKey(key);
    if (COLLECTION_KEYS.has(nk)) {
      visit(item, local, alerts, seenAlerts, seenObjects);
    }
  }

  // Provider envelopes are not stable (`data.remote`, `response.body`, etc.).
  // Continue through unknown nested containers so future error shapes are not
  // silently reduced to "erro desconhecido".
  for (const [key, item] of Object.entries(value)) {
    const nk = normalizedKey(key);
    if (
      item && typeof item === 'object' &&
      !MESSAGE_KEYS.has(nk) && !COLLECTION_KEYS.has(nk)
    ) {
      visit(item, local, alerts, seenAlerts, seenObjects);
    }
  }
}

export function extractAlerts(payload, options = {}) {
  const alerts = [];
  const seenAlerts = new Set();
  const seenObjects = new WeakSet();
  const severity = options.severity || 'error';

  if (payload == null) return alerts;

  // A failed root response may keep its useful message directly at the root.
  if (payload?.ok === false || options.includeRoot === true) {
    visit(payload, { severity }, alerts, seenAlerts, seenObjects);
  } else if (typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      if (COLLECTION_KEYS.has(normalizedKey(key))) {
        visit(value, { severity }, alerts, seenAlerts, seenObjects);
      }
    }
  }

  return alerts;
}

export function formatAlertTitle(alert) {
  const parts = [];
  if (alert.orderId) parts.push(`Pedido ${alert.orderId}`);
  if (alert.code) parts.push(`cStat ${alert.code}`);
  return parts.join(' · ');
}
