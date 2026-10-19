// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmDealsReativationPerformance.js — Performance CRM Reativação       ║
// ║ PRODNEX ERP | Frontend (JS)                                          ║
// ║                                                                      ║
// ║ ✅ FIX DEFINITIVO: evita /performance/performance                     ║
// ║ Rotas no backend (padrão recomendado):                               ║
// ║   GET  /api/crm/reativacao/performance?startDate&endDate&sellerId     ║
// ║   GET  /api/crm/reativacao/actions?startDate&endDate&sellerId&actionType&limit&offset&q ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ===========================
   API (ajuste se necessário)
   =========================== */

// ✅ Base recomendada (padrão do seu routes/controller)
const API_BASE_A = '/api/crm/reativacao';

// Alternativas (caso exista outro padrão no seu server)
const API_BASE_B = '/api/crm-deals-reativation-performance';
const API_BASE_C = '/api/crmDealsReativationPerformance';

// Sellers (lista vendedores)
const API_SELLERS_A = '/api/sellers';
const API_SELLERS_B = '/api/vendedores';
const API_SELLERS_C = '/api/cadastrovendedores';

const qs = (s, el = document) => el.querySelector(s);

const els = {
  fStart: qs('#fStart'),
  fEnd: qs('#fEnd'),
  fSeller: qs('#fSeller'),
  fAction: qs('#fAction'),
  fSearch: qs('#fSearch'),
  fLimit: qs('#fLimit'),

  btnApply: qs('#btnApply'),
  btnReset: qs('#btnReset'),
  btnPrev: qs('#btnPrev'),
  btnNext: qs('#btnNext'),
  btnExportCsv: qs('#btnExportCsv'),

  kpiActions: qs('#kpiActions'),
  kpiMoves: qs('#kpiMoves'),
  kpiConverted: qs('#kpiConverted'),
  kpiLost: qs('#kpiLost'),

  tableMeta: qs('#tableMeta'),
  pageInfo: qs('#pageInfo'),
  resultPill: qs('#resultPill'),
  tbodyActions: qs('#tbodyActions'),
};

let state = {
  apiBase: API_BASE_A,
  page: 0,
  limit: 50,
  total: 0,
  lastRows: [],
};

/* ===========================
   Utils
   =========================== */

