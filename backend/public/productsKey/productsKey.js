//╔════════════════════════════════════════════════════════════════════════════╗
//║ public/productsKey/productsKey.js — ProductsKey UI (PRODNEX ERP | ESM)    ║
//║ - UI padrão "Grupos & Subgrupos"                                          ║
//║ - Consome API: /api/products-key                                          ║
//║ - ✅ Modal de busca de produto (productsModalSearch)                      ║
//╚════════════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

const API_BASE =
  (typeof window !== 'undefined' && (window.getApiBase?.() || window.apiBase || window.API_BASE)) ||
  location.origin;

const ROUTES = Object.freeze({
  ensure:  `${API_BASE}/api/products-key/ensure`,
  list:    `${API_BASE}/api/products-key`,
  upsert:  `${API_BASE}/api/products-key`,
  del:     (id) => `${API_BASE}/api/products-key/${encodeURIComponent(id)}`,
  resolve: `${API_BASE}/api/products-key/resolve`,
});

const $ = (s, r = document) => r.querySelector(s);

const toast = {
  ok:   (t, m) => showCenterModal({ variant: 'success', title: t, message: m, timeoutMs: 2600 }),
  warn: (t, m) => showCenterModal({ variant: 'warning', title: t, message: m, timeoutMs: 3200 }),
  err:  (t, m) => showCenterModal({ variant: 'danger',  title: t, message: m, timeoutMs: 4200 }),
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

/* ───────────────────────────────────────────────────────────── */

const els = {
  btnEnsure: $('#btnEnsureTables'),
  btnRefresh: $('#btnRefreshAll'),

  qKeys: $('#qKeys'),
  qProductCode: $('#qProductCode'),
  btnSearch: $('#btnSearch'),
  btnNew: $('#btnNew'),

  form: $('#formKey'),
  id: $('#products_key_id'),
  product_code: $('#product_code'),
  word_keys: $('#word_keys'),
  word_keys_norm: $('#word_keys_norm'),
  btnCancel: $('#btnCancel'),

  btnPickProduct: $('#btnPickProduct'),

  tbody: $('#tbodyKeys'),
  keysFooterHint: $('#keysFooterHint'),

  resolveText: $('#resolveText'),
  resolveProductCode: $('#resolveProductCode'),
  resolveLimit: $('#resolveLimit'),
  btnResolve: $('#btnResolve'),
  btnClearResolve: $('#btnClearResolve'),
  resolveNorm: $('#resolveNorm'),
  resolveExact: $('#resolveExact'),
  resolveCandidates: $('#resolveCandidates'),

  btnPickProductResolve: $('#btnPickProductResolve'),
};

let lastList = [];

function resetForm() {
  els.id.value = '';
  els.product_code.value = '';
  els.word_keys.value = '';
  els.word_keys_norm.value = '';
}

function fillForm(row) {
  els.id.value = row.products_key_id ?? '';
  els.product_code.value = row.product_code ?? '';
  els.word_keys.value = row.word_keys ?? '';
  els.word_keys_norm.value = row.word_keys_norm ?? '';
  els.word_keys.focus();
}

function rowActions(row) {
  return `
    <div class="pk-rowactions">
      <button class="pk-mini" data-act="edit" data-id="${row.products_key_id}" title="Editar">✏️</button>
      <button class="pk-mini pk-mini--danger" data-act="del" data-id="${row.products_key_id}" title="Excluir">🗑</button>
    </div>
  `;
}

function renderList(rows) {
  lastList = rows || [];
  if (!rows?.length) {
    els.tbody.innerHTML = `<tr><td colspan="5" class="pk-muted">Nenhum registro encontrado.</td></tr>`;
    els.keysFooterHint.textContent = '0 registros';
    return;
  }

  els.tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.products_key_id)}</td>
      <td>${escapeHtml(r.product_code || '')}</td>
      <td>${escapeHtml(r.word_keys || '')}</td>
      <td class="pk-mono">${escapeHtml(r.word_keys_norm || '')}</td>
      <td>${rowActions(r)}</td>
    </tr>
  `).join('');

  els.keysFooterHint.textContent = `${rows.length} registro(s) carregado(s)`;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadList() {
  const q = els.qKeys.value.trim();
  const product_code = els.qProductCode.value.trim();

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (product_code) params.set('product_code', product_code);
  params.set('limit', '80');
  params.set('offset', '0');

  els.tbody.innerHTML = `<tr><td colspan="5" class="pk-muted">Carregando…</td></tr>`;

  const out = await api(`${ROUTES.list}?${params.toString()}`);
  renderList(out.data || []);
}

async function ensureTables() {
  await api(ROUTES.ensure, { method: 'POST', body: '{}' });
  toast.ok('OK', 'Tabela/índices garantidos.');
}

async function saveKey(e) {
  e.preventDefault();

  const payload = {
    product_code: els.product_code.value.trim(),
    word_keys: els.word_keys.value.trim(),
    word_keys_norm: els.word_keys_norm.value.trim() || undefined,
  };

  if (!payload.product_code) return toast.warn('Atenção', 'Informe o Product Code.');
  if (!payload.word_keys) return toast.warn('Atenção', 'Informe o Word Keys.');

  await api(ROUTES.upsert, { method: 'POST', body: JSON.stringify(payload) });
  toast.ok('Salvo', 'Key registrada com sucesso.');

  resetForm();
  await loadList();
}

async function deleteKey(id) {
  if (!id) return;
  const yes = confirm(`Excluir o registro #${id}?`);
  if (!yes) return;

  await api(ROUTES.del(id), { method: 'DELETE' });
  toast.ok('Excluído', `Registro #${id} removido.`);
  await loadList();
}

