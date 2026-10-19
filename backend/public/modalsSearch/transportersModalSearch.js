// ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
// ║ backend\public\modalsSearch\transportersModalSearch.js — Modal inline para TRANSPORTADORAS   ║
// ║ exporta: openTransportersModalSearch({ apiBase, onPick(transporter) })                        ║
// ║ ✅ Busca por nome, razão social, CNPJ/CPF, cidade ou UF                                      ║
// ║ ✅ Suporte real a teclado: ↑ ↓ Enter Esc                                                     ║
// ║ ✅ Fecha pelo X, ESC ou clique no backdrop                                                   ║
// ║ ✅ Seleção por teclado, clique e movimento do mouse                                          ║
// ║ ✅ CSS injetado automaticamente                                                              ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

'use strict';

const TRANSPORTERS_MODAL_STYLE_ID =
  'transporters-modal-search-styles';

const TRANSPORTERS_MODAL_ID =
  'transportersModalSearchOverlay';


// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


function onlyDigits(value = '') {
  return String(value ?? '')
    .replace(/\D/g, '');
}


function formatCpfCnpj(value = '') {
  const digits = onlyDigits(value);

  if (digits.length === 11) {
    return digits.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4'
    );
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5'
    );
  }

  return value || '';
}


function normalizeText(value = '') {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}


function getTransporterId(row = {}) {
  return (
    row.transporter_id ??
    row.id ??
    row.transport_id ??
    ''
  );
}


function getTransporterName(row = {}) {
  return (
    row.legal_name ??
    row.razao_social ??
    row.corporate_name ??
    row.name ??
    row.trade_name ??
    row.nome ??
    ''
  );
}


function getTransporterTradeName(row = {}) {
  return (
    row.trade_name ??
    row.nome_fantasia ??
    row.fantasy_name ??
    ''
  );
}


function getTransporterDocument(row = {}) {
  return (
    row.cnpj_cpf ??
    row.cpf_cnpj ??
    row.cnpj ??
    row.cpf ??
    row.document ??
    row.document_number ??
    ''
  );
}


function getTransporterCity(row = {}) {
  return (
    row.city ??
    row.cidade ??
    row.city_name ??
    ''
  );
}


function getTransporterUf(row = {}) {
  return (
    row.uf ??
    row.state ??
    row.estado ??
    row.state_code ??
    ''
  );
}


function normalizeTransporter(row = {}) {
  return {
    ...row,

    transporter_id:
      getTransporterId(row),

    id:
      getTransporterId(row),

    legal_name:
      row.legal_name ??
      row.razao_social ??
      row.corporate_name ??
      row.name ??
      row.nome ??
      '',

    trade_name:
      getTransporterTradeName(row),

    name:
      getTransporterName(row),

    cnpj_cpf:
      getTransporterDocument(row),

    state_registration:
      row.state_registration ??
      row.ie ??
      row.inscricao_estadual ??
      '',

    street:
      row.street ??
      row.address ??
      row.logradouro ??
      '',

    number:
      row.number ??
      row.numero ??
      '',

    complement:
      row.complement ??
      row.complemento ??
      '',

    neighborhood:
      row.neighborhood ??
      row.bairro ??
      '',

    city:
      getTransporterCity(row),

    uf:
      getTransporterUf(row),

    zip_code:
      row.zip_code ??
      row.cep ??
      row.postal_code ??
      '',

    rntrc:
      row.rntrc ??
      row.rntc ??
      row.antt ??
      '',
  };
}


// ============================================================================
// CSS
// ============================================================================

