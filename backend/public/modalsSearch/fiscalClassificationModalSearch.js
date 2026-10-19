// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassificationModalSearch.js                               ║
// ║ MODULE: Fiscal Classification Search Modal                             ║
// ║ DESCRIPTION: Modal de busca e seleção de classificação fiscal           ║
// ║ PRODNEX ERP                                                             ║
// ║                                                                          ║
// ║ EXPORTS:                                                                ║
// ║ - openFiscalClassificationModal({ apiBase, onPick })                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

const MODAL_ID = 'fiscalClassificationSearchModal';

/* ========================================================================
   HELPERS
======================================================================== */

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeApiBase(apiBase) {
  return String(apiBase ?? '').replace(/\/+$/, '');
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeClassification(row) {
  if (!row?.fiscal_classification_id) return null;

  return {
    fiscal_classification_id: row.fiscal_classification_id,
    classification_name: row.classification_name ?? '',
    description: row.description ?? null,
    ncm_code: row.ncm_code ?? null,
    ncm_description: row.ncm_description ?? null,
    ex_tipi: row.ex_tipi ?? null,
    cest_code: row.cest_code ?? null,
    cest_description: row.cest_description ?? null,
    fiscal_profile_id: row.fiscal_profile_id ?? null,
    profile_name: row.profile_name ?? null,
    profile_description: row.profile_description ?? null,
    is_cst: row.is_cst ?? null,
    is_classification: row.is_classification ?? null,
    is_rate: row.is_rate ?? 0,
    is_specific_rate: row.is_specific_rate ?? 0,
    is_unit: row.is_unit ?? 'UN',
    ibscbs_cst: row.ibscbs_cst ?? null,
    ibscbs_classification: row.ibscbs_classification ?? null,
    ibs_uf_rate: row.ibs_uf_rate ?? 0,
    ibs_municipal_rate: row.ibs_municipal_rate ?? 0,
    cbs_rate: row.cbs_rate ?? 0,
    donation_indicator: row.donation_indicator ?? 1,
    tax_reform_details: row.tax_reform_details ?? {},
    is_active: row.is_active !== false,
  };
}

async function fetchJSON(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const text = await response.text();

  if (!response.ok) {
    let message = text;
    try {
      const errorPayload = text ? JSON.parse(text) : {};
      message = errorPayload.message || errorPayload.error || text;
    } catch {
      // Preserve plain-text error responses.
    }
    throw new Error(message || response.statusText || 'Erro ao buscar classificações.');
  }

  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('A API retornou uma resposta JSON inválida.');
  }
}

/* ========================================================================
   MODAL MARKUP
======================================================================== */

function createModalMarkup() {
  return /* html */ `
    <div
      id="${MODAL_ID}"
      class="modal modal-width-8 modal-height-5 is-open"
      aria-hidden="false"
    >
      <div
        class="modal__backdrop"
        data-fiscal-classification-close
      ></div>

      <div class="modal__dialog">
        <section
          class="modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="${MODAL_ID}Title"
          aria-describedby="fcm-status"
        >
          <header class="modal__header modal-header-color-3">
            <h2
              id="${MODAL_ID}Title"
              class="modal__title"
            >
              🔎 Buscar Classificação Fiscal
            </h2>

            <button
              id="fcm-close"
              class="modal__close"
              type="button"
              aria-label="Fechar modal"
              title="Fechar"
              data-fiscal-classification-close
            >
              &times;
            </button>
          </header>

          <div class="modal__body">
            <div class="modal-section">
              <div class="fields-inline fields-gap-3">
                <div class="fields fields-h-6 fields-w-20 fields-font-3">
                  <label for="fcm-q">NCM, CEST, nome ou descrição</label>

                  <input
                    id="fcm-q"
                    type="search"
                    placeholder="Digite NCM, CEST, nome ou descrição..."
                    autocomplete="off"
                  />
                </div>

                <div class="btn-inline">
                  <button id="fcm-btn" class="btn btn-footer btn-sm" type="button">
                    Buscar
                  </button>
                </div>
              </div>
            </div>

            <section class="table-layout">
              <div class="table-scroll--rounded table-height-flex table-row-h-28">
                <table class="table table-zebra table-zebra-hover table-sticky-head">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>NCM</th>
                      <th>CEST</th>
                      <th>Descrição</th>
                      <th>Perfil Fiscal ID</th>
                    </tr>
                  </thead>

                  <tbody id="fcm-tbody">
                    <tr>
                      <td colspan="5">
                        Digite um termo para pesquisar.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <footer class="modal__footer modal-footer-color-3">
            <span
              id="fcm-status"
              role="status"
              aria-live="polite"
            >
              Digite um termo e clique em “Buscar”.
            </span>

          </footer>
        </section>
      </div>
    </div>
  `;
}

/* ========================================================================
   OPEN MODAL
======================================================================== */

