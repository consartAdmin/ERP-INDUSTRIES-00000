// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usersProfile.render.js                                              ║
// ║ Renderização da lista de usuários e da matriz de módulos do modal   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PERMISSION_KEYS, SELECTORS } from './usersProfile.config.js';
import { isChanged, isCustomProfile, usersProfileState } from './usersProfile.state.js';
import { $, escapeHtml, formatDateTime, normalizeText } from './usersProfile.utils.js';

const USERS_COLSPAN = 8;

/* ── Lista de usuários ─────────────────────────────────────────────── */

function renderUsersMessage(message, className) {
  const tbody = $(SELECTORS.usersTableBody);
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${USERS_COLSPAN}" class="${className}">${escapeHtml(message)}</td>
      </tr>
    `;
  }
}

export function renderUsersLoading() {
  renderUsersMessage('Carregando usuários...', 'up-loading');
  const info = $(SELECTORS.tableInfo);
  if (info) info.textContent = 'Carregando...';
}

export function renderUsersError(message) {
  renderUsersMessage(message, 'up-error');
  const info = $(SELECTORS.tableInfo);
  if (info) info.textContent = 'Erro ao carregar';
}

export function renderUsersTable(users = []) {
  const tbody = $(SELECTORS.usersTableBody);
  const info = $(SELECTORS.tableInfo);
  if (!tbody) return;

  if (info) info.textContent = `${users.length} Registros`;

  if (!users.length) {
    renderUsersMessage('Nenhum usuário encontrado.', 'up-empty');
    return;
  }

  tbody.innerHTML = users.map((user) => {
    const id = user.user_id;
    const active = user.is_active !== false;
    const summary = usersProfileState.summaryByUser.get(String(id));
    const withAccess = summary?.modules_with_access ?? 0;

    return `
      <tr>
        <td>${escapeHtml(id)}</td>
        <td>${escapeHtml(user.name || '-')}</td>
        <td>${escapeHtml(user.email || '-')}</td>
        <td>${escapeHtml(user.access_level || '-')}</td>
        <td><span class="up-badge ${active ? 'on' : 'off'}">${active ? 'ATIVO' : 'INATIVO'}</span></td>
        <td class="up-access-count">${escapeHtml(withAccess)}</td>
        <td>${escapeHtml(formatDateTime(summary?.last_update))}</td>
        <td class="up-col-actions">
          <button
            class="btn btn-toolbar btn-sm"
            type="button"
            data-up-action="profiles"
            data-user-id="${escapeHtml(id)}"
            aria-label="Definir perfis de ${escapeHtml(user.name || 'usuário')}"
          >🛡️ Perfis</button>
        </td>
      </tr>
    `;
  }).join('');
}

/* ── Modal: selects e legenda ──────────────────────────────────────── */

function profileOptions(selected) {
  // Perfis inativos só aparecem quando já estão atribuídos ao módulo
  const options = usersProfileState.profiles
    .filter((p) => p.is_active || p.code === selected)
    .map((p) => `
      <option value="${escapeHtml(p.code)}" ${p.code === selected ? 'selected' : ''}>
        ${escapeHtml(p.label)}${p.is_active ? '' : ' (inativo)'}
      </option>
    `);

  if (!usersProfileState.profiles.some((p) => p.code === selected)) {
    options.push(`<option value="${escapeHtml(selected)}" selected>${escapeHtml(selected)} (excluído)</option>`);
  }

  return options.join('');
}

export function renderBulkProfileSelect() {
  const select = $(SELECTORS.bulkProfile);
  if (!select) return;

  select.innerHTML = usersProfileState.profiles
    .filter((p) => p.is_active && !p.is_custom)
    .map((p) => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.label)}</option>`)
    .join('');
}

export function renderLegend() {
  const legend = $(SELECTORS.legend);
  if (!legend) return;

  legend.innerHTML = usersProfileState.profiles
    .filter((p) => p.is_active)
    .map((p) => `<strong>${escapeHtml(p.label)}:</strong> ${escapeHtml(p.description)}`)
    .join(' · ');
}

/* ── Modal: matriz de módulos ──────────────────────────────────────── */

function flagCell(module, key) {
  const disabled = !isCustomProfile(module.profile);
  return `
    <td class="up-col-flag">
      <input
        type="checkbox"
        data-up-flag="${key}"
        data-modulo-row="${escapeHtml(module.modulo_id)}"
        ${module[key] ? 'checked' : ''}
        ${disabled ? 'disabled' : ''}
      />
    </td>
  `;
}

export function renderModulesTable(modules = usersProfileState.modules) {
  const tbody = $(SELECTORS.modulesTableBody);
  if (!tbody) return;

  if (!modules.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="up-empty">Nenhum módulo ativo cadastrado em "Criação de Módulos".</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = modules.map((m) => `
    <tr data-modulo-id-row="${escapeHtml(m.modulo_id)}" class="${isChanged(m) ? 'is-changed' : ''}">
      <td>${escapeHtml(m.modulo_id)}</td>
      <td>${escapeHtml(m.module_name || '-')}</td>
      <td class="up-module-path">${escapeHtml(m.module_path || '-')}</td>
      <td>
        <select data-up-profile data-modulo-row="${escapeHtml(m.modulo_id)}">
          ${profileOptions(m.profile)}
        </select>
      </td>
      ${PERMISSION_KEYS.map((k) => flagCell(m, k)).join('')}
    </tr>
  `).join('');

  applyModuleFilter();
}

/** Atualiza só a linha de um módulo (evita perder o foco/scroll) */
export function renderModuleRow(module) {
  const tbody = $(SELECTORS.modulesTableBody);
  const row = tbody?.querySelector(`tr[data-modulo-id-row="${CSS.escape(String(module.modulo_id))}"]`);
  if (!row) return;

  row.classList.toggle('is-changed', isChanged(module));

  const select = row.querySelector('[data-up-profile]');
  if (select) select.value = module.profile;

  PERMISSION_KEYS.forEach((key) => {
    const input = row.querySelector(`[data-up-flag="${key}"]`);
    if (!input) return;
    input.checked = Boolean(module[key]);
    input.disabled = !isCustomProfile(module.profile);
  });
}

export function applyModuleFilter() {
  const term = normalizeText($(SELECTORS.moduleSearch)?.value.trim());
  const tbody = $(SELECTORS.modulesTableBody);
  if (!tbody) return;

  tbody.querySelectorAll('tr[data-modulo-id-row]').forEach((row) => {
    const visible = !term || normalizeText(row.textContent).includes(term);
    row.classList.toggle('is-hidden', !visible);
  });
}

export function renderModalInfo() {
  const info = $(SELECTORS.modalInfo);
  if (!info) return;

  const modules = usersProfileState.modules;
  const withAccess = modules.filter((m) => m.can_view).length;
  const changed = modules.filter(isChanged).length;

  info.textContent =
    `${withAccess} de ${modules.length} módulos com acesso` +
    (changed ? ` · ${changed} alteração(ões) não salva(s)` : '');
}
