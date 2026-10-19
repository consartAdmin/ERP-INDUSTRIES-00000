// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: tasks.js                                                     ║
// ║ MODULE: Tasks / Tarefas                                            ║
// ║ PRODNEX ERP | Frontend ESM                                         ║
// ║ ✅ Lista / Dashboard / Kanban / Relatórios                          ║
// ║ ✅ Grupo/Classificação via /api/task-groups                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { ensureTasksNewModal } from './modal/tasksNewModal.js';

const API_URL = '/api/tasks';
const TASK_GROUPS_URL = '/api/task-groups';

let tasks = [];
let taskGroups = [];
let editingTaskId = null;

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  ensureTasksNewModal();

  bindEvents();
  openTab('tableTab');

  await loadTaskGroups();
  await loadTasks();
}

function bindEvents() {
  $('btnReloadTasks')?.addEventListener('click', loadTasks);
  $('btnNewTask')?.addEventListener('click', openNewTaskModal);

  $('btnCloseModal')?.addEventListener('click', closeModal);
  $('taskForm')?.addEventListener('submit', saveTask);

  $('btnDeleteTask')?.addEventListener('click', deleteCurrentTask);
  $('btnFinishTask')?.addEventListener('click', finishCurrentTask);

  $('searchTask')?.addEventListener('input', renderAll);
  $('filterStatus')?.addEventListener('change', renderAll);
  $('filterTaskGroup')?.addEventListener('change', renderAll);
  $('filterActive')?.addEventListener('change', renderAll);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => openTab(btn.dataset.tab));
  });
}

async function loadTaskGroups() {
  try {
    const res = await fetch(`${TASK_GROUPS_URL}?active=true`);
    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao carregar grupos de tarefas.');
    }

    taskGroups = Array.isArray(json)
      ? json
      : Array.isArray(json.rows)
        ? json.rows
        : Array.isArray(json.data)
          ? json.data
          : [];

    renderTaskGroupSelects();
  } catch (error) {
    console.error('[tasks] loadTaskGroups error:', error);
    taskGroups = [];
    renderTaskGroupSelects();
  }
}

function renderTaskGroupSelects() {
  const options = taskGroups.map((group) => {
    const id = group.task_group_id;
    const icon = group.icon || '';
    const name = group.name || `Grupo #${id}`;

    return `
      <option value="${escapeHtml(id)}">
        ${escapeHtml(`${icon} ${name}`.trim())}
      </option>
    `;
  }).join('');

  const filter = $('filterTaskGroup');
  if (filter) {
    const current = filter.value;

    filter.innerHTML = `
      <option value="">Todos os grupos</option>
      ${options}
    `;

    filter.value = current || '';
  }

  const modalSelect = $('taskGroupId');
  if (modalSelect) {
    const current = modalSelect.value;

    modalSelect.innerHTML = `
      <option value="">Sem grupo</option>
      ${options}
    `;

    modalSelect.value = current || '';
  }
}

async function loadTasks() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao carregar tarefas.');
    }

    tasks = Array.isArray(json)
      ? json
      : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.rows)
          ? json.rows
          : [];

    renderAll();
  } catch (error) {
    console.error('[tasks] loadTasks error:', error);
    alert('Erro ao carregar tarefas.');
  }
}

function renderAll() {
  const filtered = getFilteredTasks();

  renderDashboard(filtered);
  renderTable(filtered);
  renderKanban(filtered);
  renderReports(filtered);
}

function getFilteredTasks() {
  const search = $('searchTask')?.value?.toLowerCase().trim() || '';
  const status = $('filterStatus')?.value || '';
  const taskGroupId = $('filterTaskGroup')?.value || '';
  const active = $('filterActive')?.value || '';

  return tasks.filter((task) => {
    const matchSearch =
      !search ||
      String(task.title || '').toLowerCase().includes(search) ||
      String(task.description || '').toLowerCase().includes(search) ||
      String(task.observations || '').toLowerCase().includes(search);

    const matchStatus = !status || task.status === status;

    const matchGroup =
      !taskGroupId ||
      String(task.task_group_id || '') === String(taskGroupId);

    const matchActive =
      active === '' ||
      String(Boolean(task.active)) === active;

    return matchSearch && matchStatus && matchGroup && matchActive;
  });
}

