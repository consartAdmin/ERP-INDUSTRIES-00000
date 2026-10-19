// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 📊 reportsProductsStock.js — Relatório: Posição de Estoque (CONSART | ESM)║
// ║ ✅ filtros avançados (Fornecedor/Grupo/Subgrupo/Marca/Estoque/Ativo/Custo)║
// ║ ✅ paginação + PDF + Excel levando filtros                              ║
// ║ ✅ filtro "Somente estoque positivo" (stock > 0)                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/* ========================================================================== */
/* Estado                                                                     */
/* ========================================================================== */
let state = {
  page: 1,
  limit: 50,
  q: '',
  order: 'description_asc',
  loading: false,
  aborter: null,

  supplier_id: '',
  group_id: '',
  subgroup_id: '',
  brand_id: '',

  // ✅ Somente estoque POSITIVO (>0)
  only_stock: false,

  // '' | '1' | '0'
  active: '1',

  cost_min: '',
  cost_max: '',
};

/* ========================================================================== */
/* Utils                                                                      */
/* ========================================================================== */
const qs  = (s, el = document) => el.querySelector(s);
const qsa = (s, el = document) => Array.from(el.querySelectorAll(s));
const API_BASE = (window.apiBase || window.location.origin || '').replace(/\/+$/, '');

function fmtInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}
function fmtNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '—';
}
function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}
function sanitize(v) {
  return (v ?? '').toString().replace(/[<>&]/g, s => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;' }[s]));
}
function setStatus(msg, type = 'info') {
  const el = qs('#statusArea');
  if (!el) return;
  el.textContent = msg || '';
  el.dataset.type = type;
}
function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function fetchJSON(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }
  if (r.status === 204) return null;
  const ct = r.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    const preview = (await r.text().catch(() => '')).slice(0, 200).replace(/\s+/g, ' ');
    throw new Error(`Resposta não-JSON (${ct}). Corpo: ${preview || '(vazio)'}`);
  }
  return await r.json();
}
async function fetchBlob(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = await r.text(); } catch {}
    throw new Error(`HTTP ${r.status} — ${msg}`);
  }
  return await r.blob();
}

/* ========================================================================== */
/* Query builder (leva filtros para API e exports)                             */
/* ========================================================================== */
function buildQueryParams({ forExport = false } = {}) {
  const sp = new URLSearchParams();

  if (state.q) sp.set('q', state.q);

  if (!forExport) {
    sp.set('page', String(state.page || 1));
    sp.set('limit', String(state.limit || 50));
  }

  if (state.order) sp.set('order', state.order);

  if (state.supplier_id) sp.set('supplier_id', state.supplier_id);
  if (state.group_id) sp.set('group_id', state.group_id);
  if (state.subgroup_id) sp.set('subgroup_id', state.subgroup_id);
  if (state.brand_id) sp.set('brand_id', state.brand_id);

  // ✅ envia para backend (se você implementar depois)
  if (state.only_stock) sp.set('only_stock', '1');

  if (state.active !== '') sp.set('active', state.active);

  if (state.cost_min !== '' && state.cost_min !== null) sp.set('cost_min', String(state.cost_min));
  if (state.cost_max !== '' && state.cost_max !== null) sp.set('cost_max', String(state.cost_max));

  return sp;
}

/* ========================================================================== */
/* API                                                                        */
/* ========================================================================== */
/**
 * Esperado:
 * GET /api/products/stock-position?...
 * -> { ok:true, data:{ rows:[], total, page, limit, summary:{sum_stock,sum_cost} } }
 */
async function loadRows() {
  const signal = state?.aborter?.signal;
  const sp = buildQueryParams({ forExport: false });
  const url = `${API_BASE}/api/products/stock-position?${sp.toString()}`;

  const res = await fetchJSON(url, { signal });

  // normaliza o payload para compat com variações
  const data = res?.data ?? res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
  const total = Number(data?.total);
  const outTotal = Number.isFinite(total) ? total : rows.length;

  const outPg  = Number(data?.page  ?? state.page)  || state.page;
  const outLim = Number(data?.limit ?? state.limit) || state.limit;

  const summary = data?.summary && typeof data.summary === 'object' ? data.summary : null;

  return { rows, total: outTotal, page: outPg, limit: outLim, summary };
}

