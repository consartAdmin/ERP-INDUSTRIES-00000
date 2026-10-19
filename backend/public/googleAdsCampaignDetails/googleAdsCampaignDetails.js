// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCampaignDetails.js — Campaign 360° (Frontend)              ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║ + Aba "Eventos" (Realtime) com tabela:                              ║
// ║   Hora | Evento | Página | Produto | SKU | Qtd | Valor | Session    ║
// ║ + ✅ Botão "Carregar anteriores" (cursor simples)                   ║
// ║   - usa o campo created_at retornado pela API                        ║
// ║   - append de eventos mais antigos                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE =
  (typeof window !== 'undefined' && (window.getApiBase?.() || window.apiBase || window.API_BASE)) ||
  (typeof window !== 'undefined' ? window.location.origin : '');

const ROUTES = Object.freeze({
  stats:     `${API_BASE}/api/googleads/campaigns/stats`,
  full:      (id) => `${API_BASE}/api/googleads/campaigns/${encodeURIComponent(id)}/full`,
  details:   (id) => `${API_BASE}/api/googleads/campaigns/${encodeURIComponent(id)}/details`,

  // ✅ Realtime events (tracking próprio do ERP / GA4 bridge)
  // Esperado: { ok:true, data:{ updatedAt, rows:[{time,event,page,product,sku,qty,value,session,created_at}] } }
  // ✅ Suporta paginação simples: ?before=<created_at>&limit=50
  eventsRealtime: `${API_BASE}/api/tracking/realtime-events`,
});

const el = (id) => document.getElementById(id);

const fmtBRL = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const fmtPct = (n) => {
  const v = Number(n || 0) * 100;
  return `${v.toFixed(2).replace('.', ',')}%`;
};

function ymd(d) { return String(d || '').slice(0, 10); }

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function gaDateToBr(v) {
  const s = String(v || '').trim();
  if (!s) return '—';

  if (/^\d{8}$/.test(s)) {
    const yyyy = s.slice(0, 4);
    const mm = s.slice(4, 6);
    const dd = s.slice(6, 8);
    return `${dd}/${mm}/${yyyy}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  return s;
}

function gaDateRaw(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  return s;
}

async function safeJson(url, opts = {}) {
  const describe = (err) => {
    try {
      if (!err) return 'Unknown error';
      if (err instanceof Error) return `${err.name}: ${err.message}\n${err.stack || ''}`;
      const props = {};
      for (const k of Object.getOwnPropertyNames(err)) props[k] = err[k];
      const json = JSON.stringify(props);
      if (json && json !== '{}' ) return json;
      return String(err);
    } catch {
      return String(err);
    }
  };

  try {
    const res = await fetch(url, { credentials: 'include', ...opts });

    const text = await res.text();
    let json = null;

    try { json = text ? JSON.parse(text) : null; }
    catch {
      throw new Error(`Invalid JSON (HTTP ${res.status})\nURL: ${url}\nBody: ${text?.slice(0, 800) || ''}`);
    }

    if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}\nURL: ${url}`);
    if (!json?.ok) throw new Error(json?.error || `Request failed\nURL: ${url}`);

    return json.data;
  } catch (err) {
    console.error('[safeJson] raw error =', err);
    throw new Error(`Fetch error: ${describe(err)}\nURL: ${url}`);
  }
}

function readQuery() {
  const u = new URL(location.href);
  return {
    campaignId: u.searchParams.get('campaignId') || '',
    from: u.searchParams.get('from') || '',
    to: u.searchParams.get('to') || '',
  };
}

function setQuery({ campaignId, from, to }) {
  const u = new URL(location.href);
  if (campaignId !== undefined) {
    if (campaignId) u.searchParams.set('campaignId', campaignId);
    else u.searchParams.delete('campaignId');
  }
  if (from) u.searchParams.set('from', from);
  if (to) u.searchParams.set('to', to);
  history.replaceState({}, '', u.toString());
}

