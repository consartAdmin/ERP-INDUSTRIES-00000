// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ public/iaBudgetsConsart/iaBudgetsConsart.js — IA Budgets (Resolver+Create) ║
// ║ PRODNEX ERP | ESM                                                      ║
// ║ - Resolve multi-linhas via POST /api/products-key/resolve              ║
// ║ - Monta preview de itens                                               ║
// ║ - Seleciona cliente via customersModalSearch.js                         ║
// ║ - (Opcional) carrega tabela de preços via GET /api/tabela-precos        ║
// ║ - Cria orçamento via POST /api/budgets/from-ia                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';

const API_BASE =
  (typeof window !== 'undefined' && (window.getApiBase?.() || window.apiBase || window.API_BASE)) ||
  location.origin;

const ROUTES = Object.freeze({
  resolve:      `${API_BASE}/api/products-key/resolve`,
  priceTables:  `${API_BASE}/api/tabela-precos`,     // opcional
  createBudget: `${API_BASE}/api/budgets/from-ia`,
});

const $ = (s, r = document) => r.querySelector(s);

const toast = {
  ok:   (t, m) => showCenterModal({ variant: 'success', title: t, message: m, timeoutMs: 2600 }),
  warn: (t, m) => showCenterModal({ variant: 'warning', title: t, message: m, timeoutMs: 3300 }),
  err:  (t, m) => showCenterModal({ variant: 'danger',  title: t, message: m, timeoutMs: 4500 }),
  info: (t, m) => showCenterModal({ variant: 'info',    title: t, message: m, timeoutMs: 2800 }),
};

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toNumber(v, def = 0) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}

