// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterpriseModalSearch.js — Modal de Busca de Empresas               ║
// ║ PRODNEX ERP | Frontend ESM                                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

const MODAL_ID = 'enterpriseSearchModal';

const DEFAULT_API_BASE = '/api/enterprises';

function $(sel, root = document) {
  return root.querySelector(sel);
}

function onlyDigits(v) {
  return String(v ?? '').replace(/\D+/g, '');
}

function formatCnpj(value) {
  const v = onlyDigits(value).slice(0, 14);
  if (v.length <= 2) return v;
  if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`;
  if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
  if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
  return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getApiBase(apiBase) {
  return String(apiBase || window.apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
}

function getHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('token');

  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizeListPayload(payload) {
  if (Array.isArray(payload)) {
    return { rows: payload, total: payload.length };
  }

  const rows =
    payload?.rows ||
    payload?.data ||
    payload?.items ||
    payload?.enterprises ||
    payload?.result ||
    [];

  const total =
    payload?.total ??
    payload?.count ??
    payload?.pagination?.total ??
    rows.length;

  return {
    rows: Array.isArray(rows) ? rows : [],
    total: Number(total) || 0,
  };
}

function createModal() {
  const old = document.getElementById(MODAL_ID);
  if (old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = MODAL_ID;
  wrap.className = 'enterprise-modal-backdrop';
  wrap.innerHTML = `
    <div class="enterprise-modal" role="dialog" aria-modal="true">
      <div class="enterprise-modal__header">
        <div>
          <h2>Buscar Empresa</h2>
          <p>Pesquise por razão social, nome fantasia, CNPJ, e-mail ou cidade.</p>
        </div>
        <button type="button" class="enterprise-modal__close" data-action="close">×</button>
      </div>

      <div class="enterprise-modal__toolbar">
        <input id="enterpriseModalQ" type="search" placeholder="Buscar empresa..." autocomplete="off" />
        <select id="enterpriseModalActive">
          <option value="true">Somente ativas</option>
          <option value="">Todas</option>
          <option value="false">Somente inativas</option>
        </select>
        <button type="button" class="btn btn-toolbar btn-sm" data-action="search">Buscar</button>
      </div>

      <div class="enterprise-modal__body">
        <table class="enterprise-modal__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Razão Social</th>
              <th>Nome Fantasia</th>
              <th>CNPJ</th>
              <th>Cidade/UF</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="enterpriseModalRows">
            <tr>
              <td colspan="6" class="enterprise-modal__empty">Digite para buscar.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="enterprise-modal__footer">
        <button type="button" class="btn btn-toolbar btn-sm" data-action="prev">Anterior</button>
        <span id="enterpriseModalInfo">Página 1</span>
        <button type="button" class="btn btn-toolbar btn-sm" data-action="next">Próxima</button>
      </div>
    </div>
  `;

  document.body.appendChild(wrap);
  return wrap;
}

export function openEnterpriseSearchModal({
  apiBase = DEFAULT_API_BASE,
  onPick,
  onlyActive = true,
  limit = 20,
} = {}) {
  const modal = createModal();
  const api = getApiBase(apiBase);

  const state = {
    q: '',
    is_active: onlyActive ? 'true' : '',
    limit,
    offset: 0,
    total: 0,
    rows: [],
  };

  const els = {
    q: $('#enterpriseModalQ', modal),
    active: $('#enterpriseModalActive', modal),
    rows: $('#enterpriseModalRows', modal),
    info: $('#enterpriseModalInfo', modal),
  };

  els.active.value = state.is_active;

  function close() {
    document.removeEventListener('keydown', onKeyDown);
    modal.remove();
  }

  function renderRows() {
    if (!state.rows.length) {
      els.rows.innerHTML = `
        <tr>
          <td colspan="6" class="enterprise-modal__empty">Nenhuma empresa encontrada.</td>
        </tr>
      `;
      return;
    }

    els.rows.innerHTML = state.rows.map((e) => `
      <tr data-id="${escapeHtml(e.id)}">
        <td>${escapeHtml(e.id)}</td>
        <td>${escapeHtml(e.corporate_name)}</td>
        <td>${escapeHtml(e.trade_name)}</td>
        <td>${escapeHtml(formatCnpj(e.cnpj))}</td>
        <td>${escapeHtml([e.city, e.state].filter(Boolean).join('/'))}</td>
        <td>${e.is_active ? 'Ativa' : 'Inativa'}</td>
      </tr>
    `).join('');
  }

  function renderFooter() {
    const page = Math.floor(state.offset / state.limit) + 1;
    const pages = Math.max(1, Math.ceil(state.total / state.limit));

    els.info.textContent = `Página ${page} de ${pages} • ${state.total} registro(s)`;
  }

  async function load() {
    els.rows.innerHTML = `
      <tr>
        <td colspan="6" class="enterprise-modal__empty">Carregando...</td>
      </tr>
    `;

    const params = new URLSearchParams();
    params.set('limit', state.limit);
    params.set('offset', state.offset);

    if (state.q) params.set('q', state.q);
    if (state.is_active !== '') params.set('is_active', state.is_active);

    const res = await fetch(`${api}?${params.toString()}`, {
      headers: getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Erro ao buscar empresas. HTTP ${res.status}`);
    }

    const payload = await res.json();
    const normalized = normalizeListPayload(payload);

    state.rows = normalized.rows;
    state.total = normalized.total;

    renderRows();
    renderFooter();
  }

  function search() {
    state.q = els.q.value.trim();
    state.is_active = els.active.value;
    state.offset = 0;
    load().catch((err) => {
      console.error(err);
      els.rows.innerHTML = `
        <tr>
          <td colspan="6" class="enterprise-modal__empty">Erro ao carregar empresas.</td>
        </tr>
      `;
    });
  }

  function pickById(id) {
    const item = state.rows.find((row) => String(row.id) === String(id));
    if (!item) return;

    if (typeof onPick === 'function') {
      onPick(item);
    }

    close();
  }

  function onKeyDown(ev) {
    if (ev.key === 'Escape') close();

    if (ev.key === 'Enter' && document.activeElement === els.q) {
      ev.preventDefault();
      search();
    }
  }

  modal.addEventListener('click', (ev) => {
    const action = ev.target?.dataset?.action;

    if (action === 'close') close();

    if (action === 'search') search();

    if (action === 'prev') {
      state.offset = Math.max(0, state.offset - state.limit);
      load().catch(console.error);
    }

    if (action === 'next') {
      if (state.offset + state.limit < state.total) {
        state.offset += state.limit;
        load().catch(console.error);
      }
    }

    const tr = ev.target.closest('tr[data-id]');
    if (tr) pickById(tr.dataset.id);

    if (ev.target === modal) close();
  });

  document.addEventListener('keydown', onKeyDown);

  els.q.focus();
  load().catch(console.error);

  return {
    close,
    reload: load,
  };
}

export default openEnterpriseSearchModal;