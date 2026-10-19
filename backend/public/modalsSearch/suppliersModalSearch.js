// ╔══════════════════════════════════════════════════════════════╗
// ║ suppliersModalSearch.js                                      ║
// ║ Modal de busca de Fornecedores / Clientes — PRODNEX ERP (ESM)║
// ║ Path: public/modalsSearch/suppliersModalSearch.js            ║
// ║ ✅ Compatível com API que retorna { ok:true, data:{rows} }    ║
// ║ ✅ Mapeia supplier_id / name / tax_id                        ║
// ║ ✅ allowCustomers:true exibe seletor Clientes | Fornecedor    ║
// ║    (clientes retornam entity_type:'customer' + customer_id)  ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

const LAYER_ID = 'suppliers-modal-layer-consart';

function getApiBaseSafe() {
  try { if (typeof window.getApiBase === 'function') return window.getApiBase(); } catch {}
  return window.API_BASE || window.apiBase || '';
}

const API_BASE = getApiBaseSafe();

const ENTITIES = {
  suppliers: {
    title: 'Pesquisar Fornecedor',
    notFound: 'Nenhum fornecedor encontrado.',
    buildUrl: (q) =>
      `${API_BASE}/api/suppliers?q=${encodeURIComponent(q)}&limit=20&page=1&sort=name&dir=asc`,
    normalize: (s) => ({
      ...s,
      entity_type: 'supplier',
      id: s.supplier_id ?? s.id,
      name: s.name ?? '',
      tax_id: s.tax_id ?? '',
    }),
  },
  customers: {
    title: 'Pesquisar Cliente',
    notFound: 'Nenhum cliente encontrado.',
    buildUrl: (q) =>
      `${API_BASE}/api/customers/search?q=${encodeURIComponent(q)}&limit=20&offset=0`,
    normalize: (c) => {
      const id = c.customer_id ?? c.id ?? '';
      return {
        ...c,
        entity_type: 'customer',
        id,
        customer_id: id,
        name: c.legal_name ?? c.trade_name ?? c.name ?? c.company_name ?? '',
        tax_id: c.tax_id ?? c.cnpj_cpf ?? c.cnpj ?? c.cpf ?? '',
      };
    },
  },
};

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function extractRows(json) {
  // ✅ Suporta { ok:true, data:{rows} }, { rows:[] }, { items:[] }, { data:[] } e []
  const payload = (json && json.ok && json.data) ? json.data : json;
  if (Array.isArray(payload)) return payload;
  for (const key of ['rows', 'items', 'data', 'customers', 'suppliers']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

/**
 * @param {object}  [opts]
 * @param {boolean} [opts.allowCustomers=false] Exibe seletor Clientes | Fornecedor.
 * @param {'suppliers'|'customers'} [opts.defaultType='suppliers']
 * @returns {Promise<object|null>} Registro selecionado (com entity_type) ou null.
 */
export function openSuppliersModalSearch({ allowCustomers = false, defaultType = 'suppliers' } = {}) {
  return new Promise((resolve) => {
    // remove modal antigo se existir
    const old = document.getElementById(LAYER_ID);
    if (old) old.remove();

    let type = allowCustomers && defaultType === 'customers' ? 'customers' : 'suppliers';

    const typeSwitchHtml = allowCustomers ? `
            <div class="sms-typeswitch" role="radiogroup" aria-label="Tipo de pesquisa">
              <button type="button" class="btn btn-sm sms-typeswitch__btn" role="radio" data-type="customers">Clientes</button>
              <button type="button" class="btn btn-sm sms-typeswitch__btn" role="radio" data-type="suppliers">Fornecedor</button>
            </div>` : '';

    // Estrutura padrão MODALS.CSS: .modal > backdrop + dialog > panel (header/body/footer)
    const layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.className = 'modal suppliers-search-modal is-open';
    layer.setAttribute('aria-hidden', 'false');
    layer.innerHTML = `
      <div class="modal__backdrop" data-sms-close></div>

      <div class="modal__dialog">
        <section class="modal__panel modal-width-7" role="dialog" aria-modal="true"
          aria-labelledby="supplierSearchTitle">
          <header class="modal__header modal-header-color-3">
            <h2 id="supplierSearchTitle" class="modal__title">${ENTITIES[type].title}</h2>

            <div class="sms-header-actions">
              ${typeSwitchHtml}
              <button type="button" class="modal__close" data-sms-close
                title="Fechar" aria-label="Fechar">&times;</button>
            </div>
          </header>

          <div class="modal__body modal-section">
            <div class="fields fields-h-6 fields-w-full fields-font-3">
              <label for="supplierSearchInput">Pesquisar</label>
              <input
                id="supplierSearchInput"
                type="text"
                placeholder="Digite nome, CNPJ/CPF ou código..."
                autocomplete="off"
              />
            </div>

            <div class="modal-divider"></div>

            <div class="sms-results">
              <table class="sms-table">
                <thead>
                  <tr>
                    <th class="sms-col-code">Código</th>
                    <th>Nome</th>
                    <th class="sms-col-doc">CNPJ/CPF</th>
                  </tr>
                </thead>
                <tbody id="supplierSearchTbody">
                  <tr><td colspan="3" class="sms-empty">Digite pelo menos 2 caracteres...</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <footer class="modal__footer">
            <button type="button" class="btn btn-cancel btn-sm" data-sms-close>Cancelar</button>
          </footer>
        </section>
      </div>
    `;

    document.body.appendChild(layer);

    const title = layer.querySelector('#supplierSearchTitle');
    const input = layer.querySelector('#supplierSearchInput');
    const tbody = layer.querySelector('#supplierSearchTbody');
    const typeButtons = [...layer.querySelectorAll('.sms-typeswitch__btn')];

    function closeModal(selected = null) {
      document.removeEventListener('keydown', onKeydown, true);
      layer.remove();
      resolve(selected);
    }

    // ESC fecha apenas este modal (captura evita fechar o modal de baixo)
    function onKeydown(e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      closeModal(null);
    }

    layer.querySelectorAll('[data-sms-close]').forEach((el) => {
      el.addEventListener('click', () => closeModal(null));
    });
    document.addEventListener('keydown', onKeydown, true);

    // Debounce + descarte de respostas antigas (troca de tipo durante a busca)
    let timer = null;
    let requestSeq = 0;

    async function fetchRows(q) {
      const entity = ENTITIES[type];
      const res = await fetch(entity.buildUrl(q), { headers: { Accept: 'application/json' } });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || json?.message || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      return extractRows(json).map(entity.normalize);
    }

    function renderEmpty(msg) {
      tbody.innerHTML = `<tr><td colspan="3" class="sms-empty">${escapeHtml(msg)}</td></tr>`;
    }

    function renderRows(rows) {
      if (!rows.length) return renderEmpty(ENTITIES[type].notFound);

      tbody.innerHTML = rows.map((r) => `
          <tr class="sms-row" data-id="${escapeHtml(r.id ?? '')}">
            <td>${escapeHtml(r.id ?? '')}</td>
            <td>${escapeHtml(r.name)}</td>
            <td>${escapeHtml(r.tax_id)}</td>
          </tr>
        `).join('');

      tbody.querySelectorAll('.sms-row').forEach((tr) => {
        tr.addEventListener('click', () => {
          const id = String(tr.dataset.id || '');
          const selected = rows.find(r => String(r.id) === id) || null;
          closeModal(selected);
        });
      });
    }

    function runSearch() {
      clearTimeout(timer);

      const q = input.value.trim();
      if (q.length < 2) {
        requestSeq++;
        return renderEmpty('Digite pelo menos 2 caracteres...');
      }

      timer = setTimeout(async () => {
        const seq = ++requestSeq;
        try {
          renderEmpty('Buscando...');
          const rows = await fetchRows(q);
          if (seq === requestSeq) renderRows(rows);
        } catch (err) {
          if (seq !== requestSeq) return;
          console.error('[suppliersModalSearch]', err);
          renderEmpty(`Erro ao buscar: ${err.message || err}`);
        }
      }, 250);
    }

    function setType(next) {
      type = next;
      title.textContent = ENTITIES[type].title;
      typeButtons.forEach((btn) => {
        const active = btn.dataset.type === type;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', String(active));
      });
    }

    typeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.type === type) return;
        setType(btn.dataset.type);
        runSearch();
        input.focus();
      });
    });

    setType(type);
    input.addEventListener('input', runSearch);

    setTimeout(() => input.focus(), 80);
  });
}
