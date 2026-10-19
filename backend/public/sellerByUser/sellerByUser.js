// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sellerByUser.js — UI Usuário x Vendedor | PRODNEX ERP               ║
// ║ Path: /public/sellerByUser/sellerByUser.js                          ║
// ║ API: /api/seller-by-user                                            ║
// ║ ✅ UPDATE: Modais (User + Seller), atalhos, Enter nos inputs, UX     ║
// ║ ✅ REVIEW: setas (▾) clicáveis + click no campo abre modal           ║
// ╚══════════════════════════════════════════════════════════════════════╝

// (Opcional) Modais inline — se você não tiver estes arquivos ainda,
// comente os imports abaixo.
import { openUsersModalSearch } from '/public/modalsSearch/usersModalSearch.js';
import { openSellersModalSearch } from '/public/modalsSearch/sellersModalSearch.js';

const $ = (id) => document.getElementById(id);

// ----------------------------------------------------------
// Estado
// ----------------------------------------------------------
const state = {
  editingId: null,
  filterUserId: null,
  includeInactive: false,
  rows: [],
};

// ----------------------------------------------------------
// API helpers
// ----------------------------------------------------------
const API_BASE = '';
const api = {
  list: (q = {}) => jget(`/api/seller-by-user?${new URLSearchParams(q).toString()}`),
  listByUser: (userId) => jget(`/api/seller-by-user/user/${encodeURIComponent(userId)}`),
  create: (body) => jpost('/api/seller-by-user', body),
  update: (id, body) => jput(`/api/seller-by-user/${encodeURIComponent(id)}`, body),
  remove: (id) => jdel(`/api/seller-by-user/${encodeURIComponent(id)}`),
  setPrimary: (userId, id) =>
    jpatch(`/api/seller-by-user/user/${encodeURIComponent(userId)}/${encodeURIComponent(id)}/primary`, {}),
  setActive: (id, active) => jpatch(`/api/seller-by-user/${encodeURIComponent(id)}/active`, { active }),
};

