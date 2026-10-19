// ╔══════════════════════════════════════════════════════════════════════╗
// ║ userEmailAccounts.js — Vínculo Usuários x Contas de E-mail          ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ║ Rotas esperadas:                                                    ║
// ║   GET    /api/user-email-accounts                                   ║
// ║   GET    /api/user-email-accounts/:id                               ║
// ║   POST   /api/user-email-accounts                                   ║
// ║   PUT    /api/user-email-accounts/:id                               ║
// ║   DELETE /api/user-email-accounts/:id                               ║
// ║   GET    /api/users                                                 ║
// ║   GET    /api/email-accounts                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_LINKS = '/api/user-email-accounts';
const API_USERS = '/api/users';
const API_EMAIL_ACCOUNTS = '/api/email/accounts';

const state = {
    page: 1,
    pageSize: 50,
    totalPages: 1,
    total: 0,
    items: [],
    users: [],
    emailAccounts: [],
    editingId: null,
};

const dom = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    bindDom();
    bindEvents();

    try {
        await loadUsers();
    } catch (error) {
        console.error('[userEmailAccounts.init.loadUsers]', error);
        showToast(`Erro ao carregar usuários: ${error.message}`, 'error');
        return;
    }

    try {
        await loadEmailAccounts();
    } catch (error) {
        console.error('[userEmailAccounts.init.loadEmailAccounts]', error);
        showToast(`Erro ao carregar contas de e-mail: ${error.message}`, 'error');
        return;
    }

    try {
        await loadLinks();
    } catch (error) {
        console.error('[userEmailAccounts.init.loadLinks]', error);
        showToast(`Erro ao carregar vínculos: ${error.message}`, 'error');
    }
}

function bindDom() {
    dom.filtroBusca = document.getElementById('filtroBusca');
    dom.filtroUser = document.getElementById('filtroUser');
    dom.filtroEmailAccount = document.getElementById('filtroEmailAccount');
    dom.filtroDefault = document.getElementById('filtroDefault');
    dom.filtroCanRead = document.getElementById('filtroCanRead');
    dom.filtroCanSend = document.getElementById('filtroCanSend');

    dom.btnFiltrar = document.getElementById('btnFiltrar');
    dom.btnLimparFiltros = document.getElementById('btnLimparFiltros');
    dom.btnAtualizar = document.getElementById('btnAtualizar');
    dom.btnNovo = document.getElementById('btnNovo');

    dom.linkForm = document.getElementById('linkForm');
    dom.linkId = document.getElementById('linkId');
    dom.userId = document.getElementById('userId');
    dom.emailAccountId = document.getElementById('emailAccountId');
    dom.isDefault = document.getElementById('isDefault');
    dom.canRead = document.getElementById('canRead');
    dom.canSend = document.getElementById('canSend');

    dom.formTitle = document.getElementById('formTitle');
    dom.editingBadge = document.getElementById('editingBadge');
    dom.btnCancelarEdicao = document.getElementById('btnCancelarEdicao');

    dom.tableBody = document.getElementById('tableBody');
    dom.apTableInfo = document.getElementById('apTableInfo');
    dom.apPageInfo = document.getElementById('apPageInfo');
    dom.btnPreviousPage = document.getElementById('btnPreviousPage');
    dom.btnNextPage = document.getElementById('btnNextPage');

    dom.toast = document.getElementById('toast');
}

function bindEvents() {
    dom.btnFiltrar?.addEventListener('click', async () => {
        state.page = 1;
        await loadLinks();
    });

    dom.btnLimparFiltros?.addEventListener('click', async () => {
        clearFilters();
        state.page = 1;
        await loadLinks();
    });

    dom.btnAtualizar?.addEventListener('click', async () => {
        await refreshAll();
    });

    dom.btnNovo?.addEventListener('click', () => {
        resetForm();
        dom.userId?.focus();
    });

    dom.linkForm?.addEventListener('submit', onSubmitForm);

    dom.btnCancelarEdicao?.addEventListener('click', () => {
        resetForm();
    });

    dom.btnPreviousPage?.addEventListener('click', async () => {
        if (state.page <= 1) return;
        state.page -= 1;
        await loadLinks();
    });

    dom.btnNextPage?.addEventListener('click', async () => {
        if (state.page >= state.totalPages) return;
        state.page += 1;
        await loadLinks();
    });

    dom.filtroBusca?.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            state.page = 1;
            await loadLinks();
        }
    });

    dom.tableBody?.addEventListener('click', async (event) => {
        const editBtn = event.target.closest('[data-action="edit"]');
        const deleteBtn = event.target.closest('[data-action="delete"]');

        if (editBtn) {
            const id = Number(editBtn.dataset.id);
            if (id) await editItem(id);
        }

        if (deleteBtn) {
            const id = Number(deleteBtn.dataset.id);
            if (id) await deleteItem(id);
        }
    });
}

