/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ ordersModalSearch.js — Modal de Busca de Pedidos (PRODNEX ERP)       ║
   ║ Path: backend/public/modalsSearch/ordersModalSearch.js               ║
   ║ - Busca via GET /api/orders/search                                  ║
   ║ - Seleção retorna o pedido escolhido                                ║
   ║ - Paginação limit/offset                                            ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

const qs  = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

const API_BASE = () => (window.apiBase || location.origin);

// Ajuste se sua rota for diferente:
const API_ORDERS_SEARCH = () => `${API_BASE()}/api/orders/search`;
const API_ORDERS_GET    = (id) => `${API_BASE()}/api/orders/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
function escHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clampInt(n, def, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString('pt-BR');
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
  const txt = await r.text();
  let data = null;
  try { data = JSON.parse(txt); } catch { data = { ok: false, error: txt }; }
  if (!r.ok) {
    const msg = data?.error || data?.message || `${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  return data;
}

// ---------------------------------------------------------------------
// Modal singleton
// ---------------------------------------------------------------------
let _mounted = false;

function ensureModalDom() {
  if (_mounted) return;

  // styles
  const st = document.createElement('style');
  st.id = 'ordersModalSearch__css';
  st.textContent = `
    .oms-overlay{
      position: fixed; inset: 0;
      background: rgba(15,23,42,.55);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      padding: 16px;
    }
    .oms-overlay.is-open{ display:flex; }
    .oms-card{
      width: min(1100px, 100%);
      background: #fff;
      border: 1px solid rgba(148,163,184,.55);
      border-radius: 14px;
      box-shadow: 0 24px 70px rgba(0,0,0,.25);
      overflow: hidden;
    }
    .oms-head{
      display:flex; align-items:center; justify-content: space-between;
      padding: 14px 16px;
      background: linear-gradient(180deg, rgba(248,250,252,1), rgba(241,245,249,1));
      border-bottom: 1px solid rgba(148,163,184,.4);
    }
    .oms-title{ font-weight: 800; font-size: 14px; letter-spacing:.2px; color:#0f172a; }
    .oms-sub{ font-size: 12px; color:#64748b; margin-top: 2px; }
    .oms-x{
      border: 0; background: transparent; cursor:pointer;
      font-size: 18px; line-height: 1; padding: 6px 10px;
      border-radius: 10px;
    }
    .oms-x:hover{ background: rgba(148,163,184,.18); }
    .oms-body{ padding: 14px 16px; }
    .oms-grid{
      display:grid;
      grid-template-columns: 1fr 140px 140px 140px;
      gap: 10px;
      align-items: end;
    }
    .oms-field label{ display:block; font-size: 12px; color:#334155; font-weight: 700; margin-bottom: 6px; }
    .oms-field input, .oms-field select{
      width:100%;
      border: 1px solid rgba(148,163,184,.6);
      border-radius: 10px;
      padding: 10px 10px;
      font-size: 13px;
      outline: none;
    }
    .oms-field input:focus, .oms-field select:focus{
      border-color: rgba(37,99,235,.55);
      box-shadow: 0 0 0 3px rgba(37,99,235,.12);
    }
    .oms-actions{ display:flex; gap: 8px; justify-content: flex-end; }
    .oms-meta{ font-size: 12px; color:#64748b; padding-top: 6px; }
    .oms-tableWrap{
      margin-top: 12px;
      border: 1px solid rgba(148,163,184,.45);
      border-radius: 12px;
      overflow: hidden;
    }
    .oms-table{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .oms-table thead th{
      background: rgba(248,250,252,1);
      border-bottom: 1px solid rgba(148,163,184,.35);
      padding: 10px 10px;
      text-align: left;
      color:#0f172a;
      font-weight: 800;
      white-space: nowrap;
    }
    .oms-table tbody td{
      border-bottom: 1px solid rgba(148,163,184,.22);
      padding: 10px 10px;
      color:#0f172a;
      vertical-align: middle;
    }
    .oms-table tbody tr{
      cursor: pointer;
    }
    .oms-table tbody tr:hover{
      background: rgba(37,99,235,.06);
    }
    .oms-table tbody tr.is-selected{
      background: rgba(37,99,235,.10);
      outline: 2px solid rgba(37,99,235,.25);
      outline-offset: -2px;
    }
    .oms-right{ text-align:right; }
    .oms-center{ text-align:center; }
    .oms-foot{
      display:flex;
      align-items:center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(248,250,252,1);
      border-top: 1px solid rgba(148,163,184,.35);
    }
    .oms-pager{ display:flex; align-items:center; gap: 8px; }
    .oms-hint{ font-size: 12px; color:#64748b; }
    .oms-btn{
      border: 1px solid rgba(148,163,184,.6);
      background: #fff;
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }
    .oms-btn:hover{ background: rgba(148,163,184,.12); }
    .oms-btn--primary{
      background: rgba(37,99,235,1);
      border-color: rgba(37,99,235,1);
      color:#fff;
    }
    .oms-btn--primary:hover{ filter: brightness(.95); }
    .oms-btn[disabled]{ opacity:.55; cursor:not-allowed; }
    .oms-empty{
      text-align:center; padding: 18px; color:#64748b;
    }
  `;
  document.head.appendChild(st);

  // modal HTML
  const wrap = document.createElement('div');
  wrap.className = 'oms-overlay';
  wrap.id = 'ordersModalSearch__overlay';
  wrap.innerHTML = `
    <div class="oms-card" role="dialog" aria-modal="true" aria-labelledby="omsTitle">
      <div class="oms-head">
        <div>
          <div class="oms-title" id="omsTitle">🔎 Buscar Pedido</div>
          <div class="oms-sub">Busque por cliente, documento, número do pedido, NF-e, etc.</div>
        </div>
        <button class="oms-x" type="button" data-close="1" title="Fechar">✕</button>
      </div>

      <div class="oms-body">
        <div class="oms-grid">
          <div class="oms-field">
            <label for="omsQ">Buscar</label>
            <input id="omsQ" type="text" placeholder="Ex: Maria / 123456 / 1002 / chave..." autocomplete="off" />
          </div>

          <div class="oms-field">
            <label for="omsStatus">Status</label>
            <select id="omsStatus">
              <option value="">Todos</option>
              <option value="ABERTO">ABERTO</option>
              <option value="CONVERTIDO">CONVERTIDO</option>
              <option value="FATURADO">FATURADO</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>

          <div class="oms-field">
            <label for="omsLimit">Limit</label>
            <select id="omsLimit">
              <option value="10">10</option>
              <option value="20" selected>20</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div class="oms-actions">
            <button class="btn btn-toolbar btn-sm" type="button" id="omsBtnClear">Limpar</button>
            <button class="btn btn-toolbar btn-sm" type="button" id="omsBtnSearch">Buscar</button>
          </div>
        </div>

        <div class="oms-meta" id="omsMeta">—</div>

        <div class="oms-tableWrap">
          <table class="oms-table">
            <thead>
              <tr>
                <th class="oms-right">ID</th>
                <th class="oms-right">Número</th>
                <th>Cliente</th>
                <th>Doc</th>
                <th class="oms-center">Data</th>
                <th class="oms-center">Status</th>
                <th class="oms-right">Total</th>
              </tr>
            </thead>
            <tbody id="omsTbody">
              <tr><td colspan="7" class="oms-empty">Digite para buscar…</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="oms-foot">
        <div class="oms-pager">
          <button class="btn btn-toolbar btn-sm" id="omsPrev">◀</button>
          <div class="oms-hint" id="omsPage">Página 1</div>
          <button class="btn btn-toolbar btn-sm" id="omsNext">▶</button>
        </div>

        <div style="display:flex; gap:8px;">
          <button class="btn btn-toolbar btn-sm" type="button" data-close="1">Cancelar</button>
          <button class="btn btn-toolbar btn-sm" type="button" id="omsSelect" disabled>Selecionar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  // close handlers
  wrap.addEventListener('click', (e) => {
    const t = e.target;
    if (t?.dataset?.close === '1') closeModal();
    if (t === wrap) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    const overlay = qs('#ordersModalSearch__overlay');
    if (!overlay?.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModal();
  });

  _mounted = true;
}

function openModal() {
  ensureModalDom();
  qs('#ordersModalSearch__overlay')?.classList.add('is-open');
  qs('#omsQ')?.focus();
}
function closeModal() {
  qs('#ordersModalSearch__overlay')?.classList.remove('is-open');
}

// ---------------------------------------------------------------------
// State + actions
// ---------------------------------------------------------------------
let _resolver = null;
let _rejecter = null;

let state = {
  q: '',
  status: '',
  limit: 20,
  offset: 0,
  total: 0,
  rows: [],
  selected: null,
};

function setMeta(text) {
  const el = qs('#omsMeta');
  if (el) el.textContent = text || '—';
}

function setPageInfo() {
  const p = qs('#omsPage');
  if (!p) return;
  const page = Math.floor(state.offset / state.limit) + 1;
  const pages = state.total ? Math.ceil(state.total / state.limit) : 1;
  p.textContent = `Página ${page} / ${pages}`;
  qs('#omsPrev')?.toggleAttribute('disabled', state.offset <= 0);
  qs('#omsNext')?.toggleAttribute('disabled', (state.offset + state.limit) >= state.total);
}

function clearSelection() {
  state.selected = null;
  qsa('#omsTbody tr').forEach(tr => tr.classList.remove('is-selected'));
  qs('#omsSelect')?.setAttribute('disabled', 'disabled');
}

function renderRows() {
  const tb = qs('#omsTbody');
  if (!tb) return;

  if (!state.rows?.length) {
    tb.innerHTML = `<tr><td colspan="7" class="oms-empty">Nenhum resultado.</td></tr>`;
    clearSelection();
    setPageInfo();
    return;
  }

  tb.innerHTML = state.rows.map((o) => {
    const id = o.order_id ?? '';
    const num = o.number ?? '';
    const name = o.customer_name ?? o.nome_razao_social ?? '';
    const doc = o.customer_tax_id ?? o.cnpj_cpf ?? '';
    const dt  = fmtDate(o.issue_date);
    const st  = o.status ?? '';
    const total = money(o.total_amount ?? 0);

    return `
      <tr data-id="${escHtml(id)}">
        <td class="oms-right">${escHtml(id)}</td>
        <td class="oms-right">${escHtml(num)}</td>
        <td>${escHtml(name)}</td>
        <td>${escHtml(doc)}</td>
        <td class="oms-center">${escHtml(dt)}</td>
        <td class="oms-center">${escHtml(st)}</td>
        <td class="oms-right">${escHtml(total)}</td>
      </tr>
    `;
  }).join('');

  // row click select
  qsa('#omsTbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const id = tr.dataset.id;
      const row = state.rows.find(r => String(r.order_id) === String(id));
      if (!row) return;

      qsa('#omsTbody tr').forEach(x => x.classList.remove('is-selected'));
      tr.classList.add('is-selected');

      state.selected = row;
      qs('#omsSelect')?.removeAttribute('disabled');
    });

    tr.addEventListener('dblclick', async () => {
      const id = tr.dataset.id;
      await selectById(id);
    });
  });

  setPageInfo();
}

async function searchOrders() {
  const q = String(state.q || '').trim();
  const limit = clampInt(state.limit, 20, 1, 200);
  const offset = clampInt(state.offset, 0, 0, 1_000_000);

  setMeta('Carregando…');
  clearSelection();

  const url = new URL(API_ORDERS_SEARCH());
  if (q) url.searchParams.set('q', q);
  if (state.status) url.searchParams.set('status', state.status);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  // Seu ordersApi.search retorna { ok, rows, total }
  const data = await fetchJson(url.toString());

  if (!data?.ok) {
    const msg = data?.error || 'Falha ao buscar pedidos.';
    throw new Error(msg);
  }

  state.rows = Array.isArray(data.rows) ? data.rows : [];
  state.total = Number(data.total || 0);

  setMeta(`Resultados: ${state.rows.length} (Total: ${state.total})`);
  renderRows();
}

async function selectById(orderId) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return;

  // Se quiser retornar só o header do search, beleza.
  // Mas normalmente a tela de volumes vai querer os itens → GET /api/orders/:id
  setMeta('Carregando pedido…');

  const data = await fetchJson(API_ORDERS_GET(id));

  // Seu getById retorna { ok, header, items }
  if (!data?.ok) {
    const msg = data?.error || 'Falha ao carregar pedido.';
    throw new Error(msg);
  }

  const payload = {
    header: data.header || null,
    items: Array.isArray(data.items) ? data.items : [],
    raw: data,
  };

  closeModal();
  if (_resolver) _resolver(payload);
  _resolver = null;
  _rejecter = null;
}

function wireUiOnce() {
  const qInp = qs('#omsQ');
  const selStatus = qs('#omsStatus');
  const selLimit = qs('#omsLimit');

  const btnSearch = qs('#omsBtnSearch');
  const btnClear = qs('#omsBtnClear');
  const btnPrev = qs('#omsPrev');
  const btnNext = qs('#omsNext');
  const btnSelect = qs('#omsSelect');

  if (!qInp || qInp.dataset.wired === '1') return;

  qInp.dataset.wired = '1';

  const run = debounce(async () => {
    state.offset = 0;
    await searchOrders();
  }, 300);

  qInp.addEventListener('input', () => {
    state.q = qInp.value;
    run();
  });

  selStatus?.addEventListener('change', async () => {
    state.status = selStatus.value || '';
    state.offset = 0;
    await searchOrders();
  });

  selLimit?.addEventListener('change', async () => {
    state.limit = Number(selLimit.value) || 20;
    state.offset = 0;
    await searchOrders();
  });

  btnSearch?.addEventListener('click', async () => {
    state.q = qInp.value;
    state.offset = 0;
    await searchOrders();
  });

  btnClear?.addEventListener('click', async () => {
    qInp.value = '';
    if (selStatus) selStatus.value = '';
    if (selLimit) selLimit.value = '20';

    state.q = '';
    state.status = '';
    state.limit = 20;
    state.offset = 0;
    state.total = 0;
    state.rows = [];
    clearSelection();

    const tb = qs('#omsTbody');
    if (tb) tb.innerHTML = `<tr><td colspan="7" class="oms-empty">Digite para buscar…</td></tr>`;
    setMeta('—');
    setPageInfo();
  });

  btnPrev?.addEventListener('click', async () => {
    state.offset = Math.max(0, state.offset - state.limit);
    await searchOrders();
  });

  btnNext?.addEventListener('click', async () => {
    state.offset = state.offset + state.limit;
    await searchOrders();
  });

  btnSelect?.addEventListener('click', async () => {
    if (!state.selected?.order_id) return;
    await selectById(state.selected.order_id);
  });
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------
/**
 * Abre modal e retorna:
 *  - { header, items, raw } (header + itens do pedido via GET /api/orders/:id)
 *  - null (se cancelar)
 */
export function openOrdersSearchModal({
  initialQuery = '',
  status = '',
  limit = 20,
} = {}) {
  ensureModalDom();
  wireUiOnce();

  // init state
  state.q = String(initialQuery || '');
  state.status = String(status || '');
  state.limit = clampInt(limit, 20, 1, 200);
  state.offset = 0;
  state.total = 0;
  state.rows = [];
  state.selected = null;

  // init UI values
  const qInp = qs('#omsQ');
  const selStatus = qs('#omsStatus');
  const selLimit = qs('#omsLimit');

  if (qInp) qInp.value = state.q;
  if (selStatus) selStatus.value = state.status;
  if (selLimit) selLimit.value = String(state.limit);

  // reset UI
  const tb = qs('#omsTbody');
  if (tb) tb.innerHTML = `<tr><td colspan="7" class="oms-empty">Digite para buscar…</td></tr>`;
  setMeta('—');
  setPageInfo();
  clearSelection();

  openModal();

  // auto search if initialQuery present
  if (state.q.trim()) {
    searchOrders().catch((e) => setMeta(`Erro: ${e?.message || e}`));
  }

  return new Promise((resolve, reject) => {
    _resolver = resolve;
    _rejecter = reject;

    const overlay = qs('#ordersModalSearch__overlay');
    if (!overlay) return resolve(null);

    // 🔒 garante que vamos resolver uma única vez
    let settled = false;
    const settle = (val) => {
      if (settled) return;
      settled = true;

      try { closeModal(); } catch {}
      try { document.removeEventListener('keydown', escHandler); } catch {}
      try { overlay.removeEventListener('click', overlayClickHandler); } catch {}

      _resolver = null;
      _rejecter = null;
      resolve(val);
    };

    // ✅ Fechar clicando fora (backdrop/overlay) ou no X/cancel
    const overlayClickHandler = (e) => {
      const t = e.target;

      // clique no overlay (fora do card)
      if (t === overlay) return settle(null);

      // clique em qualquer elemento com data-close dentro do modal
      if (t?.dataset?.close === '1') return settle(null);
    };

    overlay.addEventListener('click', overlayClickHandler);

    // ✅ ESC fecha
    const escHandler = (e) => {
      if (e.key === 'Escape') settle(null);
    };
    document.addEventListener('keydown', escHandler);
  });
}

export default { openOrdersSearchModal };
