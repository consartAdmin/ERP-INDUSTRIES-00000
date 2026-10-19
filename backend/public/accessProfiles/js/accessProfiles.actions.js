// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.actions.js                                           ║
// ║ Ações do usuário no Cadastro de Perfis                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { createProfile, deleteProfile, listProfiles, updateProfile } from './accessProfiles.api.js';
import { SELECTORS } from './accessProfiles.config.js';
import { fillForm, getFormData, resetForm, validateFormData } from './accessProfiles.form.js';
import { closeAccessProfileModal, openAccessProfileModal } from './accessProfiles.modal.js';
import { renderError, renderLoading, renderTable } from './accessProfiles.render.js';
import {
  accessProfilesState,
  findRow,
  setEditing,
  setRows,
  setSaving,
} from './accessProfiles.state.js';
import { $, getApiRows, showMessage } from './accessProfiles.utils.js';

function readFilters() {
  return {
    search: $(SELECTORS.searchInput)?.value.trim() || '',
    onlyActive: $(SELECTORS.filterActive)?.value || '',
  };
}

export async function loadProfiles() {
  renderLoading();

  try {
    const result = await listProfiles(readFilters());
    const rows = getApiRows(result);
    setRows(rows);
    renderTable(rows);
  } catch (error) {
    console.error('[accessProfiles] Erro ao listar perfis:', error);
    renderError(error.message || 'Erro ao carregar perfis.');
  }
}

export function openNewProfile() {
  setEditing(null);
  resetForm();
  openAccessProfileModal(null);
}

export function openEditProfile(id) {
  const profile = findRow(id);
  if (!profile) return;

  setEditing(profile);
  fillForm(profile);
  openAccessProfileModal(profile);
}

export async function saveProfile() {
  if (accessProfilesState.saving) return;

  const data = getFormData();
  const error = validateFormData(data);
  if (error) {
    showMessage(error, 'warn');
    return;
  }

  const { id, ...payload } = data;
  const btnSave = $(SELECTORS.btnSave);
  const originalText = btnSave?.textContent;

  setSaving(true);
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';
  }

  try {
    const result = id ? await updateProfile(id, payload) : await createProfile(payload);
    closeAccessProfileModal();

    const propagated = result?.data?.propagated;
    showMessage(
      id
        ? `Perfil atualizado.${propagated ? ` ${propagated} vínculo(s) de usuário receberam as novas permissões.` : ''}`
        : 'Perfil criado. Ele já aparece na tela "Perfis de Usuários".',
      'success'
    );
    await loadProfiles();
  } catch (err) {
    console.error('[accessProfiles] Erro ao salvar perfil:', err);
    showMessage(err.message || 'Erro ao salvar perfil.', 'error');
  } finally {
    setSaving(false);
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = originalText || 'Salvar perfil';
    }
  }
}

export async function removeProfile(id) {
  const profile = findRow(id);
  if (!profile) return;

  if (!window.confirm(`Tem certeza que deseja excluir o perfil "${profile.name}"?`)) return;

  try {
    await deleteProfile(id);
    showMessage('Perfil excluído.', 'success');
    await loadProfiles();
  } catch (err) {
    console.error('[accessProfiles] Erro ao excluir perfil:', err);
    showMessage(err.message || 'Erro ao excluir perfil.', 'error');
  }
}