function fmtBRL(n) {
  const v = Number(n || 0);
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ───────────────────────────────────────────────────────────── */

const els = {
  // resolve
  resolveText: $('#resolveText'),
  resolveProductCode: $('#resolveProductCode'),
  resolveLimit: $('#resolveLimit'),
  btnResolve: $('#btnResolve'),
  btnClearResolve: $('#btnClearResolve'),
  resolveProgress: $('#resolveProgress'),

  resolveNorm: $('#resolveNorm'),
  resolveExact: $('#resolveExact'),
  resolveCandidates: $('#resolveCandidates'),
  resolvedLines: $('#resolvedLines'),

  // budget
  btnPickCustomer: $('#btnPickCustomer'),
  btnClearCustomer: $('#btnClearCustomer'),
  customerName: $('#customerName'),
  customerDoc: $('#customerDoc'),
  customerPhone: $('#customerPhone'),
  customerEmail: $('#customerEmail'),

  priceTableId: $('#priceTableId'),
  sellerId: $('#sellerId'),
  budgetNotes: $('#budgetNotes'),

  itemsTbody: $('#itemsTbody'),
  itemsCount: $('#itemsCount'),
  budgetTotal: $('#budgetTotal'),
  btnClearItems: $('#btnClearItems'),
  btnCreateBudget: $('#btnCreateBudget'),
};

const state = {
  customer: null, // { id, name, doc, phone, email }
  items: [],      // [{ sku, description, qty, unit, unit_price, discount, total, source_line, confidence }]
  lastResolve: null,
};

function setProgress(text) {
  els.resolveProgress.textContent = text || '—';
}

function clearResult() {
  els.resolveNorm.textContent = '—';
  els.resolveExact.textContent = '—';
  els.resolveCandidates.textContent = '—';
  els.resolvedLines.textContent = '—';
  setProgress('—');
}

function clearAll() {
  els.resolveText.value = '';
  els.resolveProductCode.value = '';
  els.resolveLimit.value = 10;
  clearResult();

  state.items = [];
  renderItems();

  els.resolveText.focus();
}

function renderExact(exact) {
  if (!exact?.length) return `<div class="c-muted">Nenhum match exato.</div>`;

  return exact.map(x => `
    <div style="margin-bottom:6px;">
      ✅ <b>${escapeHtml(x.product_code || '')}</b>
      ${x.description ? `— <span>${escapeHtml(x.description)}</span>` : ''}
      <div class="c-mono c-muted" style="margin-top:2px;">${escapeHtml(x.word_keys_norm || '')}</div>
    </div>
  `).join('');
}

function renderCandidates(cand) {
  if (!cand?.length) return `<div class="c-muted">Nenhum candidato encontrado.</div>`;

  return cand.map((x, idx) => `
    <div class="ib-cand" style="margin-bottom:8px;">
      • <b>${escapeHtml(x.product_code || '')}</b>
      ${x.description ? `— <span>${escapeHtml(x.description)}</span>` : ''}
      <div class="c-mono c-muted" style="margin-top:2px;">${escapeHtml(x.word_keys_norm || '')}</div>

      <div style="margin-top:6px;">
        <button class="ib-mini" type="button" data-pick-cand="${idx}">
          ➕ Adicionar ao Preview
        </button>
      </div>
    </div>
  `).join('');
}

function parseLines(raw) {
  return String(raw || '')
    .split(/\r?\n/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function guessQtyFromLine(line) {
  // tenta pegar algo tipo "12 un", "6 cx", "2x1000" etc.
  // regra simples: pega o primeiro número inteiro grande (>=2) e usa como qty,
  // se não achar, qty=1
  const m = String(line).match(/(\d{1,4})\s*(un|und|u|cx|pct|pcts|fd|fardo|pc|pcs|kg|g|l|ml)?\b/i);
  if (!m) return 1;
  const q = Number(m[1]);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return q;
}

function ensureItemShape(it) {
  const qty = Math.max(0, toNumber(it.qty, 1));
  const unit_price = Math.max(0, toNumber(it.unit_price, 0));
  const discount = Math.max(0, toNumber(it.discount, 0));
  const total = Math.max(0, qty * unit_price - discount);

  return {
    sku: String(it.sku || '').trim(),
    description: String(it.description || '').trim(),
    qty,
    unit: String(it.unit || 'UN').trim() || 'UN',
    unit_price,
    discount,
    total,
    source_line: String(it.source_line || '').trim(),
    confidence: toNumber(it.confidence, 0),
  };
}

function upsertItem(newItem) {
  const sku = String(newItem.sku || '').trim();
  if (!sku) return;

  const idx = state.items.findIndex(x => x.sku === sku);
  if (idx >= 0) {
    // se já existe, soma quantidade e recalcula
    const merged = { ...state.items[idx] };
    merged.qty = toNumber(merged.qty, 0) + toNumber(newItem.qty, 0);
    merged.unit_price = toNumber(newItem.unit_price, merged.unit_price || 0);
    merged.discount = toNumber(newItem.discount, merged.discount || 0);
    state.items[idx] = ensureItemShape(merged);
  } else {
    state.items.push(ensureItemShape(newItem));
  }
}

function removeItemAt(i) {
  state.items.splice(i, 1);
  renderItems();
}

function updateItemField(i, field, value) {
  const it = state.items[i];
  if (!it) return;

  it[field] = value;
  state.items[i] = ensureItemShape(it);
  renderItems({ preserveFocus: true });
}

function computeTotal() {
  return state.items.reduce((sum, it) => sum + Number(it.total || 0), 0);
}

function renderItems({ preserveFocus = false } = {}) {
  const active = preserveFocus ? document.activeElement : null;
  const activeKey = active?.dataset?.k || null;

  els.itemsCount.textContent = String(state.items.length);
  els.budgetTotal.textContent = fmtBRL(computeTotal());

  if (!state.items.length) {
    els.itemsTbody.innerHTML = `<tr><td colspan="8" class="ib-empty">Nenhum item ainda. Resolva o texto acima para montar a lista.</td></tr>`;
    return;
  }

  els.itemsTbody.innerHTML = state.items.map((it, i) => `
    <tr>
      <td>
        <div class="c-mono" style="font-weight:1000;">${escapeHtml(it.sku)}</div>
        <div class="c-mono c-muted" style="margin-top:4px;">${escapeHtml(it.source_line || '')}</div>
      </td>
      <td>${escapeHtml(it.description || '')}</td>

      <td>
        <input data-k="qty:${i}" type="number" min="0" step="1" value="${it.qty}" />
      </td>

      <td>
        <select data-k="unit:${i}">
          <option value="UN" ${it.unit === 'UN' ? 'selected' : ''}>UN</option>
          <option value="CX" ${it.unit === 'CX' ? 'selected' : ''}>CX</option>
          <option value="FD" ${it.unit === 'FD' ? 'selected' : ''}>FD</option>
          <option value="PCT" ${it.unit === 'PCT' ? 'selected' : ''}>PCT</option>
          <option value="KG" ${it.unit === 'KG' ? 'selected' : ''}>KG</option>
          <option value="L"  ${it.unit === 'L'  ? 'selected' : ''}>L</option>
        </select>
      </td>

      <td>
        <input data-k="unit_price:${i}" type="number" min="0" step="0.01" value="${it.unit_price}" />
      </td>

      <td>
        <input data-k="discount:${i}" type="number" min="0" step="0.01" value="${it.discount}" />
      </td>

      <td style="font-weight:1000;">${fmtBRL(it.total)}</td>

      <td>
        <button class="ib-mini" type="button" data-remove="${i}">🗑️</button>
      </td>
    </tr>
  `).join('');

  // bind inputs
  els.itemsTbody.querySelectorAll('input[data-k], select[data-k]').forEach(el => {
    el.addEventListener('input', () => {
      const [field, idxStr] = String(el.dataset.k).split(':');
      const i = Number(idxStr);
      updateItemField(i, field, el.value);
    });
  });

  // bind removes
  els.itemsTbody.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeItemAt(Number(btn.dataset.remove)));
  });

  // restore focus
  if (activeKey) {
    const toFocus = els.itemsTbody.querySelector(`[data-k="${CSS.escape(activeKey)}"]`);
    if (toFocus) toFocus.focus();
  }
}