function toISODate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDateTime(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('pt-BR');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => (
    m === '&' ? '&amp;' :
    m === '<' ? '&lt;' :
    m === '>' ? '&gt;' :
    m === '"' ? '&quot;' : '&#039;'
  ));
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!res.ok) {
    const msg = data?.error || data?.message || txt || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// tenta vários endpoints até achar um que responde
async function tryApiBases(bases, path, qsObj = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(qsObj)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, v);
  }
  const suffix = q.toString() ? `?${q.toString()}` : '';
  let lastErr = null;

  for (const base of bases) {
    try {
      const url = `${base}${path}${suffix}`;
      const data = await fetchJson(url);
      // Se respondeu, retorna mesmo que seja ok:false (para debug)
      return { base, data };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('Falha ao acessar API');
}

/* ===========================
   Data load
   =========================== */

function getFilters() {
  const startDate = els.fStart.value || '';
  const endDate = els.fEnd.value || '';
  const sellerId = els.fSeller.value || '';
  const actionType = els.fAction.value || '';
  const q = (els.fSearch.value || '').trim();
  return { startDate, endDate, sellerId, actionType, q };
}

async function loadSellers() {
  const bases = [API_SELLERS_A, API_SELLERS_B, API_SELLERS_C];
  let result = null;

  for (const base of bases) {
    try {
      const urls = [
        `${base}?limit=500`,
        `${base}`,
        `${base}/list?limit=500`,
      ];

      for (const url of urls) {
        try {
          const data = await fetchJson(url);
          const rows = data?.data || data?.rows || data?.items || data || [];
          const list = Array.isArray(rows) ? rows : [];
          if (list.length) {
            result = list;
            break;
          }
        } catch (_) {}
      }
      if (result) break;
    } catch (_) {}
  }

  const list = Array.isArray(result) ? result : [];

  const normalized = list.map((r) => ({
    id: r.id ?? r.seller_id ?? r.vendedor_id ?? r.user_id ?? r.codigo ?? r.sku ?? r.pk ?? null,
    name:
      r.name ??
      r.nome ??
      r.nome_vendedor ??
      r.nickname ??
      r.apelido ??
      r.descricao ??
      'Vendedor',
    nickname: r.nickname ?? r.apelido ?? null,
  })).filter((x) => x.id !== null);

  const keep = els.fSeller.value;
  els.fSeller.innerHTML = `<option value="">Todos os vendedores</option>`;
  for (const s of normalized) {
    const label = s.nickname ? `${s.name} (${s.nickname})` : s.name;
    const opt = document.createElement('option');
    opt.value = String(s.id);
    opt.textContent = label;
    els.fSeller.appendChild(opt);
  }
  if (keep) els.fSeller.value = keep;
}

/**
 * KPIs
 * Backend esperado:
 *   GET {API_BASE}/performance?startDate&endDate&sellerId
 */
async function loadKPIs() {
  const f = getFilters();
  const bases = [API_BASE_A, API_BASE_B, API_BASE_C];

  const { base, data } = await tryApiBases(bases, '/performance', {
    startDate: f.startDate,
    endDate: f.endDate,
    sellerId: f.sellerId,
  });

  state.apiBase = base;

  // padrão: { ok:true, data:{...} }
  const d = data?.data ?? data;

  const actions = Number(
    d?.actions ??
    d?.total_actions ??
    d?.count_actions ??
    d?.acoes ??
    0
  );

  const moves = Number(
    d?.moves ??
    d?.total_moves ??
    d?.count_moves ??
    d?.movimentacoes ??
    0
  );

  const converted = Number(
    d?.total_converted ??
    d?.converted_value ??
    d?.converted ??
    d?.totalConverted ??
    d?.valor_convertido ??
    0
  );

  const lost = Number(
    d?.total_lost ??
    d?.lost_value ??
    d?.lost ??
    d?.totalLost ??
    d?.valor_perdido ??
    0
  );

  els.kpiActions.textContent = actions.toLocaleString('pt-BR');
  els.kpiMoves.textContent = moves.toLocaleString('pt-BR');
  els.kpiConverted.textContent = fmtBRL(converted);
  els.kpiLost.textContent = fmtBRL(lost);
}

function labelAction(type) {
  const t = String(type || '').toUpperCase();
  const map = {
    CREATE_DEAL: 'Criação de Card',
    UPDATE_DEAL: 'Atualização de Card',
    MOVE_STAGE: 'Movimentação de Etapa',
    DELETE_DEAL: 'Exclusão de Card',
    OUTCOME_CONVERSION: 'Conversão',
    OUTCOME_LOSS: 'Queda de Venda',
    NOTE: 'Anotação',
    CALL: 'Ligação',
    WHATSAPP: 'WhatsApp',
    EMAIL: 'E-mail',
    VISIT: 'Visita',
  };
  return map[t] || (type || '—');
}

function renderRows(rows = []) {
  state.lastRows = rows;

  if (!rows.length) {
    els.tbodyActions.innerHTML = `<tr><td colspan="7" class="crmperf__empty">Nenhuma ação encontrada.</td></tr>`;
    return;
  }

  const html = rows.map((r) => {
    const createdAt = r.created_at || r.createdAt || r.ts || r.timestamp || r.created;
    const seller = r.seller_name || r.sellerName || r.vendedor || '—';
    const customer = r.customer_name || r.customerName || r.cliente || '—';
    const type = r.action_type || r.actionType || r.type || r.action || r.acao || '—';

    const stageCode = r.stage_code || r.stageCode || '';
    const fromStage = r.from_stage_code || r.fromStageCode || r.from_stage || '';
    const toStage = r.to_stage_code || r.toStageCode || r.to_stage || '';

    const stageLabel = (fromStage || toStage)
      ? `${fromStage || '—'} → ${toStage || stageCode || '—'}`
      : (stageCode || '—');

    const val =
      r.value_at_moment ??
      r.valueAtMoment ??
      r.estimated_value ??
      r.estimatedValue ??
      r.value ??
      r.valor ??
      null;

    const detailsObj = r.details || r.meta || null;
    let details = '';
    try {
      if (typeof detailsObj === 'string') details = detailsObj;
      else if (detailsObj && typeof detailsObj === 'object') details = JSON.stringify(detailsObj);
    } catch (_) {}

    if (!details) details = r.note || r.notes || r.observacao || '';

    return `
      <tr>
        <td>${esc(fmtDateTime(createdAt))}</td>
        <td>${esc(seller)}</td>
        <td>${esc(customer)}</td>
        <td>${esc(labelAction(type))}</td>
        <td>${esc(stageLabel)}</td>
        <td class="ta-right">${val === null || val === undefined ? '—' : esc(fmtBRL(val))}</td>
        <td title="${esc(details)}">${esc(details).slice(0, 140)}${details.length > 140 ? '…' : ''}</td>
      </tr>
    `;
  }).join('');

  els.tbodyActions.innerHTML = html;
}

/**
 * Actions
 * Backend esperado:
 *   GET {API_BASE}/actions?startDate&endDate&sellerId&actionType&limit&offset&q
 */
async function loadActions() {
  const f = getFilters();
  const offset = state.page * state.limit;

  const { data } = await tryApiBases(
    [state.apiBase, API_BASE_A, API_BASE_B, API_BASE_C],
    '/actions',
    {
      startDate: f.startDate,
      endDate: f.endDate,
      sellerId: f.sellerId,

      // backend usa actionType
      actionType: f.actionType,

      // busca livre (se backend suportar)
      q: f.q,

      limit: state.limit,
      offset,
    }
  );

  // esperado:
  // { ok:true, data:[...], meta:{ total } }
  // ou { ok:true, rows:[...], total }
  const rows = data?.data || data?.rows || data?.items || [];
  const meta = data?.meta || {};
  const total =
    Number(meta?.total ?? data?.total ?? data?.count ?? (Array.isArray(rows) ? rows.length : 0) ?? 0);

  state.total = total;

  renderRows(Array.isArray(rows) ? rows : []);

  const start = total ? (offset + 1) : 0;
  const end = Math.min(offset + state.limit, total || 0);
  els.tableMeta.textContent = `${total.toLocaleString('pt-BR')} registro(s)`;
  els.resultPill.textContent = `Mostrando ${start}–${end} de ${total.toLocaleString('pt-BR')}`;

  const totalPages = total ? Math.ceil(total / state.limit) : 1;
  els.pageInfo.textContent = `Página ${state.page + 1} / ${totalPages}`;

  els.btnPrev.disabled = state.page <= 0;
  els.btnNext.disabled = state.page >= (totalPages - 1);
}

/* ===========================
   CSV export (front-end)
   =========================== */

function downloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const header = ['Data/Hora','Vendedor','Cliente','Ação','Etapa','Valor','Detalhes'];
  const lines = [header.join(';')];

  for (const r of rows) {
    const createdAt = fmtDateTime(r.created_at || r.createdAt || r.ts || r.timestamp || r.created);
    const seller = r.seller_name || r.sellerName || '';
    const customer = r.customer_name || r.customerName || '';
    const action = labelAction(r.action_type || r.actionType || r.type || r.action || r.acao || '');

    const stageCode = r.stage_code || r.stageCode || '';
    const fromStage = r.from_stage_code || r.fromStageCode || r.from_stage || '';
    const toStage = r.to_stage_code || r.toStageCode || r.to_stage || '';
    const stage = (fromStage || toStage)
      ? `${fromStage || ''} -> ${toStage || stageCode || ''}`
      : (stageCode || '');

    const val =
      r.value_at_moment ??
      r.valueAtMoment ??
      r.estimated_value ??
      r.estimatedValue ??
      r.value ??
      r.valor ??
      '';
    const value = (val === '' || val === null || val === undefined) ? '' : String(val);

    let details = '';
    const detailsObj = r.details || r.meta || null;
    try {
      if (typeof detailsObj === 'string') details = detailsObj;
      else if (detailsObj && typeof detailsObj === 'object') details = JSON.stringify(detailsObj);
    } catch (_) {}
    if (!details) details = r.note || r.notes || '';

    const row = [createdAt, seller, customer, action, stage, value, details]
      .map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`)
      .join(';');
    lines.push(row);
  }

  return lines.join('\n');
}

/* ===========================
   Events
   =========================== */

async function refreshAll() {
  await loadKPIs();
  await loadActions();
}

function setDefaults() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 7);

  els.fStart.value = toISODate(start);
  els.fEnd.value = toISODate(today);
  els.fLimit.value = String(state.limit);
}

function bindEvents() {
  els.btnApply.addEventListener('click', async () => {
    state.page = 0;
    state.limit = Number(els.fLimit.value || 50);
    await refreshAll();
  });

  els.btnReset.addEventListener('click', async () => {
    els.fAction.value = '';
    els.fSeller.value = '';
    els.fSearch.value = '';
    setDefaults();
    state.page = 0;
    state.limit = Number(els.fLimit.value || 50);
    await refreshAll();
  });

  els.btnPrev.addEventListener('click', async () => {
    if (state.page <= 0) return;
    state.page -= 1;
    await loadActions();
  });

  els.btnNext.addEventListener('click', async () => {
    const totalPages = state.total ? Math.ceil(state.total / state.limit) : 1;
    if (state.page >= totalPages - 1) return;
    state.page += 1;
    await loadActions();
  });

  els.fLimit.addEventListener('change', async () => {
    state.limit = Number(els.fLimit.value || 50);
    state.page = 0;
    await loadActions();
  });

  els.fSearch.addEventListener('keydown', async (ev) => {
    if (ev.key === 'Enter') {
      state.page = 0;
      await refreshAll();
    }
  });

  els.btnExportCsv.addEventListener('click', () => {
    const f = getFilters();
    const rows = state.lastRows || [];
    const csv = toCsv(rows);
    const file = `crm_reativacao_performance_${f.startDate || 'inicio'}_${f.endDate || 'fim'}.csv`;
    downloadText(file, csv);
  });
}

/* ===========================
   Init
   =========================== */

(async function init() {
  try {
    setDefaults();
    bindEvents();

    // 1) sellers
    await loadSellers();

    // 2) KPIs + table
    await refreshAll();
  } catch (e) {
    console.error('[crmDealsReativationPerformance] init error:', e);
    els.tbodyActions.innerHTML = `
      <tr>
        <td colspan="7" class="crmperf__empty">
          Erro ao carregar: ${esc(e?.message || e)}
        </td>
      </tr>
    `;
    els.tableMeta.textContent = 'Falha';
    els.resultPill.textContent = 'Falha ao carregar dados';
  }
})();