function ensureTransportersModalStyles() {
  if (
    document.getElementById(
      TRANSPORTERS_MODAL_STYLE_ID
    )
  ) {
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    TRANSPORTERS_MODAL_STYLE_ID;

  style.textContent = `
    /* ================================================================
       TRANSPORTERS MODAL SEARCH
       ================================================================ */

    .transporters-modal-search {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(15, 23, 42, 0.48);
      backdrop-filter: blur(2px);
    }


    .transporters-modal-search__panel {
      width: min(980px, 96vw);
      max-height: min(760px, 92vh);

      display: flex;
      flex-direction: column;

      background: #ffffff;
      border: 1px solid #dbe3ef;
      border-radius: 18px;

      overflow: hidden;

      box-shadow:
        0 28px 80px rgba(15, 23, 42, 0.24),
        0 8px 24px rgba(15, 23, 42, 0.12);

      font-family:
        Inter,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }


    .transporters-modal-search__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;

      padding: 20px 22px 17px;

      background:
        linear-gradient(
          180deg,
          #f8fbff 0%,
          #eef5ff 100%
        );

      border-bottom: 1px solid #cfe0ff;
    }


    .transporters-modal-search__heading {
      min-width: 0;
    }


    .transporters-modal-search__title {
      margin: 0;

      color: #182033;

      font-size: 20px;
      font-weight: 800;
      line-height: 1.2;
    }


    .transporters-modal-search__subtitle {
      margin: 6px 0 0;

      color: #4f6df5;

      font-size: 13px;
      font-weight: 500;
    }


    .transporters-modal-search__close {
      flex: 0 0 auto;

      width: 34px;
      height: 34px;

      display: inline-flex;
      align-items: center;
      justify-content: center;

      border: 1px solid #aeb8c7;
      border-radius: 8px;

      background: #ffffff;
      color: #334155;

      cursor: pointer;

      font-size: 18px;
      font-weight: 700;

      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        transform 0.15s ease;
    }


    .transporters-modal-search__close:hover {
      background: #f1f5f9;
      border-color: #8794a5;
    }


    .transporters-modal-search__close:active {
      transform: scale(0.96);
    }


    .transporters-modal-search__body {
      min-height: 0;

      display: flex;
      flex-direction: column;
      gap: 14px;

      padding: 18px 20px 20px;
    }


    .transporters-modal-search__search-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
    }


    .transporters-modal-search__search {
      width: 100%;
      height: 40px;

      padding: 0 13px;

      border: 1px solid #b9c5d5;
      border-radius: 9px;

      outline: none;

      background: #ffffff;
      color: #172033;

      font-size: 14px;
      font-weight: 600;

      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }


    .transporters-modal-search__search::placeholder {
      color: #94a3b8;
      font-weight: 400;
    }


    .transporters-modal-search__search:focus {
      border-color: #5b7cff;

      box-shadow:
        0 0 0 3px
        rgba(91, 124, 255, 0.14);
    }


    .transporters-modal-search__table-wrap {
      min-height: 240px;
      max-height: 490px;

      overflow: auto;

      border: 1px solid #d7dfeb;
      border-radius: 10px;

      background: #ffffff;
    }


    .transporters-modal-search__table {
      width: 100%;

      border-collapse: collapse;
      border-spacing: 0;

      table-layout: fixed;
    }


    .transporters-modal-search__table thead th {
      position: sticky;
      top: 0;
      z-index: 2;

      padding: 10px 12px;

      background: #f6f8fb;
      color: #39475d;

      border-bottom: 1px solid #d7dfeb;

      text-align: left;

      font-size: 12px;
      font-weight: 800;

      white-space: nowrap;
    }


    .transporters-modal-search__table tbody td {
      padding: 10px 12px;

      border-bottom: 1px solid #edf1f6;

      color: #263247;

      font-size: 13px;
      vertical-align: middle;

      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }


    .transporters-modal-search__row {
      cursor: pointer;

      transition:
        background 0.12s ease,
        color 0.12s ease;
    }


    .transporters-modal-search__row:hover,
    .transporters-modal-search__row.is-active {
      background: #edf4ff;
    }


    .transporters-modal-search__row.is-active td {
      color: #102a56;
      font-weight: 700;
    }


    .transporters-modal-search__empty,
    .transporters-modal-search__loading,
    .transporters-modal-search__error {
      padding: 36px 18px !important;

      text-align: center !important;

      white-space: normal !important;
    }


    .transporters-modal-search__empty {
      color: #64748b !important;
    }


    .transporters-modal-search__loading {
      color: #475569 !important;
    }


    .transporters-modal-search__error {
      color: #b42318 !important;
      background: #fff6f5;
    }


    .transporters-modal-search__footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;

      padding: 11px 20px;

      border-top: 1px solid #e2e8f0;

      background: #f8fafc;
    }


    .transporters-modal-search__status {
      color: #64748b;

      font-size: 12px;
      font-weight: 600;
    }


    .transporters-modal-search__hint {
      color: #8491a3;

      font-size: 11px;
    }


    .transporters-modal-search__kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;

      min-width: 21px;
      height: 20px;

      padding: 0 5px;

      border: 1px solid #cbd5e1;
      border-bottom-width: 2px;
      border-radius: 5px;

      background: #ffffff;
      color: #475569;

      font-size: 10px;
      font-weight: 700;
    }


    @media (max-width: 760px) {
      .transporters-modal-search {
        padding: 10px;
      }

      .transporters-modal-search__panel {
        width: 100%;
        max-height: 95vh;
        border-radius: 12px;
      }

      .transporters-modal-search__table {
        min-width: 760px;
      }

      .transporters-modal-search__footer {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `;

  document.head.appendChild(style);
}


// ============================================================================
// API HELPERS
// ============================================================================

function extractTransporterRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.transporters)) {
    return payload.transporters;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.data?.rows)) {
    return payload.data.rows;
  }

  if (Array.isArray(payload?.data?.items)) {
    return payload.data.items;
  }

  if (Array.isArray(payload?.data?.transporters)) {
    return payload.data.transporters;
  }

  return [];
}


