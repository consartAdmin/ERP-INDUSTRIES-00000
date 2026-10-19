// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsUnitsModalSearch.js — Modal para buscar unidades do produto ║
// ║ PRODNEX ERP — usa /api/products-units                               ║
// ║ export default: openProductsUnitsModalSearch({                       ║
// ║   productId, productCode, onSelect(unitRow)                          ║
// ║ })                                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// ---------------------------------------------------------------------
// API BASE — usa getApiBase() do backend/config/apiBase.js
// ---------------------------------------------------------------------
const ROOT_API =
  (typeof window !== 'undefined' &&
    (typeof window.getApiBase === 'function'
      ? window.getApiBase()
      : (window.apiBase || window.API_BASE))) ||
  'http://localhost:8080';

const API_PRODUCTS_UNITS = `${ROOT_API}/api/products-units`;

// ---------------------------------------------------------------------
// Estado interno do modal
// ---------------------------------------------------------------------
let overlayEl = null;
let dialogEl  = null;
let formEl    = null;
let inputQEl  = null;
let tableBodyEl = null;
let statusEl  = null;
let closeBtnEl = null;

let currentConfig = null; // { productId, productCode, onSelect }

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------
// Cria modal (uma vez só)
// ---------------------------------------------------------------------
function ensureModal() {
  if (overlayEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'c-modal-backdrop c-modal-backdrop--units';
  overlayEl.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.42);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 1300;
  `;

  dialogEl = document.createElement('div');
  dialogEl.className = 'c-modal c-modal--units';
  dialogEl.style.cssText = `
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
    width: min(640px, 95vw);
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  dialogEl.innerHTML = `
    <header style="padding: 16px 18px; border-bottom: 1px solid #e5e7eb; display:flex; align-items:center; gap:8px;">
      <div>
        <h2 style="margin:0; font-size:1rem; font-weight:600;">Selecionar Unidade do Produto</h2>
        <p id="pum-product-info" style="margin:2px 0 0; font-size:.85rem; color:#6b7280;">
          Localize uma unidade em productsUnits vinculada a um código de produto (SKU).
        </p>
      </div>
      <button
        type="button"
        id="pum-close-btn"
        style="margin-left:auto; border:0; background:none; font-size:1.4rem; cursor:pointer; line-height:1;"
      >
        ×
      </button>
    </header>

    <div style="padding: 12px 18px; border-bottom: 1px solid #e5e7eb; display:flex; flex-direction:column; gap:8px;">
      <div style="font-size:.85rem; color:#4b5563;">
        <strong>Código do produto (SKU):</strong>
        <span id="pum-product-code">-</span>
      </div>

      <form id="pum-search-form" style="display:flex; gap:8px; align-items:flex-end;">
        <div style="flex:1;">
          <label for="pum-q" style="display:block; font-size:.8rem; margin-bottom:2px;">Buscar por unidade / descrição</label>
          <input
            id="pum-q"
            type="text"
            placeholder="Ex.: CX.50, UN., CAIXA 50..."
            style="width:100%; padding:.5rem .6rem; border-radius:8px; border:1px solid #d1d5db; font-size:.9rem;"
          />
        </div>
        <button
          type="submit"
          style="padding:.55rem 1.1rem; border-radius:999px; border:0; background:#2563eb; color:#fff; font-size:.9rem; cursor:pointer;"
        >
          Buscar
        </button>
      </form>
    </div>

    <div style="flex:1; overflow:auto;">
      <table style="width:100%; border-collapse:collapse; font-size:.86rem;">
        <thead style="background:#f9fafb;">
          <tr>
            <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e7eb;">ID</th>
            <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e7eb;">Unidade</th>
            <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e7eb;">Descrição</th>
            <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">Fator</th>
            <th style="padding:6px 8px; text-align:center; border-bottom:1px solid #e5e7eb;">Padrão</th>
          </tr>
        </thead>
        <tbody id="pum-tbody">
          <tr>
            <td colspan="5" style="padding:10px 8px; text-align:center; color:#6b7280; font-size:.85rem;">
              Informe um termo e clique em Buscar.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer style="padding:8px 18px 12px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;">
      <div id="pum-status" style="font-size:.8rem; color:#6b7280;">Nenhuma unidade consultada ainda.</div>
      <button
        type="button"
        id="pum-close-footer"
        style="padding:.45rem 1.1rem; border-radius:999px; border:1px solid #e5e7eb; background:#fff; font-size:.85rem; cursor:pointer;"
      >
        Fechar
      </button>
    </footer>
  `;

  overlayEl.appendChild(dialogEl);
  document.body.appendChild(overlayEl);

  // refs
  formEl       = dialogEl.querySelector('#pum-search-form');
  inputQEl     = dialogEl.querySelector('#pum-q');
  tableBodyEl  = dialogEl.querySelector('#pum-tbody');
  statusEl     = dialogEl.querySelector('#pum-status');
  closeBtnEl   = dialogEl.querySelector('#pum-close-btn');
  const closeFooterBtn = dialogEl.querySelector('#pum-close-footer');

  const close = () => {
    overlayEl.style.display = 'none';
    document.removeEventListener('keydown', escHandler);
    currentConfig = null;
  };

  function escHandler(ev) {
    if (ev.key === 'Escape') close();
  }

  overlayEl.addEventListener('click', (ev) => {
    if (ev.target === overlayEl) close();
  });
  closeBtnEl.addEventListener('click', close);
  closeFooterBtn.addEventListener('click', close);
  document.addEventListener('keydown', escHandler);

  formEl.addEventListener('submit', (ev) => {
    ev.preventDefault();
    performSearch().catch(console.error);
  });
}

