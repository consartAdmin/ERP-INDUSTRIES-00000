// ╔════════════════════════════════════════════════════════════════════╗
// ║ analyticsTracking.js — Painel Analytics & Tracking                  ║
// ║ PRODNEX ERP                                                         ║
// ║ - KPIs GA4 (reader)                                                 ║
// ║ - Visão Geral ERP realtime (trackingSessions/trackingEvents)        ║
// ║ - ApexCharts premium                                                ║
// ╚════════════════════════════════════════════════════════════════════╝

const apiBase = location.origin;
const el = (id) => document.getElementById(id);

function setText(id, value) {
  const node = el(id);
  if (!node) return;
  node.textContent = value;
}

async function safeJson(url, opts) {
  try {
    const res = await fetch(url, { credentials: 'include', ...opts });
    const text = await res.text();
    let json = null;

    try { json = text ? JSON.parse(text) : null; }
    catch { json = { ok: false, error: 'Invalid JSON response', raw: text }; }

    if (!res.ok) return { ok: false, status: res.status, ...json };
    return json ?? { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers (page_view)                                                 */
/* ------------------------------------------------------------------ */
function isPageViewEvent(name) {
  const n = String(name || '').trim().toLowerCase();
  return n === 'page_view' || n === 'pageview' || n === 'page-view' || n === 'view_page';
}

function pickPageViewTotal(topEventsRows) {
  const rows = Array.isArray(topEventsRows) ? topEventsRows : [];
  const hit = rows.find(r => isPageViewEvent(r?.event_name));
  const total = Number(hit?.total || 0);
  return Number.isFinite(total) ? total : 0;
}

/* ------------------------------------------------------------------ */
/* Status de integrações                                               */
/* ------------------------------------------------------------------ */
async function loadStatus() {
  const cfg = await safeJson(`${apiBase}/api/tracking/config`);

  if (!cfg || cfg.ok === false) {
    setText('statusGtm', '—');
    setText('statusGa4', '—');
    setText('statusAds', '—');
    setText('statusMeta', '—');
    setText('statusUpdated', '—');
    return;
  }

  setText('statusGtm',  cfg.gtmEnabled  ? `Ativo (${cfg.gtmContainerId})` : 'Desativado');
  setText('statusGa4',  cfg.ga4Enabled  ? `Ativo (${cfg.ga4MeasurementId})` : 'Desativado');
  setText('statusAds',  cfg.adsEnabled  ? `Ativo (${cfg.adsConversionId})` : 'Desativado');
  setText('statusMeta', cfg.metaEnabled ? `Ativo (${cfg.metaPixelId})` : 'Desativado');

  setText('statusUpdated', cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleString() : '—');
}

/* ------------------------------------------------------------------ */
/* Métricas GA4                                                        */
/* ------------------------------------------------------------------ */
let analyticsLoading = false;

async function loadAnalytics() {
  if (analyticsLoading) return;
  analyticsLoading = true;

  const dbg = el('realtimeDebug');

  try {
    const [realtime, summary] = await Promise.all([
      safeJson(`${apiBase}/api/analytics/ga4/realtime`),
      safeJson(`${apiBase}/api/analytics/ga4/summary`),
    ]);

    const activeUsers = realtime?.ok ? Number(realtime.activeUsers || 0) : null;

    setText('kpiActiveUsers', activeUsers !== null ? String(activeUsers) : '—');
    setText('realtimeUsers',  activeUsers !== null ? String(activeUsers) : '—');

    setText('kpiPageViews',   summary?.ok ? String(Number(summary.screenPageViews || 0)) : '—');
    setText('kpiEvents',      summary?.ok ? String(Number(summary.eventCount || 0)) : '—');
    setText('kpiConversions', summary?.ok ? String(Number(summary.conversions || 0)) : '—');

    if (dbg) {
      const hasError = !(realtime?.ok) || !(summary?.ok);
      dbg.hidden = !hasError;
      dbg.textContent = hasError ? JSON.stringify({ realtime, summary }, null, 2) : '';
      dbg.classList.toggle('is-error', hasError);
    }
  } finally {
    analyticsLoading = false;
  }
}

/* ------------------------------------------------------------------ */
/* Teste de tracking                                                   */
/* ------------------------------------------------------------------ */
async function testTracking() {
  const resultBox = el('testResult');
  if (!resultBox) return;

  resultBox.hidden = false;
  resultBox.textContent = 'Executando teste...\n';

  const json = await safeJson(`${apiBase}/api/tracking/test`, { method: 'POST' });
  resultBox.textContent = JSON.stringify(json, null, 2);
  resultBox.classList.toggle('is-error', json?.ok === false);
}

/* ------------------------------------------------------------------ */
/* Visão Geral ERP (trackingSessions / trackingEvents) + ApexCharts     */
/* ------------------------------------------------------------------ */
function fmtTime(value) {
  if (!value) return '--';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function shortId(v, n = 10) {
  if (!v) return '';
  const s = String(v);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

let chartTraffic = null;
let chartTopEvents = null;
let chartFunnel = null;

// caches (para “aplicar page_view” quando o backend ainda não sumarizou pageviews)
let lastTopEventsRows = [];
let lastFunnelRows = [];
let lastOverview = null;

function buildTrafficOptions(categories, sessions, pageviews) {
  return {
    chart: { type: 'line', height: 260, toolbar: { show: false }, zoom: { enabled: false } },
    stroke: { curve: 'smooth', width: 3 },
    dataLabels: { enabled: false },
    xaxis: { categories, labels: { rotate: 0 } },
    yaxis: { decimalsInFloat: 0 },
    tooltip: { shared: true },
    legend: { position: 'top' },
    series: [
      { name: 'Sessions', data: sessions },
      { name: 'Pageviews', data: pageviews },
    ],
  };
}

function buildTopEventsOptions(labels, values) {
  return {
    chart: { type: 'bar', height: 260, toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 10, horizontal: true } },
    dataLabels: { enabled: true },
    xaxis: { categories: labels },
    series: [{ name: 'Total', data: values }],
  };
}

function buildFunnelOptions(labels, values) {
  return {
    chart: { type: 'bar', height: 260, toolbar: { show: false } },
    plotOptions: { bar: { borderRadius: 10 } },
    dataLabels: { enabled: true },
    xaxis: { categories: labels },
    series: [{ name: 'Sessions', data: values }],
  };
}

function ensureCharts() {
  if (!window.ApexCharts) {
    console.error('[analyticsTracking] ApexCharts não carregou. Verifique o CDN.');
    return false;
  }

  const t = el('chartTraffic');
  const e = el('chartTopEvents');
  const f = el('chartFunnel');

  if (!t || !e || !f) {
    console.warn('[analyticsTracking] Containers de chart não encontrados no HTML.');
    return false;
  }

  if (!chartTraffic) {
    chartTraffic = new ApexCharts(t, buildTrafficOptions([], [], []));
    chartTraffic.render();
  }
  if (!chartTopEvents) {
    chartTopEvents = new ApexCharts(e, buildTopEventsOptions([], []));
    chartTopEvents.render();
  }
  if (!chartFunnel) {
    chartFunnel = new ApexCharts(f, buildFunnelOptions([], []));
    chartFunnel.render();
  }

  return true;
}

function applyPageViewFallbackToKpis(kpis, topEventsRows) {
  const pageViewTotal = pickPageViewTotal(topEventsRows);
  const out = { ...(kpis || {}) };

  const pv = Number(out.pageviews || 0);
  if ((!Number.isFinite(pv) || pv === 0) && pageViewTotal > 0) out.pageviews = pageViewTotal;

  const ev = Number(out.events || 0);
  if ((!Number.isFinite(ev) || ev === 0) && Array.isArray(topEventsRows) && topEventsRows.length) {
    const sum = topEventsRows.reduce((acc, r) => acc + Number(r?.total || 0), 0);
    out.events = Number.isFinite(sum) ? sum : ev;
  }

  return out;
}

function applyPageViewFallbackToFunnel(rows, topEventsRows, overviewKpis) {
  const r = Array.isArray(rows) ? rows.map(x => ({ ...x })) : [];
  if (!r.length) return r;

  const pvTotal = pickPageViewTotal(topEventsRows);
  if (pvTotal <= 0) return r;

  const sessions = Number(overviewKpis?.sessions || 0);
  const fallbackVal = (Number.isFinite(sessions) && sessions > 0) ? sessions : pvTotal;

  const idx = r.findIndex(x => {
    const lbl = String(x?.label || '').toLowerCase();
    return lbl.includes('view item') || lbl.includes('view') || lbl.includes('page') || lbl.includes('visual');
  });

  if (idx >= 0) {
    const cur = Number(r[idx]?.sessions || 0);
    if (!Number.isFinite(cur) || cur === 0) r[idx].sessions = fallbackVal;
  }

  return r;
}

async function loadOverview(hours) {
  const data = await safeJson(`${apiBase}/api/tracking/overview?hours=${encodeURIComponent(hours)}`);
  if (!data?.ok) throw new Error(data?.error || 'Falha em /api/tracking/overview');

  lastOverview = data;

  const kpisRaw = data.data?.kpis || {};
  const kpis = applyPageViewFallbackToKpis(kpisRaw, lastTopEventsRows);

  setText('ovKpiSessions',    `Sessions: ${kpis.sessions ?? 0}`);
  setText('ovKpiPageviews',   `Pageviews: ${kpis.pageviews ?? 0}`);
  setText('ovKpiEvents',      `Eventos: ${kpis.events ?? 0}`);
  setText('ovKpiConversions', `Conversões: ${kpis.conversions ?? 0}`);

  const series = Array.isArray(data.data?.series) ? data.data.series : [];
  const categories = series.map(x => fmtTime(x.bucket));
  const sessions = series.map(x => Number(x.sessions || 0));
  const pageviews = series.map(x => Number(x.pageviews || 0));

  await chartTraffic.updateOptions(buildTrafficOptions(categories, sessions, pageviews), true, true);
}

async function loadTopEvents(hours) {
  const data = await safeJson(`${apiBase}/api/tracking/top-events?hours=${encodeURIComponent(hours)}&limit=8`);
  if (!data?.ok) throw new Error(data?.error || 'Falha em /api/tracking/top-events');

  const rows = Array.isArray(data.data) ? data.data : [];
  lastTopEventsRows = rows;

  const labels = rows.map(x => x.event_name);
  const values = rows.map(x => Number(x.total || 0));

  await chartTopEvents.updateOptions(buildTopEventsOptions(labels, values), true, true);

  // re-aplica KPI pageviews (page_view) imediatamente
  try {
    const kpisRaw = lastOverview?.data?.kpis || null;
    if (kpisRaw) {
      const kpis = applyPageViewFallbackToKpis(kpisRaw, lastTopEventsRows);
      setText('ovKpiPageviews', `Pageviews: ${kpis.pageviews ?? 0}`);
      setText('ovKpiEvents', `Eventos: ${kpis.events ?? 0}`);
    }
  } catch {}
}

async function loadFunnel(hours) {
  const data = await safeJson(`${apiBase}/api/tracking/funnel?hours=${encodeURIComponent(hours)}`);
  if (!data?.ok) throw new Error(data?.error || 'Falha em /api/tracking/funnel');

  let rows = Array.isArray(data.data) ? data.data : [];
  lastFunnelRows = rows;

  const kpisRaw = lastOverview?.data?.kpis || {};
  rows = applyPageViewFallbackToFunnel(rows, lastTopEventsRows, kpisRaw);

  const labels = rows.map(x => x.label);
  const values = rows.map(x => Number(x.sessions || 0));

  await chartFunnel.updateOptions(buildFunnelOptions(labels, values), true, true);
}

/* ------------------------------------------------------------------ */
/* Realtime table — 8 colunas + payload parser                          */
/* ------------------------------------------------------------------ */
function tryParsePayload(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}

function fmtBRL(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function safeTxt(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loadRealtimeEvents() {
  const rtStatus = el('rtStatus');
  const body = el('rtBody');

  const data = await safeJson(`${apiBase}/api/tracking/realtime?limit=30`);
  if (!data?.ok) {
    if (rtStatus) rtStatus.textContent = `Erro: ${data?.error || 'Falha realtime'}`;
    if (body) body.innerHTML = `<tr><td colspan="8" style="opacity:.7">Sem dados…</td></tr>`;
    return;
  }

  const rows = Array.isArray(data.data) ? data.data : [];
  if (!rows.length) {
    if (rtStatus) rtStatus.textContent = 'Sem eventos';
    if (body) body.innerHTML = `<tr><td colspan="8" style="opacity:.7">Sem eventos ainda…</td></tr>`;
    return;
  }

  if (rtStatus) rtStatus.textContent = `Atualizado: ${new Date().toLocaleTimeString('pt-BR')}`;

  body.innerHTML = rows.map(r => {
    const t  = fmtTime(r.created_at || r.event_time || r.ts);
    const ev = r.event_name || r.eventName || '';
    const pg = r.page_path || r.pagePath || '';
    const sidFull = r.session_id || r.sessionId || '';
    const sid = shortId(sidFull, 10);

    const payload = tryParsePayload(r.payload || r.meta || r.data || r.payload_json);

    const productName =
      r.item_name || r.itemName ||
      payload?.item_name || payload?.itemName ||
      payload?.product_name || payload?.name || '';

    const sku =
      r.item_id || r.itemId ||
      payload?.item_id || payload?.itemId ||
      payload?.sku || payload?.product_code || '';

    const qty =
      r.quantity || r.qty ||
      payload?.quantity || payload?.qty || '';

    const value =
      r.value || payload?.value ||
      (Number(payload?.price || 0) * Number(payload?.quantity || 0)) || '';

    const isCart = String(ev) === 'add_to_cart';

    const trClass = isPageViewEvent(ev)
      ? ' class="is-pageview"'
      : (isCart ? ' class="is-cart"' : '');

    return `
      <tr${trClass}>
        <td>${safeTxt(t)}</td>
        <td>${safeTxt(ev)}</td>
        <td title="${safeTxt(pg)}" class="col-page">${safeTxt(pg)}</td>

        <td title="${safeTxt(productName)}" class="col-product">${isCart ? (safeTxt(productName) || '—') : '—'}</td>
        <td class="col-sku">${isCart ? (safeTxt(sku) || '—') : '—'}</td>
        <td class="col-qty">${isCart ? (safeTxt(qty) || '—') : '—'}</td>
        <td class="col-value">${isCart ? (value ? fmtBRL(value) : '—') : '—'}</td>

        <td title="${safeTxt(sidFull)}">${safeTxt(sid)}</td>
      </tr>
    `;
  }).join('');
}

let overviewLoading = false;

async function refreshOverview() {
  if (overviewLoading) return;
  overviewLoading = true;

  const rangeEl = el('ovRange');
  const hours = Number(rangeEl?.value || 24);

  const rtStatus = el('rtStatus');
  if (rtStatus) rtStatus.textContent = 'Carregando…';

  try {
    // ordem importa: top-events primeiro (para fallback de page_view)
    await Promise.all([
      loadTopEvents(hours),
      loadOverview(hours),
      loadFunnel(hours),
      loadRealtimeEvents(),
    ]);
  } catch (e) {
    if (rtStatus) rtStatus.textContent = `Erro: ${String(e?.message || e)}`;
    console.error('[analyticsTracking] refreshOverview error:', e);
  } finally {
    overviewLoading = false;
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  loadStatus();
  loadAnalytics();

  setInterval(loadAnalytics, 30000);
  setInterval(loadStatus, 60000);

  const btn = el('btnTestTracking');
  if (btn) btn.addEventListener('click', testTracking);

  if (ensureCharts()) {
    const btnRefresh = el('ovRefresh');
    const range = el('ovRange');

    if (btnRefresh) btnRefresh.addEventListener('click', refreshOverview);
    if (range) range.addEventListener('change', refreshOverview);

    refreshOverview();
    setInterval(loadRealtimeEvents, 8000);
  }
});
 