async function downloadPdf() {
  const sp = buildQueryParams({ forExport: true });
  const url = `${API_BASE}/api/products/stock-position/pdf?${sp.toString()}`;
  return await fetchBlob(url, { method: 'GET' });
}

async function downloadExcel() {
  const sp = buildQueryParams({ forExport: true });
  const url = `${API_BASE}/api/products/stock-position/excel?${sp.toString()}`;
  return await fetchBlob(url, { method: 'GET' });
}

/* ========================================================================== */
/* Lookups (Fornecedor/Grupo/Subgrupo/Marca)                                  */
/* ========================================================================== */
async function loadSuppliersSuggest(q) {
  if (!q || q.trim().length < 2) return [];
  const sp = new URLSearchParams({ q: q.trim(), limit: '20' });
  const url = `${API_BASE}/api/suppliers?${sp.toString()}`;
  const res = await fetchJSON(url);
  const data = res?.data ?? res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
  return rows.map(r => ({
    id: r.id ?? r.supplier_id ?? r.fornecedor_id,
    name: r.name ?? r.nome ?? r.razao_social ?? r.nome_fantasia ?? '',
  })).filter(x => x.id != null);
}

async function loadGroups() {
  const url = `${API_BASE}/api/products/groups`;
  const res = await fetchJSON(url);
  const data = res?.data ?? res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
  return rows.map(r => ({ id: r.id ?? r.group_id, name: r.name ?? r.nome ?? '' })).filter(x => x.id != null);
}

async function loadSubgroups(groupId) {
  if (!groupId) return [];
  const sp = new URLSearchParams({ group_id: String(groupId) });
  const url = `${API_BASE}/api/products/subgroups?${sp.toString()}`;
  const res = await fetchJSON(url);
  const data = res?.data ?? res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
  return rows.map(r => ({ id: r.id ?? r.subgroup_id, name: r.name ?? r.nome ?? '' })).filter(x => x.id != null);
}

async function loadBrands() {
  const url = `${API_BASE}/api/brands`;
  const res = await fetchJSON(url);
  const data = res?.data ?? res;
  const rows = Array.isArray(data?.rows) ? data.rows : (Array.isArray(data) ? data : []);
  return rows.map(r => ({ id: r.id ?? r.brand_id, name: r.name ?? r.nome ?? '' })).filter(x => x.id != null);
}

/* ========================================================================== */
/* Transformações + ordenação                                                 */
/* ========================================================================== */
function mapRow(r) {
  const id = r.product_id ?? r.id ?? r.produto_id ?? null;
  const code = r.product_code ?? r.code ?? r.sku ?? '';
  const desc = r.description ?? r.descricao ?? '';
  const cost = Number(r.cost_price ?? r.cost ?? r.preco_custo ?? 0);
  const stock = Number(r.stock_qty ?? r.stock ?? r.estoque ?? 0);

  const costOk = Number.isFinite(cost) ? cost : 0;
  const stockOk = Number.isFinite(stock) ? stock : 0;

  return {
    id,
    code,
    desc,
    cost: costOk,
    stock: stockOk,
    total: costOk * stockOk,
  };
}

