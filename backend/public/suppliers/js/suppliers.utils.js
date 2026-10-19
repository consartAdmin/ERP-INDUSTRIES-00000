import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
export const qs = (selector, root = document) => root.querySelector(selector);
export function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
export function cleanValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim(); return normalized || null;
}
export const onlyDigits = (value = '') => String(value).replace(/\D+/g, '');
export function formatCnpj(value = '') {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
export function formatCep(value = '') {
  const d = onlyDigits(value).slice(0, 8); return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
export function buildLegacyAddress(payload = {}) {
  const street = [cleanValue(payload.address_street_type), cleanValue(payload.address_street)].filter(Boolean).join(' ');
  const parts = [street, ...['address_number', 'address_complement', 'address_district']
    .map((key) => cleanValue(payload[key]))].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}
export async function showToast(message, variant = 'info') {
  try {
    await showCenterModal({
      variant, title: { success: 'Sucesso', error: 'Erro', warning: 'Atenção' }[variant] || 'Informação',
      message, timeoutMs: variant === 'success' ? 2500 : null, buttons: [{ label: 'OK', variant: 'ok' }],
    });
  } catch { window.alert(message); }
}
export async function askConfirm(message, title = 'Confirmar') {
  try {
    return (await showCenterModal({
      variant: 'warning', title, message, timeoutMs: null,
      buttons: [{ label: 'Cancelar', variant: 'cancel', action: () => false },
        { label: 'Confirmar', variant: 'ok', action: () => true }],
    })) === true;
  } catch { return window.confirm(message); }
}