function renderDashboard(data) {
  $('kpiTotal').textContent = data.length;
  $('kpiOpen').textContent = data.filter((t) => t.status === 'OPEN').length;
  $('kpiProgress').textContent = data.filter((t) => t.status === 'IN_PROGRESS').length;
  $('kpiFinished').textContent = data.filter((t) => t.status === 'FINISHED').length;
}

function renderReports(data) {
  $('reportHigh').textContent = data.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT').length;
  $('reportNormal').textContent = data.filter((t) => t.priority === 'NORMAL').length;
  $('reportLow').textContent = data.filter((t) => t.priority === 'LOW').length;
  $('reportInactive').textContent = data.filter((t) => !t.active).length;
}

function renderTable(data) {
  const tbody = $('tasksTableBody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-row">Nenhuma tarefa encontrada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map((task) => `
    <tr>
      <td>${task.id}</td>

      <td>
        <strong>${escapeHtml(task.title)}</strong>
        <br>
        <small>${escapeHtml(task.description || '')}</small>
      </td>

      <td>${groupBadge(task)}</td>

      <td>${statusBadge(task.status)}</td>
      <td>${priorityBadge(task.priority)}</td>
      <td>${formatDate(task.created_at)}</td>
      <td>${formatDate(task.finished_at)}</td>
      <td>${task.active ? 'Sim' : 'Não'}</td>

      <td>
        <div class="table-actions">
          <button class="btn btn-icon-sm-size" type="button" onclick="window.editTask(${task.id})">
            Editar
          </button>

          <button class="btn btn-icon-sm-size" type="button" onclick="window.finishTaskById(${task.id})">
            Finalizar
          </button>

          <button class="btn btn-icon-sm-size" type="button" onclick="window.deleteTaskById(${task.id})">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderKanban(data) {
  const columns = {
    OPEN: $('kanbanOpen'),
    IN_PROGRESS: $('kanbanProgress'),
    REVIEW: $('kanbanReview'),
    FINISHED: $('kanbanFinished'),
  };

  Object.values(columns).forEach((col) => {
    if (col) col.innerHTML = '';
  });

  data.forEach((task) => {
    const col = columns[task.status] || columns.OPEN;
    if (!col) return;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.onclick = () => openEditTaskModal(task.id);

    card.innerHTML = `
      <h4>${escapeHtml(task.title)}</h4>
      <p>${escapeHtml(task.description || '')}</p>

      <div class="kanban-card-footer">
        ${groupBadge(task)}
        ${priorityBadge(task.priority)}
        <small>#${task.id}</small>
      </div>
    `;

    col.appendChild(card);
  });
}

function openTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-content').forEach((tab) => {
    const isActive = tab.id === tabId;

    tab.classList.toggle('active', isActive);
    tab.classList.toggle('hidden', !isActive);
  });
}

function openNewTaskModal() {
  editingTaskId = null;

  $('modalTitle').textContent = 'Nova Tarefa';
  $('taskForm').reset();

  $('taskId').value = '';
  $('taskGroupId').value = '';
  $('taskStatus').value = 'OPEN';
  $('taskPriority').value = 'NORMAL';
  $('taskActive').checked = true;

  $('btnDeleteTask').classList.add('hidden');
  $('btnFinishTask').classList.add('hidden');

  openModal();
}

function openEditTaskModal(id) {
  const task = tasks.find((t) => Number(t.id) === Number(id));
  if (!task) return;

  editingTaskId = task.id;

  $('modalTitle').textContent = `Editar Tarefa #${task.id}`;
  $('taskId').value = task.id;
  $('taskTitle').value = task.title || '';
  $('taskDescription').value = task.description || '';
  $('taskGroupId').value = task.task_group_id || '';
  $('taskStatus').value = task.status || 'OPEN';
  $('taskPriority').value = task.priority || 'NORMAL';
  $('taskAssignedTo').value = task.assigned_to || '';
  $('taskCreatedBy').value = task.created_by || '';
  $('taskStartedAt').value = toDatetimeLocal(task.started_at);
  $('taskFinishedAt').value = toDatetimeLocal(task.finished_at);
  $('taskObservations').value = task.observations || '';
  $('taskActive').checked = task.active !== false;

  $('btnDeleteTask').classList.remove('hidden');
  $('btnFinishTask').classList.remove('hidden');

  openModal();
}

