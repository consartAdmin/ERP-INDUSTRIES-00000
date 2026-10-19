// backend\public\modalsSearch\chartAccountsModalSearch.js

'use strict';

const MODAL_ID = 'chartAccountsModalSearch';
const API_URL = '/api/chart-of-accounts';

let resolveModalPromise = null;
let currentSelectedIndex = -1;
let currentRows = [];
let currentFocusEls = [];
let initialized = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function ensureModal() {
  if (document.getElementById(MODAL_ID)) return;

  const root = document.createElement('div');

  root.id = MODAL_ID;
  root.className = 'modal modal-width-9 modal-height-8';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');

  root.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">

      <section
        class="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chartAccountsSearchTitle"
      >

        <!-- HEADER -->
        <header class="modal__header modal-header-color-3">

          <h3
            id="chartAccountsSearchTitle"
            class="ca-modal__title"
          >
            Buscar Conta Contábil
          </h3>

          <button
            type="button"
            id="chartAccountsSearchCloseX"
            class="btn btn-new btn-sm btn-icon"
            aria-label="Fechar"
          >
            ✕
          </button>

        </header>


        <!-- BODY -->
        <div class="modal__body">

<section class="table-layout-integrated table-max-height-550">

  <div class="table-layout-integrated__filter">

              <div class="modal-section">

                <div class="fields-inline fields-gap-3">

                  <!-- SEARCH -->
                  <div class="fields fields-h-5 fields-w-30 fields-font-3">

                    <label for="chartAccountsSearchInput">
                      Buscar por código ou descrição
                    </label>

                    <input
                      type="text"
                      id="chartAccountsSearchInput"
                      placeholder="Ex.: combustível, despesa, banco..."
                      autocomplete="off"
                    />

                  </div>


                  <!-- CHECKS -->
                  <div class="ca-checks">

                    <label class="ca-check">

                      <input
                        type="checkbox"
                        id="chartAccountsSearchOnlyPosting"
                        checked
                      />

                      Somente contas lançáveis

                    </label>

                    <label class="ca-check">

                      <input
                        type="checkbox"
                        id="chartAccountsSearchOnlyActive"
                        checked
                      />

                      Somente ativas

                    </label>

                  </div>


                  <!-- ACTIONS -->
                  <div class="btn-inline btn-gap-3">

                    <button
                      type="button"
                      class="btn btn-toolbar btn-sm"
                      id="chartAccountsSearchClear"
                    >
                      Limpar
                    </button>

                    <button
                      type="button"
                      class="btn btn-toolbar btn-sm"
                      id="chartAccountsSearchBtn"
                    >
                      Buscar
                    </button>

                  </div>

                </div>

              </div>

            </div>


            <!-- TABLE -->
            <div class="table-scroll table-height-400 table-row-h-20">

              <table class="table table-zebra table-zebra-hover table-sticky-head">

                <thead>

                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Tipo</th>
                    <th>Natureza</th>
                    <th>Lançável</th>
                    <th>Ativa</th>
                    <th>Ação</th>
                  </tr>

                </thead>

                <tbody id="chartAccountsSearchTbody">

                  <tr>

                    <td
                      colspan="7"
                      class="ca-empty"
                    >
                      Digite para buscar contas contábeis.
                    </td>

                  </tr>

                </tbody>

              </table>

            </div>

          </section>

        </div>


        <!-- FOOTER -->
        <footer class="modal__footer modal-footer-color-3">

          <span
            id="chartAccountsSearchInfo"
            class="ca-info"
          >
            0 conta(s)
          </span>

          <button
            type="button"
            id="chartAccountsSearchCancel"
            class="btn btn-new btn-sm"
          >
            Cancelar
          </button>

        </footer>

      </section>

    </div>
  `;

  document.body.appendChild(root);
}

function getEls() {
  const root = document.getElementById(MODAL_ID);
  if (!root) return {};

  return {
    root,
    inputQ: root.querySelector('#chartAccountsSearchInput'),
    btnCloseX: root.querySelector('#chartAccountsSearchCloseX'),
    btnCancel: root.querySelector('#chartAccountsSearchCancel'),
    btnClear: root.querySelector('#chartAccountsSearchClear'),
    btnSearch: root.querySelector('#chartAccountsSearchBtn'),
    tbody: root.querySelector('#chartAccountsSearchTbody'),
    info: root.querySelector('#chartAccountsSearchInfo'),
    chkOnlyPosting: root.querySelector('#chartAccountsSearchOnlyPosting'),
    chkOnlyActive: root.querySelector('#chartAccountsSearchOnlyActive'),
  };
}

async function fetchChartAccounts({ q = '', onlyPosting = true, onlyActive = true } = {}) {
  const params = new URLSearchParams();

  params.set('limit', '500');

  if (q) params.set('search', q.trim());

  if (onlyPosting) {
    params.set('only_posting', 'true');
    params.set('allows_posting', 'true');
  }

  if (onlyActive) {
    params.set('is_active', 'true');
  }

  const r = await fetch(`${API_URL}?${params.toString()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => '(sem body)');
    throw new Error(`Erro ao buscar contas contábeis: ${r.status} ${r.statusText}\n${txt}`);
  }

  const data = await r.json().catch(() => []);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.rows)) return data.rows;
  if (Array.isArray(data.data)) return data.data;

  return [];
}

