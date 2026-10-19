// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.form.js — Form colaborador: reset/fill/payload (CONSART | ESM)     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { el } from './employees.dom.js';
import { state } from './employees.state.js';
import { safeStr, toBool } from './employees.utils.js';
import { enableDetailsTabIfNeeded } from './employees.view.js';
import { renderDocsTable } from './employees.render.js';

export function resetEmployeeForm(keepSelection = false) {
  el.form.reset();
  el.employee_id.value = keepSelection ? safeStr(state.selectedId || '') : '';
  el.active.checked = true;

  el.trial_extended.checked = false;
  el.advDetails.open = false;

  const hasSel = Boolean(state.selectedId);
  el.btnInactivateEmployee.disabled = !hasSel;
  el.btnHardDeleteEmployee.disabled = !hasSel;

  // docs form disabled until select
  el.docForm.querySelectorAll('input,select,button').forEach((x) => {
    if (x.id === 'btnClearDocForm') return;
    x.disabled = !hasSel;
  });

  enableDetailsTabIfNeeded();

  if (!hasSel) renderDocsTable([]);
}

export function fillEmployeeForm(r) {
  el.employee_id.value = safeStr(r.employee_id);
  el.full_name.value = safeStr(r.full_name);
  el.cpf.value = safeStr(r.cpf);
  el.rg.value = safeStr(r.rg);
  el.admission_date.value = r.admission_date ? String(r.admission_date).slice(0,10) : '';

  el.department.value = safeStr(r.department);
  el.position.value = safeStr(r.position);
  el.email.value = safeStr(r.email);
  el.phone.value = safeStr(r.phone);
  el.mobile.value = safeStr(r.mobile);

  el.active.checked = toBool(r.active);

  // advanced
  el.trial_start_date.value = r.trial_start_date ? String(r.trial_start_date).slice(0,10) : '';
  el.trial_end_date.value = r.trial_end_date ? String(r.trial_end_date).slice(0,10) : '';
  el.trial_extended.checked = toBool(r.trial_extended);
  el.trial_extension_end_date.value = r.trial_extension_end_date ? String(r.trial_extension_end_date).slice(0,10) : '';
  el.trial_notes.value = safeStr(r.trial_notes);

  el.transport_benefit.value = safeStr(r.transport_benefit ?? '');
  el.food_benefit.value = safeStr(r.food_benefit ?? '');
  el.meal_benefit.value = safeStr(r.meal_benefit ?? '');
  el.health_benefit.value = safeStr(r.health_benefit ?? '');

  el.address.value = safeStr(r.address);
  el.city.value = safeStr(r.city);
  el.state.value = safeStr(r.state);
  el.postal_code.value = safeStr(r.postal_code);

  el.notes.value = safeStr(r.notes);

  el.btnInactivateEmployee.disabled = false;
  el.btnHardDeleteEmployee.disabled = false;

  // enable docs
  el.docForm.querySelectorAll('input,select,button').forEach((x) => {
    if (x.id === 'btnClearDocForm') return;
    x.disabled = false;
  });

  el.selectedEmployeeHint.textContent = `Editando colaborador #${r.employee_id} — ${safeStr(r.full_name)}`;

  enableDetailsTabIfNeeded();
}

export function currentEmployeePayload() {
  return {
    full_name: el.full_name.value.trim(),
    cpf: el.cpf.value.trim(),
    rg: el.rg.value.trim() || null,

    admission_date: el.admission_date.value || null,
    department: el.department.value.trim() || null,
    position: el.position.value.trim() || null,

    email: el.email.value.trim() || null,
    phone: el.phone.value.trim() || null,
    mobile: el.mobile.value.trim() || null,

    active: el.active.checked,

    // advanced
    trial_start_date: el.trial_start_date.value || null,
    trial_end_date: el.trial_end_date.value || null,
    trial_extended: el.trial_extended.checked,
    trial_extension_end_date: el.trial_extension_end_date.value || null,
    trial_notes: el.trial_notes.value.trim() || null,

    transport_benefit: el.transport_benefit.value === '' ? null : Number(el.transport_benefit.value),
    food_benefit: el.food_benefit.value === '' ? null : Number(el.food_benefit.value),
    meal_benefit: el.meal_benefit.value === '' ? null : Number(el.meal_benefit.value),
    health_benefit: el.health_benefit.value === '' ? null : Number(el.health_benefit.value),

    address: el.address.value.trim() || null,
    city: el.city.value.trim() || null,
    state: el.state.value.trim() || null,
    postal_code: el.postal_code.value.trim() || null,

    notes: el.notes.value.trim() || null,
  };
}