export function openFiscalClassificationModal({
  apiBase = '',
  onPick,
} = {}) {
  apiBase = normalizeApiBase(apiBase);

  /*
   * Garante apenas uma instância do modal.
   */
  document.getElementById(MODAL_ID)?.remove();

  const modalHost = document.createElement('div');
  modalHost.innerHTML = createModalMarkup().trim();

  const modal = modalHost.firstElementChild;

  if (!modal) {
    throw new Error('Não foi possível criar o modal de classificação fiscal.');
  }

  document.body.appendChild(modal);

  /* ----------------------------------------------------------------------
     DOM
  ---------------------------------------------------------------------- */

  const q = modal.querySelector('#fcm-q');
  const btn = modal.querySelector('#fcm-btn');
  const tbody = modal.querySelector('#fcm-tbody');
  const status = modal.querySelector('#fcm-status');
  const closeButtons = modal.querySelectorAll(
    '[data-fiscal-classification-close]',
  );

  let isSearching = false;

  /* ----------------------------------------------------------------------
     CLOSE
  ---------------------------------------------------------------------- */

  function close() {
    document.removeEventListener('keydown', onDocumentKeydown);

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modal.remove();
  }

  function onDocumentKeydown(event) {
    if (event.key !== 'Escape' && event.key !== 'Esc') return;

    event.preventDefault();
    close();
  }

  document.addEventListener('keydown', onDocumentKeydown);

  closeButtons.forEach((element) => {
    element.addEventListener('click', close);
  });

  /* ----------------------------------------------------------------------
     RENDER
  ---------------------------------------------------------------------- */

  function renderMessage(message) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          ${escapeHtml(message)}
        </td>
      </tr>
    `;
  }

  function renderRows(rows) {
    if (!rows.length) {
      renderMessage('Nenhum resultado encontrado.');
      return;
    }

    tbody.innerHTML = rows
      .map((row, index) => {
        const id = row.fiscal_classification_id;
        const ncm = row.ncm_code ?? '';
        const cest = row.cest_code ?? '';
        const description = row.classification_name || row.description || '';
        const fiscalProfileId = row.fiscal_profile_id ?? '';

        return `
          <tr
            tabindex="0"
            data-row-index="${index}"
            title="Clique para selecionar"
          >
            <td>${escapeHtml(id)}</td>
            <td>${escapeHtml(ncm)}</td>
            <td>${escapeHtml(cest)}</td>
            <td>${escapeHtml(description)}</td>
            <td>${escapeHtml(fiscalProfileId)}</td>
          </tr>
        `;
      })
      .join('');
  }

  /* ----------------------------------------------------------------------
     SEARCH
  ---------------------------------------------------------------------- */

  async function search() {
    const term = q.value.trim();

    if (!term) {
      renderMessage('Informe um termo de busca.');
      status.textContent = 'Informe um termo de busca.';
      q.focus();
      return;
    }

    if (isSearching) return;

    isSearching = true;
    btn.disabled = true;
    q.disabled = true;
    btn.textContent = 'Buscando...';

    status.textContent = 'Pesquisando classificações...';
    renderMessage('Carregando classificações...');

    try {
      const params = new URLSearchParams({
        search: term,
        active: 'true',
        limit: '50',
        offset: '0',
      });

      const url = `${apiBase}/api/v2/fiscal-classifications?${params.toString()}`;
      const payload = await fetchJSON(url);
      const rows = normalizeRows(payload)
        .map(normalizeClassification)
        .filter(Boolean);

      /*
       * Mantém os objetos fora do HTML.
       * Isso evita problemas com JSON contendo aspas ou caracteres especiais.
       */
      modal.__fiscalClassificationRows = rows;

      renderRows(rows);

      status.textContent = rows.length
        ? `${rows.length} classificação(ões) encontrada(s). Clique em uma linha para selecionar.`
        : 'Nenhuma classificação encontrada.';
    } catch (error) {
      console.error('[fiscalClassificationModal] search error:', error);

      modal.__fiscalClassificationRows = [];

      renderMessage('Erro ao buscar classificações fiscais.');
      status.textContent =
        error?.message || 'Erro ao buscar classificações fiscais.';
    } finally {
      isSearching = false;
      btn.disabled = false;
      q.disabled = false;
      btn.textContent = 'Buscar';
      q.focus();
    }
  }

  /* ----------------------------------------------------------------------
     SELECT
  ---------------------------------------------------------------------- */

  function selectRow(rowElement) {
    if (!rowElement) return;

    const rowIndex = Number(rowElement.dataset.rowIndex);

    if (!Number.isInteger(rowIndex)) return;

    const rows = modal.__fiscalClassificationRows ?? [];
    const selectedRow = rows[rowIndex];

    if (!selectedRow) return;

    try {
      if (typeof onPick === 'function') {
        onPick(selectedRow);
      }
    } finally {
      close();
    }
  }

  /* ----------------------------------------------------------------------
     EVENTS
  ---------------------------------------------------------------------- */

  btn.addEventListener('click', search);

  q.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    search();
  });

  tbody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-row-index]');
    selectRow(row);
  });

  tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;

    const row = event.target.closest('tr[data-row-index]');

    if (!row) return;

    event.preventDefault();
    selectRow(row);
  });

  requestAnimationFrame(() => {
    q.focus();
  });

  return {
    modal,
    close,
    search,
  };
}