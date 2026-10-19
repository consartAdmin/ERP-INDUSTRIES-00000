// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accessProfiles.form.js                                              ║
// ║ Preenchimento e leitura do formulário de perfil                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { NO_ACCESS_CODE, PERMISSION_KEYS, SELECTORS } from './accessProfiles.config.js';
import { $, toCode } from './accessProfiles.utils.js';

function flagInput(key) {
  return document.querySelector(`[data-apf-flag="${key}"]`);
}

function setPermissionsLocked(locked) {
  PERMISSION_KEYS.forEach((k) => {
    const input = flagInput(k);
    if (input) input.disabled = locked;
  });
}

export function resetForm() {
  $(SELECTORS.id).value = '';
  $(SELECTORS.name).value = '';
  $(SELECTORS.code).value = '';
  $(SELECTORS.sortOrder).value = '100';
  $(SELECTORS.description).value = '';
  $(SELECTORS.isActive).checked = true;
  $(SELECTORS.isActive).disabled = false;
  $(SELECTORS.note).textContent = '';

  PERMISSION_KEYS.forEach((k) => {
    const input = flagInput(k);
    if (input) input.checked = k === 'can_view';
  });
  setPermissionsLocked(false);
}

export function fillForm(profile) {
  resetForm();

  $(SELECTORS.id).value = profile.id;
  $(SELECTORS.name).value = profile.name || '';
  $(SELECTORS.code).value = profile.code || '';
  $(SELECTORS.sortOrder).value = profile.sort_order ?? 100;
  $(SELECTORS.description).value = profile.description || '';
  $(SELECTORS.isActive).checked = Boolean(profile.is_active);
  $(SELECTORS.isActive).disabled = Boolean(profile.is_system);

  PERMISSION_KEYS.forEach((k) => {
    const input = flagInput(k);
    if (input) input.checked = Boolean(profile[k]);
  });

  const notes = [];
  if (profile.is_custom) {
    setPermissionsLocked(true);
    PERMISSION_KEYS.forEach((k) => { flagInput(k).checked = false; });
    notes.push('Este perfil não tem permissões fixas: elas são marcadas módulo a módulo na tela "Perfis de Usuários".');
  } else if (profile.code === NO_ACCESS_CODE) {
    setPermissionsLocked(true);
    notes.push('"Sem acesso" nunca tem permissões.');
  } else if (profile.users_count) {
    notes.push(`Usado por ${profile.users_count} usuário(s). Mudar as permissões atualiza esses usuários na hora.`);
  }
  if (profile.is_system) notes.push('Perfil do sistema: não pode ser excluído nem desativado.');

  $(SELECTORS.note).textContent = notes.join(' ');
}

/** Atualiza o código sugerido enquanto digita o nome (só em perfis novos) */
export function syncCodeFromName() {
  if ($(SELECTORS.id).value) return;
  $(SELECTORS.code).value = toCode($(SELECTORS.name).value);
}

/** Qualquer ação marca "Visualizar"; desmarcar "Visualizar" limpa as ações */
export function handleFlagChange(input) {
  const key = input.dataset.apfFlag;
  if (key !== 'can_view' && input.checked) flagInput('can_view').checked = true;
  if (key === 'can_view' && !input.checked) {
    PERMISSION_KEYS.forEach((k) => { flagInput(k).checked = false; });
  }
}

export function getFormData() {
  const data = {
    id: $(SELECTORS.id).value.trim(),
    name: $(SELECTORS.name).value.trim(),
    description: $(SELECTORS.description).value.trim(),
    sort_order: $(SELECTORS.sortOrder).value,
    is_active: $(SELECTORS.isActive).checked,
  };

  PERMISSION_KEYS.forEach((k) => {
    const input = flagInput(k);
    if (input && !input.disabled) data[k] = input.checked;
  });

  return data;
}

export function validateFormData(data) {
  if (!data.name) return 'Informe o nome do perfil.';
  if (!data.id && !toCode(data.name)) return 'O nome precisa ter letras ou números.';
  return null;
}
