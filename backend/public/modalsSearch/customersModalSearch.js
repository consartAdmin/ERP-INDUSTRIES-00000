// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ Modal inline para buscar CLIENTES — layout padrão MODALS.CSS               ║
// ║ exporta: openCustomersModalSearch({ apiBase, onPick(customer) })            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

'use strict';

const CUSTOMERS_MODAL_STYLE_ID = 'customers-modal-search-styles';

function ensureCustomersModalStyles() {
  if (document.getElementById(CUSTOMERS_MODAL_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = CUSTOMERS_MODAL_STYLE_ID;
  style.textContent = `
    /* Apenas regras específicas deste componente. A estrutura visual base
       pertence ao MODALS.CSS e os controles reutilizam fields.css/buttons.css. */
    .modal.customers-search-modal {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }

    .customers-search-modal .modal__backdrop {
      position: absolute;
      inset: 0;
    }

    .customers-search-modal .modal__dialog {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .customers-search-modal .modal__panel {
      display: flex;
      flex-direction: column;
      width: min(100%, 1000px);
      max-height: 90vh;
      overflow: hidden;
    }

    .customers-search-modal__title-group {
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .customers-search-modal__title-icon {
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 19px;
    }

    .customers-search-modal__title-copy { min-width: 0; }

    .customers-search-modal__subtitle {
      margin: 4px 0 0;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.35;
    }

    .customers-search-modal .modal__body {
      min-height: 0;
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
    }

    .customers-search-modal__search {
      flex: 0 0 auto;
      padding: 16px 22px;
      background: #f8fafc;
    }

    .customers-search-modal__search-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: 12px;
    }

    .customers-search-modal__search .fields { min-width: 0; }
    .customers-search-modal__search input { width: 100%; }

    .customers-search-modal__results {
      min-height: 220px;
      flex: 1 1 auto;
      overflow: auto;
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }

    .customers-search-modal__table {
      width: 100%;
      min-width: 760px;
      border-collapse: separate;
      border-spacing: 0;
      color: #334155;
      font-size: 13px;
    }

    .customers-search-modal__table thead {
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .customers-search-modal__table th {
      padding: 12px 14px;
      border-bottom: 1px solid #dbe3ee;
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      text-align: left;
      text-transform: uppercase;
      letter-spacing: .03em;
      white-space: nowrap;
    }

    .customers-search-modal__table td {
      padding: 12px 14px;
      border-bottom: 1px solid #edf2f7;
      line-height: 1.35;
      vertical-align: middle;
    }

    .customers-search-modal__table tbody tr {
      cursor: pointer;
      transition: background-color 100ms ease, box-shadow 100ms ease;
    }

    .customers-search-modal__table tbody tr:hover { background: #f1f5f9; }

    .customers-search-modal__table tbody tr.is-selected {
      background: #dbeafe;
      box-shadow: inset 4px 0 0 #2563eb;
    }

    .customers-search-modal__table tbody tr.is-selected td { color: #1e3a8a; }
    .customers-search-modal__table tbody tr:last-child td { border-bottom: 0; }
    .customers-search-modal__table th:first-child,
    .customers-search-modal__table td:first-child { width: 90px; }
    .customers-search-modal__table th:nth-child(4),
    .customers-search-modal__table td:nth-child(4) { white-space: nowrap; }
    .customers-search-modal__table th:last-child,
    .customers-search-modal__table td:last-child { width: 72px; text-align: center; }

    .customers-search-modal__empty td {
      padding: 38px 20px;
      color: #64748b;
      text-align: center;
      cursor: default;
    }

    .customers-search-modal__status {
      min-height: 44px;
      justify-content: flex-start;
      gap: 8px;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
    }

    .customers-search-modal__status.is-loading { color: #2563eb; }
    .customers-search-modal__status.is-success { color: #047857; }
    .customers-search-modal__status.is-warning { color: #b45309; }
    .customers-search-modal__status.is-error { color: #b91c1c; }

    .customers-search-modal__spinner {
      width: 15px;
      height: 15px;
      flex: 0 0 15px;
      border: 2px solid rgba(37, 99, 235, .22);
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: customers-modal-spin 700ms linear infinite;
    }

    body.customers-modal-search-open { overflow: hidden; }
    @keyframes customers-modal-spin { to { transform: rotate(360deg); } }

    @media (max-width: 720px) {
      .customers-search-modal .modal__dialog { align-items: stretch; padding: 12px; }
      .customers-search-modal .modal__panel { max-height: calc(100vh - 24px); }
      .customers-search-modal__title-icon { display: none; }
      .customers-search-modal__search { padding: 14px 16px; }
      .customers-search-modal__search-grid { grid-template-columns: 1fr; }
      .customers-search-modal__search-grid .btn { width: 100%; }
    }

    @media (prefers-reduced-motion: reduce) {
      .customers-search-modal__spinner { animation: none; }
      .customers-search-modal__table tbody tr { transition: none; }
    }
  `;
  document.head.appendChild(style);
}

export function openCustomersModalSearch({ apiBase = '', onPick } = {}) {
  ensureCustomersModalStyles();
  const previousModal = document.getElementById('cms-overlay');
  if (previousModal) {
    previousModal.dispatchEvent(new Event('cms:close'));
    previousModal.remove();
  }

  apiBase = String(apiBase || '').replace(/\/$/, '');

  let currentIndex = -1;
  let resultRows = [];
  let customersCollection = [];
  let isClosed = false;
  let isSearching = false;
  let abortController = null;

  const previousActiveElement = document.activeElement;
  const modal = document.createElement('div');
  modal.id = 'cms-overlay';
  /* As classes de estado atendem às convenções mais comuns do MODALS.CSS.
     O fallback CSS específico acima garante a exibição mesmo quando o projeto
     utiliza outro nome para o estado aberto. */
  modal.className = 'modal customers-search-modal is-open modal--open active';
  modal.setAttribute('aria-hidden', 'false');

  modal.innerHTML = `
    <div class="modal__backdrop" data-cms-close aria-hidden="true"></div>
    <div class="modal__dialog" role="presentation">
      <section class="modal__panel modal__panel--lg" role="dialog"
        aria-modal="true" aria-labelledby="cms-title" aria-describedby="cms-subtitle" tabindex="-1">
        <header class="modal__header modal-header-color-3">
          <div class="customers-search-modal__title-group">
            <span class="customers-search-modal__title-icon" aria-hidden="true">🔎</span>
            <div class="customers-search-modal__title-copy">
              <h2 id="cms-title" class="modal__title">Buscar cliente</h2>
              <p id="cms-subtitle" class="customers-search-modal__subtitle">
                Pesquise pelo nome, razão social, CNPJ ou CPF.
              </p>
            </div>
          </div>
          <button id="cms-close" class="modal__close" type="button"
            title="Fechar" aria-label="Fechar busca de clientes">×</button>
        </header>

        <div class="modal__body">
          <section class="modal-section customers-search-modal__search">
            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-25 fields-font-3">
                <label for="cms-q">Cliente</label>
                <input id="cms-q" type="search"
                  placeholder="Digite o nome, razão social, CNPJ ou CPF..."
                  autocomplete="off" spellcheck="false" aria-controls="cms-tbody" />
              </div>

              <button id="cms-btn" class="btn btn-save btn-sm" type="button">
                <span aria-hidden="true">🔍</span><span>Buscar</span>
              </button>
            </div>
          </section>

          <div class="modal-divider"></div>

          <div id="cms-body" class="customers-search-modal__results" tabindex="0">
            <table class="customers-search-modal__table">
              <thead><tr>
                <th scope="col">ID</th><th scope="col">Nome fantasia</th>
                <th scope="col">Razão social</th><th scope="col">CNPJ/CPF</th>
                <th scope="col">Cidade</th><th scope="col">UF</th>
              </tr></thead>
              <tbody id="cms-tbody">
                <tr class="customers-search-modal__empty"><td colspan="6">
                  Digite um termo acima para pesquisar clientes.
                </td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <footer id="cms-status" class="modal__footer customers-search-modal__status"
          aria-live="polite" aria-atomic="true">
          Digite um termo e clique em “Buscar”.
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add('customers-modal-search-open');

  const dialog = modal.querySelector('.modal__panel');
  const closeButton = modal.querySelector('#cms-close');
  const q = modal.querySelector('#cms-q');
  const btn = modal.querySelector('#cms-btn');
  const tbody = modal.querySelector('#cms-tbody');
  const status = modal.querySelector('#cms-status');

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function normalizeCustomersResponse(data) {
    if (Array.isArray(data)) return data;
    for (const key of ['rows', 'items', 'data', 'customers']) {
      if (Array.isArray(data?.[key])) return data[key];
    }
    return [];
  }

  function formatDocument(value) {
    const raw = String(value ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return raw;
  }

  function setStatus(message, type = '') {
    status.className = 'modal__footer customers-search-modal__status';
    if (type) status.classList.add(`is-${type}`);
    status.innerHTML = type === 'loading'
      ? `<span class="customers-search-modal__spinner" aria-hidden="true"></span><span>${escapeHtml(message)}</span>`
      : escapeHtml(message);
  }

  function renderEmpty(message) {
    tbody.innerHTML = `<tr class="customers-search-modal__empty"><td colspan="6">${escapeHtml(message)}</td></tr>`;
    resultRows = [];
    customersCollection = [];
    currentIndex = -1;
  }

  const refreshRows = () => { resultRows = Array.from(tbody.querySelectorAll('tr[data-index]')); };

  function close() {
    if (isClosed) return;
    isClosed = true;
    abortController?.abort();
    document.removeEventListener('keydown', onGlobalKeyDown, true);
    document.body.classList.remove('customers-modal-search-open');
    modal.remove();
    if (previousActiveElement?.focus && document.body.contains(previousActiveElement)) {
      previousActiveElement.focus();
    }
  }

  function updateSelection(index) {
    refreshRows();
    if (!resultRows.length) { currentIndex = -1; return; }
    currentIndex = Math.max(0, Math.min(index, resultRows.length - 1));
    resultRows.forEach((row, rowIndex) => {
      const selected = rowIndex === currentIndex;
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-selected', String(selected));
      row.tabIndex = selected ? 0 : -1;
    });
    resultRows[currentIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function moveSelection(step) {
    refreshRows();
    if (!resultRows.length) return;
    if (currentIndex < 0) return updateSelection(step < 0 ? resultRows.length - 1 : 0);
    updateSelection((currentIndex + step + resultRows.length) % resultRows.length);
  }

  function pickSelected() {
    refreshRows();
    if (!resultRows.length) return false;
    const rowIndex = currentIndex >= 0 ? currentIndex : 0;
    const customerIndex = Number(resultRows[rowIndex]?.dataset.customerIndex);
    const customer = Number.isInteger(customerIndex) ? customersCollection[customerIndex] : null;
    if (!customer) {
      setStatus('Não foi possível selecionar este cliente.', 'error');
      return false;
    }
    try {
      onPick?.({
        ...customer,
        trade_name: customer.trade_name ?? customer.fantasy_name ?? customer.name ?? '',
        legal_name: customer.legal_name ?? customer.company_name ?? customer.corporate_name ?? '',
      });
    } catch (error) {
      console.error('[customersModalSearch] Erro no callback onPick:', error);
      setStatus('O cliente foi localizado, mas ocorreu um erro ao selecioná-lo.', 'error');
      return false;
    }
    close();
    return true;
  }

  async function fetchJSON(url, signal) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
    const responseText = await response.text();
    let data = null;
    if (responseText) { try { data = JSON.parse(responseText); } catch { /* texto inválido */ } }
    if (!response.ok) {
      const message = data?.message || data?.error || responseText || response.statusText || 'Erro desconhecido';
      throw new Error(`${response.status} ${response.statusText}: ${message}`);
    }
    return data;
  }

  function buildSearchUrl(term) {
    const url = new URL('/api/customers/search', apiBase.trim() || window.location.origin);
    url.searchParams.set('q', term);
    url.searchParams.set('limit', '50');
    url.searchParams.set('offset', '0');
    return url;
  }

  function renderRows(customers) {
    customersCollection = customers;
    const fragment = document.createDocumentFragment();
    tbody.innerHTML = '';
    customers.forEach((customer, index) => {
      const values = {
        id: customer.customer_id ?? customer.id ?? '',
        trade: customer.trade_name ?? customer.fantasy_name ?? customer.name ?? '',
        legal: customer.legal_name ?? customer.company_name ?? customer.corporate_name ?? '',
        document: customer.tax_id ?? customer.cnpj_cpf ?? customer.cnpj ?? customer.cpf ?? '',
        city: customer.city ?? customer.city_name ?? '',
        state: customer.state ?? customer.uf ?? '',
      };
      const row = document.createElement('tr');
      row.dataset.index = String(index);
      row.dataset.customerIndex = String(index);
      row.setAttribute('aria-selected', 'false');
      row.tabIndex = -1;
      row.innerHTML = `
        <td>${escapeHtml(values.id || '-')}</td>
        <td title="${escapeHtml(values.trade)}">${escapeHtml(values.trade || '-')}</td>
        <td title="${escapeHtml(values.legal)}">${escapeHtml(values.legal || '-')}</td>
        <td>${escapeHtml(formatDocument(values.document) || '-')}</td>
        <td title="${escapeHtml(values.city)}">${escapeHtml(values.city || '-')}</td>
        <td>${escapeHtml(values.state || '-')}</td>`;
      fragment.appendChild(row);
    });
    tbody.appendChild(fragment);
  }

  async function buscar() {
    if (isSearching || isClosed) return;
    const term = q.value.trim();
    if (!term) {
      renderEmpty('Informe um termo para pesquisar clientes.');
      setStatus('Informe um nome, razão social, CNPJ ou CPF.', 'warning');
      q.focus();
      return;
    }

    abortController?.abort();
    abortController = new AbortController();
    isSearching = true;
    renderEmpty('Pesquisando clientes...');
    setStatus('Pesquisando clientes...', 'loading');
    btn.disabled = true;
    q.disabled = true;

    try {
      const data = await fetchJSON(buildSearchUrl(term).toString(), abortController.signal);
      const customers = normalizeCustomersResponse(data);
      if (isClosed) return;
      if (!customers.length) {
        renderEmpty('Nenhum cliente encontrado.');
        setStatus('Nenhum resultado encontrado para a pesquisa informada.', 'warning');
        return;
      }
      renderRows(customers);
      updateSelection(0);
      const total = customers.length === 1 ? '1 cliente encontrado.' : `${customers.length} clientes encontrados.`;
      setStatus(`${total} Use ↑, ↓ e Enter para selecionar.`, 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('[customersModalSearch] Erro ao buscar clientes:', error);
      renderEmpty('Não foi possível carregar os clientes.');
      setStatus('Erro ao buscar clientes. Verifique a conexão e tente novamente.', 'error');
    } finally {
      isSearching = false;
      if (!isClosed) {
        btn.disabled = false;
        q.disabled = false;
        q.focus();
        q.select();
      }
    }
  }

  function onGlobalKeyDown(event) {
    if (isClosed || !document.body.contains(modal)) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (!dialog.contains(document.activeElement)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); event.stopPropagation();
      moveSelection(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (resultRows.length) pickSelected(); else if (document.activeElement === q || document.activeElement === btn) buscar();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialog.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  closeButton.addEventListener('click', close);
  modal.addEventListener('cms:close', close, { once: true });
  modal.querySelector('[data-cms-close]').addEventListener('mousedown', close);
  btn.addEventListener('click', buscar);
  q.addEventListener('input', () => {
    currentIndex = -1;
    resultRows.forEach((row) => {
      row.classList.remove('is-selected');
      row.setAttribute('aria-selected', 'false');
      row.tabIndex = -1;
    });
  });
  tbody.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-index]');
    if (!row || !tbody.contains(row)) return;
    updateSelection(Number(row.dataset.index));
    pickSelected();
  });
  tbody.addEventListener('mousemove', (event) => {
    const row = event.target.closest('tr[data-index]');
    const index = Number(row?.dataset.index);
    if (row && tbody.contains(row) && Number.isInteger(index) && index !== currentIndex) updateSelection(index);
  });

  document.addEventListener('keydown', onGlobalKeyDown, true);
  requestAnimationFrame(() => { if (!isClosed) q.focus(); });

  return { close, search: buscar, focus: () => q.focus() };
}