function computeRange(mode, from, to) {
  const t = to || todayYmd();
  if (mode === 'CUSTOM') return { from: ymd(from), to: ymd(to) };

  const days = ({
    LAST_7_DAYS: 7,
    LAST_14_DAYS: 14,
    LAST_30_DAYS: 30,
    LAST_90_DAYS: 90,
  })[mode] || 30;

  const f = addDays(t, -(days - 1));
  return { from: f, to: t };
}

// ---------------------------- UI refs ----------------------------
const campaignSelect = el('campaignSelect');
const periodMode = el('periodMode');
const dateFrom = el('dateFrom');
const dateTo = el('dateTo');

const badgeId = el('badgeId');
const badgeStatus = el('badgeStatus');
const badgeChannel = el('badgeChannel');

const metaStrategy = el('metaStrategy');
const metaBudget = el('metaBudget');
const metaRange = el('metaRange');

const kpiCost = el('kpiCost');
const kpiCpc = el('kpiCpc');
const kpiClicks = el('kpiClicks');
const kpiCtr = el('kpiCtr');
const kpiImpr = el('kpiImpr');
const kpiInter = el('kpiInter');
const kpiConv = el('kpiConv');
const kpiCpa = el('kpiCpa');
const kpiConvValue = el('kpiConvValue');
const kpiRoas = el('kpiRoas');

const kvOverview = el('kvOverview');
const listTimeseries = el('listTimeseries');
const listDevices = el('listDevices');
const listDemographics = el('listDemographics');
const listWeekdayHour = el('listWeekdayHour');
const listKeywords = el('listKeywords');
const listTerms = el('listTerms');
const listAds = el('listAds');
const listGeo = el('listGeo');
const listChanges = el('listChanges');

const debugCard = el('debugCard');
const debugPre = el('debugPre');

// ✅ Events refs (aba Eventos)
const eventsTbody = el('eventsTbody');
const eventsUpdatedAt = el('eventsUpdatedAt');
const eventsDot = el('eventsDot');
const btnEventsOlder = el('btnEventsOlder'); // ✅ botão "carregar anteriores" (se existir)

// ---------------------------- Tabs ----------------------------
function setupTabs() {
  el('tabbar')?.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.cgd-tab');
    if (!btn) return;

    document.querySelectorAll('.cgd-tab').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const tab = btn.getAttribute('data-tab');
    document.querySelectorAll('.cgd-panel').forEach(p => p.classList.remove('is-active'));
    el(`tab-${tab}`)?.classList.add('is-active');
  });
}

// ---------------------------- Render helpers ----------------------------
function renderKv(obj) {
  kvOverview.innerHTML = '';
  const entries = Object.entries(obj || {});
  for (const [k, v] of entries) {
    const row = document.createElement('div');
    row.className = 'cgd-kv__row';
    row.innerHTML = `<div class="cgd-kv__k">${k}</div><div class="cgd-kv__v">${v}</div>`;
    kvOverview.appendChild(row);
  }
}

function renderList(ul, items, emptyText = 'Sem dados.') {
  ul.innerHTML = '';
  if (!items || !items.length) {
    const li = document.createElement('li');
    li.textContent = emptyText;
    ul.appendChild(li);
    return;
  }
  for (const it of items) {
    const li = document.createElement('li');
    li.innerHTML = it;
    ul.appendChild(li);
  }
}

function statusLabel(s) {
  const v = String(s || '').toUpperCase();
  if (v === 'ENABLED') return 'Ativa';
  if (v === 'PAUSED') return 'Pausada';
  if (v === 'REMOVED') return 'Removida';
  return v || '—';
}

function deviceLabel(d) {
  const v = String(d || '').toUpperCase();
  if (v === 'MOBILE') return 'Smartphones';
  if (v === 'DESKTOP') return 'Computadores';
  if (v === 'TABLET') return 'Tablets';
  return v || '—';
}

