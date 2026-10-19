/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.api.js — Acesso a unidades, lotes e grades              ║
   ║ PRODNEX ERP | Frontend (ESM)                                    ║
   ║ ✅ product_code preservado exatamente como no ERP                                                ║
   ║ ✅ Lotes filtrados corretamente por product_grade_id/grade_id    ║
   ║ ✅ Grades por produto com labels normalizados                    ║
   ║ ✅ Fallback de grades vindas dos próprios lotes                  ║
   ║ ✅ Cache separado por produto + grade + estoque                  ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { isSimpleStockMode } from './inboundInvoices.stock.js';

function normalizeProductCode(v) {
  // ERP product_code is a business key. Preserve it exactly as received.
  // Never pad supplier/NF-e codes with zeros.
  return String(v ?? '').trim();
}

// Inspect actual array properties before normalizeRows(): the legacy helper
// returns [] for unknown envelopes and used to mask {data: [...]}/{items: [...]}.
function safeRows(core, json, { strict = false } = {}) {
  const candidates = [
    json, json?.rows, json?.data, json?.data?.rows, json?.items,
    json?.data?.items, json?.result, json?.result?.rows,
    json?.options, json?.data?.options, json?.lots, json?.data?.lots,
  ];
  for (const rows of candidates) {
    if (Array.isArray(rows)) return rows;
  }
  const normalized = core?.normalizeRows?.(json);
  if (Array.isArray(normalized) && normalized.length > 0) return normalized;
  if (strict) {
    const error = new Error('Resposta de lotes em formato inesperado.');
    error.code = 'LOTS_INVALID_RESPONSE';
    throw error;
  }
  return [];
}

function toPositiveNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function firstText(...vals) {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return '';
}

function htmlEscape(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeGradeLabel(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^padr[aã]o$/i.test(s)) return 'Padrão';
  return s.toUpperCase();
}

function mapLotRow(r) {
  if (!r || typeof r !== 'object') return null;
  const lot_id = Number(r.lot_id ?? r.id ?? r.product_stock_lot_id ?? 0);
  if (!Number.isSafeInteger(lot_id) || lot_id <= 0) return null;

  const product_grade_id =
    toPositiveNumberOrNull(
      r.product_grade_id ??
      r.productGradeId ??
      r.product_stock_grade_id ??
      r.grade_product_id
    ) ||
    toPositiveNumberOrNull(r.grade_id ?? r.gradeId) ||
    null;

  const grade_id =
    toPositiveNumberOrNull(r.grade_id ?? r.gradeId) ||
    toPositiveNumberOrNull(r.product_grade_id ?? r.productGradeId) ||
    null;

  const grade_name = normalizeGradeLabel(
    firstText(
      r.grade_name,
      r.product_grade_name,
      r.grade,
      r.name,
      r.nome,
      r.description,
      r.descricao
    )
  );

  const lot_code = firstText(r.lot_code, r.code, r.lote, r.batch_code);
  const expires_at = r.expires_at ?? r.validade ?? r.expiry_date ?? r.expiration_date ?? null;

  const qty_available_raw = r.qty_available ?? r.available ?? r.saldo ?? null;
  const qty_on_hand = r.qty_on_hand ?? r.on_hand ?? r.em_maos ?? r.qty ?? r.quantity ?? null;
  const qty_reserved = r.qty_reserved ?? r.reserved ?? r.reservado ?? 0;

  const qty_available =
    qty_available_raw != null
      ? Number(qty_available_raw || 0)
      : Number(qty_on_hand || 0) - Number(qty_reserved || 0);

  return {
    lot_id,
    product_stock_id: r.product_stock_id ?? null,
    product_grade_id,
    grade_id,
    grade_name,
    lot_code,
    expires_at,
    qty_on_hand: Number(qty_on_hand || 0),
    qty_reserved: Number(qty_reserved || 0),
    qty_available: Number.isFinite(qty_available) ? qty_available : 0,
  };
}

function mapGradeRow(g) {
  const product_grade_id =
    toPositiveNumberOrNull(
      g.product_grade_id ??
      g.productGradeId ??
      g.productGradeID ??
      g.product_stock_grade_id ??
      g.grade_product_id
    ) ||
    toPositiveNumberOrNull(g.grade_id ?? g.gradeId) ||
    toPositiveNumberOrNull(g.id) ||
    null;

  if (!product_grade_id) return null;

  const grade_id =
    toPositiveNumberOrNull(g.grade_id ?? g.gradeId) ||
    toPositiveNumberOrNull(g.id) ||
    null;

  const name = normalizeGradeLabel(
    firstText(
      g.name,
      g.nome,
      g.grade,
      g.grade_name,
      g.product_grade_name,
      g.description,
      g.descricao,
      g.label
    )
  );

  return {
    product_grade_id,
    grade_id,
    name: name || `Grade ${product_grade_id}`,
  };
}