/* ─────────────────────────────────────────────────────────────
   Resolve multi-linhas (linha por linha)
───────────────────────────────────────────────────────────── */

async function resolveLine(line, { product_code, limit } = {}) {
  const out = await api(ROUTES.resolve, {
    method: 'POST',
    body: JSON.stringify({ text: line, product_code, limit }),
  });
  return out?.data || {};
}

function pickBestCandidate(resData) {
  // prioridade:
  // 1) exact[0]
  // 2) candidates[0]
  const exact = resData?.exact || [];
  const cand = resData?.candidates || [];
  const best = exact[0] || cand[0];
  if (!best) return null;

  return {
    sku: best.product_code || '',
    description: best.description || '',
    confidence: toNumber(best.score, 0),
  };
}

function renderResolvedLines(linesInfo) {
  if (!linesInfo?.length) return `<div class="c-muted">—</div>`;

  return linesInfo.map((x, idx) => {
    const ok = !!x.best?.sku;
    return `
      <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:8px;">
        <span class="c-pill">${idx + 1}</span>
        <div style="flex:1;">
          <div style="font-weight:900;">${escapeHtml(x.line)}</div>
          <div class="c-mono c-muted" style="margin-top:2px;">
            ${ok ? `→ <b>${escapeHtml(x.best.sku)}</b> — ${escapeHtml(x.best.description || '')}` : '→ Não resolvido'}
          </div>
        </div>

        ${ok ? `<button class="ib-mini" type="button" data-add-line="${idx}">➕ Add</button>` : ''}
      </div>
    `;
  }).join('');
}