function sortRows(rows, order) {
  const out = [...(rows || [])];
  const byText = (a, b, k, dir = 1) => String(a[k] || '').localeCompare(String(b[k] || ''), 'pt-BR') * dir;
  const byNum  = (a, b, k, dir = 1) => ((Number(a[k]) || 0) - (Number(b[k]) || 0)) * dir;

  switch (order) {
    case 'description_desc': out.sort((a,b) => byText(a,b,'desc', -1)); break;
    case 'stock_desc':       out.sort((a,b) => byNum(a,b,'stock', -1)); break;
    case 'stock_asc':        out.sort((a,b) => byNum(a,b,'stock',  1)); break;
    case 'cost_desc':        out.sort((a,b) => byNum(a,b,'cost',  -1)); break;
    case 'cost_asc':         out.sort((a,b) => byNum(a,b,'cost',   1)); break;
    case 'total_desc':       out.sort((a,b) => byNum(a,b,'total', -1)); break;
    case 'total_asc':        out.sort((a,b) => byNum(a,b,'total',  1)); break;
    case 'description_asc':
    default:
      out.sort((a,b) => byText(a,b,'desc', 1));
      break;
  }
  return out;
}

/* ========================================================================== */
/* Footer / Pagination                                                        */
/* ========================================================================== */
function setFooter({ total = null, page = null, pages = null, sumStock = null, sumCost = null } = {}) {
  const elTotal = qs('#lblTotalItens');
  const elPag   = qs('#lblPagina');
  const elStock = qs('#lblTotEstoque');
  const elCost  = qs('#lblTotCusto');

  if (elTotal) elTotal.textContent = Number.isFinite(Number(total)) ? `${Number(total)} item(ns)` : `— item(ns)`;
  if (elPag) {
    elPag.textContent =
      Number.isFinite(Number(page)) && Number.isFinite(Number(pages))
        ? `Página ${Number(page)} de ${Number(pages)}`
        : `Página — de —`;
  }
  if (elStock) elStock.textContent = `Total estoque: ${Number.isFinite(Number(sumStock)) ? fmtNumber(sumStock) : '—'}`;
  if (elCost)  elCost.textContent  = `Total (custo): ${Number.isFinite(Number(sumCost)) ? fmtMoney(sumCost) : '—'}`;
}

function renderPagination({ total, page, limit }) {
  state.page = page;
  state.limit = limit;

  const el = qs('#paginacao');
  if (!el) return;

  const pages = Math.max(Math.ceil((total || 0) / (limit || 1)), 1);

  const mk = (p, label = p, disabled = false, current = false) => `
    <button
      class="btn btn-toolbar btn-sm pg ${current ? 'is-active' : ''}"
      data-p="${p}"
      ${disabled ? 'disabled' : ''}
      type="button"
    >${label}</button>
  `;

  let html = '';
  html += mk(1, '« Primeiro', page === 1);
  html += mk(Math.max(1, page - 1), '‹ Anterior', page === 1);

  const win = 5;
  let start = Math.max(1, page - Math.floor(win / 2));
  let end = Math.min(pages, start + win - 1);
  start = Math.max(1, end - win + 1);

  for (let p = start; p <= end; p++) html += mk(p, String(p), false, p === page);

  html += mk(Math.min(pages, page + 1), 'Próxima ›', page === pages);
  html += mk(pages, 'Última »', page === pages);

  el.innerHTML = html;

  qsa('button.pg', el).forEach(btn => {
    btn.addEventListener('click', () => {
      const p = fmtInt(btn.dataset.p, 1);
      if (p !== state.page) {
        state.page = p;
        load();
      }
    });
  });

  setFooter({ total: Number(total) || 0, page: state.page, pages });
}