// ----------------------------------------------------------
// Fetch wrappers
// ----------------------------------------------------------
async function jget(url) {
  const r = await fetch(API_BASE + url, { headers: { Accept: 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function jpost(url, body) {
  const r = await fetch(API_BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function jput(url, body) {
  const r = await fetch(API_BASE + url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function jpatch(url, body) {
  const r = await fetch(API_BASE + url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}
async function jdel(url) {
  const r = await fetch(API_BASE + url, { method: 'DELETE', headers: { Accept: 'application/json' } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

// ----------------------------------------------------------
// UI helpers
// ----------------------------------------------------------
function toast(msg) {
  if (typeof window.showToast === 'function') return window.showToast(msg);
  alert(msg);
}

function setFormMode(mode, id = null) {
  state.editingId = mode === 'edit' ? id : null;

  const badge = $('formModeBadge');
  const hint = $('formIdHint');

  if (mode === 'edit') {
    badge.classList.remove('badge--new');
    badge.classList.add('badge--edit');
    badge.textContent = 'Modo: Editar Vínculo';
    hint.textContent = id ? `ID em edição: ${id}` : '';
  } else {
    badge.classList.remove('badge--edit');
    badge.classList.add('badge--new');
    badge.textContent = 'Modo: Novo Vínculo';
    hint.textContent = '';
  }
}

function clearForm({ keepFilter = true } = {}) {
  $('inputUserId').value = '';
  $('inputSellerId').value = '';
  $('chkPrimary').checked = false;
  $('chkAtivo').checked = true;
  setFormMode('new');

  // UX: quando clicar em "Novo", mantemos filtro e estado do topo.
  if (!keepFilter) {
    state.filterUserId = null;
    $('inputBuscaUser').value = '';
  }

  // foco
  $('inputUserId')?.focus?.();
}

function fillForm(row) {
  $('inputUserId').value = row.user_id ?? '';
  $('inputSellerId').value = row.seller_id ?? '';
  $('chkPrimary').checked = !!row.is_primary;
  $('chkAtivo').checked = !!row.active;
  setFormMode('edit', row.id);
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('pt-BR');
}

function pillActive(active) {
  return active ? `<span class="pill pill--ok">Ativo</span>` : `<span class="pill pill--off">Inativo</span>`;
}

function pillPrimary(isPrimary) {
  return isPrimary
    ? `<span class="pill"><span class="star">⭐</span> Principal</span>`
    : `<span class="pill pill--ghost">—</span>`;
}

function esc(v) {
  return (v ?? '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isTypingInInput(ev) {
  const el = ev.target;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

// ----------------------------------------------------------
// Metrics
// ----------------------------------------------------------
function renderMetrics(rows) {
  const total = rows.length;
  const ativos = rows.filter((r) => r.active === true).length;
  const principais = rows.filter((r) => r.is_primary === true).length;

  const mTotal = $('mTotal');
  const mAtivos = $('mAtivos');
  const mPrincipais = $('mPrincipais');

  if (mTotal) mTotal.textContent = String(total);
  if (mAtivos) mAtivos.textContent = String(ativos);
  if (mPrincipais) mPrincipais.textContent = String(principais);

  const subtitle = $('tableSubtitle');
  if (subtitle) {
    const filtro = state.filterUserId ? `• Filtrado: User ${state.filterUserId}` : '• Geral';
    const inativos = state.includeInactive ? '• Inclui inativos' : '• Só ativos';
    subtitle.textContent = `${filtro} ${inativos}`;
  }
}

// ----------------------------------------------------------
// Render
// ----------------------------------------------------------
function renderTable(rows) {
  const tbody = $('listaSBU');

  renderMetrics(rows);

  if (!rows?.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="sbu-empty">
            <div style="font-size:22px; margin-bottom:6px;">🧩</div>
            <b>Nenhum vínculo encontrado</b><br>
            Tente remover o filtro, ou clique em <b>Novo Vínculo</b>.
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const active = !!r.active;
      const primary = !!r.is_primary;

      return `
      <tr data-id="${esc(r.id)}">
        <td class="t-right">${esc(r.id)}</td>
        <td>
        <div class="idname">
        <span class="idname__id">#${esc(r.user_id)}</span>
        <span class="idname__name">${esc(r.user_name || r.user_login || r.user_nome || '—')}</span>
        </div>
        </td>

        <td>
        <div class="idname">
        <span class="idname__id">#${esc(r.seller_id)}</span>
        <span class="idname__name">${esc(r.seller_name || r.seller_nome || r.seller_apelido || '—')}</span>
        </div>
        </td>

        <td class="t-center">${pillPrimary(primary)}</td>
        <td class="t-center">${pillActive(active)}</td>
        <td>${esc(fmtDate(r.updated_at || r.created_at))}</td>
        <td>
          <div class="row-actions">
            <button class="btn-mini" data-act="edit" title="Editar">✏️ Editar</button>
            <button class="btn-mini" data-act="primary" ${primary ? 'disabled' : ''} title="Definir como principal">⭐ Principal</button>
            <button class="btn-mini" data-act="toggle" title="Ativar/Inativar">${active ? '⛔ Inativar' : '✅ Ativar'}</button>
            <button class="btn-mini btn-mini--danger" data-act="del" title="Excluir">🗑 Excluir</button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

// ----------------------------------------------------------
// Load
// ----------------------------------------------------------
async function load() {
  const includeInactive = state.includeInactive;

  try {
    let rows = [];

    if (state.filterUserId) {
      const j = await api.listByUser(state.filterUserId);
      rows = j.rows || [];
      if (!includeInactive) rows = rows.filter((x) => x.active === true);
    } else {
      const q = { limit: 500, offset: 0 };
      if (!includeInactive) q.active = true;

      const j = await api.list(q);
      rows = j.rows || [];
    }

    state.rows = rows;
    renderTable(rows);
  } catch (e) {
    toast(e.message || 'Falha ao carregar');
    state.rows = [];
    renderTable([]);
  }
}

// ----------------------------------------------------------
// Modal helpers (User / Seller)
// ----------------------------------------------------------
function pickUserByModal(target = 'form') {
  // target: 'filter' | 'form'
  try {
    openUsersModalSearch({
      apiBase: API_BASE,
      onPick: (u) => {
        const id = u.user_id ?? u.id ?? u.userId ?? u.user ?? u.usuario_id ?? null;
        if (!id) return toast('Usuário sem ID retornado pelo modal.');

        if (target === 'filter') {
          $('inputBuscaUser').value = String(id);
          state.filterUserId = Number(id);
          load();
          return;
        }

        $('inputUserId').value = String(id);
        $('inputSellerId')?.focus?.();
      },
    });
  } catch (e) {
    toast('Modal de usuários não disponível. Verifique o import/arquivo.');
  }
}

function pickSellerByModal() {
  try {
    openSellersModalSearch({
      apiBase: API_BASE,
      onPick: (s) => {
        const id = s.seller_id ?? s.id ?? s.sellerId ?? s.vendedor_id ?? s.vendedorId ?? null;
        if (!id) return toast('Vendedor sem ID retornado pelo modal.');
        $('inputSellerId').value = String(id);
        $('chkPrimary')?.focus?.();
      },
    });
  } catch (e) {
    toast('Modal de vendedores não disponível. Verifique o import/arquivo.');
  }
}

// ----------------------------------------------------------
// Actions
// ----------------------------------------------------------
async function onSave() {
  const user_id = Number($('inputUserId').value || 0);
  const seller_id = Number($('inputSellerId').value || 0);
  const is_primary = !!$('chkPrimary').checked;
  const active = !!$('chkAtivo').checked;

  if (!user_id) return toast('Informe o User ID.');
  if (!seller_id) return toast('Informe o Seller ID.');

  try {
    if (state.editingId) {
      await api.update(state.editingId, { user_id, seller_id, is_primary, active });
      toast('Vínculo atualizado.');
    } else {
      await api.create({ user_id, seller_id, is_primary, active });
      toast('Vínculo criado.');
    }

    // mantém filtro por user se o user_id foi usado no filtro
    if (state.filterUserId && state.filterUserId !== user_id) {
      state.filterUserId = user_id;
      $('inputBuscaUser').value = String(user_id);
    }

    clearForm({ keepFilter: true });
    await load();
  } catch (e) {
    toast(e.message || 'Falha ao salvar');
  }
}

async function onRowAction(ev) {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;

  const tr = ev.target.closest('tr[data-id]');
  if (!tr) return;

  const id = Number(tr.dataset.id);
  const row = state.rows.find((x) => Number(x.id) === id);
  if (!row) return;

  const act = btn.dataset.act;

  try {
    if (act === 'edit') {
      fillForm(row);
      document.getElementById('formWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (act === 'primary') {
      const userId = Number(row.user_id);
      if (!userId) return toast('user_id inválido no registro.');

      await api.setPrimary(userId, id);
      toast('Principal atualizado.');
      await load();
      return;
    }

    if (act === 'toggle') {
      const next = !row.active;
      await api.setActive(id, next);
      toast(next ? 'Ativado.' : 'Inativado.');
      await load();
      return;
    }

    if (act === 'del') {
      const okDel = confirm(`Excluir vínculo ID ${id}? Essa ação não pode ser desfeita.`);
      if (!okDel) return;

      await api.remove(id);
      toast('Removido.');
      if (state.editingId === id) clearForm({ keepFilter: true });
      await load();
      return;
    }
  } catch (e) {
    toast(e.message || 'Falha na ação');
  }
}

// ----------------------------------------------------------
// Events
// ----------------------------------------------------------
function bind() {
  // botões topo/form
  $('btnNovo').addEventListener('click', () => clearForm({ keepFilter: true }));
  $('btnCancelar').addEventListener('click', () => clearForm({ keepFilter: true }));
  $('btnSalvar').addEventListener('click', () => onSave());

  // incluir inativos
  $('chkInativos').addEventListener('change', async (e) => {
    state.includeInactive = !!e.target.checked;
    await load();
  });

  // filtro por user
  $('btnFiltrarUser').addEventListener('click', async () => {
    const v = $('inputBuscaUser').value.trim();
    state.filterUserId = v ? Number(v) : null;
    await load();
  });

  $('inputBuscaUser').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('btnFiltrarUser').click();
    }
    if (e.key === 'Escape') {
      $('inputBuscaUser').value = '';
      state.filterUserId = null;
      await load();
    }
    // Ctrl+K abre modal de users no filtro
    if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      pickUserByModal('filter');
    }
  });

  // tabela
  $('listaSBU').addEventListener('click', onRowAction);

  // atalhos no form
  $('inputUserId').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('inputSellerId')?.focus?.();
    }
    // F2 ou Ctrl+K abre modal de users para preencher user_id
    if (e.key === 'F2' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      pickUserByModal('form');
    }
  });

  $('inputSellerId').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('chkPrimary')?.focus?.();
    }
    // F2 ou Ctrl+K abre modal de sellers para preencher seller_id
    if (e.key === 'F2' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      pickSellerByModal();
    }
  });

  // duplo clique abre modal (UX)
  $('inputUserId').addEventListener('dblclick', () => pickUserByModal('form'));
  $('inputSellerId').addEventListener('dblclick', () => pickSellerByModal());

  // ✅ SETAS (▾) — abre modal ao clicar na seta dentro do input
  // HTML esperado:
  // <button class="input-arrow" data-arrow="user">▾</button>
  // <button class="input-arrow" data-arrow="seller">▾</button>
  document.querySelectorAll('.input-arrow[data-arrow]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const type = String(btn.dataset.arrow || '').toLowerCase();
      if (type === 'user') return pickUserByModal('form');
      if (type === 'seller') return pickSellerByModal();
    });
  });

  // ✅ Clique no campo/área do input também abre modal (premium)
  // - Se você NÃO quiser isso, pode apagar este bloco.
  const userWrap = $('inputUserId')?.closest?.('.input-arrow-wrap');
  if (userWrap) {
    userWrap.addEventListener('click', (e) => {
      const isArrow = e.target?.closest?.('.input-arrow');
      if (isArrow) return; // seta já trata
      // só abre se clicar no wrap (não se estiver selecionando texto)
      // abre com Alt+Click OU click em área vazia do wrap
    });
  }

  const sellerWrap = $('inputSellerId')?.closest?.('.input-arrow-wrap');
  if (sellerWrap) {
    sellerWrap.addEventListener('click', (e) => {
      const isArrow = e.target?.closest?.('.input-arrow');
      if (isArrow) return;
    });
  }

  // atalhos globais (não atrapalha digitando)
  document.addEventListener('keydown', (e) => {
    if (isTypingInInput(e) && !(e.ctrlKey || e.metaKey)) return;

    // N = novo
    if (e.key.toLowerCase() === 'n' && !(e.ctrlKey || e.metaKey) && !e.altKey) {
      e.preventDefault();
      clearForm({ keepFilter: true });
      document.getElementById('formWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // Ctrl+S = salvar
    if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onSave();
      return;
    }

    // Esc = cancelar edição
    if (e.key === 'Escape') {
      if (state.editingId) {
        e.preventDefault();
        clearForm({ keepFilter: true });
      }
    }
  });
}

// ----------------------------------------------------------
// Boot
// ----------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  bind();
  clearForm({ keepFilter: true });
  await load();
});
