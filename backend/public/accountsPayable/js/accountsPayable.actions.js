'use strict';

import * as api from './accountsPayable.api.js';
import { buildExportParams, buildListParams, clearFilterFields, readFilters } from './accountsPayable.filters.js';
import { closePayModal, openAccountForm, openBatchForm, openPayModal } from './accountsPayable.modal.js';
import { renderPagination, renderTable } from './accountsPayable.render.js';
import { state, patchState } from './accountsPayable.state.js';
import { qs, toFloat, toInt } from './accountsPayable.utils.js';
import { validatePayment } from './accountsPayable.validation.js';

export async function loadList() {
  try {
    const { rows, total } = await api.listAccounts(buildListParams());
    patchState({ items: rows, total });
    renderTable(rows);
    renderPagination();
  } catch (error) {
    console.error('[accountsPayable] loadList:', error);
    alert('Erro ao carregar contas a pagar. Veja o console para detalhes.');
  }
}

export function applyFilters() {
  readFilters();
  return loadList();
}

export function clearFilters() {
  clearFilterFields();
  return loadList();
}

export async function downloadAccounts(format) {
  const button = qs(format === 'pdf' ? '#btnExportPdf' : '#btnExportExcel');
  const originalLabel = button?.textContent;
  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Baixando...';
    }
    await api.downloadExport(format, buildExportParams());
  } catch (error) {
    console.error(`[accountsPayable] export ${format}:`, error);
    alert(`Erro ao baixar o arquivo ${format === 'pdf' ? 'PDF' : 'Excel'}.`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}

export function newAccount() {
  openAccountForm(null, loadList);
}

export async function editAccount(id) {
  try { openAccountForm(await api.getAccount(id), loadList); }
  catch (error) {
    console.error('[accountsPayable] edit:', error);
    alert('Erro ao carregar registro para edição.');
  }
}

export async function deleteAccount(id) {
  if (!confirm(`Deseja realmente excluir a conta a pagar #${id}?`)) return;
  try { await api.removeAccount(id); await loadList(); }
  catch (error) {
    console.error('[accountsPayable] delete:', error);
    alert('Erro ao excluir registro.');
  }
}

export function batchAccounts() {
  openBatchForm(loadList);
}

export function previousPage() {
  if (state.page <= 1) return;
  state.page -= 1;
  loadList();
}

export function nextPage() {
  const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
  if (state.page >= pages) return;
  state.page += 1;
  loadList();
}

export async function submitPayment(event) {
  event.preventDefault();
  const accountId = toInt(qs('#pay_account_id')?.value);
  const record = state.items.find((item) => Number(item.id) === accountId);
  if (!record) return alert('Conta não encontrada na lista atual.');
  const amount = toFloat(qs('#pay_valor_original')?.value) ?? 0;
  const cashSelect = qs('#pay_conta_caixa');
  const bankAccountId = toInt(cashSelect?.value);
  const cashAccount = cashSelect?.value
    ? cashSelect.options[cashSelect.selectedIndex].dataset.accountName ||
      cashSelect.options[cashSelect.selectedIndex].text.trim()
    : '';
  const error = validatePayment({ accountId, cashAccount, amount });
  if (error) return alert(error);

  const paidAt = qs('#pay_data_hora')?.value || new Date().toISOString();
  const fine = toFloat(qs('#pay_multa')?.value) ?? 0;
  const interest = toFloat(qs('#pay_juros')?.value) ?? 0;
  const charges = toFloat(qs('#pay_encargos')?.value) ?? 0;
  const observation = qs('#pay_observacao')?.value || '';
  const documentTypeSelect = qs('#pay_document_type_id');
  const documentType = documentTypeSelect?.value
    ? documentTypeSelect.options[documentTypeSelect.selectedIndex].text.trim()
    : record.document_type || 'DUPLICATA';

  try {
    await api.createCashMovement({
      data_hora: paidAt,
      tipo_movimentacao: 'SAÍDA',
      conta_caixa: cashAccount,
      bank_account_id: bankAccountId,
      valor: amount,
      tipo_documento: documentType,
      document_type_id: toInt(documentTypeSelect?.value),
      numero_documento: qs('#pay_documento')?.value?.trim() ||
        record.nfe_number || record.numero_nfe || record.invoice_number || String(record.id),
      fornecedor: record.supplier_name || '',
      observacao: observation,
      multa: fine,
      juros: interest,
      encargos: charges,
      chart_account_id: toInt(qs('#pay_chart_account_id')?.value),
      categoria: qs('#pay_categoria')?.value || null,
      subcategoria: qs('#pay_subcategoria')?.value || null,
      is_active: true,
    });
    await api.registerPayment(accountId, {
      payment_date: String(paidAt).slice(0, 10),
      paid_increment: amount,
      multa: fine,
      juros: interest,
      encargos: charges,
      chart_account_id: toInt(qs('#pay_chart_account_id')?.value),
      observacao: observation,
    });

    const file = qs('#pay_anexoFile')?.files?.[0] || state.payDroppedFile;
    const progress = qs('#pay_anexoProgress');
    if (file) {
      if (progress) progress.style.display = 'block';
      await api.uploadAttachment(accountId, file, (value) => {
        if (progress) progress.value = value;
      });
    }
    closePayModal();
    await loadList();
  } catch (error) {
    console.error('[accountsPayable] payment:', error);
    alert(error.message || 'Erro inesperado ao registrar o pagamento.');
  } finally {
    const progress = qs('#pay_anexoProgress');
    if (progress) { progress.style.display = 'none'; progress.value = 0; }
  }
}

export async function handleTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = toInt(button.closest('tr')?.dataset.id);
  if (!id) return;
  if (button.dataset.action === 'edit') return editAccount(id);
  if (button.dataset.action === 'delete') return deleteAccount(id);
  if (button.dataset.action === 'pay') {
    const record = state.items.find((item) => Number(item.id) === id);
    if (record) return openPayModal(record);
  }
}