function renderEmpty(message = 'Nenhuma conta encontrada.') {
  const { tbody, info } = getEls();
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="ca-empty">${escapeHtml(message)}</td>
    </tr>
  `;

  if (info) info.textContent = '0 conta(s)';
  currentRows = [];
  currentSelectedIndex = -1;
  currentFocusEls = [];
}

function badgeBool(value, textTrue = 'SIM', textFalse = 'NÃO') {
  const yes = value === true || value === 'true' || value === 't' || value === 1;

  return yes
    ? `<span class="ca-badge ca-badge--ok">${textTrue}</span>`
    : `<span class="ca-badge ca-badge--off">${textFalse}</span>`;
}

function renderRows(rows) {
  const { tbody, info } = getEls();
  if (!tbody) return;

  currentRows = Array.isArray(rows) ? rows.slice() : [];
  currentSelectedIndex = currentRows.length ? 0 : -1;

  if (!currentRows.length) {
    renderEmpty('Nenhuma conta encontrada.');
    return;
  }

  tbody.innerHTML = currentRows.map((row, idx) => {
    const label = `${row.code ?? ''} - ${row.description ?? ''}`;

    return `
      <tr data-index="${idx}" data-id="${escapeHtml(row.id)}" tabindex="0" class="${idx === currentSelectedIndex ? 'is-selected' : ''}">
        <td><span class="ca-code">${escapeHtml(row.code)}</span></td>
        <td>
          <span class="ca-desc">${escapeHtml(row.description)}</span>
          <span class="ca-sub">ID ${escapeHtml(row.id)}${row.level != null ? ` • Nível ${escapeHtml(row.level)}` : ''}</span>
        </td>
        <td>${escapeHtml(row.account_type || '')}</td>
        <td>${escapeHtml(row.nature || '')}</td>
        <td>${badgeBool(row.allows_posting, 'SIM', 'NÃO')}</td>
        <td>${badgeBool(row.is_active, 'ATIVA', 'INATIVA')}</td>
        <td>
          <button type="button" class="btn btn-new btn-sm" data-action="select" data-index="${idx}" title="${escapeHtml(label)}">
            Selecionar
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (info) info.textContent = `${currentRows.length} conta(s)`;
  currentFocusEls = Array.from(tbody.querySelectorAll('tr[data-index]'));
}

function updateSelectedRow(nextIndex, shouldFocus = false) {
  if (!currentRows.length) return;

  const max = currentRows.length - 1;
  currentSelectedIndex = Math.max(0, Math.min(max, nextIndex));

  currentFocusEls.forEach((tr, idx) => {
    tr.classList.toggle('is-selected', idx === currentSelectedIndex);
  });

  currentFocusEls[currentSelectedIndex]?.scrollIntoView({ block: 'nearest' });

  if (shouldFocus) {
    currentFocusEls[currentSelectedIndex]?.focus();
  }
}

function closeModal(result = null) {
  const { root, inputQ } = getEls();

  if (root) {
    root.classList.remove('is-open');
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
  }

  currentRows = [];
  currentSelectedIndex = -1;
  currentFocusEls = [];

  if (inputQ) {
    inputQ.value = '';
  }

  const resolver = resolveModalPromise;
  resolveModalPromise = null;

  if (typeof resolver === 'function') {
    resolver(result);
  }
}

function selectByIndex(index) {
  const row = currentRows[index];
  if (!row) return;
  closeModal(row);
}

