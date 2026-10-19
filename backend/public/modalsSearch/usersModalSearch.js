// ╔══════════════════════════════════════════════════════════════════╗
// ║ usersModalSearch.js — Modal para buscar USUÁRIOS                   ║
// ║ exporta: openUsersModalSearch({ apiBase, onPick(user) })           ║
// ║ Layout: /public/includes/css/modals.css (via style.css)            ║
// ║ Controle: Modal de /public/includes/js/modal.js                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';

const MODAL_ID = 'usersModalSearch';
const CSS_HREF = '/public/modalsSearch/usersModalSearch.css?v=2';

let els = null;
let current = { apiBase: '', onPick: null };
let rowsCache = [];

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureCss() {
  if (document.querySelector(`link[href="${CSS_HREF}"]`)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  document.head.appendChild(link);
}

function ensureModal() {
  if (els) return els;

  ensureCss();
  Modal.setup();

  const root = document.createElement('div');
  root.id = MODAL_ID;
  root.className = 'modal modal-width-8 ums-modal';
  root.setAttribute('aria-hidden', 'true');

  root.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">
      <section class="modal__panel" role="dialog" aria-modal="true"
        aria-labelledby="umsTitle" tabindex="-1">

        <header class="modal__header modal-header-color-3">
          <h2 id="umsTitle" class="modal__title">
            Buscar Usuário <span id="umsChip" class="ums-chip"></span>
          </h2>

          <button type="button" class="modal__close" data-modal-close
            title="Fechar" aria-label="Fechar">&times;</button>
        </header>

        <div class="modal__body">
          <div class="ums-filters">
            <div class="fields fields-h-6 fields-w-full fields-font-3">
              <label for="umsQuery">Pesquisar</label>
              <input id="umsQuery" type="text" autocomplete="off"
                placeholder="Digite nome, e-mail, login, ID…" />
            </div>

            <label class="ums-check">
              <input id="umsInactive" type="checkbox" />
              Incluir inativos
            </label>

            <button type="button" id="umsSearchBtn" class="btn btn-toolbar btn-sm">
              Buscar
            </button>
          </div>

          <div class="modal-divider"></div>

          <div class="table-scroll table-scroll--rounded ums-results">
            <table class="table table-bounded table-zebra table-zebra-hover table-sticky-head">
              <thead>
                <tr>
                  <th class="ums-col-id">ID</th>
                  <th>Nome</th>
                  <th>Login/E-mail</th>
                  <th class="ums-col-status">Status</th>
                </tr>
              </thead>
              <tbody id="umsTbody"></tbody>
            </table>
          </div>
        </div>

        <footer class="modal__footer ums-footer">
          <span id="umsStatus">Digite e clique em “Buscar”.</span>
        </footer>

      </section>
    </div>
  `;

  document.body.appendChild(root);

  els = {
    root,
    query: root.querySelector('#umsQuery'),
    inactive: root.querySelector('#umsInactive'),
    searchBtn: root.querySelector('#umsSearchBtn'),
    tbody: root.querySelector('#umsTbody'),
    status: root.querySelector('#umsStatus'),
    chip: root.querySelector('#umsChip'),
  };

  els.searchBtn.addEventListener('click', buscar);
  els.inactive.addEventListener('change', buscar);
  els.query.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      buscar();
    }
  });

  els.tbody.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr[data-idx]');
    if (!tr) return;
    pick(rowsCache[Number(tr.dataset.idx)]);
  });

  els.tbody.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const tr = ev.target.closest('tr[data-idx]');
    if (!tr) return;
    ev.preventDefault();
    pick(rowsCache[Number(tr.dataset.idx)]);
  });

  return els;
}

function pick(user) {
  if (!user) return;

  const onPick = current.onPick;
  Modal.close(els.root);

  try {
    onPick?.(user);
  } catch (e) {
    console.error('[usersModalSearch] onPick:', e);
  }
}

function badgeStatus(active) {
  return active
    ? '<span class="ums-badge ums-badge--on">Ativo</span>'
    : '<span class="ums-badge ums-badge--off">Inativo</span>';
}

async function fetchJSON(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${t}`);
  try { return JSON.parse(t); } catch { return t; }
}

async function buscar() {
  // Termo vazio lista todos os usuários.
  const termo = els.query.value.trim();

  els.status.textContent = 'Pesquisando…';
  els.chip.textContent = '';
  els.tbody.innerHTML = '';

  try {
    const base = current.apiBase || window.location.origin;

    // GET /api/users/search?q=...&limit=...&is_active=...
    // Sem is_active o backend retorna ativos e inativos.
    const url = new URL('/api/users/search', base);
    url.searchParams.set('q', termo);
    url.searchParams.set('limit', '200');
    if (!els.inactive.checked) url.searchParams.set('is_active', 'true');

    const data = await fetchJSON(url.toString());
    const rows = Array.isArray(data) ? data : (data.rows || []);
    rowsCache = rows;

    els.tbody.innerHTML = rows.map((u, idx) => {
      const id = u.user_id ?? u.id ?? '';
      const name = u.name ?? u.full_name ?? u.display_name ?? u.username ?? '';
      const login = u.email ?? u.login ?? u.username ?? '';
      const active = (u.is_active ?? u.active ?? true) === true;

      return `
        <tr data-idx="${idx}" tabindex="0" class="ums-row">
          <td class="ums-col-id"><strong>${esc(id)}</strong></td>
          <td>${esc(name)}</td>
          <td>${esc(login)}</td>
          <td class="ums-col-status">${badgeStatus(active)}</td>
        </tr>
      `;
    }).join('');

    els.chip.textContent = rows.length ? `• ${rows.length} encontrado(s)` : '';
    els.status.textContent = rows.length
      ? 'Clique em um registro para selecionar.'
      : 'Nenhum resultado encontrado.';
  } catch (e) {
    console.error('[usersModalSearch] buscar:', e);
    els.status.textContent = 'Erro ao buscar usuários.';
  }
}

export function openUsersModalSearch({ apiBase = '', onPick } = {}) {
  ensureModal();

  current = {
    apiBase: (apiBase || '').trim().replace(/\/$/, ''),
    onPick,
  };

  Modal.open(els.root, { focusSelector: '#umsQuery' });
  buscar();
}