async function resolveAll() {
  const raw = els.resolveText.value;
  const lines = parseLines(raw);
  const product_code = els.resolveProductCode.value.trim() || undefined;
  const limit = Math.max(1, Math.min(50, Number(els.resolveLimit.value || 10)));

  if (!lines.length) return toast.warn('Atenção', 'Cole pelo menos 1 linha no texto.');

  // reset UI “última linha”
  els.resolveNorm.textContent = '—';
  els.resolveExact.textContent = 'Carregando…';
  els.resolveCandidates.textContent = 'Carregando…';

  setProgress(`0/${lines.length}`);

  const resolved = [];
  for (let i = 0; i < lines.length; i++) {
    setProgress(`${i + 1}/${lines.length}`);

    const line = lines[i];
    const data = await resolveLine(line, { product_code, limit });

    // UI do “último”
    els.resolveNorm.textContent = data.normalized || '—';
    els.resolveExact.innerHTML = renderExact(data.exact || []);
    els.resolveCandidates.innerHTML = renderCandidates(data.candidates || []);

    const best = pickBestCandidate(data);
    resolved.push({ line, data, best });

    // auto-add (opcional): se tiver best, já monta item com qty estimada
    if (best?.sku) {
      upsertItem({
        sku: best.sku,
        description: best.description,
        qty: guessQtyFromLine(line),
        unit: 'UN',
        unit_price: 0,
        discount: 0,
        source_line: line,
        confidence: best.confidence,
      });
    }
  }

  state.lastResolve = resolved;

  els.resolvedLines.innerHTML = renderResolvedLines(resolved);
  bindAddButtonsResolvedLines();

  renderItems();

  toast.ok('OK', `Resolvido: ${lines.length} linha(s). Preview montado.`);
}

function bindCandidatePickButtons() {
  els.resolveCandidates.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pick-cand]');
    if (!btn) return;

    const idx = Number(btn.dataset.pickCand);
    const data = state.lastResolve?.[state.lastResolve.length - 1]?.data;
    const cand = (data?.candidates || [])[idx];
    if (!cand) return;

    upsertItem({
      sku: cand.product_code || '',
      description: cand.description || '',
      qty: 1,
      unit: 'UN',
      unit_price: 0,
      discount: 0,
      source_line: state.lastResolve?.[state.lastResolve.length - 1]?.line || '',
      confidence: toNumber(cand.score, 0),
    });
    renderItems();
    toast.ok('OK', `Adicionado: ${cand.product_code}`);
  });
}

