// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.form.js                                       ║
// ║ MODULE: Senhas dos Módulos — Form                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { $, normalizeCode } from './modulePasswords.utils.js';

function setCodesReadonly(readonly) {
  ['#module_code', '#action_code'].forEach((selector) => {
    const input = $(selector);
    input.readOnly = readonly;
    input.classList.toggle('is-readonly', readonly);
  });
}

export function resetForm() {
  $('#passwordForm').reset();
  $('#is_active').checked = true;
  $('#passwordHelp').textContent = 'Deixe em branco para cadastrar sem senha (o módulo não pede senha).';
  setCodesReadonly(false);
}

export function fillForm(row) {
  $('#passwordForm').reset();
  $('#module_code').value = row.module_code || '';
  $('#action_code').value = row.action_code || '';
  $('#description').value = row.description || '';
  $('#is_active').checked = row.is_active !== false;
  $('#passwordHelp').textContent = row.has_password
    ? 'Deixe em branco para manter a senha atual.'
    : 'Nenhuma senha definida — o módulo não pede senha.';
  setCodesReadonly(true);
}

export function readForm() {
  return {
    module_code: normalizeCode($('#module_code').value),
    action_code: normalizeCode($('#action_code').value),
    description: $('#description').value.trim(),
    password: $('#password').value,
    password_confirm: $('#password_confirm').value,
    is_active: $('#is_active').checked,
  };
}
