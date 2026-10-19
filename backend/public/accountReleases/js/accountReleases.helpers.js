// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.helpers.js                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

export const ROOT_API = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8080';
  if (typeof window.getApiBase === 'function') return window.getApiBase();
  if (window.apiBase) return window.apiBase;
  if (window.API_BASE) return window.API_BASE;
  return window.location.origin;
})();

export const $ = (id) => document.getElementById(id);

export function showToast(msg) {
  const el = $('toast');
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('is-show'), 3200);
}

export function monthToCompetence(monthVal) {
  if (!monthVal) return null;
  return `${monthVal}-01`;
}

export function competenceToMonth(competence) {
  if (!competence) return '';
  return String(competence).slice(0, 7);
}

export function fmtMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'BRL' });
}

export function pad2(n) {
  const s = String(n ?? '');
  return s.length === 1 ? `0${s}` : s;
}

export function safeUpper(v) {
  return String(v || '').trim().toUpperCase();
}

export function sanitizeGcsFileName(name) {
  const base = String(name || '').trim() || 'file';
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function calcFinalAmountLocal() {
  const amount = Number($('fAmount')?.value || 0);
  const extra = Number($('fExtraCharges')?.value || 0);
  const discounts = Number($('fDiscounts')?.value || 0);
  const taxes = Number($('fTaxesAmount')?.value || 0);
  const total = amount + extra - discounts + taxes;
  return Math.max(0, Number(total.toFixed(2)));
}

export function getDisplayFileName(a) {
  const raw =
    (a?.original_file_name && String(a.original_file_name).trim()) ||
    (a?.originalFileName && String(a.originalFileName).trim()) ||
    '';

  const candidate =
    raw ||
    (a?.object_path && String(a.object_path)) ||
    (a?.objectPath && String(a.objectPath)) ||
    (a?.file_name && String(a.file_name)) ||
    (a?.fileName && String(a.fileName)) ||
    '';

  if (!candidate) return '(unnamed)';

  const base = candidate.split('/').pop() || candidate;

  const cleaned = base
    .replace(/^(\d{10,16})([_-]+)?/g, '')
    .replace(/^_+/g, '')
    .trim();

  return cleaned || base || '(unnamed)';
}

export function parseAttachmentDate(a) {
  const raw =
    a?.created_at ||
    a?.createdAt ||
    a?.uploaded_at ||
    a?.uploadedAt ||
    a?.updated_at ||
    a?.updatedAt ||
    null;

  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const name =
    (a?.object_path && String(a.object_path).split('/').pop()) ||
    (a?.objectPath && String(a.objectPath).split('/').pop()) ||
    (a?.original_file_name && String(a.original_file_name)) ||
    (a?.file_name && String(a.file_name)) ||
    '';

  const m = String(name).match(/^(\d{13})(?=[_-]|[A-Za-z0-9]|\.|$)/);
  if (m?.[1]) {
    const d = new Date(Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

export function isPdfAttachment(a) {
  const mime = String(a?.mime_type || a?.mime || '').toLowerCase();
  const name = getDisplayFileName(a).toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
}

export function openAttachment(a) {
  const url = a?.signed_url || a?.signedUrl || a?.download_url || a?.downloadUrl || '';
  if (!url) {
    showToast('No URL available for this attachment.');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}