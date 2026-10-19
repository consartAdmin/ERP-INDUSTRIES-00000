// ╔══════════════════════════════════════════════════════════════╗
// ║ productsDescriptions.js — Frontend (ESM)                     ║
// ║ PRODNEX ERP — CRUD + filtros + modal buscar produto (F2)     ║
// ║ ✅ F2 / Duplo clique abre modal e preenche product_code       ║
// ║ ✅ Enter no campo: se vazio abre modal, se cheio vai p/ desc  ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

// Helper base (usa window.getApiBase se existir)
function getApiBase() {
  try {
    if (typeof window !== 'undefined' && window.getApiBase) return window.getApiBase();
  } catch {}
  return '';
}

const API_BASE = getApiBase();
const API = `${API_BASE}/api/products-descriptions`;

// Elements
const el = (id) => document.getElementById(id);

const tbody = el('tbody');
const emptyState = el('emptyState');

// filters
const q = el('q');
const filter_product_code = el('filter_product_code');
const filter_active = el('filter_active');

// form
const product_description_id = el('product_description_id');
const product_code = el('product_code');
const description = el('description');
const is_active = el('is_active');
const formModePill = el('formModePill');

// buttons
el('btnSearch').addEventListener('click', () => load());
el('btnClear').addEventListener('click', onClearFilters);

el('btnNew').addEventListener('click', () => resetForm(true));
el('btnReload').addEventListener('click', () => load());

el('btnSave').addEventListener('click', onSave);
el('btnDeactivate').addEventListener('click', onDeactivate);
el('btnDelete').addEventListener('click', onDelete);

// Enter to search
[q, filter_product_code].forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') load();
  });
});

/* ──────────────────────────────────────────────────────────────
   ✅ Modal de busca de produto (F2 / dblclick)
────────────────────────────────────────────────────────────── */
function openProductPicker() {
  openProductsModalSearch({
    apiBase: API_BASE || '',
    priceId: null,
    onPick: (p) => {
      const sku =
        p?.product_code ??
        p?.sku ??
        p?.product_id ??
        p?.codigo ??
        p?.code ??
        '';

      if (!sku) return;

      product_code.value = String(sku);

      // Se textarea estiver vazio, sugere descrição do produto
      const pickedDesc = (p?.description ?? p?.nome ?? p?.name ?? '').toString().trim();
      if (!description.value.trim() && pickedDesc) {
        description.value = pickedDesc;
      }

      setTimeout(() => description.focus(), 0);
    }
  });
}

// F2 no campo product_code
product_code.addEventListener('keydown', (e) => {
  if (e.key === 'F2') {
    e.preventDefault();
    openProductPicker();
  }
});

// Duplo clique no campo
product_code.addEventListener('dblclick', (e) => {
  e.preventDefault();
  openProductPicker();
});

// Enter no product_code: se vazio abre modal; se preenchido vai para descrição
product_code.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = product_code.value.trim();
    if (!v) {
      e.preventDefault();
      openProductPicker();
      return;
    }
    e.preventDefault();
    description.focus();
  }
});
/* ────────────────────────────────────────────────────────────── */

function buildQuery() {
  const params = new URLSearchParams();
  if (q.value.trim()) params.set('q', q.value.trim());
  if (filter_product_code.value.trim()) params.set('product_code', filter_product_code.value.trim());
  if (filter_active.value !== '') params.set('is_active', filter_active.value);
  params.set('limit', '500');
  params.set('offset', '0');
  return params.toString();
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const data = isJson ? await res.json().catch(() => ({})) : {};
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return isJson ? res.json() : res.text();
}

function setPill(mode) {
  if (mode === 'EDIT') {
    formModePill.textContent = 'EDITANDO';
    formModePill.style.background = 'rgba(245,158,11,.12)';
    formModePill.style.borderColor = 'rgba(245,158,11,.20)';
    formModePill.style.color = 'rgba(180,83,9,.95)';
  } else {
    formModePill.textContent = 'NOVO';
    formModePill.style.background = 'rgba(59,130,246,.12)';
    formModePill.style.borderColor = 'rgba(59,130,246,.20)';
    formModePill.style.color = 'rgba(37,99,235,.95)';
  }
}

function resetForm(focus = false) {
  product_description_id.value = '';
  product_code.value = '';
  description.value = '';
  is_active.value = 'true';
  setPill('NEW');
  if (focus) product_code.focus();
}

function onClearFilters() {
  q.value = '';
  filter_product_code.value = '';
  filter_active.value = 'true';
  load();
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function render(rows) {
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const r of rows) {
    const activeTxt = r.is_active ? 'SIM' : 'NÃO';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.product_description_id)}</td>
      <td><b>${escapeHtml(r.product_code)}</b></td>
      <td>${escapeHtml(r.description)}</td>
      <td>${activeTxt}</td>
      <td>
        <div class="pd-actions-cell">
          <button class="btn btn-toolbar pd-btn-sm" data-act="edit" data-id="${r.product_description_id}">Editar</button>
          <button class="btn btn-warning pd-btn-sm" data-act="deactivate" data-id="${r.product_description_id}">Desativar</button>
          <button class="btn btn-danger pd-btn-sm" data-act="delete" data-id="${r.product_description_id}">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const act = btn.getAttribute('data-act');
      const id = btn.getAttribute('data-id');

      if (act === 'edit') return edit(id);
      if (act === 'deactivate') return deactivateRow(id);
      if (act === 'delete') return deleteRow(id);
    });
  });
}

async function load() {
  try {
    const qs = buildQuery();
    const url = `${API}?${qs}`;
    const rows = await apiFetch(url);
    render(rows);
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function edit(id) {
  try {
    const r = await apiFetch(`${API}/${id}`);
    product_description_id.value = r.product_description_id;
    product_code.value = r.product_code;
    description.value = r.description;
    is_active.value = String(!!r.is_active);
    setPill('EDIT');
    description.focus();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

function getPayload() {
  const payload = {
    product_code: product_code.value.trim(),
    description: description.value.trim(),
    is_active: (is_active.value === 'true'),
  };

  if (!payload.product_code) throw new Error('Informe o product_code (use F2 para buscar)');
  if (!payload.description) throw new Error('Informe a descrição');

  return payload;
}

async function onSave() {
  try {
    const payload = getPayload();

    if (product_description_id.value) {
      await apiFetch(`${API}/${product_description_id.value}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: payload.description,
          is_active: payload.is_active,
        }),
      });
    } else {
      await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    resetForm();
    load();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function onDeactivate() {
  try {
    const id = product_description_id.value;
    if (!id) return alert('Selecione um registro para desativar (Editar).');

    await apiFetch(`${API}/${id}/deactivate`, { method: 'PATCH' });

    resetForm();
    load();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function onDelete() {
  try {
    const id = product_description_id.value;
    if (!id) return alert('Selecione um registro para excluir (Editar).');

    const ok = confirm('Excluir definitivamente este registro?');
    if (!ok) return;

    await apiFetch(`${API}/${id}`, { method: 'DELETE' });

    resetForm();
    load();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// ações na tabela
async function deactivateRow(id) {
  const ok = confirm('Desativar este registro?');
  if (!ok) return;
  await apiFetch(`${API}/${id}/deactivate`, { method: 'PATCH' });
  load();
}

async function deleteRow(id) {
  const ok = confirm('Excluir definitivamente este registro?');
  if (!ok) return;
  await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  load();
}

// init
resetForm();
load();
