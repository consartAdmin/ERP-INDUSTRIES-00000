/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ pdv_logins.js — Frontend dos usuários do PDV                        ║
   ║ PRODNEX ERP                                                          ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const API_URL = '/api/pdv-logins';

const state = {
    page: 1,
    limit: 20,
    totalPages: 1,
    users: [],
    loading: false,
};

const el = {
    filterSearch: document.querySelector('#filterSearch'),
    filterRole: document.querySelector('#filterRole'),
    filterActive: document.querySelector('#filterActive'),
    btnApplyFilters: document.querySelector('#btnApplyFilters'),
    btnClearFilters: document.querySelector('#btnClearFilters'),
    btnNew: document.querySelector('#btnNew'),
    tableBody: document.querySelector('#usersTableBody'),
    loadingBox: document.querySelector('#loadingBox'),
    emptyBox: document.querySelector('#emptyBox'),
    summaryTotal: document.querySelector('#summaryTotal'),
    summaryActive: document.querySelector('#summaryActive'),
    summaryInactive: document.querySelector('#summaryInactive'),
    paginationInfo: document.querySelector('#paginationInfo'),
    pageInfo: document.querySelector('#pageInfo'),
    btnPrevious: document.querySelector('#btnPrevious'),
    btnNext: document.querySelector('#btnNext'),
    modal: document.querySelector('#userModal'),
    modalTitle: document.querySelector('#modalTitle'),
    form: document.querySelector('#userForm'),
    userId: document.querySelector('#userId'),
    username: document.querySelector('#username'),
    fullName: document.querySelector('#fullName'),
    role: document.querySelector('#role'),
    password: document.querySelector('#password'),
    passwordRequired: document.querySelector('#passwordRequired'),
    passwordHelp: document.querySelector('#passwordHelp'),
    active: document.querySelector('#active'),
    btnTogglePassword: document.querySelector('#btnTogglePassword'),
    btnSave: document.querySelector('#btnSave'),
    formError: document.querySelector('#formError'),
    toast: document.querySelector('#toast'),
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function roleLabel(role) {
    return { operator: 'Operador', supervisor: 'Supervisor', admin: 'Administrador' }[role] ?? role;
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? '—'
        : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

async function request(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `Erro HTTP ${response.status}.`);
    return body;
}

function showToast(message, type = 'success') {
    el.toast.textContent = message;
    el.toast.className = `toast toast-${type}`;
    el.toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { el.toast.hidden = true; }, 3500);
}

function setLoading(loading) {
    state.loading = loading;
    el.loadingBox.hidden = !loading;
    el.btnApplyFilters.disabled = loading;
    el.btnPrevious.disabled = loading || state.page <= 1;
    el.btnNext.disabled = loading || state.page >= state.totalPages;
}

function buildQuery() {
    const params = new URLSearchParams({ page: state.page, limit: state.limit });
    if (el.filterSearch.value.trim()) params.set('search', el.filterSearch.value.trim());
    if (el.filterRole.value) params.set('role', el.filterRole.value);
    if (el.filterActive.value) params.set('active', el.filterActive.value);
    return params.toString();
}

function renderTable() {
    el.tableBody.innerHTML = state.users.map((user) => `
    <tr>
      <td>${user.id}</td>
      <td><strong>${escapeHtml(user.username)}</strong></td>
      <td>${escapeHtml(user.full_name)}</td>
      <td><span class="role-badge role-${escapeHtml(user.role)}">${escapeHtml(roleLabel(user.role))}</span></td>
      <td><span class="status-badge ${user.active ? 'status-active' : 'status-inactive'}">${user.active ? 'Ativo' : 'Inativo'}</span></td>
      <td>${formatDateTime(user.updated_at)}</td>
      <td class="row-actions">
        <button type="button" class="action-btn edit" data-action="edit" data-id="${user.id}">Editar</button>
        <button type="button" class="action-btn status" data-action="status" data-id="${user.id}">${user.active ? 'Desativar' : 'Ativar'}</button>
        <button type="button" class="action-btn delete" data-action="delete" data-id="${user.id}">Excluir</button>
      </td>
    </tr>
  `).join('');

    el.emptyBox.hidden = state.loading || state.users.length > 0;
}

function renderSummary(pagination) {
    const active = state.users.filter((user) => user.active).length;
    el.summaryTotal.textContent = pagination.total ?? 0;
    el.summaryActive.textContent = active;
    el.summaryInactive.textContent = state.users.length - active;
    el.paginationInfo.textContent = `${pagination.total ?? 0} registro(s)`;
    el.pageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
}

