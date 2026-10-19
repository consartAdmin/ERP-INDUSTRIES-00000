// ╔══════════════════════════════════════════════════════════════════════╗
// ║ rentabilityBudgetsModal.js — Modal de Rentabilidade (PRODNEX ERP)    ║
// ║ - Importa custo base via products.cost_price (por SKU)               ║
// ║ - Ajusta custo pela U.M via productUnits.factor (sku + unit)         ║
// ║ - Calcula: custo_unit = cost_price * factor                          ║
// ║ - Calcula: custo_total = qtd * custo_unit                             ║
// ║ - Calcula: lucro/margem por item e total                              ║
// ║ ✅ FIX: display mantém "CX.10", lookup usa "CX" (multiplicador OK)     ║
// ║ ✅ FIX: fallback com/sem ponto final ao buscar factor                 ║
// ║ ✅ FIX: cost-map suporta {ok:true,data:{...}} ou {ok:true,rows:[...]} ║
// ║ ✅ FIX: aliases de U.M robustos + UX estável                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

/**
 * @typedef {Object} RentItem
 * @property {string} sku
 * @property {string} description
 * @property {number} quantity
 * @property {number} unit_price
 * @property {number} discount_value
 * @property {string=} unit
 * @property {string=} unit_code
 * @property {string=} unidade
 * @property {string=} um
 * @property {string=} u_m
 * @property {string=} unidade_venda
 * @property {string=} unidadeVenda
 * @property {string=} unit_name
 * @property {string=} product_unit
 * @property {string=} unidade_medida
 * @property {number|string|null=} product_id
 * @property {number|string|null=} price_id
 * @property {number|null=} grade_id
 * @property {string=} grade
 * @property {number=} cost_price
 * @property {number=} preco_custo
 * @property {number=} cost
 */

/**
 * Open modal and compute profitability.
 * @param {Object} args
 * @param {RentItem[]} args.items
 * @param {number=} args.freight_value
 * @param {Object<string, number>=} args.costBySku
 * @param {Object<string, number>=} args.factorBySkuUnit   // key: `${sku}||${unit}`
 * @param {string=} args.title
 * @param {boolean=} args.debug
 * @returns {Promise<{ok:boolean, data?:any}>}
 */