function dayLabel(d) {
  const v = String(d || '').toUpperCase();
  const map = {
    MONDAY:'Seg', TUESDAY:'Ter', WEDNESDAY:'Qua', THURSDAY:'Qui',
    FRIDAY:'Sex', SATURDAY:'Sáb', SUNDAY:'Dom'
  };
  return map[v] || v || '—';
}

// ---------------------------- Load campaigns dropdown ----------------------------
async function loadCampaignsDropdown(from, to) {
  const data = await safeJson(`${ROUTES.stats}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  const rows = data?.rows || [];

  const current = campaignSelect.value;
  campaignSelect.innerHTML = `<option value="">Selecione...</option>`;

  for (const r of rows) {
    const opt = document.createElement('option');
    opt.value = r.campaignId;
    opt.textContent = r.campaignName || r.campaignId;
    campaignSelect.appendChild(opt);
  }

  if (current && rows.some(r => r.campaignId === current)) campaignSelect.value = current;
  return rows;
}

// ---------------------------- Events (Realtime + Load older) ----------------------------
let eventsTimer = null;
let lastEventsSig = '';
let eventsBusy = false;

// cursor (mais antigo na tela)
let eventsCursorBefore = null;

// mapa para evitar duplicados ao append
const eventsSeen = new Set();

function setEventsDot(mode) {
  // mode: 'ok' | 'warn' | 'err' | 'idle'
  if (!eventsDot) return;
  const color = ({
    ok:   '#2ecc71',
    warn: '#f59e0b',
    err:  '#ef4444',
    idle: '#9ca3af',
  })[mode] || '#9ca3af';
  eventsDot.style.background = color;
}

function nowHms() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fmtQty(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n === 0) return '—';
  return n.toLocaleString('pt-BR');
}

function fmtMoneyMaybe(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n) || n === 0) return '—';
  return fmtBRL(n);
}

function normalizeEventRow(r) {
  // aceita tracking próprio + GA4 bridge etc.
  const createdAt = r.created_at || r.createdAt || r.ts || r.timestamp || '';

  return {
    time:      r.time || r.hora || r.event_time || r.created_at || r.createdAt || '—',
    event:     r.event || r.evento || r.name || '—',
    page:      r.page || r.pagina || r.path || r.page_path || '—',
    product:   r.product || r.produto || r.product_name || r.item_name || '—',
    sku:       r.sku || r.SKU || r.item_id || r.product_sku || '—',
    qty:       r.qty ?? r.qtd ?? r.quantity ?? r.item_quantity ?? 0,
    value:     r.value ?? r.valor ?? r.revenue ?? r.item_revenue ?? 0,
    session:   r.session || r.sessionId || r.session_id || r.ga_session_id || '—',
    created_at: createdAt || '',
  };
}

function eventKey(n) {
  // chave estável para dedup
  return [
    n.created_at || n.time,
    n.event,
    n.page,
    n.sku,
    String(n.qty ?? ''),
    String(n.value ?? ''),
    n.session
  ].join('|');
}

function timeToHms(v) {
  let hora = String(v || '—');

  // se vier ISO
  if (hora.includes('T')) {
    const d = new Date(hora);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    }
  }

  // se vier HH:MM:SS já
  if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) return hora;

  return hora;
}

function clearEventsTableLoading(text = 'Carregando eventos…') {
  if (!eventsTbody) return;
  eventsTbody.innerHTML = `
    <tr>
      <td colspan="8" style="padding:14px;color:#6b7280;">${esc(text)}</td>
    </tr>`;
}

function renderEventsTable(rows, emptyText = 'Sem eventos no período.') {
  if (!eventsTbody) return;

  eventsTbody.innerHTML = '';

  if (!rows || !rows.length) {
    eventsTbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding:14px;color:#6b7280;">${esc(emptyText)}</td>
      </tr>`;
    return;
  }

  const html = rows.map((raw) => {
    const r = normalizeEventRow(raw);
    const hora = timeToHms(r.time);

    return `
      <tr>
        <td style="padding:12px;white-space:nowrap;">${esc(hora)}</td>
        <td style="padding:12px;white-space:nowrap;"><b>${esc(r.event)}</b></td>
        <td style="padding:12px;min-width:280px;">${esc(r.page)}</td>
        <td style="padding:12px;min-width:260px;">${esc(r.product)}</td>
        <td style="padding:12px;white-space:nowrap;">${esc(r.sku)}</td>
        <td style="padding:12px;text-align:right;white-space:nowrap;">${esc(fmtQty(r.qty))}</td>
        <td style="padding:12px;text-align:right;white-space:nowrap;">${esc(fmtMoneyMaybe(r.value))}</td>
        <td style="padding:12px;white-space:nowrap;">${esc(r.session)}</td>
      </tr>`;
  }).join('');

  eventsTbody.innerHTML = html;

  // atualiza cursor com o mais antigo do lote
  try {
    const last = rows[rows.length - 1];
    const nLast = normalizeEventRow(last);
    if (nLast.created_at) eventsCursorBefore = nLast.created_at;
  } catch {}
}