async function performSearch() {
  const { inputQ, chkOnlyPosting, chkOnlyActive, tbody } = getEls();
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="ca-empty">Buscando contas contábeis...</td>
    </tr>
  `;

  try {
    const rows = await fetchChartAccounts({
      q: inputQ?.value || '',
      onlyPosting: chkOnlyPosting?.checked === true,
      onlyActive: chkOnlyActive?.checked === true,
    });

    renderRows(rows);
  } catch (err) {
    console.error('[chartAccountsModalSearch] erro ao buscar:', err);
    renderEmpty('Erro ao buscar contas contábeis.');
  }
}

function bindEvents() {
  if (initialized) return;
  initialized = true;

  const els = getEls();
  if (!els.root) return;

  const debouncedSearch = debounce(() => performSearch(), 300);

  els.btnCloseX?.addEventListener('click', () => closeModal(null));
  els.btnCancel?.addEventListener('click', () => closeModal(null));

  els.btnClear?.addEventListener('click', () => {
    if (els.inputQ) els.inputQ.value = '';
    if (els.chkOnlyPosting) els.chkOnlyPosting.checked = true;
    if (els.chkOnlyActive) els.chkOnlyActive.checked = true;
    performSearch();
  });

  els.btnSearch?.addEventListener('click', () => performSearch());
  els.inputQ?.addEventListener('input', debouncedSearch);

  els.inputQ?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      performSearch();
      return;
    }

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      updateSelectedRow(currentSelectedIndex + 1, true);
      return;
    }

    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      updateSelectedRow(currentSelectedIndex - 1, true);
    }
  });

  els.chkOnlyPosting?.addEventListener('change', () => performSearch());
  els.chkOnlyActive?.addEventListener('change', () => performSearch());

  els.tbody?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action="select"]');

    if (btn) {
      const idx = Number(btn.dataset.index);
      if (Number.isFinite(idx)) selectByIndex(idx);
      return;
    }

    const tr = ev.target.closest('tr[data-index]');
    if (tr) {
      const idx = Number(tr.dataset.index);
      if (Number.isFinite(idx)) {
        updateSelectedRow(idx, true);
      }
    }
  });

  els.tbody?.addEventListener('keydown', (ev) => {
    const tr = ev.target.closest('tr[data-index]');
    if (!tr) return;

    const idx = Number(tr.dataset.index);
    if (!Number.isFinite(idx)) return;

    if (ev.key === 'Enter') {
      ev.preventDefault();
      selectByIndex(idx);
      return;
    }

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      updateSelectedRow(idx + 1, true);
      return;
    }

    if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      updateSelectedRow(idx - 1, true);
    }
  });

  els.tbody?.addEventListener('dblclick', (ev) => {
    const tr = ev.target.closest('tr[data-index]');
    if (!tr) return;

    const idx = Number(tr.dataset.index);
    if (Number.isFinite(idx)) selectByIndex(idx);
  });

  document.addEventListener('keydown', (ev) => {
    const { root } = getEls();
    if (!root || root.hidden) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeModal(null);
      return;
    }

    if (ev.key === 'ArrowDown') {
      if (document.activeElement?.id === 'chartAccountsSearchInput') return;
      ev.preventDefault();
      updateSelectedRow(currentSelectedIndex + 1, true);
      return;
    }

    if (ev.key === 'ArrowUp') {
      if (document.activeElement?.id === 'chartAccountsSearchInput') return;
      ev.preventDefault();
      updateSelectedRow(currentSelectedIndex - 1, true);
      return;
    }

    if (ev.key === 'Enter') {
      if (document.activeElement?.id === 'chartAccountsSearchInput') return;

      const activeRow = document.activeElement?.closest?.('tr[data-index]');
      if (activeRow) {
        const idx = Number(activeRow.dataset.index);
        if (Number.isFinite(idx)) {
          ev.preventDefault();
          selectByIndex(idx);
        }
        return;
      }

      if (currentSelectedIndex >= 0 && currentRows[currentSelectedIndex]) {
        ev.preventDefault();
        selectByIndex(currentSelectedIndex);
      }
    }
  });

  els.root?.addEventListener('click', (ev) => {
    if (ev.target === els.root) closeModal(null);
  });
}

export async function openChartAccountsModalSearch(options = {}) {
  ensureModal();
  bindEvents();

  const els = getEls();

  if (!els.root) {
    console.error(
      '[chartAccountsModalSearch] Modal não foi criado.'
    );

    return null;
  }

  const {
    query = '',
    onlyPosting = true,
    onlyActive = true,
  } = options || {};

  els.root.hidden = false;
  els.root.classList.add('is-open');
  els.root.setAttribute('aria-hidden', 'false');

  if (els.inputQ) {
    els.inputQ.value = String(query || '');
  }

  if (els.chkOnlyPosting) {
    els.chkOnlyPosting.checked = onlyPosting !== false;
  }

  if (els.chkOnlyActive) {
    els.chkOnlyActive.checked = onlyActive !== false;
  }

  renderEmpty('Buscando contas contábeis...');

  performSearch().finally(() => {
    setTimeout(() => {
      els.inputQ?.focus();
      els.inputQ?.select?.();
    }, 30);
  });

  return new Promise((resolve) => {
    resolveModalPromise = resolve;
  });
}