function bindAddButtonsResolvedLines() {
  els.resolvedLines.querySelectorAll('button[data-add-line]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.addLine);
      const row = state.lastResolve?.[idx];
      if (!row?.best?.sku) return;

      upsertItem({
        sku: row.best.sku,
        description: row.best.description,
        qty: guessQtyFromLine(row.line),
        unit: 'UN',
        unit_price: 0,
        discount: 0,
        source_line: row.line,
        confidence: row.best.confidence,
      });
      renderItems();
      toast.ok('OK', `Adicionado: ${row.best.sku}`);
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   Cliente (modal) + tabela de preço
───────────────────────────────────────────────────────────── */

function setCustomer(c) {
  state.customer = c;

  els.customerName.value = c?.name || '';
  els.customerDoc.value = c?.doc || '';
  els.customerPhone.value = c?.phone || '';
  els.customerEmail.value = c?.email || '';
}

function clearCustomer() {
  state.customer = null;
  els.customerName.value = '';
  els.customerDoc.value = '';
  els.customerPhone.value = '';
  els.customerEmail.value = '';
}

async function loadPriceTables() {
  // se não existir endpoint, só ignora
  try {
    const out = await api(ROUTES.priceTables, { method: 'GET' });
    const rows = out?.data || out || [];

    // aceita formatos comuns:
    // [{id, nome}] ou [{id, name}] etc.
    const options = rows.map(r => ({
      id: r.id ?? r.tabela_preco_id ?? r.tabela_preco ?? r.codigo ?? r.value,
      name: r.nome ?? r.name ?? r.descricao ?? r.label ?? `Tabela ${r.id}`,
    })).filter(x => x.id !== undefined && x.id !== null);

    options.sort((a,b) => String(a.name).localeCompare(String(b.name)));

    // mantém o primeiro option padrão
    const current = els.priceTableId.value;
    els.priceTableId.innerHTML = `<option value="">— Não usar —</option>` + options.map(o =>
      `<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)}</option>`
    ).join('');

    if (current) els.priceTableId.value = current;
  } catch {
    // silencioso (opcional)
  }
}

/* ─────────────────────────────────────────────────────────────
   Criar orçamento
───────────────────────────────────────────────────────────── */

function buildCreatePayload() {
  const customer_id = state.customer?.id;
  const price_table_id = els.priceTableId.value ? Number(els.priceTableId.value) : null;
  const seller_id = els.sellerId.value ? Number(els.sellerId.value) : null;
  const notes = (els.budgetNotes.value || '').trim();

  if (!customer_id) throw new Error('Selecione o cliente antes de gerar o orçamento.');
  if (!state.items.length) throw new Error('Adicione pelo menos 1 item no preview.');

  const items = state.items.map(it => ({
    sku: it.sku,
    description: it.description,
    qtd: it.qty,
    unidade: it.unit,
    unit_price: it.unit_price,
    discount: it.discount,
  }));

  return {
    customer_id,
    seller_id,
    notes,
    price_table_id,
    items,
  };
}

async function createBudget() {
  const payload = buildCreatePayload();

  const out = await api(ROUTES.createBudget, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const budgetId = out?.budget_id || out?.data?.budget_id;
  const number = out?.number || out?.data?.number;

  toast.ok('Orçamento gerado', `ID: ${budgetId}${number ? ` • Nº: ${number}` : ''}`);

  // aqui você pode redirecionar para sua tela de orçamento
  // ex: location.href = `/public/budgets/budgets.html?id=${budgetId}`;
}

/* ─────────────────────────────────────────────────────────────
   Botão "Buscar Produto" ao lado do filtro ProductCode
───────────────────────────────────────────────────────────── */

function mountProductSearchButton() {
  const input = els.resolveProductCode;
  if (!input) return;

  const field = input.closest('.c-field');
  if (!field) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'ib-inline';

  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ib-mini';
  btn.title = 'Buscar produto no catálogo';
  btn.textContent = '🔎 Buscar Produto';
  wrapper.appendChild(btn);

  btn.addEventListener('click', () => {
    openProductsModalSearch({
      apiBase: (window.getApiBase?.() || window.apiBase || window.API_BASE || location.origin),
      onPick: (p) => {
        const sku = p.product_code ?? p.sku ?? p.codigo ?? '';
        if (sku) {
          els.resolveProductCode.value = String(sku);
          toast.ok('OK', `Produto selecionado: ${sku}`);
        } else {
          toast.warn('Atenção', 'Produto selecionado não trouxe product_code.');
        }
      },
    });
  });
}

/* ───────────────────────────────────────────────────────────── */

function bindEvents() {
  els.btnResolve?.addEventListener('click', async () => {
    try { await resolveAll(); }
    catch (e) { toast.err('Erro', e.message); }
  });

  els.btnClearResolve?.addEventListener('click', () => clearAll());

  els.btnPickCustomer?.addEventListener('click', () => {
    openCustomersModalSearch({
      apiBase: (window.getApiBase?.() || window.apiBase || window.API_BASE || location.origin),
      onPick: (c) => {
        // tenta mapear formatos comuns do seu ERP
        const id = c.id ?? c.customer_id ?? c.codigo ?? c.cod ?? c.value;
        const name = c.nome ?? c.name ?? c.nome_fantasia ?? c.razao_social ?? '';
        const doc = c.cnpj_cpf ?? c.cnpjCpf ?? c.document ?? c.cpf_cnpj ?? '';
        const phone = c.telefone ?? c.phone ?? c.celular ?? '';
        const email = c.email ?? '';

        if (!id) return toast.warn('Atenção', 'Cliente selecionado não trouxe ID.');
        setCustomer({ id: Number(id), name: String(name), doc: String(doc), phone: String(phone), email: String(email) });
        toast.ok('OK', `Cliente: ${name || id}`);
      },
    });
  });

  els.btnClearCustomer?.addEventListener('click', () => clearCustomer());

  els.btnClearItems?.addEventListener('click', () => {
    state.items = [];
    renderItems();
  });

  els.btnCreateBudget?.addEventListener('click', async () => {
    try { await createBudget(); }
    catch (e) { toast.err('Erro', e.message); }
  });

  // Ctrl+Enter no textarea resolve
  els.resolveText?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) els.btnResolve.click();
  });
}

function init() {
  try {
    mountProductSearchButton();
    bindCandidatePickButtons();
    bindEvents();
    clearResult();
    renderItems();
    loadPriceTables();
    els.resolveText?.focus();
  } catch (e) {
    toast.err('Erro', e.message);
  }
}

init();