export async function openRentabilityBudgetsModal(args = {}) {
  const items = Array.isArray(args.items) ? args.items : [];
  const freight = toNum(args.freight_value);
  const costBySku = isObj(args.costBySku) ? args.costBySku : {};
  const factorBySkuUnit = isObj(args.factorBySkuUnit) ? args.factorBySkuUnit : {};
  const title = String(args.title || 'Rentabilidade do Orçamento');
  const DEBUG = !!args.debug;

  if (!items.length) return { ok: false, data: { reason: 'NO_ITEMS' } };

  // -------------------------------------------------------------------
  // API base
  // -------------------------------------------------------------------
  const API_BASE = (typeof window !== 'undefined' && (window.apiBase || window.API_BASE || window.location.origin))
    .toString()
    .replace(/\/$/, '');

  // -------------------------------------------------------------------
  // Singleton root
  // -------------------------------------------------------------------
  const idRoot = 'rbRentabilityRoot';
  let root = document.getElementById(idRoot);

  if (!root) {
    root = document.createElement('div');
    root.id = idRoot;
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <div class="rb-backdrop rb-hidden" id="rbBackdrop" aria-hidden="true"></div>
    <div class="rb-modal rb-hidden" id="rbModal" role="dialog" aria-modal="true" aria-labelledby="rbTitle">
      <div class="rb-card">
        <div class="rb-header">
          <div class="rb-header-left">
            <h3 class="rb-title" id="rbTitle">${escapeHtml(title)}</h3>
            <div class="rb-subtitle" id="rbSubtitle">Ajuste o custo por item para calcular lucro e margem.</div>
          </div>
          <div class="rb-header-actions">
          <button type="button" class="rb-btn rb-btn--icon" id="rbClose" aria-label="Fechar">✖</button>
          </div>
        </div>

        <div class="rb-body">
          <div class="rb-panel">
            <div class="rb-panel__head">
              <h4>Itens</h4>
              <div class="rb-muted">
                <span class="rb-pill" id="rbCount"></span>
              </div>
            </div>

      <div class="table-scroll--rounded table-height-300 table-row-h-28">
        <table class="table table-zebra table-zebra-hover table-sticky-head">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Descrição</th>
                    <th class="num">U.M</th>
                    <th class="num">Fator</th>
                    <th class="num">Qtd</th>
                    <th class="num">Unit.</th>
                    <th class="num">Desc.</th>
                    <th class="num">Receita</th>
                    <th class="num">Custo (unit)</th>
                    <th class="num">Custo total</th>
                    <th class="num">Lucro</th>
                    <th class="num">Margem</th>
                  </tr>
                </thead>
                <tbody id="rbTbody"></tbody>
              </table>
            </div>

            <div class="rb-foot">
              <div class="rb-muted" id="rbFootLeft"></div>
              <div style="display:flex; gap:8px; align-items:center;">
                <button type="button" class="btn btn-toolbar btn-sm" id="rbApply">Aplicar</button>
                <button type="button" class="btn btn-toolbar btn-sm" id="rbCancel">Cancelar</button>
              </div>
            </div>
          </div>

          <div class="rb-side">
            <div class="rb-panel">
              <div class="rb-panel__head">
                <h4>Resumo</h4>
                <div class="rb-muted">Totais</div>
              </div>

              <div class="rb-kpis">
                <div class="rb-kpi"><span>Receita bruta</span><strong id="kGross">0,00</strong></div>
                <div class="rb-kpi"><span>Descontos</span><strong id="kDisc">0,00</strong></div>
                <div class="rb-kpi"><span>Receita líquida</span><strong class="accent" id="kNet">0,00</strong></div>
                <div class="rb-kpi"><span>Frete</span><strong id="kFreight">0,00</strong></div>
                <div class="rb-kpi"><span>Custo total</span><strong id="kCost">0,00</strong></div>
                <div class="rb-kpi"><span>Lucro</span><strong id="kProfit">0,00</strong></div>
                <div class="rb-kpi"><span>Margem (%)</span><strong id="kMargin">0,00%</strong></div>
              </div>

              <div class="rb-note" id="rbNote">
                • <b>Receita</b> = (Qtd × Unit.) − Desconto<br/>
                • <b>Custo (unit)</b> = <b>products.cost_price</b> × <b>productUnits.factor</b><br/>
                • <b>Custo total</b> = Qtd × Custo (unit)<br/>
                • <b>Margem</b> = Lucro / Receita líquida<br/>
                <br/>
                <span class="rb-chip" id="rbChipDb">⌛ Importando custos do banco…</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  const $ = (sel) => root.querySelector(sel);

  const backdrop = $('#rbBackdrop');
  const modal = $('#rbModal');
  const tbody = $('#rbTbody');

  const btnClose = $('#rbClose');
  const btnCancel = $('#rbCancel');
  const btnApply = $('#rbApply');

  const kGross = $('#kGross');
  const kDisc = $('#kDisc');
  const kNet = $('#kNet');
  const kFreight = $('#kFreight');
  const kCost = $('#kCost');
  const kProfit = $('#kProfit');
  const kMargin = $('#kMargin');

  const count = $('#rbCount');
  const footLeft = $('#rbFootLeft');
  const chipDb = $('#rbChipDb');

  // -------------------------------------------------------------------
  // Load cost_base by SKU + unit factors by (SKU, U.M)
  // -------------------------------------------------------------------
  const skus = uniq(items.map((x) => String(x.sku || '').trim()).filter(Boolean));

  /** @type {Record<string, number>} */
  let dbCostBySku = {};
  /** @type {Record<string, number>} */
  let dbFactorBySkuUnit = {};
  let dbLoadedOk = false;

  let factorMissCount = 0;
  let factorHitCount = 0;

  try {
    const [costRes, factorRes] = await Promise.all([
      fetchJson(`${API_BASE}/api/products/cost-map?codes=${encodeURIComponent(skus.join(','))}`),
      fetchJson(`${API_BASE}/api/barcodes/factors?skus=${encodeURIComponent(skus.join(','))}`),
    ]);

    // -----------------------
    // COST MAP (aceita 2 formatos):
    // A) { ok:true, data:{SKU: cost, ...} }
    // B) { ok:true, rows:[{sku, cost_price}, ...] }
    // -----------------------
    if (costRes?.ok) {
      // formato A
      if (isObj(costRes.data)) {
        for (const [k, v] of Object.entries(costRes.data)) {
          const sku = String(k || '').trim();
          const c = toNum(v);
          if (sku && c > 0) dbCostBySku[sku] = c;
        }
      }
      // formato B
      if (Array.isArray(costRes.rows)) {
        for (const r of costRes.rows) {
          const sku = String(r.sku ?? r.product_code ?? '').trim();
          if (!sku) continue;
          const c = toNum(r.cost_price ?? r.cost ?? r.preco_custo);
          if (c > 0) dbCostBySku[sku] = c;
        }
      }
    }

    // -----------------------
    // FACTORS
    // IMPORTANT: store keys for BOTH display and lookup variants
    // - display keeps "CX.10"
    // - lookup collapses "CX.10" -> "CX"
    // -----------------------
    if (factorRes?.ok && Array.isArray(factorRes.rows)) {
      for (const r of factorRes.rows) {
        const sku = String(r.sku ?? r.product_code ?? '').trim();
        const unitDisp = normUnitDisplay(r.unit ?? r.unit_code ?? r.um ?? r.unidade ?? '');
        const unitLook = normUnitLookup(unitDisp);
        const factor = toNum(r.factor ?? r.fator ?? r.multiplier ?? 1) || 1;

        if (!sku || !unitDisp) continue;
        const safeFactor = factor > 0 ? factor : 1;

        // display key (if DB ever returns CX.10)
        dbFactorBySkuUnit[`${sku}||${unitDisp}`] = safeFactor;
        dbFactorBySkuUnit[`${sku}||${withDot(unitDisp)}`] = safeFactor;

        // lookup key (most common: DB stores CX, item shows CX.10)
        if (unitLook) {
          dbFactorBySkuUnit[`${sku}||${unitLook}`] = safeFactor;
          dbFactorBySkuUnit[`${sku}||${withDot(unitLook)}`] = safeFactor;
        }
      }
    }

    dbLoadedOk = true;

    if (DEBUG) {
      console.log('[rentability][db] skus:', skus);
      console.log('[rentability][db] costBySku:', dbCostBySku);
      console.log('[rentability][db] factorBySkuUnit sample keys:', Object.keys(dbFactorBySkuUnit).slice(0, 120));
    }
  } catch (e) {
    console.warn('[rentability][db-load] failed:', e);
    dbLoadedOk = false;
  }

  // -------------------------------------------------------------------
  // local state (editable)
  // -------------------------------------------------------------------
  const rows = items
    .map((it, idx) => {
      const sku = String(it.sku || '').trim();
      if (!sku) return null;

      const unitRaw = String(
        it.unit ??
        it.unit_code ??
        it.unidade ??
        it.um ??
        it.u_m ??
        it.unidade_venda ??
        it.unidadeVenda ??
        it.unit_name ??
        it.product_unit ??
        it.unidade_medida ??
        it.unidadeMedida ??
        it.unid ??
        it.uom ??
        ''
      ).trim();

      // display keeps CX.10 / lookup collapses to CX
      const unit_display = normUnitDisplay(unitRaw);
      const unit_lookup = normUnitLookup(unit_display);

      const qty = toNum(it.quantity);
      const unitPrice = toNum(it.unit_price);
      const disc = toNum(it.discount_value);

      const gross = qty * unitPrice;
      const revenue = Math.max(0, gross - disc);

      const preItemCost =
        toNum(it.cost_price) ||
        toNum(it.preco_custo) ||
        toNum(it.cost) ||
        0;

      const baseCost =
        (toNum(costBySku[sku]) > 0 ? toNum(costBySku[sku]) : 0) ||
        (toNum(dbCostBySku[sku]) > 0 ? toNum(dbCostBySku[sku]) : 0) ||
        preItemCost ||
        0;

      const factor = pickFactor({
        sku,
        unit: unit_lookup || unit_display, // lookup first
        factorBySkuUnit,
        dbFactorBySkuUnit
      });

      if ((unit_lookup || unit_display) && factor !== null) factorHitCount++;
      else factorMissCount++;

      console.log('[RENTABILITY FACTOR]', {
        sku,
        unit_display,
        unit_lookup,
        factor,
        factorFromDb: dbFactorBySkuUnit,
        factorFromArgs: factorBySkuUnit
      });

      const safeFactor = (Number.isFinite(factor) && factor > 0) ? factor : 1;
      const costUnit = Math.max(0, baseCost * safeFactor);

      return {
        idx,
        sku,
        unit: unit_display,        // UI
        unit_lookup,               // internal
        unit_raw: unitRaw,
        factor: safeFactor,
        base_cost: baseCost,
        description: String(it.description || ''),
        quantity: qty,
        unit_price: unitPrice,
        discount_value: disc,
        revenue,
        cost_unit: costUnit,
      };
    })
    .filter(Boolean);

  // -------------------------------------------------------------------
  // UI chip
  // -------------------------------------------------------------------
  if (chipDb) {
    chipDb.classList.remove('ok', 'bad');
    if (dbLoadedOk) {
      chipDb.textContent =
        `✅ DB OK — custos: ${Object.keys(dbCostBySku).length}/${skus.length} | fatores: ${factorHitCount}/${rows.length} (faltando ${factorMissCount}).`;
      chipDb.classList.add('ok');
    } else {
      chipDb.textContent =
        `⚠️ DB indisponível — usando custo do item / fallback. Fatores encontrados: ${factorHitCount}/${rows.length}.`;
      chipDb.classList.add('bad');
    }
  }

  count.textContent = `${rows.length} item(ns)`;
  footLeft.textContent = `Frete considerado no resumo: R$ ${fmtMoney(freight)}`;

  // -------------------------------------------------------------------
  // Render rows
  // -------------------------------------------------------------------
  tbody.innerHTML = rows.map((r) => {
    const costTot = r.quantity * r.cost_unit;
    const profit = r.revenue - costTot;
    const margin = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;

    return `
      <tr data-i="${r.idx}">
        <td>${escapeHtml(r.sku)}</td>
        <td title="${escapeHtml(r.description)}">${escapeHtml(ellipsize(r.description, 54))}</td>
        <td class="num" title="${escapeHtml(r.unit_raw || '')}">${escapeHtml(r.unit || '-')}</td>
        <td class="num" data-factor="${r.idx}">${fmtFactor(r.factor)}</td>
        <td class="num">${fmtNum(r.quantity)}</td>
        <td class="num">${fmtMoney(r.unit_price)}</td>
        <td class="num">${fmtMoney(r.discount_value)}</td>
        <td class="num"><b>${fmtMoney(r.revenue)}</b></td>
        <td class="num">
          <input class="rb-cost-input" inputmode="decimal" type="number" step="0.01" min="0"
            data-cost="${r.idx}" value="${Number(r.cost_unit || 0).toFixed(2)}"/>
          <div class="rb-mini" data-mini="${r.idx}">base: ${fmtMoney(r.base_cost)} × ${fmtFactor(r.factor)}</div>
        </td>
        <td class="num" data-costtot="${r.idx}">${fmtMoney(costTot)}</td>
        <td class="num" data-profit="${r.idx}">${fmtMoney(profit)}</td>
        <td class="num" data-margin="${r.idx}">${fmtPct(margin)}</td>
      </tr>
    `;
  }).join('');

  // -------------------------------------------------------------------
  // recompute
  // -------------------------------------------------------------------
  function recomputeAll() {
    let gross = 0;
    let disc = 0;
    let net = 0;
    let cost = 0;

    for (const r of rows) {
      const g = r.quantity * r.unit_price;
      const d = r.discount_value;
      const rev = Math.max(0, g - d);
      r.revenue = rev;

      const ct = r.quantity * r.cost_unit;
      const pf = rev - ct;

      gross += g;
      disc += d;
      net += rev;
      cost += ct;

      const cellCostTot = tbody.querySelector(`[data-costtot="${r.idx}"]`);
      const cellProfit = tbody.querySelector(`[data-profit="${r.idx}"]`);
      const cellMargin = tbody.querySelector(`[data-margin="${r.idx}"]`);

      const m = rev > 0 ? (pf / rev) * 100 : 0;

      if (cellCostTot) cellCostTot.textContent = fmtMoney(ct);
      if (cellProfit) cellProfit.textContent = fmtMoney(pf);
      if (cellMargin) cellMargin.textContent = fmtPct(m);
    }

    const profit = net - cost;
    const marginTotal = net > 0 ? (profit / net) * 100 : 0;

    kGross.textContent = fmtMoney(gross);
    kDisc.textContent = fmtMoney(disc);
    kNet.textContent = fmtMoney(net);
    kFreight.textContent = fmtMoney(freight);
    kCost.textContent = fmtMoney(cost);
    kProfit.textContent = fmtMoney(profit);
    kMargin.textContent = fmtPct(marginTotal);

    kProfit.classList.remove('good', 'bad');
    kMargin.classList.remove('good', 'bad');

    if (profit >= 0) {
      kProfit.classList.add('good');
      kMargin.classList.add('good');
    } else {
      kProfit.classList.add('bad');
      kMargin.classList.add('bad');
    }
  }

  const onInput = (e) => {
    const inp = e.target.closest?.('input[data-cost]');
    if (!inp) return;
    const i = Number(inp.dataset.cost);
    const v = toNum(inp.value);
    const row = rows.find((x) => x.idx === i);
    if (!row) return;
    row.cost_unit = Math.max(0, v);
    recomputeAll();
  };

  tbody.addEventListener('input', onInput);

  // -------------------------------------------------------------------
  // Auto actions
  // -------------------------------------------------------------------
  const refreshRowCells = (r) => {
    const tr = tbody.querySelector(`tr[data-i="${r.idx}"]`);
    if (!tr) return;

    const unitCell = tr.children?.[2];
    if (unitCell) unitCell.textContent = r.unit || '-';

    const facCell = tr.querySelector(`[data-factor="${r.idx}"]`);
    if (facCell) facCell.textContent = fmtFactor(r.factor);

    const mini = tr.querySelector(`[data-mini="${r.idx}"]`);
    if (mini) mini.textContent = `base: ${fmtMoney(r.base_cost)} × ${fmtFactor(r.factor)}`;

    const inp = tr.querySelector(`input[data-cost="${r.idx}"]`);
    if (inp) inp.value = Number(r.cost_unit || 0).toFixed(2);
  };

  // -------------------------------------------------------------------
  // Open/close
  // -------------------------------------------------------------------
  function open() {
    backdrop.classList.remove('rb-hidden');
    modal.classList.remove('rb-hidden');
    backdrop.setAttribute('aria-hidden', 'false');
    modal.setAttribute('aria-hidden', 'false');

    recomputeAll();

    setTimeout(() => {
      const first = tbody.querySelector('input[data-cost]');
      first?.focus?.();
      first?.select?.();
    }, 0);
  }

  function close() {
    backdrop.classList.add('rb-hidden');
    modal.classList.add('rb-hidden');
    backdrop.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-hidden', 'true');
  }

  // Promise resolver
  let resolvePromise;
  const p = new Promise((resolve) => (resolvePromise = resolve));

  const cleanup = () => {
    tbody.removeEventListener('input', onInput);
    document.removeEventListener('keydown', onKey);
  };

  function cancel() {
    close();
    cleanup();
    resolvePromise({ ok: false });
  }

  function apply() {
    recomputeAll();

    const snapshot = {
      freight_value: freight,
      items: rows.map((r) => ({
        sku: r.sku,
        unit: r.unit,                     // display
        unit_lookup: r.unit_lookup || null, // internal (helpful for audit)
        unit_raw: r.unit_raw || null,
        factor: Number(r.factor || 1),
        base_cost: Number(r.base_cost || 0),
        cost_unit: Number(r.cost_unit || 0),
        revenue: Number(r.revenue || 0),
        quantity: Number(r.quantity || 0),
        unit_price: Number(r.unit_price || 0),
        discount_value: Number(r.discount_value || 0),
      })),
      meta: {
        db_loaded: !!dbLoadedOk,
        factor_hit_count: Number(factorHitCount || 0),
        factor_missing_count: Number(factorMissCount || 0),
      }
    };

    close();
    cleanup();
    resolvePromise({ ok: true, data: snapshot });
  }

  btnClose.addEventListener('click', cancel);
  btnCancel.addEventListener('click', cancel);
  backdrop.addEventListener('click', cancel);
  btnApply.addEventListener('click', apply);

  function onKey(e) {
    if (e.key === 'Escape' && !modal.classList.contains('rb-hidden')) cancel();
  }
  document.addEventListener('keydown', onKey);

  open();
  return p;
}

// ----------------------- helpers -----------------------
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function uniq(arr) {
  const s = new Set();
  for (const x of arr) s.add(x);
  return Array.from(s);
}

// display: keeps CX.10, removes only final dot
function normUnitDisplay(u) {
  const s = String(u || '').trim().toUpperCase();
  if (!s) return '';
  return s.endsWith('.') ? s.slice(0, -1) : s;
}

// lookup: collapses CX.10 -> CX and removes final dot
function normUnitLookup(u) {
  const s = normUnitDisplay(u);
  if (!s) return '';
  return s.replace(/\.\d+$/, '');
}

function withDot(u) {
  const s = normUnitLookup(u);
  if (!s) return '';
  return s.endsWith('.') ? s : `${s}.`;
}

/**
 * Retorna factor (number) ou null se não achou.
 * Fallback:
 * - tenta unit lookup (colapsada)
 * - tenta com ponto final
 */
function pickFactor({ sku, unit, factorBySkuUnit, dbFactorBySkuUnit }) {
  const s = String(sku || '').trim();
  const u = normUnitLookup(unit);

  if (!s || !u) return null;

  const k1 = `${s}||${u}`;
  const k2 = `${s}||${withDot(u)}`;

  const a1 = toNum(factorBySkuUnit[k1]); if (a1 > 0) return a1;
  const a2 = toNum(factorBySkuUnit[k2]); if (a2 > 0) return a2;

  const d1 = toNum(dbFactorBySkuUnit[k1]); if (d1 > 0) return d1;
  const d2 = toNum(dbFactorBySkuUnit[k2]); if (d2 > 0) return d2;

  return null;
}

async function fetchJson(url, { timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);

  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    '';

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : null;

    if (!res.ok) {
      const msg = data?.error ? `${res.status} — ${data.error}` : `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

function toNum(v) {
  if (v === null || v === undefined) return 0;

  if (typeof v === 'string') {
    let s = v.trim();
    if (!s) return 0;

    // BR format: 1.234,56
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    }

    // US/DB format: 1.00
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v) {
  const n = Number(v || 0);
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '0';
}

function fmtFactor(v) {
  const n = Number(v || 1);
  if (!Number.isFinite(n) || n <= 0) return '1';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}

function ellipsize(s, max = 40) {
  const t = String(s || '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