async function fetchTransporters({
  apiBase,
  signal,
}) {
  const base =
    String(apiBase || '/api/transporters')
      .replace(/\/+$/, '');

  const candidates = [
    base,
    `${base}?limit=500`,
  ];

  let lastError = null;

  for (const url of candidates) {
    try {
      const response =
        await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
          credentials: 'same-origin',
          signal,
        });

      if (!response.ok) {
        lastError =
          new Error(
            `Erro HTTP ${response.status} ao carregar transportadoras.`
          );

        continue;
      }

      const payload =
        await response.json();

      const rows =
        extractTransporterRows(payload);

      return rows.map(
        normalizeTransporter
      );

    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error;
      }

      lastError = error;
    }
  }

  throw (
    lastError ||
    new Error(
      'Não foi possível carregar as transportadoras.'
    )
  );
}


// ============================================================================
// MODAL
// ============================================================================

export async function openTransportersModalSearch({
  apiBase = '/api/transporters',
  onPick,
} = {}) {

  ensureTransportersModalStyles();

  // ------------------------------------------------------------
  // Remove modal anterior, caso exista
  // ------------------------------------------------------------

  const previous =
    document.getElementById(
      TRANSPORTERS_MODAL_ID
    );

  if (previous) {
    previous.remove();
  }


  // ------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------

  let allRows = [];
  let visibleRows = [];

  let activeIndex = -1;
  let isClosed = false;

  const abortController =
    new AbortController();


  // ------------------------------------------------------------
  // Criação do overlay
  // ------------------------------------------------------------

  const overlay =
    document.createElement('div');

  overlay.id =
    TRANSPORTERS_MODAL_ID;

  overlay.className =
    'transporters-modal-search';

  overlay.setAttribute(
    'role',
    'presentation'
  );


  overlay.innerHTML = `
    <section
      class="transporters-modal-search__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transportersModalSearchTitle"
    >

      <header class="transporters-modal-search__header">

        <div class="transporters-modal-search__heading">

          <h2
            id="transportersModalSearchTitle"
            class="transporters-modal-search__title"
          >
            Buscar transportadora
          </h2>

          <p class="transporters-modal-search__subtitle">
            Pesquise pelo nome, razão social, CNPJ/CPF, cidade ou UF.
          </p>

        </div>

        <button
          type="button"
          class="transporters-modal-search__close"
          data-close
          aria-label="Fechar"
          title="Fechar"
        >
          ×
        </button>

      </header>


      <div class="transporters-modal-search__body">

        <div class="transporters-modal-search__search-wrap">

          <input
            type="search"
            class="transporters-modal-search__search"
            data-search
            placeholder="Digite para buscar transportadora..."
            autocomplete="off"
            spellcheck="false"
          >

        </div>


        <div class="transporters-modal-search__table-wrap">

          <table class="transporters-modal-search__table">

            <colgroup>
              <col style="width: 80px">
              <col style="width: 33%">
              <col style="width: 190px">
              <col>
              <col style="width: 80px">
            </colgroup>

            <thead>
              <tr>
                <th>ID</th>
                <th>Transportadora</th>
                <th>CNPJ/CPF</th>
                <th>Cidade</th>
                <th>UF</th>
              </tr>
            </thead>

            <tbody data-results>
              <tr>
                <td
                  colspan="5"
                  class="transporters-modal-search__loading"
                >
                  Carregando transportadoras...
                </td>
              </tr>
            </tbody>

          </table>

        </div>

      </div>


      <footer class="transporters-modal-search__footer">

        <div
          class="transporters-modal-search__status"
          data-status
        >
          Carregando...
        </div>

        <div class="transporters-modal-search__hint">

          <span class="transporters-modal-search__kbd">↑</span>
          <span class="transporters-modal-search__kbd">↓</span>
          navegar

          &nbsp;

          <span class="transporters-modal-search__kbd">Enter</span>
          selecionar

          &nbsp;

          <span class="transporters-modal-search__kbd">Esc</span>
          fechar

        </div>

      </footer>

    </section>
  `;


  document.body.appendChild(overlay);


  // ------------------------------------------------------------
  // Elementos
  // ------------------------------------------------------------

  const panel =
    overlay.querySelector(
      '.transporters-modal-search__panel'
    );

  const searchInput =
    overlay.querySelector(
      '[data-search]'
    );

  const resultsBody =
    overlay.querySelector(
      '[data-results]'
    );

  const statusEl =
    overlay.querySelector(
      '[data-status]'
    );

  const closeButton =
    overlay.querySelector(
      '[data-close]'
    );


  // ------------------------------------------------------------
  // Close
  // ------------------------------------------------------------

  function closeModal() {
    if (isClosed) {
      return;
    }

    isClosed = true;

    abortController.abort();

    document.removeEventListener(
      'keydown',
      handleDocumentKeyDown,
      true
    );

    overlay.remove();
  }


  // ------------------------------------------------------------
  // Pick
  // ------------------------------------------------------------

  function pickTransporter(
    transporter
  ) {
    if (!transporter) {
      return;
    }

    const selected =
      normalizeTransporter(
        transporter
      );

    try {
      if (
        typeof onPick === 'function'
      ) {
        onPick(selected);
      }
    } catch (error) {
      console.error(
        '[transportersModalSearch] Erro no onPick:',
        error
      );
    }

    closeModal();
  }


  // ------------------------------------------------------------
  // Scroll active row
  // ------------------------------------------------------------

  function scrollActiveIntoView() {
    const row =
      resultsBody.querySelector(
        '.transporters-modal-search__row.is-active'
      );

    row?.scrollIntoView({
      block: 'nearest',
      behavior: 'auto',
    });
  }


  // ------------------------------------------------------------
  // Seleção visual
  // ------------------------------------------------------------

  function setActiveIndex(
    newIndex,
    {
      scroll = true,
    } = {}
  ) {
    if (!visibleRows.length) {
      activeIndex = -1;
      return;
    }

    if (newIndex < 0) {
      newIndex =
        visibleRows.length - 1;
    }

    if (
      newIndex >= visibleRows.length
    ) {
      newIndex = 0;
    }

    activeIndex =
      newIndex;

    const rows =
      resultsBody.querySelectorAll(
        '.transporters-modal-search__row'
      );

    rows.forEach(
      (row, index) => {
        row.classList.toggle(
          'is-active',
          index === activeIndex
        );
      }
    );

    if (scroll) {
      scrollActiveIntoView();
    }
  }


  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  function renderRows() {
    if (!visibleRows.length) {

      resultsBody.innerHTML = `
        <tr>
          <td
            colspan="5"
            class="transporters-modal-search__empty"
          >
            Nenhuma transportadora encontrada.
          </td>
        </tr>
      `;

      statusEl.textContent =
        '0 transportadoras encontradas';

      activeIndex = -1;

      return;
    }


    resultsBody.innerHTML =
      visibleRows
        .map(
          (row, index) => {

            const id =
              getTransporterId(row);

            const legalName =
              row.legal_name ||
              getTransporterName(row);

            const tradeName =
              getTransporterTradeName(row);

            const displayName =
              legalName ||
              tradeName ||
              '-';

            const documentValue =
              formatCpfCnpj(
                getTransporterDocument(row)
              );

            const city =
              getTransporterCity(row);

            const uf =
              getTransporterUf(row);

            const titleName =
              tradeName &&
              tradeName !== legalName
                ? `${legalName} · ${tradeName}`
                : displayName;

            return `
              <tr
                class="transporters-modal-search__row ${
                  index === activeIndex
                    ? 'is-active'
                    : ''
                }"
                data-index="${index}"
              >

                <td
                  title="${escapeHtml(id)}"
                >
                  ${escapeHtml(id)}
                </td>

                <td
                  title="${escapeHtml(titleName)}"
                >
                  ${escapeHtml(displayName)}
                </td>

                <td
                  title="${escapeHtml(documentValue)}"
                >
                  ${escapeHtml(documentValue)}
                </td>

                <td
                  title="${escapeHtml(city)}"
                >
                  ${escapeHtml(city || '-')}
                </td>

                <td
                  title="${escapeHtml(uf)}"
                >
                  ${escapeHtml(
                    String(uf || '-').toUpperCase()
                  )}
                </td>

              </tr>
            `;
          }
        )
        .join('');


    statusEl.textContent =
      visibleRows.length === 1
        ? '1 transportadora encontrada'
        : `${visibleRows.length} transportadoras encontradas`;


    // ----------------------------------------------------------
    // Bind rows
    // ----------------------------------------------------------

    resultsBody
      .querySelectorAll(
        '.transporters-modal-search__row'
      )
      .forEach(
        (rowEl) => {

          const index =
            Number(
              rowEl.dataset.index
            );

          rowEl.addEventListener(
            'mouseenter',
            () => {
              setActiveIndex(
                index,
                {
                  scroll: false,
                }
              );
            }
          );


          rowEl.addEventListener(
            'click',
            () => {
              pickTransporter(
                visibleRows[index]
              );
            }
          );
        }
      );
  }


  // ------------------------------------------------------------
  // Filter
  // ------------------------------------------------------------

  function applyFilter() {
    const query =
      normalizeText(
        searchInput.value
      );

    if (!query) {
      visibleRows =
        [...allRows];
    } else {

      visibleRows =
        allRows.filter(
          (row) => {

            const searchable =
              normalizeText(
                [
                  getTransporterId(row),

                  row.legal_name,
                  row.razao_social,

                  row.trade_name,
                  row.nome_fantasia,

                  row.name,
                  row.nome,

                  getTransporterDocument(row),

                  row.state_registration,
                  row.ie,
                  row.inscricao_estadual,

                  getTransporterCity(row),

                  getTransporterUf(row),

                  row.zip_code,
                  row.cep,

                  row.rntrc,
                  row.rntc,
                ]
                  .filter(Boolean)
                  .join(' ')
              );

            return searchable.includes(
              query
            );
          }
        );
    }

    activeIndex =
      visibleRows.length
        ? 0
        : -1;

    renderRows();
  }


  // ------------------------------------------------------------
  // Keyboard
  // ------------------------------------------------------------

  function handleDocumentKeyDown(
    event
  ) {
    if (isClosed) {
      return;
    }

    switch (event.key) {

      case 'Escape': {
        event.preventDefault();
        event.stopPropagation();

        closeModal();

        break;
      }


      case 'ArrowDown': {
        event.preventDefault();
        event.stopPropagation();

        if (!visibleRows.length) {
          return;
        }

        setActiveIndex(
          activeIndex + 1
        );

        break;
      }


      case 'ArrowUp': {
        event.preventDefault();
        event.stopPropagation();

        if (!visibleRows.length) {
          return;
        }

        setActiveIndex(
          activeIndex - 1
        );

        break;
      }


      case 'Enter': {
        if (
          !visibleRows.length ||
          activeIndex < 0
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        pickTransporter(
          visibleRows[activeIndex]
        );

        break;
      }

      default:
        break;
    }
  }


  // ------------------------------------------------------------
  // Events
  // ------------------------------------------------------------

  closeButton.addEventListener(
    'click',
    closeModal
  );


  overlay.addEventListener(
    'mousedown',
    (event) => {

      if (
        event.target === overlay
      ) {
        closeModal();
      }
    }
  );


  panel.addEventListener(
    'mousedown',
    (event) => {
      event.stopPropagation();
    }
  );


  searchInput.addEventListener(
    'input',
    applyFilter
  );


  document.addEventListener(
    'keydown',
    handleDocumentKeyDown,
    true
  );


  // ------------------------------------------------------------
  // Carrega dados
  // ------------------------------------------------------------

  try {

    allRows =
      await fetchTransporters({
        apiBase,
        signal:
          abortController.signal,
      });


    if (isClosed) {
      return;
    }


    // ----------------------------------------------------------
    // Ordenação
    // ----------------------------------------------------------

    allRows.sort(
      (a, b) =>
        String(
          getTransporterName(a)
        ).localeCompare(
          String(
            getTransporterName(b)
          ),
          'pt-BR',
          {
            sensitivity: 'base',
          }
        )
    );


    visibleRows =
      [...allRows];

    activeIndex =
      visibleRows.length
        ? 0
        : -1;


    renderRows();


    requestAnimationFrame(
      () => {
        searchInput.focus();
        searchInput.select();
      }
    );

  } catch (error) {

    if (
      error?.name === 'AbortError'
    ) {
      return;
    }


    console.error(
      '[transportersModalSearch]',
      error
    );


    resultsBody.innerHTML = `
      <tr>
        <td
          colspan="5"
          class="transporters-modal-search__error"
        >
          Não foi possível carregar as transportadoras.
          Verifique a rota da API e tente novamente.
        </td>
      </tr>
    `;


    statusEl.textContent =
      'Erro ao carregar transportadoras';


    requestAnimationFrame(
      () => {
        searchInput.focus();
      }
    );
  }
}