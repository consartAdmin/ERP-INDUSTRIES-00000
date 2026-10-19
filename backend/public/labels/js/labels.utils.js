export const $ = (selector, root = document) => root.querySelector(selector);

export function showModal(options = {}) {
  if (typeof window.showCenterModal === 'function') {
    window.showCenterModal(options);
    return;
  }

  const text = String(options.message || '').replace(/<[^>]+>/g, '');
  window.alert(`${options.title || 'Informação'}\n\n${text}`);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function normalizeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export function extractFilename(disposition = '') {
  const utf8 = disposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]).replace(/["']/g, '').trim();

  const ascii =
    disposition.match(/filename\s*=\s*"([^"]+)"/i) ||
    disposition.match(/filename\s*=\s*([^;]+)/i);
  return ascii?.[1] ? ascii[1].replace(/["']/g, '').trim() : null;
}

export function defaultPdfName(templateSlug = 'labels') {
  const template = String(templateSlug)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .toLowerCase();
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  return `labels_${template}_${stamp}.pdf`;
}

export function downloadBlob(objectUrl, fileName) {
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'labels.pdf';
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