function uniqueGrades(grades) {
  const out = [];
  const seen = new Set();

  (Array.isArray(grades) ? grades : []).forEach((g) => {
    if (!g) return;

    const id = Number(g.product_grade_id || g.grade_id || 0);
    if (!id) return;

    if (seen.has(id)) return;
    seen.add(id);

    out.push({
      product_grade_id: id,
      grade_id: Number(g.grade_id || id) || null,
      name: normalizeGradeLabel(g.name || g.grade_name || g.grade || `Grade ${id}`),
    });
  });

  return out;
}

function gradesFromLots(lots) {
  return uniqueGrades(
    (Array.isArray(lots) ? lots : [])
      .filter((l) => Number(l.product_grade_id || l.grade_id || 0) > 0)
      .map((l) => ({
        product_grade_id: Number(l.product_grade_id || l.grade_id),
        grade_id: Number(l.grade_id || l.product_grade_id),
        name: l.grade_name || l.grade || l.grade_name || `Grade ${l.product_grade_id || l.grade_id}`,
      }))
  );
}

function ensureCaches(state) {
  if (!state.lotsByProductCache) state.lotsByProductCache = new Map();
  if (!state.lotsByStockCache) state.lotsByStockCache = new Map();
  if (!state.gradesByProductCache) state.gradesByProductCache = new Map();
  if (!state.gradesByStockCache) state.gradesByStockCache = new Map();
}

/* ──────────────────────────────────────────────────────────────
   GRADES BY PRODUCT CODE
────────────────────────────────────────────────────────────── */
export async function loadGradesByProductCode({ core, ROUTES, state }, product_code) {
  if (isSimpleStockMode(state)) return [];
  ensureCaches(state);

  const code = normalizeProductCode(product_code);
  if (!code) return [];

  const cacheKey = code;
  if (state.gradesByProductCache.has(cacheKey)) {
    return state.gradesByProductCache.get(cacheKey);
  }

  try {
    const candidates = [
      ROUTES?.productGradesBySku?.(code),
      `/api/products-grades/by-sku/${encodeURIComponent(code)}`,
      `/api/products-grades?product_code=${encodeURIComponent(code)}`,
      `/api/product-grades/by-sku/${encodeURIComponent(code)}`,
      `/api/product-grades?product_code=${encodeURIComponent(code)}`,
    ].filter(Boolean);

    for (const url of candidates) {
      const res = await fetch(url);
      if (!res.ok) continue;

      const json = await res.json().catch(() => ({}));
      const rows = safeRows(core, json);
      const grades = uniqueGrades(rows.map(mapGradeRow).filter(Boolean));

      console.log('[INBOUND][GRADES_BY_PRODUCT][CANDIDATE]', {
        code,
        url,
        rows_count: rows.length,
        grades,
      });

      if (grades.length) {
        state.gradesByProductCache.set(cacheKey, grades);
        return grades;
      }
    }

    const lots = await loadLotsByProductCode({ core, ROUTES, state }, code, null);
    const fallbackGrades = gradesFromLots(lots);

    state.gradesByProductCache.set(cacheKey, fallbackGrades);
    return fallbackGrades;
  } catch (err) {
    console.error('[INBOUND][GRADES_BY_PRODUCT] Erro:', err);
    state.gradesByProductCache.set(cacheKey, []);
    return [];
  }
}

/* ──────────────────────────────────────────────────────────────
   GRADES BY STOCK ID
   ✅ Melhor opção para sua tela, porque os lotes já têm as grades.
────────────────────────────────────────────────────────────── */
export async function loadGradesByStockId({ core, ROUTES, state }, product_stock_id) {
  if (isSimpleStockMode(state)) return [];
  ensureCaches(state);

  const id = Number(product_stock_id || 0);
  if (!id) return [];

  const cacheKey = String(id);
  if (state.gradesByStockCache.has(cacheKey)) {
    return state.gradesByStockCache.get(cacheKey);
  }

  try {
    const lots = await loadLotsByStockId({ core, ROUTES, state }, id, null);
    const grades = gradesFromLots(lots);

    console.log('[INBOUND][GRADES_BY_STOCK]', {
      product_stock_id: id,
      lots_count: lots.length,
      grades,
    });

    state.gradesByStockCache.set(cacheKey, grades);
    return grades;
  } catch (err) {
    console.error('[INBOUND][GRADES_BY_STOCK] Erro:', err);
    state.gradesByStockCache.set(cacheKey, []);
    return [];
  }
}

