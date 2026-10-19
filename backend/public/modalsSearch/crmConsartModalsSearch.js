// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmConsartModalsSearch.js — Modais de Busca CRM (PRODNEX ERP)       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';

function normalizeApiBase(apiBase = '') {
  return (apiBase || '').replace(/\/$/, '');
}

function joinUrl(base = '', endpoint = '') {
  base = base || '';
  endpoint = endpoint || '';

  if (!base) return endpoint;
  if (!endpoint) return base;

  if (base.endsWith('/') && endpoint.startsWith('/')) return base + endpoint.slice(1);
  if (!base.endsWith('/') && !endpoint.startsWith('/')) return `${base}/${endpoint}`;

  return base + endpoint;
}

/* =======================================================================
   ESTRUTURA PADRÃO (modals.css / modal.js)
   ======================================================================= */

const STYLE_ID = 'crm-search-modal-styles';

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .crm-search-modal .modal__subtitle {
      margin: 2px 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .crm-search-modal__row {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }

    .crm-search-modal__row .fields {
      flex: 1 1 auto;
    }

    .crm-search-modal__results {
      margin-top: 12px;
      min-height: 120px;
      max-height: 360px;
      overflow: auto;
      padding: 4px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      background: #f9fafb;
    }

    .crm-search-modal__msg {
      padding: 10px;
      font-size: 0.8rem;
      color: #6b7280;
    }

    .crm-search-modal__msg--error {
      color: #b91c1c;
    }

    .crm-search-modal__card {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      margin-bottom: 6px;
      padding: 8px 10px;
      text-align: left;
      font-size: 0.82rem;
      background: #ffffff;
      border: 1px solid transparent;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
      cursor: pointer;
    }

    .crm-search-modal__card:hover,
    .crm-search-modal__card.is-selected {
      background: #dbeafe;
      border-color: #2563eb;
    }

    .crm-search-modal__card-title {
      font-weight: 600;
      color: #0f172a;
    }

    .crm-search-modal__card-info {
      color: #6b7280;
    }
  `;

  document.head.appendChild(style);
}

function createBaseModal({ title = 'Buscar', subtitle = '', placeholder = 'Buscar...', emptyText = '' } = {}) {
  ensureStyles();

  const uid = `crmSearch${Date.now()}`;
  const overlay = document.createElement('div');
  overlay.className = 'modal crm-search-modal';
  overlay.setAttribute('aria-hidden', 'true');

  overlay.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">
      <section class="modal__panel modal-width-8" role="dialog" aria-modal="true" aria-labelledby="${uid}Title">

        <header class="modal__header modal-header-color-3">
          <div>
            <h2 class="modal__title" id="${uid}Title"></h2>
            <p class="modal__subtitle" data-subtitle></p>
          </div>
          <button type="button" class="modal__close" data-modal-close aria-label="Fechar" title="Fechar">&times;</button>
        </header>

        <div class="modal__body">
          <div class="crm-search-modal__row">
            <div class="fields fields-w-full fields-h-6">
              <label for="${uid}Input">Pesquisar</label>
              <input type="search" id="${uid}Input" autocomplete="off">
            </div>
            <button type="button" class="btn btn-search btn-sm" data-search>🔍 Buscar</button>
          </div>

          <div class="crm-search-modal__results" data-results>
            <div class="crm-search-modal__msg"></div>
          </div>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <button type="button" class="btn btn-cancel btn-sm" data-modal-close>Cancelar</button>
        </footer>

      </section>
    </div>
  `;

  overlay.querySelector('.modal__title').textContent = title;

  const subtitleEl = overlay.querySelector('[data-subtitle]');
  if (subtitle) subtitleEl.textContent = subtitle;
  else subtitleEl.remove();

  const input = overlay.querySelector('input[type="search"]');
  input.placeholder = placeholder;

  const results = overlay.querySelector('[data-results]');
  results.querySelector('.crm-search-modal__msg').textContent = emptyText;

  // Fechou (X, Cancelar, backdrop ou ESC pelo modal.js) → remove do DOM
  overlay.addEventListener('modal:close', () => overlay.remove());

  return {
    overlay,
    input,
    results,
    btnSearch: overlay.querySelector('[data-search]'),
  };
}