async function resolveText() {
  const text = els.resolveText.value.trim();
  const product_code = els.resolveProductCode.value.trim() || undefined;
  const limit = Number(els.resolveLimit.value || 10);

  if (!text) return toast.warn('Atenção', 'Digite o texto do cliente.');

  els.resolveNorm.textContent = '—';
  els.resolveExact.textContent = 'Carregando…';
  els.resolveCandidates.textContent = 'Carregando…';

  const out = await api(ROUTES.resolve, {
    method: 'POST',
    body: JSON.stringify({ text, product_code, limit }),
  });

  const data = out.data || {};
  els.resolveNorm.textContent = data.normalized || '—';

  const exact = data.exact || [];
  const cand = data.candidates || [];

  els.resolveExact.innerHTML = exact.length
    ? exact.map(x =>
        `<div>✅ <b>${escapeHtml(x.product_code)}</b> — <span class="pk-mono">${escapeHtml(x.word_keys_norm)}</span></div>`
      ).join('')
    : `<div class="pk-muted">Nenhum match exato.</div>`;

  els.resolveCandidates.innerHTML = cand.length
    ? cand.map(x =>
        `<div>• <b>${escapeHtml(x.product_code)}</b> — <span class="pk-mono">${escapeHtml(x.word_keys_norm)}</span></div>`
      ).join('')
    : `<div class="pk-muted">Nenhum candidato encontrado.</div>`;
}

function clearResolve() {
  els.resolveText.value = '';
  els.resolveProductCode.value = '';
  els.resolveLimit.value = 10;
  els.resolveNorm.textContent = '—';
  els.resolveExact.textContent = '—';
  els.resolveCandidates.textContent = '—';
}

/* ───────────────────────────────────────────────────────────── */
/* ✅ Modal Search: Produto                                        */
/* ───────────────────────────────────────────────────────────── */

function pickProductInto(inputEl) {
  if (!inputEl) return;

  openProductsModalSearch({
    apiBase: API_BASE,
    onPick: (p) => {
      const sku = p.product_code ?? p.sku ?? p.codigo ?? '';
      inputEl.value = sku;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.focus();
    }
  });
}

function bindProductPickers() {
  els.btnPickProduct?.addEventListener('click', () => pickProductInto(els.product_code));
  els.btnPickProductResolve?.addEventListener('click', () => pickProductInto(els.resolveProductCode));

  // dica: Enter no campo Product Code abre o modal (opcional e gostoso de usar)
  els.product_code?.addEventListener('keydown', (e) => {
    if (e.key === 'F2') pickProductInto(els.product_code);
  });
  els.resolveProductCode?.addEventListener('keydown', (e) => {
    if (e.key === 'F2') pickProductInto(els.resolveProductCode);
  });
}

/* ───────────────────────────────────────────────────────────── */

function bindTableActions() {
  els.tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    if (act === 'edit') {
      const row = lastList.find(r => String(r.products_key_id) === String(id));
      if (row) fillForm(row);
    }

    if (act === 'del') {
      try {
        await deleteKey(id);
      } catch (err) {
        toast.err('Erro', err.message);
      }
    }
  });
}

function bindEvents() {
  els.btnEnsure?.addEventListener('click', async () => {
    try { await ensureTables(); }
    catch (e) { toast.err('Erro', e.message); }
  });

  els.btnRefresh?.addEventListener('click', async () => {
    try { await loadList(); toast.info('Atualizado', 'Lista recarregada.'); }
    catch (e) { toast.err('Erro', e.message); }
  });

  els.btnSearch?.addEventListener('click', async () => {
    try { await loadList(); }
    catch (e) { toast.err('Erro', e.message); }
  });

  els.qKeys?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.btnSearch.click();
  });

  els.qProductCode?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') els.btnSearch.click();
  });

  els.btnNew?.addEventListener('click', () => {
    resetForm();
    els.product_code.focus();
  });

  els.btnCancel?.addEventListener('click', () => resetForm());

  els.form?.addEventListener('submit', async (e) => {
    try { await saveKey(e); }
    catch (err) { toast.err('Erro', err.message); }
  });

  els.btnResolve?.addEventListener('click', async () => {
    try { await resolveText(); }
    catch (err) { toast.err('Erro', err.message); }
  });

  els.btnClearResolve?.addEventListener('click', () => clearResolve());
}

async function init() {
  try {
    bindEvents();
    bindTableActions();
    bindProductPickers();
    await loadList();
  } catch (err) {
    toast.err('Erro', err.message);
  }
}

init();