/* ──────────────────────────────────────────────────────────────
   LOTS BY PRODUCT CODE + PRODUCT_GRADE_ID
────────────────────────────────────────────────────────────── */
// Only a successful, valid list response can mean "no lots".
// HTTP/network/JSON errors are thrown and must never be cached as [].
async function fetchLotsRows(core, url) {
  let response;
  try {
    response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  } catch (cause) {
    const error = new Error('Falha de rede ao consultar lotes.');
    error.code = 'LOTS_NETWORK_ERROR';
    error.url = url;
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`Falha ao consultar lotes (HTTP ${response.status}).`);
    error.code = 'LOTS_HTTP_ERROR';
    error.status = response.status;
    error.url = url;
    throw error;
  }

  let json;
  try {
    json = await response.json();
  } catch (cause) {
    const error = new Error('A consulta de lotes retornou um JSON inv\u00e1lido.');
    error.code = 'LOTS_INVALID_JSON';
    error.url = url;
    error.cause = cause;
    throw error;
  }

  if (json?.ok === false || json?.success === false || json?.error) {
    const error = new Error('A API informou uma falha ao consultar lotes.');
    error.code = 'LOTS_API_ERROR';
    error.url = url;
    throw error;
  }

  return safeRows(core, json, { strict: true });
}

function normalizeLots(rows) {
  const lots = rows.map(mapLotRow);
  if (lots.some((lot) => !lot)) {
    const error = new Error('A consulta retornou um lote sem identificador v\u00e1lido.');
    error.code = 'LOTS_INVALID_ROW';
    throw error;
  }
  return Array.from(new Map(lots.map((lot) => [lot.lot_id, lot])).values());
}

function filterLotsByGrade(lots, gradeId, state) {
  if (!gradeId) return lots;
  return lots.filter((lot) => {
    const lotGradeId = Number(lot.product_grade_id || lot.grade_id || 0);
    if (lotGradeId === gradeId) return true;
    const selectedLabel = normalizeGradeLabel(state?.gradesMap?.get?.(gradeId)?.name || '');
    const lotLabel = normalizeGradeLabel(lot.grade_name || '');
    return Boolean(selectedLabel && lotLabel && selectedLabel === lotLabel);
  });
}

export async function loadLotsByProductCode(
  { core, ROUTES, state }, product_code, product_grade_id = null
) {
  if (isSimpleStockMode(state)) return [];
  ensureCaches(state);
  const code = normalizeProductCode(product_code);
  if (!code) return [];
  const gradeId = toPositiveNumberOrNull(product_grade_id);
  const cacheKey = `${code}|${gradeId || 0}`;
  if (state.lotsByProductCache.has(cacheKey)) return state.lotsByProductCache.get(cacheKey);

  const baseUrl = ROUTES?.lotsByProductCode?.(code) ||
    `/api/productsStockLots/by-product-code/${encodeURIComponent(code)}`;
  const sep = baseUrl.includes('?') ? '&' : '?';
  const url = baseUrl + (gradeId ? `${sep}product_grade_id=${encodeURIComponent(gradeId)}` : '');
  const rows = await fetchLotsRows(core, url);
  if (rows.some((row) => row?.product_code != null && normalizeProductCode(row.product_code) !== code)) {
    const error = new Error('A consulta retornou lotes de outro SKU.');
    error.code = 'LOTS_PRODUCT_MISMATCH';
    throw error;
  }
  const lots = filterLotsByGrade(normalizeLots(rows), gradeId, state);
  state.lotsByProductCache.set(cacheKey, lots);
  return lots;
}

export async function loadLotsByStockId(
  { core, ROUTES, state }, product_stock_id, product_grade_id = null
) {
  if (isSimpleStockMode(state)) return [];
  ensureCaches(state);
  const id = toPositiveNumberOrNull(product_stock_id);
  if (!id) return [];
  const gradeId = toPositiveNumberOrNull(product_grade_id);
  const cacheKey = `${id}|${gradeId || 0}`;
  if (state.lotsByStockCache.has(cacheKey)) return state.lotsByStockCache.get(cacheKey);

  const baseUrl = ROUTES?.lotsOptionsByStockId?.(id) ||
    `/api/productsStockLots/options?product_stock_id=${encodeURIComponent(id)}`;
  const sep = baseUrl.includes('?') ? '&' : '?';
  const url = baseUrl + (gradeId ? `${sep}product_grade_id=${encodeURIComponent(gradeId)}` : '');
  const rows = await fetchLotsRows(core, url);
  if (rows.some((row) => row?.product_stock_id != null && Number(row.product_stock_id) !== id)) {
    const error = new Error('A consulta retornou lotes de outro estoque.');
    error.code = 'LOTS_STOCK_MISMATCH';
    throw error;
  }
  const lots = filterLotsByGrade(normalizeLots(rows), gradeId, state);
  state.lotsByStockCache.set(cacheKey, lots);
  return lots;
}

