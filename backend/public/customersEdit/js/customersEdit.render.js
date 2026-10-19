// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.render.js — Renderização | PRODNEX ERP                ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

export function renderSelectOptions(select, rows = [], { valueKey = 'id', labelKey = 'name' } = {}) {
  if (!select) return;
  const current = String(select.value || '');
  const options = rows.map((row) => {
    const option = document.createElement('option');
    option.value = row[valueKey] ?? '';
    option.textContent = row[labelKey] ?? row.name ?? row.description ?? option.value;
    return option;
  });
  select.replaceChildren(...options);
  if (current) select.value = current;
}

export function setFormBusy(form, busy) {
  if (!form) return;
  form.setAttribute('aria-busy', String(Boolean(busy)));
  form.querySelectorAll('button, input, select, textarea').forEach((element) => {
    if (element.dataset.keepEnabled !== 'true') element.disabled = Boolean(busy);
  });
}