function showModal(overlay, input) {
  Modal.setup();
  document.body.appendChild(overlay);
  Modal.open(overlay);
  input.focus();
}

function closeModal(overlay) {
  if (!overlay) return;
  if (!Modal.close(overlay)) overlay.remove();
}

function setMessage(results, text, isError = false) {
  results.innerHTML = '';

  const msg = document.createElement('div');
  msg.className = `crm-search-modal__msg${isError ? ' crm-search-modal__msg--error' : ''}`;
  msg.textContent = text;

  results.appendChild(msg);
}

function createResultCard(title, info) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'crm-search-modal__card';

  const line1 = document.createElement('div');
  line1.className = 'crm-search-modal__card-title';
  line1.textContent = title;

  const line2 = document.createElement('div');
  line2.className = 'crm-search-modal__card-info';
  line2.textContent = info || 'Sem dados adicionais';

  card.appendChild(line1);
  card.appendChild(line2);

  return card;
}

/* =======================================================================
   BUSCA DE CLIENTES
   ======================================================================= */

export function openCrmCustomerSearchModal({
  apiBase = '',
  onPick,
  endpoint = '/api/customers/search',
} = {}) {
  apiBase = normalizeApiBase(
    apiBase || (typeof window !== 'undefined' ? window.apiBase : '') || ''
  );

  const { overlay, input, results, btnSearch } = createBaseModal({
    title: 'Localizar cliente',
    subtitle: 'Digite parte do nome, código ou documento do cliente.',
    placeholder: 'Buscar cliente...',
    emptyText: 'Digite algo e clique em "Buscar" para localizar clientes.',
  });

  let selectedIndex = -1;

  function getCustomerCards() {
    return Array.from(results.querySelectorAll('button[data-crm-customer-card="1"]'));
  }

  function updateCustomerSelection() {
    const cards = getCustomerCards();

    cards.forEach((card, index) => {
      card.classList.toggle('is-selected', index === selectedIndex);
    });

    if (cards[selectedIndex]) {
      cards[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  async function doSearch() {
    const q = (input.value || '').trim();

    if (!q) {
      input.focus();
      return;
    }

    selectedIndex = -1;
    setMessage(results, 'Buscando clientes...');

    try {
      const href = joinUrl(apiBase || '', endpoint);
      const urlStr = `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;

      const res = await fetch(urlStr);
      const json = await res.json();

      const list = json.data || json.rows || [];
      results.innerHTML = '';

      if (!list.length) {
        setMessage(results, 'Nenhum cliente encontrado com esse critério.');
        return;
      }

      list.forEach((customer) => {
        const name =
          customer.trade_name ||
          customer.legal_name ||
          customer.nome_fantasia ||
          customer.razao_social ||
          customer.name ||
          customer.customer_name ||
          `Cliente #${customer.customer_id || customer.id}`;

        const doc =
          customer.tax_id ||
          customer.cnpj_cpf ||
          customer.document ||
          '';

        const phone =
          customer.phone ||
          customer.phone_number ||
          customer.mobile_number ||
          customer.telefone ||
          '';

        const infos = [];
        if (doc) infos.push(`Doc: ${doc}`);
        if (customer.email) infos.push(`Email: ${customer.email}`);
        if (phone) infos.push(`Tel: ${phone}`);

        const card = createResultCard(name, infos.join(' • '));
        card.dataset.crmCustomerCard = '1';

        card.addEventListener('click', () => {
          if (typeof onPick === 'function') {
            onPick({
              ...customer,
              id: customer.customer_id ?? customer.id ?? null,
              customer_id: customer.customer_id ?? customer.id ?? null,
              name,
              document: doc,
              tax_id: customer.tax_id ?? customer.cnpj_cpf ?? doc ?? null,
              cnpj_cpf: customer.cnpj_cpf ?? customer.tax_id ?? doc ?? null,
              email: customer.email ?? customer.email_address ?? null,
              phone:
                customer.phone ??
                customer.phone_number ??
                customer.mobile_number ??
                customer.telefone ??
                null,
            });
          }

          closeModal(overlay);
        });

        results.appendChild(card);
      });

      selectedIndex = 0;
      updateCustomerSelection();
    } catch (err) {
      console.error('[CRM Modal Search] Erro ao buscar clientes:', err);
      setMessage(results, 'Erro ao buscar clientes. Tente novamente.', true);
    }
  }

  btnSearch.addEventListener('click', doSearch);

  input.addEventListener('keydown', (e) => {
    const cards = getCustomerCards();

    if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (!cards.length) return;

      selectedIndex = selectedIndex < cards.length - 1 ? selectedIndex + 1 : 0;
      updateCustomerSelection();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();

      if (!cards.length) return;

      selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : cards.length - 1;
      updateCustomerSelection();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (cards.length && selectedIndex >= 0) {
        cards[selectedIndex].click();
        return;
      }

      doSearch();
    }
  });

  showModal(overlay, input);
}

