// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: manufacturesModalSearch.js                                    ║
// ║ MODULE: Manufactures Modal Search                                   ║
// ║ DESCRIPTION: Modal para buscar fabricantes e importar produtos       ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const MANUFACTURES_SEARCH_ROUTES = [
  '/api/productsManufactures',
  '/api/products-manufactures',
  '/api/manufactures',
  '/api/manufacturers',
];

let manufacturesModalCallback = null;
let manufacturesModalState = {
  rows: [],
  selected: null,
};

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

async function safeFetchJson(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.error || json.message || `Erro HTTP ${res.status}`);
  }

  return json;
}

function extractRows(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.manufactures)) return json.manufactures;
  if (Array.isArray(json.manufacturers)) return json.manufacturers;
  return [];
}

function normalizeManufacture(row = {}) {
  return {
    id:
      row.manufacturer_id ??
      row.manufacture_id ??
      row.product_manufacture_id ??
      row.id ??
      null,

    name:
      row.manufacturer_name ??
      row.manufacture_name ??
      row.name ??
      row.nome ??
      row.description ??
      '',

    raw: row,
  };
}

function ensureManufacturesModal() {
  if (document.getElementById('manufacturesModalSearchOverlay')) return;

  const html = `
    <div id="manufacturesModalSearchOverlay" class="manufactures-modal-overlay hidden">
      <div class="manufactures-modal">
        <div class="manufactures-modal-header">
          <div>
            <h2>🏭 Buscar Fabricante</h2>
            <p>Selecione o fabricante para importar os produtos vinculados.</p>
          </div>

          <button type="button" class="manufactures-modal-close" id="btnCloseManufacturesModal">
            ×
          </button>
        </div>

        <div class="manufactures-modal-body">
          <div class="manufactures-search-box">
            <input
              type="text"
              id="manufacturesModalSearchInput"
              placeholder="Digite o nome do fabricante..."
              autocomplete="off"
            />

            <button type="button" id="btnSearchManufacturesModal">
              Buscar
            </button>
          </div>

          <div class="manufactures-modal-hint">
            Dica: digite pelo menos 2 letras para localizar o fabricante.
          </div>

          <div class="manufactures-modal-table-wrap">
            <table class="manufactures-modal-table">
              <thead>
                <tr>
                  <th>Fabricante</th>
                  <th width="140">Ação</th>
                </tr>
              </thead>

              <tbody id="manufacturesModalTableBody">
                <tr>
                  <td colspan="2" class="manufactures-empty">
                    Pesquise um fabricante.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="manufactures-modal-footer">
          <button type="button" class="btn-manufactures-cancel" id="btnCancelManufacturesModal">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  document
    .getElementById('btnCloseManufacturesModal')
    ?.addEventListener('click', closeManufacturesModalSearch);

  document
    .getElementById('btnCancelManufacturesModal')
    ?.addEventListener('click', closeManufacturesModalSearch);

  document
    .getElementById('btnSearchManufacturesModal')
    ?.addEventListener('click', searchManufacturesModal);

  document
    .getElementById('manufacturesModalSearchInput')
    ?.addEventListener('input', debounce(searchManufacturesModal, 350));

  document
    .getElementById('manufacturesModalSearchOverlay')
    ?.addEventListener('click', event => {
      if (event.target.id === 'manufacturesModalSearchOverlay') {
        closeManufacturesModalSearch();
      }
    });
}

function debounce(fn, delay = 300) {
  let timer = null;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function openManufacturesModalSearch(callback) {
  ensureManufacturesModal();

  manufacturesModalCallback = typeof callback === 'function' ? callback : null;
  manufacturesModalState = {
    rows: [],
    selected: null,
  };

  const overlay = document.getElementById('manufacturesModalSearchOverlay');
  const input = document.getElementById('manufacturesModalSearchInput');
  const tbody = document.getElementById('manufacturesModalTableBody');

  if (input) input.value = '';

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="manufactures-empty">
          Pesquise um fabricante.
        </td>
      </tr>
    `;
  }

  overlay?.classList.remove('hidden');

  setTimeout(() => input?.focus(), 80);
}

function closeManufacturesModalSearch() {
  document
    .getElementById('manufacturesModalSearchOverlay')
    ?.classList.add('hidden');
}

async function searchManufacturesModal() {
  const input = document.getElementById('manufacturesModalSearchInput');
  const q = String(input?.value || '').trim();

  if (q.length < 2) {
    renderManufacturesRows([]);
    return;
  }

  const tbody = document.getElementById('manufacturesModalTableBody');

  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="manufactures-loading">
          Buscando fabricantes...
        </td>
      </tr>
    `;
  }

  let rows = [];

  for (const route of MANUFACTURES_SEARCH_ROUTES) {
    try {
      const url = `${route}?q=${encodeURIComponent(q)}&search=${encodeURIComponent(q)}&limit=50`;
      const json = await safeFetchJson(url);
      rows = extractRows(json).map(normalizeManufacture).filter(m => m.name);

      if (rows.length) break;
    } catch (error) {
      console.warn('[manufacturesModalSearch][route fail]', route, error.message);
    }
  }

  manufacturesModalState.rows = rows;
  renderManufacturesRows(rows);
}

function renderManufacturesRows(rows = []) {
  const tbody = document.getElementById('manufacturesModalTableBody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="2" class="manufactures-empty">
          Nenhum fabricante encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row, index) => `
    <tr>
      <td>
        <strong>${escapeHtml(row.name)}</strong>
        ${row.id ? `<small>ID: ${escapeHtml(row.id)}</small>` : ''}
      </td>

      <td>
        <button
          type="button"
          class="btn-select-manufacture"
          data-index="${index}"
        >
          Selecionar
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-select-manufacture').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      selectManufacture(rows[index]);
    });
  });
}

function selectManufacture(manufacture) {
  if (!manufacture) return;

  manufacturesModalState.selected = manufacture;

  if (manufacturesModalCallback) {
    manufacturesModalCallback(manufacture);
  }

  closeManufacturesModalSearch();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.openManufacturesModalSearch = openManufacturesModalSearch;
window.closeManufacturesModalSearch = closeManufacturesModalSearch;

export {
  openManufacturesModalSearch,
  closeManufacturesModalSearch,
};