/* ========================================================================== */
/* Render Table                                                               */
/* ========================================================================== */
function renderTable(rows) {
  const tbody = qs('#tblStock tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!rows?.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="empty">Nenhum item encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-id">${sanitize(r.id ?? '')}</td>
      <td class="col-code">${sanitize(r.code || '')}</td>
      <td class="col-desc">${sanitize(r.desc || '')}</td>
      <td class="col-cost text-right">${fmtMoney(r.cost)}</td>
      <td class="col-stock text-right">${fmtNumber(r.stock)}</td>
      <td class="col-total text-right">${fmtMoney(r.total)}</td>
    `;
    tbody.appendChild(tr);
  }
}

/* ========================================================================== */
/* Load                                                                       */
/* ========================================================================== */
async function load() {
  try {
    if (state.loading) state.aborter?.abort?.();
    state.aborter = new AbortController();
    state.loading = true;

    setStatus('Carregando…', 'info');
    setFooter({ total: null, page: null, pages: null, sumStock: null, sumCost: null });

    const api = await loadRows();
    let mapped = api.rows.map(mapRow);

    // ✅ Filtro "Somente estoque positivo (>0)" — fallback client-side
    if (state.only_stock) {
      mapped = mapped.filter(r => Number(r.stock) > 0);
    }

    const sorted = sortRows(mapped, state.order);

    // Se o backend já manda totals, usa; senão soma do que foi renderizado
    const sumStockFromApi = Number(api?.summary?.sum_stock);
    const sumCostFromApi  = Number(api?.summary?.sum_cost);

    const pageSumStock = sorted.reduce((acc, r) => acc + (Number(r.stock) || 0), 0);
    const pageSumCost  = sorted.reduce((acc, r) => acc + (Number(r.total) || 0), 0);

    renderTable(sorted);

    // ⚠️ Se filtrou client-side, o total do backend pode não bater.
    // Aqui ajustamos o "total exibido" para consistência visual.
    const effectiveTotal = state.only_stock ? sorted.length : api.total;

    // paginação: se filtrou client-side, a paginação "real" do backend perde sentido.
    // Então, quando only_stock estiver ON, a paginação vira "1 página" (lista filtrada).
    if (state.only_stock) {
      state.page = 1;
      renderPagination({ total: sorted.length, page: 1, limit: Math.max(sorted.length, 1) });
      setFooter({
        total: sorted.length,
        page: 1,
        pages: 1,
        sumStock: pageSumStock,
        sumCost: pageSumCost,
      });
    } else {
      renderPagination({ total: api.total, page: api.page, limit: api.limit });
      const pages = Math.max(Math.ceil((api.total || 0) / (state.limit || 1)), 1);
      setFooter({
        total: api.total,
        page: state.page,
        pages,
        sumStock: Number.isFinite(sumStockFromApi) ? sumStockFromApi : pageSumStock,
        sumCost: Number.isFinite(sumCostFromApi) ? sumCostFromApi : pageSumCost,
      });
    }

    setStatus(`${effectiveTotal} item(ns)`, 'info');
  } catch (err) {
    console.error('[reportsProductsStock] load error:', err);
    setStatus(`Erro: ${err.message || err}`, 'error');
    setFooter({ total: null, page: null, pages: null, sumStock: null, sumCost: null });
  } finally {
    state.loading = false;
  }
}

/* ========================================================================== */
/* Helpers: limpar filtros                                                    */
/* ========================================================================== */
function clearFiltersUI() {
  const txtBusca = qs('#txtBusca');
  const txtFornecedor = qs('#txtFornecedor');
  const hidFornecedorId = qs('#hidFornecedorId');
  const selGrupo = qs('#selGrupo');
  const selSubgrupo = qs('#selSubgrupo');
  const selMarca = qs('#selMarca');
  const chkOnlyStock = qs('#chkOnlyStock');
  const selAtivo = qs('#selAtivo');
  const numCustoMin = qs('#numCustoMin');
  const numCustoMax = qs('#numCustoMax');
  const selOrder = qs('#selOrder');
  const selLimit = qs('#selLimit');

  if (txtBusca) txtBusca.value = '';
  if (txtFornecedor) txtFornecedor.value = '';
  if (hidFornecedorId) hidFornecedorId.value = '';

  if (selGrupo) selGrupo.value = '';
  if (selSubgrupo) { selSubgrupo.value = ''; selSubgrupo.disabled = true; }
  if (selMarca) selMarca.value = '';

  if (chkOnlyStock) chkOnlyStock.checked = false;
  if (selAtivo) selAtivo.value = '1';

  if (numCustoMin) numCustoMin.value = '';
  if (numCustoMax) numCustoMax.value = '';

  if (selOrder) selOrder.value = 'description_asc';
  if (selLimit) selLimit.value = '50';
}

/* ========================================================================== */
/* Bind + Lookups                                                             */
/* ========================================================================== */
function bindAll() {
  const txtBusca = qs('#txtBusca');
  const btnBuscar = qs('#btnBuscar');
  const btnLimpar = qs('#btnLimpar');

  const selLimit = qs('#selLimit');
  const selOrder = qs('#selOrder');

  const txtFornecedor = qs('#txtFornecedor');
  const dlFornecedores = qs('#dlFornecedores');
  const hidFornecedorId = qs('#hidFornecedorId');

  const selGrupo = qs('#selGrupo');
  const selSubgrupo = qs('#selSubgrupo');
  const selMarca = qs('#selMarca');

  const chkOnlyStock = qs('#chkOnlyStock');
  const selAtivo = qs('#selAtivo');
  const numCustoMin = qs('#numCustoMin');
  const numCustoMax = qs('#numCustoMax');

  const btnPdf = qs('#btnPdf');
  const btnExcel = qs('#btnExcel');

  if (selLimit) state.limit = fmtInt(selLimit.value, 50);
  if (selOrder) state.order = String(selOrder.value || 'description_asc');

  // Buscar (debounce)
  if (txtBusca) {
    const run = debounce(() => {
      state.q = (txtBusca.value || '').trim();
      state.page = 1;
      load();
    }, 350);
    txtBusca.addEventListener('input', run);
  }

  if (btnBuscar) {
    btnBuscar.addEventListener('click', () => {
      state.q = (txtBusca?.value || '').trim();
      state.page = 1;
      load();
    });
  }

  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      clearFiltersUI();

      state.page = 1;
      state.limit = 50;
      state.q = '';
      state.order = 'description_asc';

      state.supplier_id = '';
      state.group_id = '';
      state.subgroup_id = '';
      state.brand_id = '';
      state.only_stock = false;
      state.active = '1';
      state.cost_min = '';
      state.cost_max = '';

      load();
    });
  }

  if (selLimit) {
    selLimit.addEventListener('change', () => {
      state.limit = fmtInt(selLimit.value, 50);
      state.page = 1;
      load();
    });
  }

  if (selOrder) {
    selOrder.addEventListener('change', () => {
      state.order = String(selOrder.value || 'description_asc');
      state.page = 1;
      load();
    });
  }

  // Fornecedor (datalist)
  if (txtFornecedor && dlFornecedores && hidFornecedorId) {
    const suggest = debounce(async () => {
      try {
        const q = (txtFornecedor.value || '').trim();
        if (q.length < 2) return;

        const list = await loadSuppliersSuggest(q);
        dlFornecedores.innerHTML = list
          .map(s => `<option value="${sanitize(s.name)}" data-id="${sanitize(s.id)}"></option>`)
          .join('');
      } catch (e) {
        console.warn('[suppliers suggest] falhou:', e);
      }
    }, 250);

    txtFornecedor.addEventListener('input', () => {
      hidFornecedorId.value = '';
      state.supplier_id = '';
      suggest();
    });

    txtFornecedor.addEventListener('change', async () => {
      const q = (txtFornecedor.value || '').trim();
      if (!q) {
        hidFornecedorId.value = '';
        state.supplier_id = '';
        state.page = 1;
        return load();
      }

      try {
        const list = await loadSuppliersSuggest(q);
        const found = list.find(x => (x.name || '').toLowerCase() === q.toLowerCase()) || list[0];
        if (found?.id != null) {
          hidFornecedorId.value = String(found.id);
          state.supplier_id = String(found.id);
        }
      } catch {}

      state.page = 1;
      load();
    });
  }

  // Grupo/Subgrupo
  if (selGrupo && selSubgrupo) {
    selGrupo.addEventListener('change', async () => {
      const gid = String(selGrupo.value || '');
      state.group_id = gid;
      state.subgroup_id = '';

      selSubgrupo.innerHTML = `<option value="">Todos</option>`;
      selSubgrupo.disabled = true;

      if (gid) {
        try {
          const subs = await loadSubgroups(gid);
          selSubgrupo.innerHTML =
            `<option value="">Todos</option>` +
            subs.map(s => `<option value="${sanitize(s.id)}">${sanitize(s.name)}</option>`).join('');
          selSubgrupo.disabled = false;
        } catch (e) {
          console.warn('[subgroups] erro:', e);
        }
      }

      state.page = 1;
      load();
    });

    selSubgrupo.addEventListener('change', () => {
      state.subgroup_id = String(selSubgrupo.value || '');
      state.page = 1;
      load();
    });
  }

  // Marca
  if (selMarca) {
    selMarca.addEventListener('change', () => {
      state.brand_id = String(selMarca.value || '');
      state.page = 1;
      load();
    });
  }

  // ✅ Somente estoque positivo
  if (chkOnlyStock) {
    chkOnlyStock.addEventListener('change', () => {
      state.only_stock = !!chkOnlyStock.checked;
      state.page = 1;
      load();
    });
  }

  // Ativo
  if (selAtivo) {
    selAtivo.addEventListener('change', () => {
      state.active = String(selAtivo.value ?? '');
      state.page = 1;
      load();
    });
  }

  // Custo min/max
  if (numCustoMin) {
    numCustoMin.addEventListener('change', () => {
      state.cost_min = numCustoMin.value === '' ? '' : Number(numCustoMin.value);
      state.page = 1;
      load();
    });
  }
  if (numCustoMax) {
    numCustoMax.addEventListener('change', () => {
      state.cost_max = numCustoMax.value === '' ? '' : Number(numCustoMax.value);
      state.page = 1;
      load();
    });
  }

  // Export PDF
  if (btnPdf) {
    btnPdf.addEventListener('click', async () => {
      try {
        setStatus('Gerando PDF…', 'info');
        const blob = await downloadPdf();

        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `posicao_estoque_${yyyy}-${mm}-${dd}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setStatus('PDF gerado com sucesso.', 'success');
      } catch (err) {
        console.error('[reportsProductsStock] pdf error:', err);
        setStatus(`Falha ao gerar PDF: ${err.message || err}`, 'error');
      }
    });
  }

  // Export Excel
  if (btnExcel) {
    btnExcel.addEventListener('click', async () => {
      try {
        setStatus('Gerando Excel…', 'info');
        const blob = await downloadExcel();

        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');

        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `posicao_estoque_${yyyy}-${mm}-${dd}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();

        setStatus('Excel exportado com sucesso.', 'success');
      } catch (err) {
        console.error('[reportsProductsStock] excel error:', err);
        setStatus(`Falha ao exportar Excel: ${err.message || err}`, 'error');
      }
    });
  }
}

/* ========================================================================== */
/* Bootstrap                                                                   */
/* ========================================================================== */
async function bootstrapLookups() {
  const selGrupo = qs('#selGrupo');
  const selMarca = qs('#selMarca');

  try {
    if (selGrupo) {
      const groups = await loadGroups();
      selGrupo.innerHTML = `<option value="">Todos</option>` + groups
        .map(g => `<option value="${sanitize(g.id)}">${sanitize(g.name)}</option>`)
        .join('');
    }
  } catch (e) {
    console.warn('[groups] falhou:', e);
  }

  try {
    if (selMarca) {
      const brands = await loadBrands();
      selMarca.innerHTML = `<option value="">Todas</option>` + brands
        .map(b => `<option value="${sanitize(b.id)}">${sanitize(b.name)}</option>`)
        .join('');
    }
  } catch (e) {
    console.warn('[brands] falhou:', e);
  }
}

function bootstrap() {
  bindAll();
  bootstrapLookups().finally(() => load());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}