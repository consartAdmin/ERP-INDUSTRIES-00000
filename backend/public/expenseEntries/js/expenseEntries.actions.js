// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.actions.js — Application actions (PRODNEX ERP)       ║
// ║ Path: backend/public/expenseEntries/expenseEntries.actions.js        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { http, uploadXml } from './expenseEntries.api.js';
import { API, DEFAULT_ORDER_BY, DEFAULT_PAGE_SIZE } from './expenseEntries.config.js';
import {
  clearForm,
  fillForm,
  readForm,
  renderItemsPreview,
  setModalTitle,
} from './expenseEntries.form.js';
import { setExpenseEntriesModalOpen } from './expenseEntries.modal.js';
import { renderList } from './expenseEntries.render.js';
import { state } from './expenseEntries.state.js';
import { $, toISODate, toast } from './expenseEntries.utils.js';
import { validateExpenseEntry } from './expenseEntries.validation.js';

export function readFilters() {
  return {
    q: $('#fQ').value.trim(),
    status: $('#fStatus').value.trim(),
    supplierDocument: $('#fSupplierDoc').value.trim(),
    dateFrom: $('#fDateFrom').value || '',
    dateTo: $('#fDateTo').value || '',
    orderBy: $('#fOrderBy').value || DEFAULT_ORDER_BY,
    pageSize: Number($('#pageSize').value || DEFAULT_PAGE_SIZE),
  };
}

export function buildListUrl() {
  const filters = readFilters();
  const url = new URL(API);

  url.searchParams.set('page', String(state.page));
  url.searchParams.set('pageSize', String(filters.pageSize));
  url.searchParams.set('orderBy', filters.orderBy);
  if (filters.q) url.searchParams.set('q', filters.q);
  if (filters.status) url.searchParams.set('status', filters.status);
  if (filters.supplierDocument) url.searchParams.set('supplierDocument', filters.supplierDocument);
  if (filters.dateFrom) url.searchParams.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) url.searchParams.set('dateTo', filters.dateTo);

  return url.toString();
}

export async function loadList() {
  const hint = $('#loadingHint');
  try {
    hint.textContent = 'Carregando...';
    const json = await http(buildListUrl());
    state.rows = json.data || [];
    state.paging = json.paging || {
      total: state.rows.length,
      page: state.page,
      pageSize: readFilters().pageSize,
    };
    renderList(readFilters().pageSize);
  } catch (error) {
    toast(`Erro ao listar: ${error.message}`, 'error');
  } finally {
    hint.textContent = '';
  }
}

export function openNew() {
  clearForm();
  setModalTitle('Nova Entrada', 'Preencha os dados da despesa/nota');
  const today = toISODate(new Date());
  $('#issueDate').value = today;
  $('#entryDate').value = today;
  setExpenseEntriesModalOpen(true);
}

export async function openEdit(id) {
  try {
    const json = await http(`${API}/${id}`);
    const row = json.data;
    if (!row) return toast('Registro não encontrado', 'error');
    if (String(row.status || '').toUpperCase() === 'POSTED') {
      return toast('Entrada POSTED não pode ser editada.', 'error');
    }

    clearForm();
    fillForm(row);
    setModalTitle(`Editar Entrada #${id}`, 'Atualize os dados e salve');
    setExpenseEntriesModalOpen(true);
  } catch (error) {
    toast(`Erro ao abrir: ${error.message}`, 'error');
  }
}

export async function saveCurrent(event) {
  event.preventDefault();
  try {
    const id = Number($('#expenseEntryId').value || 0);
    const payload = readForm();
    const validation = validateExpenseEntry(payload);
    if (!validation.valid) return toast(validation.errors[0], 'error');

    await http(id ? `${API}/${id}` : API, {
      method: id ? 'PUT' : 'POST',
      body: payload,
    });

    setExpenseEntriesModalOpen(false);
    await loadList();
    toast('Salvo com sucesso ✅');
  } catch (error) {
    toast(`Erro ao salvar: ${error.message}`, 'error');
  }
}

export async function cancelEntry(id) {
  if (!window.confirm(`Cancelar a entrada #${id}? (status → CANCELED)`)) return;
  try {
    await http(`${API}/${id}/cancel`, { method: 'PATCH' });
    await loadList();
    toast('Cancelado ✅');
  } catch (error) {
    toast(`Erro ao cancelar: ${error.message}`, 'error');
  }
}

export async function deleteEntry(id) {
  if (!window.confirm(`Excluir PERMANENTEMENTE a entrada #${id}?`)) return;
  try {
    await http(`${API}/${id}`, { method: 'DELETE' });
    await loadList();
    toast('Excluído ✅');
  } catch (error) {
    toast(`Erro ao excluir: ${error.message}`, 'error');
  }
}

export async function postEntry(id) {
  const confirmed = window.confirm(
    `POSTAR a entrada #${id}?\n\n` +
    'Isso irá:\n• status → POSTED\n• gerar/atualizar Contas a Pagar\n\nContinuar?',
  );
  if (!confirmed) return;

  try {
    const json = await http(`${API}/${id}/post`, { method: 'POST', body: {} });
    const accountsPayable = json?.data?.accountsPayable;
    await loadList();
    toast(accountsPayable?.id
      ? `Postado ✅ Contas a Pagar gerada (#${accountsPayable.id}) ✅`
      : 'Postado ✅ Contas a Pagar gerada ✅');
  } catch (error) {
    toast(`Erro ao postar: ${error.message}`, 'error');
  }
}

export async function importXmlFile(file) {
  const hint = $('#loadingHint');
  try {
    hint.textContent = `Importando XML: ${file.name}...`;
    const json = await uploadXml(`${API}/import-xml`, file);
    const data = json.data || {};
    const entryDraft = data.entryDraft || {};
    const items = data.items || [];

    clearForm();
    fillForm(entryDraft);
    state.xmlItems = items;
    renderItemsPreview(items);
    setModalTitle('Nova Entrada (via XML)', `XML importado: ${file.name} • Itens: ${items.length}`);

    if (items.length) {
      const preview = items.slice(0, 8)
        .map((item) => `• ${item.sku || '-'} ${item.description || ''} (${item.quantity} ${item.unit})`)
        .join('\n');
      const extra = items.length > 8 ? `\n... +${items.length - 8} itens` : '';
      const currentNotes = $('#notes').value.trim();
      $('#notes').value = `${currentNotes ? `${currentNotes}\n\n` : ''}IMPORT XML NF-e: ${file.name}\n${preview}${extra}`;
    }

    setExpenseEntriesModalOpen(true);
  } catch (error) {
    toast(`Erro ao importar XML: ${error.message}`, 'error');
  } finally {
    hint.textContent = '';
  }
}

export function clearFilters() {
  $('#fQ').value = '';
  $('#fStatus').value = '';
  $('#fSupplierDoc').value = '';
  $('#fDateFrom').value = '';
  $('#fDateTo').value = '';
  $('#fOrderBy').value = DEFAULT_ORDER_BY;
  $('#pageSize').value = String(DEFAULT_PAGE_SIZE);
  state.page = 1;
  return loadList();
}

export function previousPage() {
  const page = Number(state.paging?.page || state.page || 1);
  if (page <= 1) return;
  state.page = page - 1;
  return loadList();
}

export function nextPage() {
  const page = Number(state.paging?.page || state.page || 1);
  const total = Number(state.paging?.total || 0);
  const pageSize = Number(state.paging?.pageSize || readFilters().pageSize);
  if (page >= Math.max(1, Math.ceil(total / pageSize))) return;
  state.page = page + 1;
  return loadList();
}
