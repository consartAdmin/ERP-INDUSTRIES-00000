'use strict';
import { $ } from './banks.utils.js';
import { openModal, closeModal } from './banks.modal.js';
import { validateBank } from './banks.validation.js';
export function readBankForm() {
  const data = { code: $('#bankCode')?.value.trim() || null, name: $('#bankName')?.value.trim(), is_active: Boolean($('#bankActive')?.checked) };
  validateBank(data); return data;
}
export function openBankForm(bank = null) {
  $('#banksForm')?.reset(); $('#bankId').value = bank?.id || ''; $('#bankCode').value = bank?.code || '';
  $('#bankName').value = bank?.name || ''; $('#bankActive').checked = bank ? Boolean(bank.is_active) : true;
  $('#banksModalTitle').textContent = bank ? 'Editar Banco' : 'Novo Banco'; openModal();
}
export function bindBankForm(onSubmit) {
  $('#banksForm')?.addEventListener('submit', async (event) => { event.preventDefault(); await onSubmit({ id: $('#bankId').value || null, data: readBankForm(), submitButton: event.submitter }); });
  return { close: closeModal };
}