/* =======================================================================
   BUSCA DE VENDEDORES
   ======================================================================= */

export function openCrmSellerSearchModal({
  apiBase = '',
  onPick,
  endpoint = '/api/sellers',
} = {}) {
  apiBase = normalizeApiBase(
    apiBase || (typeof window !== 'undefined' ? window.apiBase : '') || ''
  );

  const { overlay, input, results, btnSearch } = createBaseModal({
    title: 'Localizar vendedor',
    subtitle: 'Digite parte do nome, apelido ou documento do vendedor.',
    placeholder: 'Buscar vendedor...',
    emptyText: 'Digite algo e clique em "Buscar" para localizar vendedores.',
  });

  async function doSearch() {
    const q = (input.value || '').trim();

    if (!q) {
      input.focus();
      return;
    }

    setMessage(results, 'Buscando vendedores...');

    try {
      const href = joinUrl(apiBase || '', endpoint);
      const urlStr = `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;

      const res = await fetch(urlStr);
      const json = await res.json();

      const list = json.data || json.rows || [];
      results.innerHTML = '';

      if (!list.length) {
        setMessage(results, 'Nenhum vendedor encontrado com esse critério.');
        return;
      }

      list.forEach((seller) => {
        const name = seller.name || seller.nome || `Vendedor #${seller.id}`;
        const nickname = seller.nickname || seller.apelido || '';
        const doc = seller.document || seller.cpf_cnpj || '';
        const phone = seller.mobile || seller.phone || seller.telefone || '';

        const extra = [];
        if (doc) extra.push(`Doc: ${doc}`);
        if (phone) extra.push(`Tel: ${phone}`);
        if (seller.email) extra.push(`Email: ${seller.email}`);

        const card = createResultCard(
          nickname ? `${name} (${nickname})` : name,
          extra.join(' • ')
        );

        card.addEventListener('click', () => {
          if (typeof onPick === 'function') onPick(seller);
          closeModal(overlay);
        });

        results.appendChild(card);
      });
    } catch (err) {
      console.error('[CRM Modal Search] Erro ao buscar vendedores:', err);
      setMessage(results, 'Erro ao buscar vendedores. Tente novamente.', true);
    }
  }

  btnSearch.addEventListener('click', doSearch);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch();
    }
  });

  showModal(overlay, input);
}

const crmConsartModalsSearch = {
  openCrmCustomerSearchModal,
  openCrmSellerSearchModal,
};

export default crmConsartModalsSearch;