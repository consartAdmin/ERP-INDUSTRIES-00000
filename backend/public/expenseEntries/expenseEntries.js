// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.js — Frontend (PRODNEX ERP)                             ║
// ║ Path: backend/public/expenseEntries/expenseEntries.js                  ║
// ║ API: /api/expense-entries + /import-xml + /:id/post                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { setupExpenseEntriesModal, setExpenseEntriesModalOpen } from './expenseEntriesModal.js';

const apiBase = window.apiBase || location.origin;
const API = `${apiBase}/api/expense-entries`;

const $ = (sel) => document.querySelector(sel);

function toast(msg, type = 'info') {
  if (type === 'error') console.error(msg);
  alert(msg);
}

function moneyBR(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function toISODate(d) {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function badge(status) {
  const s = String(status || 'OPEN').toUpperCase();
  const cls = s === 'POSTED' ? 'posted' : s === 'CANCELED' ? 'canceled' : 'open';
  return `<span class="ee-badge ${cls}">${s}</span>`;
}

function canPost(status) {
  const s = String(status || 'OPEN').toUpperCase();
  return s !== 'POSTED' && s !== 'CANCELED';
}

function canCancel(status) {
  const s = String(status || 'OPEN').toUpperCase();
  return s !== 'POSTED' && s !== 'CANCELED';
}

function canDelete(status) {
  const s = String(status || 'OPEN').toUpperCase();
  return s !== 'POSTED';
}

async function http(url, { method = 'GET', headers = {}, body } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.ok === false)) {
    const msg = json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// multipart upload (xml)
async function uploadXml(url, file) {
  const fd = new FormData();
  fd.append('xml', file);

  const res = await fetch(url, { method: 'POST', body: fd });
  const json = await res.json().catch(() => null);

  if (!res.ok || (json && json.ok === false)) {
    const msg = json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

// ---- state --------------------------------------------------------------

let state = {
  page: 1,
  pageSize: Number($('#fPageSize')?.value || 50),
  paging: { total: 0, page: 1, pageSize: 50 },
  rows: [],
  xmlItems: [],
};

// ---- list / render ------------------------------------------------------

function readFilters() {
  return {
    q: $('#fQ').value.trim(),
    status: $('#fStatus').value.trim(),
    supplierDocument: $('#fSupplierDoc').value.trim(),
    dateFrom: $('#fDateFrom').value || '',
    dateTo: $('#fDateTo').value || '',
    orderBy: $('#fOrderBy').value || 'issueDate desc',
    pageSize: Number($('#fPageSize').value || 50),
  };
}

function buildListUrl() {
  const f = readFilters();
  const u = new URL(API);

  u.searchParams.set('page', String(state.page));
  u.searchParams.set('pageSize', String(f.pageSize));
  u.searchParams.set('orderBy', f.orderBy);

  if (f.q) u.searchParams.set('q', f.q);
  if (f.status) u.searchParams.set('status', f.status);
  if (f.supplierDocument) u.searchParams.set('supplierDocument', f.supplierDocument);
  if (f.dateFrom) u.searchParams.set('dateFrom', f.dateFrom);
  if (f.dateTo) u.searchParams.set('dateTo', f.dateTo);

  return u.toString();
}

function render() {
  const tbody = $('#tbody');
  const kpiTotal = $('#kpiTotal');
  const kpiPageSum = $('#kpiPageSum');
  const pageInfo = $('#pageInfo');

  const rows = state.rows || [];
  const total = Number(state.paging?.total || 0);
  const page = Number(state.paging?.page || state.page || 1);
  const pageSize = Number(state.paging?.pageSize || readFilters().pageSize || 50);

  const sum = rows.reduce((acc, r) => acc + Number(Number(r.totalExpenseValue || 0)), 0);

  kpiTotal.textContent = String(total);
  kpiPageSum.textContent = moneyBR(sum);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  pageInfo.textContent = `Página ${page} de ${pages} • ${total} registros`;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="ee-muted" style="padding:16px;">
          Nenhum registro encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((r) => {
    const id = r.expenseEntryId;
    const doc = `${r.documentNumber || '-'}${r.documentSeries ? '/' + r.documentSeries : ''}`;
    const supplier = r.supplierName || '-';
    const supDoc = r.supplierDocument || '-';
    const type = (r.documentType || 'NFE').toUpperCase();
    const issue = toISODate(r.issueDate);

    const postBtn = canPost(r.status)
      ? `<button class="btn ee-mini ee-btn-primary" data-act="post" data-id="${id}" type="button">Postar</button>`
      : '';

    const editDisabled = String(r.status || '').toUpperCase() === 'POSTED' ? 'disabled' : '';
    const cancelDisabled = canCancel(r.status) ? '' : 'disabled';
    const delDisabled = canDelete(r.status) ? '' : 'disabled';

    return `
      <tr>
        <td>${id}</td>
        <td>${issue}</td>
        <td>${type}</td>
        <td>${escapeHtml(doc)}</td>
        <td title="${escapeHtml(supplier)}">${escapeHtml(supplier)}</td>
        <td>${escapeHtml(supDoc)}</td>
        <td class="ee-right">${moneyBR(r.totalExpenseValue)}</td>
        <td>${badge(r.status)}</td>
        <td>
          <div class="ee-actions-cell">
            ${postBtn}
            <button class="btn ee-mini ee-btn-ghost" data-act="edit" data-id="${id}" type="button" ${editDisabled}>Editar</button>
            <button class="btn ee-mini ee-btn-ghost" data-act="cancel" data-id="${id}" type="button" ${cancelDisabled}>Cancelar</button>
            <button class="btn ee-mini ee-btn-danger" data-act="delete" data-id="${id}" type="button" ${delDisabled}>Excluir</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadList() {
  const hint = $('#loadingHint');
  try {
    hint.textContent = 'Carregando...';
    const url = buildListUrl();
    const json = await http(url);

    state.rows = json.data || [];
    state.paging = json.paging || { total: state.rows.length, page: state.page, pageSize: readFilters().pageSize };

    render();
    hint.textContent = '';
  } catch (e) {
    hint.textContent = '';
    toast(`Erro ao listar: ${e.message}`, 'error');
  }
}

// ---- modal --------------------------------------------------------------

function modalOpen(open) {
  setExpenseEntriesModalOpen(open);
}

function modalTitle(text, sub = '') {
  $('#modalTitle').textContent = text;
  $('#modalSub').textContent = sub || '';
}

function renderItemsPreview(items = []) {
  const sec = $('#itemsSection');
  const hint = $('#itemsHint');
  const tbody = $('#itemsTbody');

  if (!items || !items.length) {
    sec.style.display = 'none';
    hint.textContent = '';
    tbody.innerHTML = '';
    return;
  }

  sec.style.display = 'block';
  hint.textContent = `${items.length} item(ns) detectado(s) no XML`;
  tbody.innerHTML = items.map((it) => {
    const sku = escapeHtml(it.sku || '-');
    const desc = escapeHtml(it.description || '');
    const unit = escapeHtml(it.unit || '');
    const qty = Number(it.quantity || 0);
    const u = Number(it.unitPrice || 0);
    const t = Number(it.totalValue || 0);

    return `
      <tr>
        <td>${sku}</td>
        <td title="${desc}">${desc}</td>
        <td>${unit}</td>
        <td class="ee-right">${qty.toLocaleString('pt-BR')}</td>
        <td class="ee-right">${moneyBR(u)}</td>
        <td class="ee-right">${moneyBR(t)}</td>
      </tr>
    `;
  }).join('');
}

function formClear() {
  $('#expenseEntryId').value = '';
  $('#documentType').value = 'NFE';
  $('#issueDate').value = '';
  $('#entryDate').value = '';
  $('#status').value = 'OPEN';

  $('#documentNumber').value = '';
  $('#documentSeries').value = '';
  $('#documentKey').value = '';

  $('#supplierName').value = '';
  $('#supplierDocument').value = '';

  $('#totalProductsValue').value = 0;
  $('#totalDiscountValue').value = 0;
  $('#totalTaxValue').value = 0;
  $('#totalExpenseValue').value = 0;

  $('#costCenterId').value = '';
  $('#vehicleId').value = '';
  $('#notes').value = '';

  $('#xmlPath').value = '';
  $('#pdfPath').value = '';

  $('#generatesTaxCredit').checked = false;
  $('#fiscalStatus').value = 'NO_CREDIT';

  state.xmlItems = [];
  renderItemsPreview([]);
}

function formFill(row) {
  $('#expenseEntryId').value = row.expenseEntryId ?? '';
  $('#documentType').value = (row.documentType || 'NFE').toUpperCase();
  $('#issueDate').value = toISODate(row.issueDate);
  $('#entryDate').value = toISODate(row.entryDate);
  $('#status').value = (row.status || 'OPEN').toUpperCase();

  $('#documentNumber').value = row.documentNumber ?? '';
  $('#documentSeries').value = row.documentSeries ?? '';
  $('#documentKey').value = row.documentKey ?? '';

  $('#supplierName').value = row.supplierName ?? '';
  $('#supplierDocument').value = row.supplierDocument ?? '';

  $('#totalProductsValue').value = Number(row.totalProductsValue || 0);
  $('#totalDiscountValue').value = Number(row.totalDiscountValue || 0);
  $('#totalTaxValue').value = Number(row.totalTaxValue || 0);
  $('#totalExpenseValue').value = Number(row.totalExpenseValue || 0);

  $('#costCenterId').value = row.costCenterId ?? '';
  $('#vehicleId').value = row.vehicleId ?? '';
  $('#notes').value = row.notes ?? '';

  $('#xmlPath').value = row.xmlPath ?? '';
  $('#pdfPath').value = row.pdfPath ?? '';

  $('#generatesTaxCredit').checked = !!row.generatesTaxCredit;
  $('#fiscalStatus').value = row.fiscalStatus ?? 'NO_CREDIT';
}

function readForm() {
  return {
    documentType: $('#documentType').value,
    issueDate: $('#issueDate').value,
    entryDate: $('#entryDate').value || null,
    status: $('#status').value,

    documentNumber: $('#documentNumber').value.trim() || null,
    documentSeries: $('#documentSeries').value.trim() || null,
    documentKey: $('#documentKey').value.trim() || null,

    supplierName: $('#supplierName').value.trim() || null,
    supplierDocument: $('#supplierDocument').value.trim() || null,

    totalProductsValue: Number($('#totalProductsValue').value || 0),
    totalDiscountValue: Number($('#totalDiscountValue').value || 0),
    totalTaxValue: Number($('#totalTaxValue').value || 0),
    totalExpenseValue: Number($('#totalExpenseValue').value || 0),

    costCenterId: $('#costCenterId').value ? Number($('#costCenterId').value) : null,
    vehicleId: $('#vehicleId').value ? Number($('#vehicleId').value) : null,
    notes: $('#notes').value.trim() || null,

    xmlPath: $('#xmlPath').value.trim() || null,
    pdfPath: $('#pdfPath').value.trim() || null,

    generatesTaxCredit: $('#generatesTaxCredit').checked,
    fiscalStatus: $('#fiscalStatus').value.trim() || 'NO_CREDIT',
  };
}

async function openNew() {
  formClear();
  modalTitle('Nova Entrada', 'Preencha os dados da despesa/nota');
  modalOpen(true);

  const today = new Date();
  $('#issueDate').value = toISODate(today);
  $('#entryDate').value = toISODate(today);
}

async function openEdit(id) {
  try {
    const json = await http(`${API}/${id}`);
    const row = json.data;
    if (!row) return toast('Registro não encontrado', 'error');

    const st = String(row.status || '').toUpperCase();
    if (st === 'POSTED') {
      toast('Entrada POSTED não pode ser editada.', 'error');
      return;
    }

    formClear();
    formFill(row);
    modalTitle(`Editar Entrada #${id}`, 'Atualize os dados e salve');
    modalOpen(true);
  } catch (e) {
    toast(`Erro ao abrir: ${e.message}`, 'error');
  }
}

async function saveCurrent(e) {
  e.preventDefault();
  try {
    const id = Number($('#expenseEntryId').value || 0);
    const payload = readForm();

    if (!payload.issueDate) return toast('Issue Date é obrigatório.', 'error');

    let url = API;
    let method = 'POST';

    if (id) {
      url = `${API}/${id}`;
      method = 'PUT';
    }

    await http(url, { method, body: payload });

    modalOpen(false);
    await loadList();
    toast('Salvo com sucesso ✅');
  } catch (e2) {
    toast(`Erro ao salvar: ${e2.message}`, 'error');
  }
}

async function cancelEntry(id) {
  const yes = confirm(`Cancelar a entrada #${id}? (status → CANCELED)`);
  if (!yes) return;

  try {
    await http(`${API}/${id}/cancel`, { method: 'PATCH' });
    await loadList();
    toast('Cancelado ✅');
  } catch (e) {
    toast(`Erro ao cancelar: ${e.message}`, 'error');
  }
}

async function deleteEntry(id) {
  const yes = confirm(`Excluir PERMANENTEMENTE a entrada #${id}?`);
  if (!yes) return;

  try {
    await http(`${API}/${id}`, { method: 'DELETE' });
    await loadList();
    toast('Excluído ✅');
  } catch (e) {
    toast(`Erro ao excluir: ${e.message}`, 'error');
  }
}

async function postEntry(id) {
  const yes = confirm(
    `POSTAR a entrada #${id}?\n\n` +
    `Isso irá:\n• status → POSTED\n• gerar/atualizar Contas a Pagar\n\nContinuar?`
  );
  if (!yes) return;

  try {
    const json = await http(`${API}/${id}/post`, { method: 'POST', body: {} });
    const ap = json?.data?.accountsPayable;

    await loadList();

    if (ap?.id) toast(`Postado ✅ Contas a Pagar gerada (#${ap.id}) ✅`);
    else toast('Postado ✅ Contas a Pagar gerada ✅');
  } catch (e) {
    toast(`Erro ao postar: ${e.message}`, 'error');
  }
}

// ---- XML Import ----------------------------------------------------------

async function handleImportXmlFile(file) {
  try {
    const hint = $('#loadingHint');
    hint.textContent = `Importando XML: ${file.name}...`;

    const json = await uploadXml(`${API}/import-xml`, file);
    const data = json.data || {};
    const entryDraft = data.entryDraft || {};
    const items = data.items || [];

    hint.textContent = '';

    formClear();
    formFill(entryDraft);

    state.xmlItems = items;
    renderItemsPreview(items);

    modalTitle('Nova Entrada (via XML)', `XML importado: ${file.name} • Itens: ${items.length}`);

    if (items.length) {
      const preview = items.slice(0, 8)
        .map((it) => `• ${it.sku || '-'} ${it.description || ''} (${it.quantity} ${it.unit})`)
        .join('\n');

      const extra = items.length > 8 ? `\n... +${items.length - 8} itens` : '';
      const curNotes = ($('#notes').value || '').trim();

      $('#notes').value =
        (curNotes ? (curNotes + '\n\n') : '') +
        `IMPORT XML NF-e: ${file.name}\n${preview}${extra}`;
    }

    modalOpen(true);
  } catch (e) {
    $('#loadingHint').textContent = '';
    toast(`Erro ao importar XML: ${e.message}`, 'error');
  }
}

// ---- events -------------------------------------------------------------

function bindEvents() {
  $('#btnNew').addEventListener('click', openNew);

  $('#btnApply').addEventListener('click', () => { state.page = 1; loadList(); });

  $('#btnClear').addEventListener('click', () => {
    $('#fQ').value = '';
    $('#fStatus').value = '';
    $('#fSupplierDoc').value = '';
    $('#fDateFrom').value = '';
    $('#fDateTo').value = '';
    $('#fOrderBy').value = 'issueDate desc';
    $('#fPageSize').value = '20';
    state.page = 1;
    loadList();
  });

  $('#btnPrev').addEventListener('click', () => {
    const page = Number(state.paging?.page || state.page || 1);
    if (page <= 1) return;
    state.page = page - 1;
    loadList();
  });

  $('#btnNext').addEventListener('click', () => {
    const page = Number(state.paging?.page || state.page || 1);
    const total = Number(state.paging?.total || 0);
    const pageSize = Number(state.paging?.pageSize || readFilters().pageSize || 50);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page >= pages) return;
    state.page = page + 1;
    loadList();
  });

  $('#fQ').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { state.page = 1; loadList(); }
  });

  // Aqui você pode manter; o modal.js também trata data-close/backdrop/ESC
  $('#modal').addEventListener('click', (ev) => {
    const t = ev.target;
    if (t?.dataset?.close === '1') modalOpen(false);
  });

  $('#form').addEventListener('submit', saveCurrent);

  $('#tbody').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.disabled) return;

    const id = Number(btn.dataset.id);
    const act = btn.dataset.act;

    if (act === 'post') return postEntry(id);
    if (act === 'edit') return openEdit(id);
    if (act === 'cancel') return cancelEntry(id);
    if (act === 'delete') return deleteEntry(id);
  });

  $('#btnImportXml').addEventListener('click', () => $('#xmlFile').click());
  $('#xmlFile').addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    await handleImportXmlFile(file);
  });
}

(function init() {
  setupExpenseEntriesModal();
  bindEvents();
  loadList();
})();