// Canonical SKU first; a known stock id is a fallback, never a replacement SKU.
// If one query fails and the other is empty, absence has NOT been established.
export async function loadLotsForItem(context, item, productGradeId = null) {
  if (isSimpleStockMode(context.state)) return [];
  const code = normalizeProductCode(item?.product_code);
  const stockId = toPositiveNumberOrNull(
    item?.product_stock_id ?? item?.stock_id ?? item?.productStockId
  );
  const attempts = [];
  if (code) attempts.push(() => loadLotsByProductCode(context, code, productGradeId));
  if (stockId) attempts.push(() => loadLotsByStockId(context, stockId, productGradeId));
  const errors = [];
  for (const attempt of attempts) {
    try {
      const lots = await attempt();
      if (lots.length) return lots;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw errors[0];
  return [];
}

export function buildGradeOptionsHtml(grades, selectedProductGradeId) {
  const sel = Number(selectedProductGradeId || 0);
  let html = '<option value="">Selecione a grade...</option>';

  const normalized = uniqueGrades(grades);

  normalized.forEach((g) => {
    const id = Number(g.product_grade_id || 0);
    if (!id) return;

    const isSel = id === sel ? ' selected' : '';
    const label = htmlEscape(g.name || `Grade ${id}`);

    html += `<option value="${id}" data-grade-id="${htmlEscape(g.grade_id || '')}"${isSel}>${label}</option>`;
  });

  return html;
}

export function buildLotOptionsHtml({ core }, lots, selectedLotId) {
  const sel = Number(selectedLotId || 0);
  let html = '<option value="">Selecione o lote...</option>';

  console.log('[INBOUND][BUILD_LOT_OPTIONS]', {
    selectedLotId,
    lots_count: Array.isArray(lots) ? lots.length : 0,
    lots,
  });

  (Array.isArray(lots) ? lots : []).forEach((l) => {
    const labelParts = [
      l.lot_code ? `Lote ${l.lot_code}` : `Lote #${l.lot_id}`,
      l.expires_at && core?.formatDateBR ? `Val: ${core.formatDateBR(l.expires_at)}` : 'Val: —',
      `Disp: ${Number(l.qty_available || 0).toFixed(3)}`,
    ];

    if (l.grade_name) {
      labelParts.unshift(l.grade_name);
    }

    const label = htmlEscape(labelParts.join(' • '));
    const isSel = Number(l.lot_id) === sel ? ' selected' : '';

    html += `
      <option
        value="${htmlEscape(l.lot_id)}"
        data-product-grade-id="${htmlEscape(l.product_grade_id || '')}"
        data-grade-id="${htmlEscape(l.grade_id || '')}"
        data-qty-available="${htmlEscape(Number(l.qty_available || 0))}"
        ${isSel}
      >
        ${label}
      </option>
    `;
  });

  return html;
}

export function clearLotsCaches(state) {
  state.lotsByProductCache?.clear?.();
  state.lotsByStockCache?.clear?.();
  state.gradesByProductCache?.clear?.();
  state.gradesByStockCache?.clear?.();
}

export async function loadUnits({ core, ROUTES, state }) {
  try {
    const response = await fetch(ROUTES.units());
    const json = await response.json().catch(() => ({}));
    const rows = core.normalizeRows(json);

    state.unitsList = rows
      .map((unit) => ({
        unit: String(
          unit.unit ?? unit.unit_code ?? unit.sigla ?? unit.unidade ?? ''
        ).toUpperCase(),
        description: unit.description ?? unit.descricao ?? '',
      }))
      .filter((unit) => unit.unit);

    console.log('[INBOUND] Unidades carregadas:', state.unitsList.length);
  } catch (error) {
    console.error('[INBOUND][UNITS] Erro ao carregar unidades:', error);
    state.unitsList = [];
  }
}

export function buildUnitOptionsHtml({ state }, selected) {
  const selectedUnit = String(selected || '').trim().toUpperCase();
  let html = '<option value="">Selecione...</option>';

  const hasSelected = state.unitsList.some((unit) => unit.unit === selectedUnit);
  if (selectedUnit && !hasSelected) {
    html += `<option value="${selectedUnit}" selected>${selectedUnit}</option>`;
  }

  state.unitsList
    .slice()
    .sort((a, b) => a.unit.localeCompare(b.unit))
    .forEach((unit) => {
      const isSelected = unit.unit === selectedUnit ? ' selected' : '';
      const label = unit.description
        ? `${unit.unit} — ${unit.description}`
        : unit.unit;
      html += `<option value="${unit.unit}"${isSelected}>${label}</option>`;
    });

  return html;
}
