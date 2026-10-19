// ╔══════════════════════════════════════════════════════════════════════╗
// ║ priceCommissions.utils.js — Utilitários | PRODNEX ERP               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function showToast(message) {
  const toast = document.getElementById('toast');

  if (!toast) {
    window.alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.remove('hidden');

  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatCommissionType(type) {
  return type === 'FIXED' ? 'Fixo (R$)' : 'Percentual (%)';
}

export function formatCommissionValue(row = {}) {
  if (row.commission_type === 'FIXED') {
    return Number(row.fixed_value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  return `${Number(row.percent_value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  })}%`;
}

export function formatValidity(row = {}) {
  const from = row.valid_from ? String(row.valid_from).slice(0, 10) : '';
  const to = row.valid_to ? String(row.valid_to).slice(0, 10) : '';
  return to ? `${from} → ${to}` : `${from} → (aberto)`;
}

export function todayYmd() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function fillSelect(
  select,
  rows,
  { valueKey, labelKey, firstLabel = 'Todos' } = {}
) {
  if (!select) return;

  select.innerHTML = '';

  if (firstLabel !== null) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = firstLabel;
    select.appendChild(option);
  }

  for (const row of rows || []) {
    const option = document.createElement('option');
    option.value = row[valueKey];
    option.textContent = row[labelKey];
    select.appendChild(option);
  }
}