function appendEventsRows(rows) {
  if (!eventsTbody) return;
  if (!rows || !rows.length) return;

  const frag = document.createDocumentFragment();

  let lastCreatedAt = null;

  for (const raw of rows) {
    const n = normalizeEventRow(raw);
    const k = eventKey(n);

    if (eventsSeen.has(k)) continue;
    eventsSeen.add(k);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding:12px;white-space:nowrap;">${esc(timeToHms(n.time))}</td>
      <td style="padding:12px;white-space:nowrap;"><b>${esc(n.event)}</b></td>
      <td style="padding:12px;min-width:280px;">${esc(n.page)}</td>
      <td style="padding:12px;min-width:260px;">${esc(n.product)}</td>
      <td style="padding:12px;white-space:nowrap;">${esc(n.sku)}</td>
      <td style="padding:12px;text-align:right;white-space:nowrap;">${esc(fmtQty(n.qty))}</td>
      <td style="padding:12px;text-align:right;white-space:nowrap;">${esc(fmtMoneyMaybe(n.value))}</td>
      <td style="padding:12px;white-space:nowrap;">${esc(n.session)}</td>
    `;
    frag.appendChild(tr);

    if (n.created_at) lastCreatedAt = n.created_at;
  }

  // remove "sem eventos/carregando" se a tabela estava vazia com placeholder
  if (eventsTbody.children.length === 1) {
    const only = eventsTbody.children[0];
    if (only && only.querySelector('td[colspan="8"]')) eventsTbody.innerHTML = '';
  }

  eventsTbody.appendChild(frag);

  if (lastCreatedAt) eventsCursorBefore = lastCreatedAt;
}

function signatureOfRows(rows) {
  try {
    const slice = (rows || []).slice(0, 30).map((r) => {
      const n = normalizeEventRow(r);
      return [n.time, n.event, n.page, n.sku, n.qty, n.value, n.session].join('|');
    });
    return slice.join('~~');
  } catch {
    return String(Math.random());
  }
}

function buildEventsUrl({ campaignId, from, to, before, limit = 50 }) {
  return (
    `${ROUTES.eventsRealtime}?` +
    `from=${encodeURIComponent(from || '')}` +
    `&to=${encodeURIComponent(to || '')}` +
    (campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : '') +
    (before ? `&before=${encodeURIComponent(before)}` : '') +
    `&limit=${encodeURIComponent(String(limit))}`
  );
}

async function loadRealtimeEvents({ campaignId, from, to }, { append = false, before = null } = {}) {
  if (!eventsTbody) return;

  if (eventsBusy) return;
  eventsBusy = true;

  try {
    setEventsDot('idle');

    const url = buildEventsUrl({
      campaignId,
      from,
      to,
      before: append ? (before || eventsCursorBefore) : null,
      limit: 50,
    });

    const data = await safeJson(url);

    const updatedAt = data?.updatedAt || nowHms();
    const rows = data?.rows || [];

    if (eventsUpdatedAt) eventsUpdatedAt.textContent = updatedAt;

    if (!append) {
      // reset dedup/cache/cursor
      eventsSeen.clear();
      eventsCursorBefore = null;

      const sig = signatureOfRows(rows);
      lastEventsSig = sig;

      // render full
      renderEventsTable(rows, 'Sem eventos retornados.');
      // marca no seen
      for (const r of rows) eventsSeen.add(eventKey(normalizeEventRow(r)));
    } else {
      // append older
      appendEventsRows(rows);
    }

    // se veio vazio e foi append, apenas avisa (não quebra)
    if (append && (!rows || rows.length === 0) && btnEventsOlder) {
      btnEventsOlder.textContent = 'Sem mais eventos';
      btnEventsOlder.disabled = true;
      setTimeout(() => {
        btnEventsOlder.textContent = '⬅ Carregar anteriores';
        btnEventsOlder.disabled = false;
      }, 2200);
    }

    setEventsDot('ok');
  } catch (err) {
    console.warn('[Events] erro ao carregar eventos:', err?.message || err);

    if (eventsUpdatedAt) eventsUpdatedAt.textContent = `${nowHms()} (erro)`;
    setEventsDot('err');

    if (!append) {
      renderEventsTable([], `Não foi possível carregar eventos. (${String(err?.message || err).slice(0, 120)})`);
    }
  } finally {
    eventsBusy = false;
  }
}

function startEventsLive({ campaignId, from, to }, intervalMs = 30000) {
  stopEventsLive();
  loadRealtimeEvents({ campaignId, from, to }, { append: false });
  eventsTimer = setInterval(() => loadRealtimeEvents({ campaignId, from, to }, { append: false }), intervalMs);
}

function stopEventsLive() {
  if (eventsTimer) clearInterval(eventsTimer);
  eventsTimer = null;
}

// ---------------------------- Main load (full) ----------------------------
async function loadCampaignFull(campaignId, from, to) {
  if (!campaignId) throw new Error('Selecione uma campanha.');

  const url = `${ROUTES.full(campaignId)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const data = await safeJson(url);

  debugPre.textContent = JSON.stringify(data, null, 2);

  const header = data.header || {};
  const k = data.kpis || {};
  const range = data.range || { from, to };

  badgeId.textContent = `ID: ${header.id || '—'}`;
  badgeStatus.textContent = `Status: ${statusLabel(header.status)}`;
  badgeChannel.textContent = `Canal: ${header.channel || '—'}`;

  metaStrategy.textContent = header.biddingStrategy || '—';
  metaBudget.textContent = header.budgetDaily ? fmtBRL(header.budgetDaily) : '—';
  metaRange.textContent = `${range.from || from} → ${range.to || to}`;

  kpiCost.textContent = fmtBRL(k.cost || 0);
  kpiCpc.textContent = `CPC médio ${fmtBRL(k.averageCpc || 0)}`;
  kpiClicks.textContent = String(k.clicks || 0);
  kpiCtr.textContent = `CTR ${fmtPct(k.ctr || 0)}`;
  kpiImpr.textContent = String(k.impressions || 0);
  kpiInter.textContent = String(k.interactions || 0);
  kpiConv.textContent = String(k.conversions || 0);

  const cpa = (Number(k.conversions || 0) > 0) ? (Number(k.cost || 0) / Number(k.conversions || 0)) : null;
  kpiCpa.textContent = `Custo/Conv ${cpa == null ? '—' : fmtBRL(cpa)}`;

  kpiConvValue.textContent = fmtBRL(k.convValue || 0);
  const roas = (Number(k.cost || 0) > 0) ? (Number(k.convValue || 0) / Number(k.cost || 0)) : null;
  kpiRoas.textContent = `ROAS ${roas == null ? '—' : roas.toFixed(2) + 'x'}`;

  const campaignStartRaw = gaDateRaw(header.startDate);
  const campaignEndRaw   = gaDateRaw(header.endDate);

  renderKv({
    'Nome': header.name || '—',
    'Canal': header.channel || '—',
    'Status': statusLabel(header.status),
    'Estratégia': header.biddingStrategy || '—',
    'Orçamento diário': header.budgetDaily ? fmtBRL(header.budgetDaily) : '—',
    'Início da campanha': campaignStartRaw ? gaDateToBr(campaignStartRaw) : '—',
    'Término da campanha': campaignEndRaw ? gaDateToBr(campaignEndRaw) : '—',
    'Período': `${range.from || from} → ${range.to || to}`,
  });

  const ts = (data.timeseries || []).slice(-12).reverse();
  renderList(
    listTimeseries,
    ts.map(r => `📅 <b>${r.date}</b> · Impr <b>${r.impressions}</b> · Cliques <b>${r.clicks}</b> · Custo <b>${fmtBRL(r.cost)}</b> · Conv <b>${r.conversions}</b> · Valor <b>${fmtBRL(r.convValue)}</b>`),
    'Sem dados ainda. Clique em Atualizar.'
  );

  const dev = data.devices || [];
  renderList(
    listDevices,
    dev.map(r => `📱 <b>${deviceLabel(r.device)}</b> · Impr <b>${r.impressions}</b> · Cliques <b>${r.clicks}</b> · Custo <b>${fmtBRL(r.cost)}</b>`),
    'Sem dados de dispositivos.'
  );

  const demo = data.demographics || [];
  renderList(
    listDemographics,
    demo.map(r => `👤 <b>${r.gender}</b> · <b>${r.ageRange}</b> · Impr <b>${r.impressions}</b>`),
    'Sem dados demográficos.'
  );

  const wh = (data.weekdayHour || [])
    .sort((a,b) => (b.impressions||0) - (a.impressions||0))
    .slice(0, 80);
  renderList(
    listWeekdayHour,
    wh.map(r => `🕒 <b>${dayLabel(r.dayOfWeek)}</b> · ${String(r.hour).padStart(2,'0')}:00 · Impr <b>${r.impressions}</b>`),
    'Sem dados de dia/hora.'
  );

  const kw = data.keywords || [];
  renderList(
    listKeywords,
    kw.map(r => `🔑 <b>${(r.keyword || '—')}</b> · ${r.status || ''} · Custo <b>${fmtBRL(r.cost)}</b> · Cliques <b>${r.clicks}</b> · CTR <b>${fmtPct(r.ctr)}</b>`),
    'Sem keywords.'
  );

  const st = data.searchTerms || [];
  renderList(
    listTerms,
    st.map(r => `🔎 <b>${(r.term || '—')}</b> · Impr <b>${r.impressions}</b> · Cliques <b>${r.clicks}</b> · Custo <b>${fmtBRL(r.cost)}</b>`),
    'Sem termos de pesquisa.'
  );

  const ads = data.ads || [];
  renderList(
    listAds,
    ads.map(r => `🧾 <b>${r.type}</b> · ID <b>${r.adId}</b> · ${r.status} · Impr <b>${r.impressions}</b> · Cliques <b>${r.clicks}</b> · CTR <b>${fmtPct(r.ctr)}</b>`),
    'Sem anúncios.'
  );

  const geo = data.geo || [];
  renderList(
    listGeo,
    geo.map(r => `🗺️ <b>${r.locationType}</b> · Criterion <b>${r.criterionId}</b> · Impr <b>${r.impressions}</b> · Cliques <b>${r.clicks}</b> · Custo <b>${fmtBRL(r.cost)}</b>`),
    'Sem dados de localização.'
  );

  const ch = data.changes || [];
  renderList(
    listChanges,
    ch.map(r => `🧩 <b>${r.dateTime || '—'}</b> · ${r.userEmail || '—'} · ${r.resourceType || ''}`),
    'Sem alterações retornadas.'
  );

  return data;
}

// ---------------------------- Bind UI events ----------------------------
function bindEvents() {
  el('btnBack')?.addEventListener('click', () => history.back());

  el('btnRefresh')?.addEventListener('click', async () => {
    const campaignId = campaignSelect.value;

    const mode = periodMode.value;
    const range = computeRange(mode, dateFrom.value, dateTo.value);
    dateFrom.value = range.from;
    dateTo.value = range.to;

    setQuery({ campaignId, from: range.from, to: range.to });

    await loadCampaignsDropdown(range.from, range.to);
    if (campaignId) await loadCampaignFull(campaignId, range.from, range.to);

    // ✅ reinicia live e reseta cursor/dedup
    startEventsLive({ campaignId, from: range.from, to: range.to }, 30000);
  });

  campaignSelect?.addEventListener('change', async () => {
    const campaignId = campaignSelect.value;
    const mode = periodMode.value;
    const range = computeRange(mode, dateFrom.value, dateTo.value);

    setQuery({ campaignId, from: range.from, to: range.to });
    if (campaignId) await loadCampaignFull(campaignId, range.from, range.to);

    startEventsLive({ campaignId, from: range.from, to: range.to }, 30000);
  });

  periodMode?.addEventListener('change', () => {
    const mode = periodMode.value;
    const range = computeRange(mode, dateFrom.value, dateTo.value);
    dateFrom.value = range.from;
    dateTo.value = range.to;
  });

  el('btnDebug')?.addEventListener('click', () => { if (debugCard) debugCard.hidden = false; });
  el('btnDebugClose')?.addEventListener('click', () => { if (debugCard) debugCard.hidden = true; });

  el('btnPdf')?.addEventListener('click', () => {
    alert('PDF: em breve. (Você já tem a base completa; dá para gerar PDF com esse payload.)');
  });

  // ✅ botão: carregar eventos anteriores (append)
  btnEventsOlder?.addEventListener('click', async () => {
    try {
      if (!btnEventsOlder) return;

      btnEventsOlder.disabled = true;
      const oldText = btnEventsOlder.textContent;
      btnEventsOlder.textContent = 'Carregando…';

      const mode = periodMode.value;
      const range = computeRange(mode, dateFrom.value, dateTo.value);
      const campaignId = campaignSelect.value || '';

      // importante: não para o live; apenas faz append do histórico
      await loadRealtimeEvents(
        { campaignId, from: range.from, to: range.to },
        { append: true, before: eventsCursorBefore }
      );

      btnEventsOlder.textContent = oldText || '⬅ Carregar anteriores';
    } catch (e) {
      console.warn('[EventsOlder] erro:', e);
      if (btnEventsOlder) btnEventsOlder.textContent = 'Erro ao carregar';
      setTimeout(() => {
        if (btnEventsOlder) btnEventsOlder.textContent = '⬅ Carregar anteriores';
      }, 1800);
    } finally {
      if (btnEventsOlder) btnEventsOlder.disabled = false;
    }
  });
}

// ---------------------------- Init ----------------------------
async function init() {
  setupTabs();
  bindEvents();

  const q = readQuery();
  const baseTo = q.to || todayYmd();
  const baseFrom = q.from || addDays(baseTo, -29);

  dateFrom.value = baseFrom;
  dateTo.value = baseTo;

  // Events UI init
  if (eventsUpdatedAt) eventsUpdatedAt.textContent = '—';
  setEventsDot('idle');
  clearEventsTableLoading('Carregando eventos…');

  // load dropdown
  await loadCampaignsDropdown(baseFrom, baseTo);

  // select campaign from URL (if any)
  const initialCampaignId = q.campaignId || '';
  if (initialCampaignId) {
    campaignSelect.value = initialCampaignId;
    await loadCampaignFull(initialCampaignId, baseFrom, baseTo);
  }

  // liga live events (com ou sem campanha)
  startEventsLive({ campaignId: initialCampaignId, from: baseFrom, to: baseTo }, 30000);
}

init().catch((e) => {
  console.error(e);
  alert(`Erro: ${String(e?.message || e)}`);
});
