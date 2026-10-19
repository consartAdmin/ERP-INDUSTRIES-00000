// ╔════════════════════════════════════════════════════════════╗
// ║ units.form.js — Formulário de Unidades                       ║
// ╚════════════════════════════════════════════════════════════╝

import { state } from './units.state.js';
import { validateUnitForm } from './units.validation.js';

export function getFormData() {
  const { inputUnit, inputDescription, inputFator, inputIsActive } = state.refs;

  return {
    unit: inputUnit?.value ?? '',
    description: inputDescription?.value ?? '',
    fator: inputFator?.value ?? '1',
    is_active: Boolean(inputIsActive?.checked),
  };
}

export function validateForm() {
  return validateUnitForm(getFormData());
}

export function fillForm(row = {}) {
  const {
    inputId,
    inputUnit,
    inputDescription,
    inputFator,
    inputIsActive,
  } = state.refs;

  if (inputId) inputId.value = row.id ?? row.unit_id ?? '';
  if (inputUnit) inputUnit.value = row.unit ?? '';
  if (inputDescription) inputDescription.value = row.description ?? '';
  if (inputFator) inputFator.value = row.fator ?? 1;
  if (inputIsActive) inputIsActive.checked = row.is_active !== false;
}

export function clearForm() {
  fillForm({
    id: '',
    unit: '',
    description: '',
    fator: 1,
    is_active: true,
  });
}

export function setFormMessage(message = '', type = 'error') {
  const el = state.refs.formMessage;
  if (!el) return;

  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.className = 'units-form-message';
    return;
  }

  el.hidden = false;
  el.textContent = message;
  el.className = `units-form-message is-${type}`;
}