// ---------------------------------------------------------------------
// Busca na API /api/products-units
// ---------------------------------------------------------------------
async function performSearch() {
  const cfg = currentConfig;
  if (!cfg || !cfg.productId) {
    statusEl.textContent = 'Produto não informado.';
    return;
  }

  const termo = inputQEl.value.trim();
  const params = new URLSearchParams();

  // 🔹 filtro principal: product_id (ID interno do produto)
  params.set('product_id', String(cfg.productId));

  if (termo) {
    // usa "q" para buscar por unidade/descrição (já suportado no listProductsUnits)
    params.set('q', termo);
  }

  params.set('limit', '50');
  params.set('offset', '0');

  statusEl.textContent = 'Buscando unidades...';

  try {
    const res = await fetch(`${API_PRODUCTS_UNITS}?${params.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Erro HTTP ${res.status}`);
    }

    const data = await res.json();
    const rows = Array.isArray(data) ? data : data.rows || [];

    renderRows(rows);
    statusEl.textContent = rows.length
      ? `${rows.length} unidade(s) encontrada(s).`
      : 'Nenhuma unidade vinculada encontrada para este produto.';
  } catch (err) {
    console.error('[productsUnitsModalSearch] erro ao buscar unidades:', err);
    statusEl.textContent = 'Erro ao buscar unidades. Veja o console.';
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="5" style="padding:10px 8px; text-align:center; color:#b91c1c;">
          Erro ao buscar unidades.
        </td>
      </tr>
    `;
  }
}

// ---------------------------------------------------------------------
// Render da tabela
// ---------------------------------------------------------------------
function renderRows(rows) {
  tableBodyEl.innerHTML = '';

  if (!rows.length) {
    tableBodyEl.innerHTML = `
      <tr>
        <td colspan="5" style="padding:10px 8px; text-align:center; color:#6b7280; font-size:.85rem;">
          Nenhuma unidade encontrada.
        </td>
      </tr>
    `;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';

    tr.innerHTML = `
      <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${esc(r.product_unit_id)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${esc(r.unit)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${esc(r.description)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6; text-align:right;">${esc(r.fator)}</td>
      <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6; text-align:center;">
        ${r.standard ? '✅' : ''}
      </td>
    `;

    tr.addEventListener('click', () => {
      try {
        currentConfig?.onSelect?.(r);
      } catch (err) {
        console.error('[productsUnitsModalSearch] erro em onSelect:', err);
      }
      overlayEl.style.display = 'none';
      currentConfig = null;
    });

    tableBodyEl.appendChild(tr);
  }
}

// ---------------------------------------------------------------------
// Função pública
// ---------------------------------------------------------------------
export default function openProductsUnitsModalSearch(config) {
  if (!config || !config.productId) {
    console.warn('[productsUnitsModalSearch] productId não informado na abertura do modal.');
  }

  currentConfig = config || {};

  ensureModal();

  // Atualiza header com SKU
  const infoEl = dialogEl.querySelector('#pum-product-info');
  const codeEl = dialogEl.querySelector('#pum-product-code');
  if (codeEl) codeEl.textContent = currentConfig.productCode || '-';
  if (infoEl && currentConfig.productCode) {
    infoEl.textContent = `Localize uma unidade em productsUnits vinculada ao produto SKU ${currentConfig.productCode}. Clique em uma linha para selecionar.`;
  }

  inputQEl.value = '';
  tableBodyEl.innerHTML = `
    <tr>
      <td colspan="5" style="padding:10px 8px; text-align:center; color:#6b7280; font-size:.85rem;">
        Informe um termo e clique em Buscar.
      </td>
    </tr>
  `;
  statusEl.textContent = 'Nenhuma unidade consultada ainda.';

  overlayEl.style.display = 'flex';

  setTimeout(() => {
    inputQEl.focus();
  }, 20);
}
