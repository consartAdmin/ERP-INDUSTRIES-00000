// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.actions.js                                      ║
// ║ MODULE: Fiscal Profile — Actions                                    ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  createFiscalProfile,
  deactivateFiscalProfile,
  listFiscalProfiles,
  updateFiscalProfile,
} from './fiscalProfile.api.js';
import { buildListParams } from './fiscalProfile.filters.js';
import { fillForm, readForm, resetForm } from './fiscalProfile.form.js';
import { confirmDeleteProfile, toast } from './fiscalProfile.modal.js';
import {
  renderListError,
  renderLoading,
  renderPagination,
  renderTable,
} from './fiscalProfile.render.js';
import { dom, state } from './fiscalProfile.state.js';
import { scrollToPageTop } from './fiscalProfile.utils.js';
import { validateFiscalProfile } from './fiscalProfile.validation.js';

function setPageVisibility(page, visible) {
  if (!page) return;

  page.hidden = !visible;
  page.classList.toggle('is-active', visible);
  page.setAttribute('aria-hidden', String(!visible));
}

export function showListPage({ scroll = true } = {}) {
  state.currentView = 'list';

  setPageVisibility(dom.listPage, true);
  setPageVisibility(dom.formPage, false);

  if (scroll) {
    scrollToPageTop();
  }
}

export function showFormPage({ focus = false, scroll = true } = {}) {
  state.currentView = 'form';

  setPageVisibility(dom.listPage, false);
  setPageVisibility(dom.formPage, true);

  if (scroll) {
    scrollToPageTop();
  }

  if (focus) {
    dom.fields.profileName?.focus();
  }
}

export async function loadProfiles() {
  if (state.loading) return;

  state.loading = true;
  renderLoading();
  let loadedSuccessfully = false;

  try {
    const response = await listFiscalProfiles(buildListParams());
    const rows = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.rows) ? response.rows : [];
    const offset = (state.page - 1) * state.pageSize;
    state.total = Number(response?.total ?? (offset + rows.length + (rows.length === state.pageSize ? 1 : 0)));

    renderTable(rows, {
      onEdit: editProfile,
      onDelete: removeProfile,
    });

    loadedSuccessfully = true;
  } catch (error) {
    console.error('[fiscalProfile] Erro ao carregar perfis', error);
    renderListError();
    toast.error(
      'Erro ao carregar',
      'Não foi possível carregar os perfis fiscais.',
    );
  } finally {
    state.loading = false;

    if (loadedSuccessfully) {
      renderPagination();
    }
  }
}

export function newProfile() {
  resetForm();
  showFormPage({ focus: true });
}

export function editProfile(profile) {
  fillForm(profile);
  showFormPage();
}

export function returnToList() {
  resetForm();
  showListPage();
}

export async function removeProfile(profile) {
  const id = profile.fiscal_profile_id;
  if (!id || !confirmDeleteProfile(profile)) return;

  try {
    await deactivateFiscalProfile(id);

    if (String(dom.fields.id.value) === String(id)) {
      resetForm();
    }

    await loadProfiles();

    toast.success(
      'Perfil desativado',
      `O perfil "${profile.profile_name}" foi desativado com sucesso.`,
    );
  } catch (error) {
    console.error('[fiscalProfile] Erro ao remover perfil', error);
    toast.error(
      'Erro ao desativar',
      error.message || 'Não foi possível desativar o perfil fiscal.',
    );
  }
}

export async function submitProfile(event) {
  event.preventDefault();

  const { id, payload } = readForm();
  const validation = validateFiscalProfile(payload);

  if (!validation.valid) {
    toast.warn(validation.title, validation.message);
    dom.fields[validation.field]?.focus();
    return;
  }

  try {
    if (id) {
      await updateFiscalProfile(id, payload);
    } else {
      await createFiscalProfile(payload);
    }

    resetForm();
    await loadProfiles();
    showListPage();

    toast.success('Perfil salvo', 'Perfil fiscal salvo com sucesso.');
  } catch (error) {
    console.error('[fiscalProfile] Erro ao salvar perfil', error);
    toast.error(
      'Erro ao salvar',
      error.message || 'Não foi possível salvar o perfil fiscal.',
    );
  }
}

export function previousPage() {
  if (state.loading || state.page <= 1) return;

  state.page -= 1;
  loadProfiles();
}

export function nextPage() {
  if (state.loading) return;

  state.page += 1;
  loadProfiles();
}
