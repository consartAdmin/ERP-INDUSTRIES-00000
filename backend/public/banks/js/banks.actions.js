'use strict';
import { listBanks, createBank, updateBank, deactivateBank } from './banks.api.js';
import { state } from './banks.state.js';
import { renderBanks } from './banks.render.js';
import { openBankForm } from './banks.form.js';
import { closeModal } from './banks.modal.js';
import { $, notify, setBusy } from './banks.utils.js';
function renderCurrentPage() {
  renderBanks(state.items, { edit: openBankForm, remove: removeBank });
}
export async function loadBanks() {
  if (state.loading) return; state.loading = true;
  try {
    const params = new URLSearchParams(); if (state.search) params.set('search', state.search); if (state.active !== '') params.set('active', state.active);
    const result = await listBanks(params); state.items = result.data || [];
    renderCurrentPage();
  } catch (error) { notify('error', 'Erro ao listar bancos', error.message); } finally { state.loading = false; }
}
export async function saveBank({ id, data, submitButton }) {
  setBusy(submitButton, true);
  try { if (id) await updateBank(id, data); else await createBank(data); closeModal(); notify('success', 'Banco salvo', 'Cadastro salvo com sucesso.'); await loadBanks(); }
  catch (error) { notify('error', 'Erro ao salvar banco', error.message); } finally { setBusy(submitButton, false); }
}
export async function removeBank(bank) {
  if (!confirm(`Desativar o banco "${bank.name}"?`)) return;
  try { await deactivateBank(bank.id); await loadBanks(); } catch (error) { notify('error', 'Erro ao desativar banco', error.message); }
}
export function bindBankActions() {
  $('#banksNew')?.addEventListener('click', () => openBankForm());
  $('#banksFilterForm')?.addEventListener('submit', (event) => { event.preventDefault(); state.search = $('#banksSearch').value.trim(); state.active = $('#banksActive').value; state.page = 1; loadBanks(); });
  $('#banksClear')?.addEventListener('click', () => { $('#banksSearch').value = ''; $('#banksActive').value = 'true'; state.search = ''; state.active = 'true'; state.page = 1; loadBanks(); });
  $('#btnPreviousPage')?.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; renderCurrentPage(); } });
  $('#btnNextPage')?.addEventListener('click', () => { if (state.page < state.totalPages) { state.page += 1; renderCurrentPage(); } });
  $('#apRowsPerPage')?.addEventListener('change', (event) => { state.pageSize = Number(event.target.value) || 50; state.page = 1; renderCurrentPage(); });
}