function openModal() {
  const modal = $('taskModal');
  if (!modal) return;

  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', 'open');
  }
}

function closeModal() {
  const modal = $('taskModal');
  if (!modal) return;

  if (typeof modal.close === 'function') {
    modal.close();
  } else {
    modal.removeAttribute('open');
  }
}

async function saveTask(event) {
  event.preventDefault();

  const payload = {
    title: $('taskTitle').value.trim(),
    description: $('taskDescription').value.trim() || null,
    task_group_id: toNumberOrNull($('taskGroupId').value),
    status: $('taskStatus').value,
    priority: $('taskPriority').value,
    assigned_to: toNumberOrNull($('taskAssignedTo').value),
    created_by: toNumberOrNull($('taskCreatedBy').value),
    started_at: $('taskStartedAt').value || null,
    finished_at: $('taskFinishedAt').value || null,
    observations: $('taskObservations').value.trim() || null,
    active: $('taskActive').checked,
  };

  if (!payload.title) {
    alert('Informe o título da tarefa.');
    return;
  }

  try {
    const isEdit = Boolean(editingTaskId);
    const url = isEdit ? `${API_URL}/${editingTaskId}` : API_URL;
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao salvar tarefa.');
    }

    closeModal();
    await loadTasks();
  } catch (error) {
    console.error('[tasks] saveTask error:', error);
    alert(error.message);
  }
}

async function finishCurrentTask() {
  if (!editingTaskId) return;
  await finishTaskById(editingTaskId);
  closeModal();
}

async function deleteCurrentTask() {
  if (!editingTaskId) return;
  await deleteTaskById(editingTaskId);
  closeModal();
}

async function finishTaskById(id) {
  if (!confirm('Deseja finalizar esta tarefa?')) return;

  try {
    const res = await fetch(`${API_URL}/${id}/finish`, {
      method: 'PATCH',
    });

    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao finalizar tarefa.');
    }

    await loadTasks();
  } catch (error) {
    console.error('[tasks] finishTaskById error:', error);
    alert(error.message);
  }
}

async function deleteTaskById(id) {
  if (!confirm('Deseja excluir esta tarefa?')) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });

    const json = await res.json();

    if (!res.ok || json.ok === false) {
      throw new Error(json.error || 'Erro ao excluir tarefa.');
    }

    await loadTasks();
  } catch (error) {
    console.error('[tasks] deleteTaskById error:', error);
    alert(error.message);
  }
}

function groupBadge(task) {
  if (!task.task_group_id) return '-';

  const icon = task.task_group_icon || '';
  const name = task.task_group_name || 'Grupo';

  return `
    <span class="badge-group">
      ${escapeHtml(icon)} ${escapeHtml(name)}
    </span>
  `;
}

function statusBadge(status = 'OPEN') {
  const map = {
    OPEN: 'badge-open',
    IN_PROGRESS: 'badge-progress',
    REVIEW: 'badge-review',
    FINISHED: 'badge-finished',
  };

  return `<span class="badge ${map[status] || 'badge-open'}">${escapeHtml(status)}</span>`;
}

function priorityBadge(priority = 'NORMAL') {
  const cls = {
    LOW: 'badge-low',
    NORMAL: 'badge-normal',
    HIGH: 'badge-high',
    URGENT: 'badge-urgent',
  };

  return `<span class="badge ${cls[priority] || 'badge-normal'}">${escapeHtml(priority)}</span>`;
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('pt-BR');
}

function toDatetimeLocal(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (n) => String(n).padStart(2, '0');

  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function toNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.editTask = openEditTaskModal;
window.finishTaskById = finishTaskById;
window.deleteTaskById = deleteTaskById;