async function refreshAll() {
    await Promise.all([
        loadUsers(),
        loadEmailAccounts(),
    ]);
    await loadLinks();
}

function clearFilters() {
    dom.filtroBusca.value = '';
    dom.filtroUser.value = '';
    dom.filtroEmailAccount.value = '';
    dom.filtroDefault.value = '';
    dom.filtroCanRead.value = '';
    dom.filtroCanSend.value = '';
}

function resetForm() {
    state.editingId = null;

    dom.linkId.value = '';
    dom.userId.value = '';
    dom.emailAccountId.value = '';
    dom.isDefault.checked = false;
    dom.canRead.checked = true;
    dom.canSend.checked = true;

    dom.formTitle.textContent = 'Novo vínculo';
    dom.editingBadge.classList.add('hidden');
}

function setEditingMode(item) {
    state.editingId = Number(item.id);

    dom.linkId.value = String(item.id ?? '');
    dom.userId.value = String(item.user_id ?? '');
    dom.emailAccountId.value = String(item.email_account_id ?? '');
    dom.isDefault.checked = toBool(item.is_default, false);
    dom.canRead.checked = toBool(item.can_read, true);
    dom.canSend.checked = toBool(item.can_send, true);

    dom.formTitle.textContent = `Editando vínculo #${item.id}`;
    dom.editingBadge.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function editItem(id) {
    try {
        const res = await fetchJson(`${API_LINKS}/${id}`);
        const item = res?.item || null;

        if (!item) {
            showToast('Vínculo não encontrado.', 'warning');
            return;
        }

        setEditingMode(item);
    } catch (error) {
        console.error('[userEmailAccounts.editItem]', error);
        showToast(error.message || 'Erro ao carregar vínculo.', 'error');
    }
}

async function deleteItem(id) {
    const confirmed = window.confirm(`Deseja realmente excluir o vínculo #${id}?`);
    if (!confirmed) return;

    try {
        await fetchJson(`${API_LINKS}/${id}`, {
            method: 'DELETE',
        });

        showToast('Vínculo excluído com sucesso.', 'success');

        if (state.editingId === id) {
            resetForm();
        }

        if (state.page > 1 && state.items.length === 1) {
            state.page -= 1;
        }

        await loadLinks();
    } catch (error) {
        console.error('[userEmailAccounts.deleteItem]', error);
        showToast(error.message || 'Erro ao excluir vínculo.', 'error');
    }
}

async function onSubmitForm(event) {
    event.preventDefault();

    const payload = {
        user_id: toIntOrNull(dom.userId.value),
        email_account_id: toIntOrNull(dom.emailAccountId.value),
        is_default: !!dom.isDefault.checked,
        can_read: !!dom.canRead.checked,
        can_send: !!dom.canSend.checked,
    };

    if (!payload.user_id) {
        showToast('Selecione um usuário.', 'warning');
        dom.userId.focus();
        return;
    }

    if (!payload.email_account_id) {
        showToast('Selecione uma conta de e-mail.', 'warning');
        dom.emailAccountId.focus();
        return;
    }

    try {
        if (state.editingId) {
            await fetchJson(`${API_LINKS}/${state.editingId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            showToast('Vínculo atualizado com sucesso.', 'success');
        } else {
            await fetchJson(API_LINKS, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            showToast('Vínculo criado com sucesso.', 'success');
        }

        resetForm();
        await loadLinks();
    } catch (error) {
        console.error('[userEmailAccounts.onSubmitForm]', error);
        showToast(error.message || 'Erro ao salvar vínculo.', 'error');
    }
}

async function loadLinks() {
    setTableLoading();

    try {
        const query = new URLSearchParams();
        query.set('page', String(state.page));
        query.set('pageSize', String(state.pageSize));

        const q = dom.filtroBusca.value.trim();
        const userId = dom.filtroUser.value;
        const emailAccountId = dom.filtroEmailAccount.value;
        const isDefault = dom.filtroDefault.value;
        const canRead = dom.filtroCanRead.value;
        const canSend = dom.filtroCanSend.value;

        if (q) query.set('q', q);
        if (userId) query.set('user_id', userId);
        if (emailAccountId) query.set('email_account_id', emailAccountId);
        if (isDefault) query.set('is_default', isDefault);
        if (canRead) query.set('can_read', canRead);
        if (canSend) query.set('can_send', canSend);

        const url = `${API_LINKS}?${query.toString()}`;
        const res = await fetchJson(url);

        state.items = normalizeItemsResponse(res);
        state.total = Number(res?.total || state.items.length || 0);
        state.totalPages = Math.max(1, Number(res?.totalPages || 1));

        renderTable();
        updatePagination();
    } catch (error) {
        console.error('[userEmailAccounts.loadLinks]', error);
        state.items = [];
        state.total = 0;
        state.totalPages = 1;
        renderTable(error.message || 'Erro ao carregar vínculos.');
        updatePagination();
    }
}

async function loadUsers() {
    const items = await fetchAllPages(API_USERS, {
        pageSize: 200,
    });

    state.users = items
        .map((item) => ({
            ...item,
            id: item?.id ?? item?.user_id ?? null,
        }))
        .filter((item) => item && item.id != null)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

    populateUsersSelects();
}

async function loadEmailAccounts() {
    const items = await fetchAllPages(API_EMAIL_ACCOUNTS, {
        pageSize: 200,
    });

    state.emailAccounts = items
        .map((item) => ({
            ...item,
            id: item?.id ?? item?.email_account_id ?? item?.account_id ?? null,
            label: item?.label ?? item?.name ?? '',
            email_address: item?.email_address ?? item?.email ?? item?.address ?? '',
        }))
        .filter((item) => item && item.id != null)
        .sort((a, b) =>
            String(a.label || a.email_address || '').localeCompare(
                String(b.label || b.email_address || ''),
                'pt-BR'
            )
        );

    populateEmailAccountsSelects();
}

function populateUsersSelects() {
    populateSelect(dom.userId, state.users, {
        firstOption: { value: '', label: 'Selecione' },
        valueKey: 'id',
        labelBuilder: (item) => {
            const name = item.name || `Usuário ${item.id}`;
            const email = item.email ? ` — ${item.email}` : '';
            const level = item.access_level ? ` (${item.access_level})` : '';
            return `${name}${email}${level}`;
        },
    });

    populateSelect(dom.filtroUser, state.users, {
        firstOption: { value: '', label: 'Todos' },
        valueKey: 'id',
        labelBuilder: (item) => {
            const name = item.name || `Usuário ${item.id}`;
            const email = item.email ? ` — ${item.email}` : '';
            return `${name}${email}`;
        },
    });
}

function populateEmailAccountsSelects() {
    console.log('[populateEmailAccountsSelects] state.emailAccounts:', state.emailAccounts);

    populateSelect(dom.emailAccountId, state.emailAccounts, {
        firstOption: { value: '', label: 'Selecione' },
        valueKey: 'id',
        labelBuilder: (item) => {
            const label = item.label || 'Sem label';
            const email = item.email_address ? ` — ${item.email_address}` : '';
            return `${label}${email}`;
        },
    });

    populateSelect(dom.filtroEmailAccount, state.emailAccounts, {
        firstOption: { value: '', label: 'Todas' },
        valueKey: 'id',
        labelBuilder: (item) => {
            const label = item.label || 'Sem label';
            const email = item.email_address ? ` — ${item.email_address}` : '';
            return `${label}${email}`;
        },
    });
}

function populateSelect(select, items, options = {}) {
    if (!select) return;

    const {
        firstOption = null,
        valueKey = 'id',
        labelBuilder = (item) => String(item?.name || item?.label || item?.id || ''),
    } = options;

    const currentValue = select.value;
    select.innerHTML = '';

    if (firstOption) {
        const opt = document.createElement('option');
        opt.value = firstOption.value;
        opt.textContent = firstOption.label;
        select.appendChild(opt);
    }

    for (const item of items) {
        const opt = document.createElement('option');
        opt.value = String(item[valueKey] ?? '');
        opt.textContent = labelBuilder(item);
        select.appendChild(opt);
    }

    if ([...select.options].some((o) => o.value === currentValue)) {
        select.value = currentValue;
    }
}

function renderTable(errorMessage = '') {
    const rows = state.items || [];

    dom.apTableInfo.textContent = `${state.total} registro(s)`;

    if (errorMessage) {
        dom.tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">${escapeHtml(errorMessage)}</td>
      </tr>
    `;
        return;
    }

    if (!rows.length) {
        dom.tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-state">Nenhum vínculo encontrado.</td>
      </tr>
    `;
        return;
    }

    dom.tableBody.innerHTML = rows.map((item) => {
        const userName = item.user_name || `Usuário ${item.user_id || ''}`;
        const userEmail = item.user_email || '';
        const accountAddress = item.email_account_address || '';
        const accountLabel = item.email_account_label || '-';

        return `
      <tr>
        <td>${escapeHtml(String(item.id ?? ''))}</td>
        <td>
          <strong>${escapeHtml(userName)}</strong>
          ${userEmail ? `<br><small>${escapeHtml(userEmail)}</small>` : ''}
        </td>
        <td>${escapeHtml(accountAddress || '-')}</td>
        <td>${escapeHtml(accountLabel)}</td>
        <td>${renderTag(toBool(item.is_default, false))}</td>
        <td>${renderTag(toBool(item.can_read, true))}</td>
        <td>${renderTag(toBool(item.can_send, true))}</td>
        <td>${escapeHtml(formatDateTime(item.created_at))}</td>
        <td class="td-actions">
          <div class="row-actions">
            <button
              type="button"
              class="btn btn-new btn-sm"
              data-action="edit"
              data-id="${escapeHtml(String(item.id ?? ''))}"
            >
              Editar
            </button>
            <button
              type="button"
              class="btn btn-new btn-sm"
              data-action="delete"
              data-id="${escapeHtml(String(item.id ?? ''))}"
            >
              Excluir
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
}

function renderTag(value) {
    if (value) {
        return `<span class="tag tag-yes">Sim</span>`;
    }
    return `<span class="tag tag-no">Não</span>`;
}

function updatePagination() {
    dom.apPageInfo.textContent = `Página ${state.page} de ${state.totalPages}`;
    dom.btnPreviousPage.disabled = state.page <= 1;
    dom.btnNextPage.disabled = state.page >= state.totalPages;
}

function setTableLoading() {
    dom.tableBody.innerHTML = `
    <tr>
      <td colspan="9" class="empty-state">Carregando...</td>
    </tr>
  `;
}

async function fetchAllPages(baseUrl, options = {}) {
    const pageSize = Number(options.pageSize || 200);
    const maxPages = Number(options.maxPages || 30);

    let page = 1;
    let aggregated = [];

    while (page <= maxPages) {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));

        const res = await fetchJson(`${baseUrl}?${params.toString()}`);
        const items = normalizeItemsResponse(res);

        if (!items.length && page === 1) {
            break;
        }

        aggregated = aggregated.concat(items);

        const totalPages = Number(res?.totalPages || 1);
        if (page >= totalPages) break;

        page += 1;
    }

    return dedupeById(
        aggregated.map((item) => ({
            ...item,
            id: item?.id ?? item?.user_id ?? item?.email_account_id ?? null,
        }))
    );
}

function normalizeItemsResponse(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.accounts)) return res.accounts;
    if (Array.isArray(res?.items)) return res.items;
    if (Array.isArray(res?.rows)) return res.rows;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.rows)) return res.data.rows;
    if (Array.isArray(res?.result)) return res.result;
    return [];
}

function dedupeById(items) {
    const map = new Map();

    for (const item of items || []) {
        if (!item) continue;

        const key =
            item.id ??
            item.user_id ??
            item.email_account_id ??
            item.account_id ??
            null;

        if (key == null) continue;

        map.set(String(key), item);
    }

    return [...map.values()];
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    });

    const text = await response.text();
    let data = null;

    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }

    if (!response.ok || (data && data.ok === false)) {
        const message =
            data?.message ||
            data?.error ||
            `HTTP ${response.status} ao acessar ${url}`;
        throw new Error(message);
    }

    return data;
}

function toBool(value, fallback = false) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return fallback;
}

function toIntOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
}

function formatDateTime(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(d);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

let toastTimer = null;
function showToast(message, type = 'success') {
    if (!dom.toast) return;

    dom.toast.textContent = message || '';
    dom.toast.className = `toast ${type}`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        dom.toast.className = 'toast hidden';
    }, 3200);
}