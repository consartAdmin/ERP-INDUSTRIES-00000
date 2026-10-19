// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssuedModalSearch.js — Modal Pesquisa de Notas Emitidas     ║
// ║ PRODNEX ERP | Frontend ESM                                          ║
// ║ Layout: Modal Global CONSART (modals.css)                           ║
// ║ API: GET /api/invoices-issued/search?q=&limit=&offset=              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getAuthToken } from '/public/includes/js/apiFetch.js';

const INVOICES_API = '/api/invoices-issued/search';
const MODAL_ID = 'modalPesquisarNotasEmitidas';
const PAGE_SIZE = 20;

// =====================================================================
// HELPERS
// =====================================================================

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR');
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function searchInvoices({ q = '', offset = 0 } = {}) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (q) params.set('q', q);

  const token = getAuthToken();
  const response = await fetch(`${INVOICES_API}?${params}`, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.ok === false) {
    throw new Error(json.error || json.message || `Erro HTTP ${response.status}`);
  }

  return { rows: Array.isArray(json.rows) ? json.rows : [], total: Number(json.total) || 0 };
}

// =====================================================================
// DOM
// =====================================================================

function buildModal() {
  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal is-open';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', `${MODAL_ID}Title`);

  modal.innerHTML = `
    <div class="modal__backdrop" data-iims-close></div>
    <div class="modal__dialog">
      <section class="modal__panel modal__panel--xl" role="document">
        <header class="modal__header">
          <h3 class="modal__title" id="${MODAL_ID}Title">Pesquisar Nota Fiscal Emitida</h3>
          <button type="button" class="modal__close" data-iims-close aria-label="Fechar" title="Fechar">&times;</button>
        </header>

        <div class="modal__body modal-section">
          <form class="fields-inline fields-gap-3" data-iims-form autocomplete="off">
            <div class="fields fields-h-6 fields-w-40 fields-font-3">
              <label for="${MODAL_ID}Q">Buscar</label>
              <input id="${MODAL_ID}Q" type="search"
                placeholder="Cliente, CPF/CNPJ, nº da NF-e, chave, pedido ou orçamento" />
            </div>
            <div class="btn-inline">
              <button type="submit" class="btn btn-new btn-sm">🔎 Buscar</button>
            </div>
          </form>

          <div class="table-scroll table-height-400">
            <table class="table table-zebra table-zebra-hover table-sticky-head">
              <thead>
                <tr>
                  <th>NF-e</th>
                  <th>Emissão</th>
                  <th>Cliente</th>
                  <th>Pedido / Orçamento</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody data-iims-tbody>
                <tr><td colspan="7" class="dl-empty">Carregando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <footer class="modal__footer">
          <span data-iims-info style="margin-right:auto;"></span>
          <button type="button" class="btn btn-clean btn-sm" data-iims-prev>Anterior</button>
          <button type="button" class="btn btn-clean btn-sm" data-iims-next>Próxima</button>
          <button type="button" class="btn btn-cancel btn-sm" data-iims-close>Cancelar</button>
        </footer>
      </section>
    </div>
  `;

  return modal;
}

function renderRows(tbody, rows) {
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="dl-empty">Nenhuma nota encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row, index) => `
    <tr>
      <td><strong>${escapeHtml(row.nfe_number ?? '-')}</strong></td>
      <td>${escapeHtml(formatDate(row.issued_date))}</td>
      <td>
        <strong>${escapeHtml(row.customer_name || '-')}</strong><br />
        <small>${escapeHtml(row.customer_tax_id || '')}</small>
      </td>
      <td>${escapeHtml(row.order_number ?? row.order_id ?? row.budget_id ?? '-')}</td>
      <td>${escapeHtml(row.nfe_status_name || row.status || '-')}</td>
      <td>${escapeHtml(formatMoney(row.total_amount))}</td>
      <td>
        <button type="button" class="btn btn-new btn-sm" data-iims-select="${index}">Selecionar</button>
      </td>
    </tr>
  `).join('');
}

// =====================================================================
// PUBLIC API
// =====================================================================

/**
 * Abre o modal e resolve com a nota selecionada (linha da API) ou null se cancelar.
 * @param {{ initialQuery?: string }} [options]
 * @returns {Promise<object|null>}
 */
export function openInvoicesIssuedSearchModal({ initialQuery = '' } = {}) {
  document.getElementById(MODAL_ID)?.remove();

  const modal = buildModal();
  document.body.appendChild(modal);

  const input = modal.querySelector(`#${MODAL_ID}Q`);
  const tbody = modal.querySelector('[data-iims-tbody]');
  const info = modal.querySelector('[data-iims-info]');
  const btnPrev = modal.querySelector('[data-iims-prev]');
  const btnNext = modal.querySelector('[data-iims-next]');

  const state = { q: String(initialQuery || ''), offset: 0, total: 0, rows: [], seq: 0 };
  input.value = state.q;

  return new Promise((resolve) => {
    let settled = false;

    const settle = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      modal.remove();
      resolve(value);
    };

    const onKeydown = (event) => {
      if (event.key === 'Escape') settle(null);
    };

    async function load() {
      const seq = ++state.seq;
      tbody.innerHTML = '<tr><td colspan="7" class="dl-empty">Carregando...</td></tr>';

      try {
        const { rows, total } = await searchInvoices({ q: state.q, offset: state.offset });
        if (seq !== state.seq) return;

        state.rows = rows;
        state.total = total;
        renderRows(tbody, rows);
      } catch (error) {
        if (seq !== state.seq) return;
        state.rows = [];
        tbody.innerHTML = `<tr><td colspan="7" class="dl-empty">Erro: ${escapeHtml(error.message)}</td></tr>`;
      }

      const page = Math.floor(state.offset / PAGE_SIZE) + 1;
      const pages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
      info.textContent = `${state.total} nota(s) · Página ${page} de ${pages}`;
      btnPrev.disabled = state.offset <= 0;
      btnNext.disabled = state.offset + PAGE_SIZE >= state.total;
    }

    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-iims-close]')) return settle(null);

      const selectBtn = event.target.closest('[data-iims-select]');
      if (selectBtn) settle(state.rows[Number(selectBtn.dataset.iimsSelect)] || null);
    });

    modal.querySelector('[data-iims-form]').addEventListener('submit', (event) => {
      event.preventDefault();
      state.q = input.value.trim();
      state.offset = 0;
      void load();
    });

    btnPrev.addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - PAGE_SIZE);
      void load();
    });

    btnNext.addEventListener('click', () => {
      state.offset += PAGE_SIZE;
      void load();
    });

    document.addEventListener('keydown', onKeydown);
    input.focus();
    void load();
  });
}

export default { openInvoicesIssuedSearchModal };
