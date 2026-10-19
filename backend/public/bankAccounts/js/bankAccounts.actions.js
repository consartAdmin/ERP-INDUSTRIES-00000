'use strict';
import { listBankAccounts, listBanks, createBankAccount, updateBankAccount, deactivateBankAccount } from './bankAccounts.api.js';
import { state } from './bankAccounts.state.js';
import { renderBankAccounts } from './bankAccounts.render.js';
import { openBankAccountForm, renderBankOptions } from './bankAccounts.form.js';
import { closeModal } from './bankAccounts.modal.js';
import { $, notify, setBusy } from './bankAccounts.utils.js';
function renderCurrentPage() {
  renderBankAccounts(state.items, { edit: openBankAccountForm, remove: removeBankAccount });
}
export async function loadBanks() { try { const result = await listBanks(); state.banks = result.data || []; renderBankOptions(); } catch (error) { notify('error', 'Erro ao listar bancos', error.message); } }
export async function loadBankAccounts() {
  if (state.loading) return; state.loading = true;
  try { const params = new URLSearchParams(); if (state.search) params.set('search', state.search); if (state.provider) params.set('provider', state.provider); if (state.active !== '') params.set('active', state.active); const result = await listBankAccounts(params); state.items = result.data || []; renderCurrentPage(); }
  catch (error) { notify('error', 'Erro ao listar contas bancárias', error.message); } finally { state.loading = false; }
}
export async function saveBankAccount({ id, data, submitButton }) { setBusy(submitButton, true); try { if (id) await updateBankAccount(id, data); else await createBankAccount(data); closeModal(); notify('success', 'Conta salva', 'Conta bancária salva com sucesso.'); await loadBankAccounts(); } catch (error) { notify('error', 'Erro ao salvar conta', error.message); } finally { setBusy(submitButton, false); } }
export async function removeBankAccount(item) { if (!confirm(`Desativar a conta "${item.name}"?`)) return; try { await deactivateBankAccount(item.id); await loadBankAccounts(); } catch (error) { notify('error', 'Erro ao desativar conta', error.message); } }
export function bindBankAccountActions() {
  $('#bankAccountsNew')?.addEventListener('click', () => openBankAccountForm());
  $('#bankAccountsFilterForm')?.addEventListener('submit', (event) => { event.preventDefault(); state.search = $('#bankAccountsSearch').value.trim(); state.provider = $('#bankAccountsProvider').value; state.active = $('#bankAccountsActive').value; state.page = 1; loadBankAccounts(); });
  $('#bankAccountsClear')?.addEventListener('click', () => { $('#bankAccountsSearch').value = ''; $('#bankAccountsProvider').value = ''; $('#bankAccountsActive').value = 'true'; state.search = ''; state.provider = ''; state.active = 'true'; state.page = 1; loadBankAccounts(); });
  $('#btnPreviousPage')?.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; renderCurrentPage(); } });
  $('#btnNextPage')?.addEventListener('click', () => { if (state.page < state.totalPages) { state.page += 1; renderCurrentPage(); } });
  $('#apRowsPerPage')?.addEventListener('change', (event) => { state.pageSize = Number(event.target.value) || 50; state.page = 1; renderCurrentPage(); });
}