async function loadUsers() {
    setLoading(true);
    el.emptyBox.hidden = true;

    try {
        const result = await request(`${API_URL}?${buildQuery()}`);
        state.users = Array.isArray(result.data) ? result.data : [];
        state.totalPages = Math.max(1, result.pagination?.total_pages || 1);
        if (state.page > state.totalPages) {
            state.page = state.totalPages;
            return loadUsers();
        }
        renderTable();
        renderSummary(result.pagination ?? {});
    } catch (error) {
        state.users = [];
        renderTable();
        showToast(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

function openModal(user = null) {
    el.form.reset();
    el.formError.hidden = true;
    el.userId.value = user?.id ?? '';
    el.username.value = user?.username ?? '';
    el.fullName.value = user?.full_name ?? '';
    el.role.value = user?.role ?? 'operator';
    el.active.checked = user?.active ?? true;
    el.password.value = '';
    el.password.type = 'password';
    el.btnTogglePassword.textContent = 'Mostrar';
    el.modalTitle.textContent = user ? 'Editar usuário' : 'Novo usuário';
    el.passwordRequired.hidden = Boolean(user);
    el.passwordHelp.textContent = user
        ? 'Deixe vazio para manter a senha atual.'
        : 'Mínimo de 8 caracteres.';
    el.modal.hidden = false;
    document.body.classList.add('modal-open');
    window.setTimeout(() => el.username.focus(), 0);
}

function closeModal() {
    el.modal.hidden = true;
    document.body.classList.remove('modal-open');
}

async function saveUser(event) {
    event.preventDefault();
    const id = el.userId.value;
    const password = el.password.value;

    if (!el.username.value.trim() || !el.fullName.value.trim()) {
        el.formError.textContent = 'Preencha o usuário e o nome completo.';
        el.formError.hidden = false;
        return;
    }
    if (!id && password.length < 8) {
        el.formError.textContent = 'A senha deve possuir no mínimo 8 caracteres.';
        el.formError.hidden = false;
        return;
    }
    if (id && password && password.length < 8) {
        el.formError.textContent = 'A nova senha deve possuir no mínimo 8 caracteres.';
        el.formError.hidden = false;
        return;
    }

    const payload = {
        username: el.username.value.trim(),
        full_name: el.fullName.value.trim(),
        role: el.role.value,
        active: el.active.checked,
    };
    if (password) payload.password = password;

    el.btnSave.disabled = true;
    el.btnSave.textContent = 'Salvando...';
    el.formError.hidden = true;

    try {
        await request(id ? `${API_URL}/${id}` : API_URL, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload),
        });
        closeModal();
        showToast(id ? 'Usuário atualizado com sucesso.' : 'Usuário criado com sucesso.');
        await loadUsers();
    } catch (error) {
        el.formError.textContent = error.message;
        el.formError.hidden = false;
    } finally {
        el.btnSave.disabled = false;
        el.btnSave.textContent = 'Salvar usuário';
    }
}

async function changeStatus(user) {
    const action = user.active ? 'desativar' : 'ativar';
    if (!window.confirm(`Deseja ${action} o usuário ${user.username}?`)) return;

    try {
        await request(`${API_URL}/${user.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ active: !user.active }),
        });
        showToast(`Usuário ${user.active ? 'desativado' : 'ativado'} com sucesso.`);
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteUser(user) {
    if (!window.confirm(`Excluir permanentemente o usuário ${user.username}?`)) return;

    try {
        await request(`${API_URL}/${user.id}`, { method: 'DELETE' });
        showToast('Usuário excluído com sucesso.');
        await loadUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

el.btnNew.addEventListener('click', () => openModal());
el.btnApplyFilters.addEventListener('click', () => { state.page = 1; loadUsers(); });
el.btnClearFilters.addEventListener('click', () => {
    el.filterSearch.value = '';
    el.filterRole.value = '';
    el.filterActive.value = '';
    state.page = 1;
    loadUsers();
});
el.filterSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { state.page = 1; loadUsers(); }
});
el.btnPrevious.addEventListener('click', () => {
    if (state.page > 1) { state.page -= 1; loadUsers(); }
});
el.btnNext.addEventListener('click', () => {
    if (state.page < state.totalPages) { state.page += 1; loadUsers(); }
});
el.form.addEventListener('submit', saveUser);
el.btnTogglePassword.addEventListener('click', () => {
    const visible = el.password.type === 'text';
    el.password.type = visible ? 'password' : 'text';
    el.btnTogglePassword.textContent = visible ? 'Mostrar' : 'Ocultar';
});
el.modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-modal]')) closeModal();
});
el.tableBody.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const user = state.users.find((item) => item.id === Number(button.dataset.id));
    if (!user) return;
    if (button.dataset.action === 'edit') openModal(user);
    if (button.dataset.action === 'status') changeStatus(user);
    if (button.dataset.action === 'delete') deleteUser(user);
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !el.modal.hidden) closeModal();
});

loadUsers();
