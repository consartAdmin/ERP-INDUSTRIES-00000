// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: taskGroups.js                                                ║
// ║ MODULE: Task Groups / Grupos de Tarefas                            ║
// ║ PRODNEX ERP | Frontend ESM                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_URL = '/api/task-groups';

let groups = [];
let editingGroupId = null;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  bindEvents();
  await loadGroups();
}

function bindEvents() {
  $('btnReload')?.addEventListener('click', loadGroups);
  $('btnNewGroup')?.addEventListener('click', openNewModal);
  $('btnCloseModal')?.addEventListener('click', closeModal);

  $('groupForm')?.addEventListener('submit', saveGroup);
  $('btnDeleteGroup')?.addEventListener('click', inactivateCurrentGroup);
  $('btnRestoreGroup')?.addEventListener('click', restoreCurrentGroup);

  $('searchGroup')?.addEventListener('input', renderTable);
  $('filterActive')?.addEventListener('change', renderTable);

  ['groupName', 'groupIcon', 'groupColor'].forEach((id) => {
    $(id)?.addEventListener('input', updatePreview);
  });
}

async function loadGroups() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao carregar grupos.');
    }

    groups = Array.isArray(json)
      ? json
      : Array.isArray(json.rows)
        ? json.rows
        : Array.isArray(json.data)
          ? json.data
          : [];

    renderTable();
  } catch (error) {
    console.error('[taskGroups] loadGroups error:', error);
    alert(error.message || 'Erro ao carregar grupos.');
  }
}

function getFilteredGroups() {
  const search = $('searchGroup')?.value?.toLowerCase().trim() || '';
  const active = $('filterActive')?.value || '';

  return groups.filter((group) => {
    const matchSearch =
      !search ||
      String(group.name || '').toLowerCase().includes(search) ||
      String(group.icon || '').toLowerCase().includes(search);

    const matchActive =
      active === '' ||
      String(Boolean(group.is_active)) === active;

    return matchSearch && matchActive;
  });
}

function renderTable() {
  const tbody = $('groupsTableBody');
  if (!tbody) return;

  const data = getFilteredGroups();

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-row">Nenhum grupo encontrado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map((group) => `
    <tr>
      <td>${group.task_group_id}</td>

      <td>${groupBadge(group)}</td>

      <td>
        <strong>${escapeHtml(group.name || '')}</strong>
      </td>

      <td>${escapeHtml(group.icon || '-')}</td>

      <td>
        <span class="color-box" style="background:${escapeAttr(group.color || '#e2e8f0')}"></span>
        ${escapeHtml(group.color || '-')}
      </td>

      <td>${Number(group.sort_order || 0)}</td>

      <td>${group.is_active ? 'Sim' : 'Não'}</td>

      <td>
        <div class="table-actions">
          <button class="action-btn action-edit" type="button" onclick="window.editGroup(${group.task_group_id})">
            Editar
          </button>

          ${
            group.is_active
              ? `
                <button class="action-btn action-delete" type="button" onclick="window.inactivateGroupById(${group.task_group_id})">
                  Inativar
                </button>
              `
              : `
                <button class="action-btn action-restore" type="button" onclick="window.restoreGroupById(${group.task_group_id})">
                  Reativar
                </button>
              `
          }
        </div>
      </td>
    </tr>
  `).join('');
}

function openNewModal() {
  editingGroupId = null;

  $('modalTitle').textContent = 'Novo Grupo';
  $('groupForm').reset();

  $('groupId').value = '';
  $('groupColor').value = '#2563eb';
  $('groupSortOrder').value = 0;
  $('groupActive').checked = true;

  $('btnDeleteGroup').classList.add('hidden');
  $('btnRestoreGroup').classList.add('hidden');

  updatePreview();
  openModal();
}

function openEditModal(id) {
  const group = groups.find((g) => Number(g.task_group_id) === Number(id));
  if (!group) return;

  editingGroupId = group.task_group_id;

  $('modalTitle').textContent = `Editar Grupo #${group.task_group_id}`;
  $('groupId').value = group.task_group_id;
  $('groupName').value = group.name || '';
  $('groupIcon').value = group.icon || '';
  $('groupColor').value = normalizeColor(group.color || '#2563eb');
  $('groupSortOrder').value = Number(group.sort_order || 0);
  $('groupActive').checked = group.is_active !== false;

  if (group.is_active) {
    $('btnDeleteGroup').classList.remove('hidden');
    $('btnRestoreGroup').classList.add('hidden');
  } else {
    $('btnDeleteGroup').classList.add('hidden');
    $('btnRestoreGroup').classList.remove('hidden');
  }

  updatePreview();
  openModal();
}

async function saveGroup(event) {
  event.preventDefault();

  const payload = {
    name: $('groupName').value.trim(),
    icon: $('groupIcon').value.trim() || null,
    color: $('groupColor').value || null,
    sort_order: toNumberOrZero($('groupSortOrder').value),
    is_active: $('groupActive').checked,
  };

  if (!payload.name) {
    alert('Informe o nome do grupo.');
    return;
  }

  try {
    const isEdit = Boolean(editingGroupId);
    const url = isEdit ? `${API_URL}/${editingGroupId}` : API_URL;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao salvar grupo.');
    }

    closeModal();
    await loadGroups();
  } catch (error) {
    console.error('[taskGroups] saveGroup error:', error);
    alert(error.message || 'Erro ao salvar grupo.');
  }
}

async function inactivateCurrentGroup() {
  if (!editingGroupId) return;
  await inactivateGroupById(editingGroupId);
  closeModal();
}

async function restoreCurrentGroup() {
  if (!editingGroupId) return;
  await restoreGroupById(editingGroupId);
  closeModal();
}

async function inactivateGroupById(id) {
  if (!confirm('Deseja inativar este grupo?')) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });

    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao inativar grupo.');
    }

    await loadGroups();
  } catch (error) {
    console.error('[taskGroups] inactivateGroupById error:', error);
    alert(error.message || 'Erro ao inativar grupo.');
  }
}

async function restoreGroupById(id) {
  if (!confirm('Deseja reativar este grupo?')) return;

  try {
    const res = await fetch(`${API_URL}/${id}/restore`, {
      method: 'PATCH',
    });

    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao reativar grupo.');
    }

    await loadGroups();
  } catch (error) {
    console.error('[taskGroups] restoreGroupById error:', error);
    alert(error.message || 'Erro ao reativar grupo.');
  }
}

function updatePreview() {
  const icon = $('groupIcon')?.value?.trim() || '🏷️';
  const name = $('groupName')?.value?.trim() || 'Nome do Grupo';
  const color = $('groupColor')?.value || '#2563eb';

  const preview = $('groupPreview');
  if (!preview) return;

  preview.textContent = `${icon} ${name}`;
  preview.style.borderColor = color;
  preview.style.color = color;
}

function groupBadge(group) {
  const icon = group.icon || '🏷️';
  const name = group.name || 'Grupo';
  const color = group.color || '#334155';

  return `
    <span class="group-badge" style="border-color:${escapeAttr(color)}; color:${escapeAttr(color)}">
      ${escapeHtml(icon)} ${escapeHtml(name)}
    </span>
  `;
}

function openModal() {
  const modal = $('groupModal');
  if (!modal) return;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'open');
  }
}

function closeModal() {
  const modal = $('groupModal');
  if (!modal) return;

  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

function normalizeColor(value) {
  const color = String(value || '').trim();

  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  return '#2563eb';
}

function toNumberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

window.editGroup = openEditModal;
window.inactivateGroupById = inactivateGroupById;
window.restoreGroupById = restoreGroupById;