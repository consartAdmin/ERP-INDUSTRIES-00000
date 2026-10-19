// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.actions.js                                             ║
// ║ Ações do usuário no módulo Perfis de Usuários                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  getProfilesCatalog,
  getProfilesSummary,
  getUserProfiles,
  listUsers,
  saveUserProfiles,
} from './usersProfile.api.js';
import { PERMISSION_KEYS, SELECTORS } from './usersProfile.config.js';
import { closeUsersProfileModal, openUsersProfileModal } from './usersProfile.modal.js';
import {
  applyModuleFilter,
  renderBulkProfileSelect,
  renderLegend,
  renderModalInfo,
  renderModuleRow,
  renderModulesTable,
  renderUsersError,
  renderUsersLoading,
  renderUsersTable,
} from './usersProfile.render.js';
import {
  findModule,
  findProfile,
  getChangedModules,
  isCustomProfile,
  setModules,
  setProfiles,
  setSaving,
  setSelectedUser,
  setSummary,
  setUsers,
  usersProfileState,
} from './usersProfile.state.js';
import { $, getApiRows, showMessage } from './usersProfile.utils.js';

/* ── Catálogo ──────────────────────────────────────────────────────── */

export async function loadProfilesCatalog() {
  const result = await getProfilesCatalog();
  setProfiles(result?.data?.profiles || []);
  renderBulkProfileSelect();
  renderLegend();
}

/* ── Lista de usuários ─────────────────────────────────────────────── */

function readFilters() {
  return {
    q: $(SELECTORS.searchInput)?.value.trim() || '',
    is_active: $(SELECTORS.filterActive)?.value ?? '',
  };
}

export async function loadUsers() {
  renderUsersLoading();

  try {
    const [usersResult, summaryResult] = await Promise.all([
      listUsers(readFilters()),
      getProfilesSummary().catch(() => ({ data: [] })),
    ]);

    setSummary(getApiRows(summaryResult));
    const users = getApiRows(usersResult);
    setUsers(users);
    renderUsersTable(users);
  } catch (error) {
    console.error('[usersProfile] Erro ao listar usuários:', error);
    renderUsersError(error.message || 'Erro ao carregar usuários.');
  }
}

/* ── Modal ─────────────────────────────────────────────────────────── */

export async function openProfilesForUser(userId) {
  const user = usersProfileState.users.find((u) => String(u.user_id) === String(userId));
  if (!user) return;

  try {
    const result = await getUserProfiles(user.user_id);
    setSelectedUser(user);
    setModules(getApiRows(result));

    const search = $(SELECTORS.moduleSearch);
    if (search) search.value = '';

    renderModulesTable();
    renderModalInfo();
    openUsersProfileModal(user);
  } catch (error) {
    console.error('[usersProfile] Erro ao carregar perfis:', error);
    showMessage(error.message || 'Erro ao carregar perfis do usuário.', 'error');
  }
}

function applyProfileToModule(module, code) {
  module.profile = code;

  const profile = findProfile(code);
  if (profile?.permissions) {
    PERMISSION_KEYS.forEach((k) => { module[k] = Boolean(profile.permissions[k]); });
  }
}

export function changeModuleProfile(moduloId, code) {
  const module = findModule(moduloId);
  if (!module) return;

  applyProfileToModule(module, code);
  renderModuleRow(module);
  renderModalInfo();
}

export function changeModuleFlag(moduloId, key, checked) {
  const module = findModule(moduloId);
  if (!module || !isCustomProfile(module.profile)) return;

  module[key] = Boolean(checked);

  // Qualquer ação implica visualizar; tirar "Ver" tira todas as ações
  if (key !== 'can_view' && checked) module.can_view = true;
  if (key === 'can_view' && !checked) {
    PERMISSION_KEYS.forEach((k) => { module[k] = false; });
  }

  renderModuleRow(module);
  renderModalInfo();
}

/** Aplica o perfil do select "em massa" a todos os módulos visíveis no filtro */
export function applyBulkProfile() {
  const code = $(SELECTORS.bulkProfile)?.value;
  if (!code) return;

  const tbody = $(SELECTORS.modulesTableBody);
  const visibleIds = [...(tbody?.querySelectorAll('tr[data-modulo-id-row]:not(.is-hidden)') || [])]
    .map((row) => row.dataset.moduloIdRow);

  visibleIds.forEach((id) => {
    const module = findModule(id);
    if (module) applyProfileToModule(module, code);
  });

  renderModulesTable();
  applyModuleFilter();
  renderModalInfo();
}

export async function saveProfiles() {
  if (usersProfileState.saving) return;

  const user = usersProfileState.selectedUser;
  const changed = getChangedModules();

  if (!user) return;
  if (!changed.length) {
    showMessage('Nenhuma alteração para salvar.', 'info');
    return;
  }

  const payload = changed.map((m) => ({
    modulo_id: m.modulo_id,
    profile: m.profile,
    can_view: m.can_view,
    can_create: m.can_create,
    can_edit: m.can_edit,
    can_delete: m.can_delete,
    can_export: m.can_export,
  }));

  const btnSave = $(SELECTORS.btnSave);
  const originalText = btnSave?.textContent;

  setSaving(true);
  if (btnSave) {
    btnSave.disabled = true;
    btnSave.textContent = 'Salvando...';
  }

  try {
    await saveUserProfiles(user.user_id, payload);
    closeUsersProfileModal();
    showMessage(`Perfis de ${user.name || 'usuário'} salvos (${payload.length} módulo(s)).`, 'success');
    await loadUsers();

    // Se o usuário alterou as próprias permissões, atualiza o menu
    window.SecurityModules?.refresh?.();
  } catch (error) {
    console.error('[usersProfile] Erro ao salvar perfis:', error);
    showMessage(error.message || 'Erro ao salvar perfis.', 'error');
  } finally {
    setSaving(false);
    if (btnSave) {
      btnSave.disabled = false;
      btnSave.textContent = originalText || 'Salvar perfis';
    }
  }
}
