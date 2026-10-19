// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: modulePasswords.actions.js                                    ║
// ║ MODULE: Senhas dos Módulos — Actions                                ║
// ║ Load, save, clear password and delete                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  clearModulePassword,
  createModulePassword,
  deleteModulePassword,
  fetchModulePasswords,
  updateModulePassword,
} from './modulePasswords.api.js';
import { HOME_URL } from './modulePasswords.config.js';
import { readForm } from './modulePasswords.form.js';
import {
  closeModal,
  confirmAction,
  openEditModal,
  openNewModal,
  showError,
  showSuccess,
  showValidation,
} from './modulePasswords.modal.js';
import { renderTable } from './modulePasswords.render.js';
import { state } from './modulePasswords.state.js';
import { $ } from './modulePasswords.utils.js';
import { validateForm } from './modulePasswords.validation.js';

export async function loadAndRender() {
  try {
    state.rows = (await fetchModulePasswords()) || [];
  } catch (error) {
    console.error('[modulePasswords.load]', error);
    state.rows = [];
    showError('Senhas dos Módulos', error?.message || 'Não foi possível carregar as senhas.');
  }
  renderTable();
}

function findRow(id) {
  return state.rows.find((row) => String(row.module_password_id) === String(id));
}

export function bindActions() {
  $('#btnNew')?.addEventListener('click', openNewModal);
  $('#btnReload')?.addEventListener('click', () => void loadAndRender());
  $('#btnBack')?.addEventListener('click', () => {
    location.href = HOME_URL;
  });

  $('#q')?.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderTable();
  });

  $('#btnCloseModal')?.addEventListener('click', closeModal);
  $('#btnCancelModal')?.addEventListener('click', closeModal);
  $('#passwordModalBackdrop')?.addEventListener('click', closeModal);
  $('#passwordForm')?.addEventListener('submit', onSave);

  $('#tbody')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-edit], button[data-clear], button[data-delete]');
    if (!button) return;

    const { edit, clear, delete: remove } = button.dataset;
    if (edit) {
      const row = findRow(edit);
      if (row) openEditModal(row);
    } else if (clear) {
      void onClearPassword(clear);
    } else if (remove) {
      void onDelete(remove);
    }
  });
}

async function onSave(event) {
  event.preventDefault();

  const isNew = !state.editing;
  const data = readForm();
  const message = validateForm(data, { isNew });
  if (message) {
    showValidation(message);
    return;
  }

  const saveButton = $('#btnSave');
  saveButton.disabled = true;

  try {
    if (isNew) {
      await createModulePassword({
        module_code: data.module_code,
        action_code: data.action_code,
        description: data.description,
        password: data.password,
        is_active: data.is_active,
      });
    } else {
      await updateModulePassword(state.editing.module_password_id, {
        description: data.description,
        password: data.password,
        is_active: data.is_active,
      });
    }

    closeModal();
    showSuccess('Senhas dos Módulos', 'Registro salvo com sucesso.');
    await loadAndRender();
  } catch (error) {
    console.error('[modulePasswords.onSave]', error);
    showError('Falha ao salvar', error?.message || 'Não foi possível salvar.');
  } finally {
    saveButton.disabled = false;
  }
}

async function onClearPassword(id) {
  const row = findRow(id);
  if (!row) return;

  const ok = await confirmAction(
    'Remover senha',
    `Remover a senha de ${row.module_code} / ${row.action_code}? ` +
      'O módulo deixa de pedir senha.',
    'Sim, remover'
  );
  if (!ok) return;

  try {
    await clearModulePassword(id);
    showSuccess('Senhas dos Módulos', 'Senha removida.');
    await loadAndRender();
  } catch (error) {
    console.error('[modulePasswords.onClearPassword]', error);
    showError('Falha ao remover senha', error?.message || 'Não foi possível remover a senha.');
  }
}

async function onDelete(id) {
  const row = findRow(id);
  if (!row) return;

  const ok = await confirmAction(
    'Excluir registro',
    `Excluir ${row.module_code} / ${row.action_code}? ` +
      'Registros usados pelo sistema são recriados (sem senha) ao reiniciar o servidor; ' +
      'até lá, vale a chave do .env, se houver.',
    'Sim, excluir'
  );
  if (!ok) return;

  try {
    await deleteModulePassword(id);
    showSuccess('Senhas dos Módulos', 'Registro excluído.');
    await loadAndRender();
  } catch (error) {
    console.error('[modulePasswords.onDelete]', error);
    showError('Falha ao excluir', error?.message || 'Não foi possível excluir.');
  }
}
