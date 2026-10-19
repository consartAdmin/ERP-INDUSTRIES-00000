'use strict';
import { state } from './bankAccounts.state.js';
import { $ } from './bankAccounts.utils.js';
import { openModal, closeModal } from './bankAccounts.modal.js';
import { validateBankAccount } from './bankAccounts.validation.js';
export function renderBankOptions() { const select = $('#bankAccountBankId'); const selected = select.value; select.replaceChildren(new Option('Selecione...', '')); state.banks.forEach((bank) => select.add(new Option(`${bank.code ? `${bank.code} — ` : ''}${bank.name}`, bank.id))); select.value = selected; }
export function readBankAccountForm() { const data = { bank_id: Number($('#bankAccountBankId').value), name: $('#bankAccountName').value.trim(), agency: $('#bankAccountAgency').value.trim() || null, account_number: $('#bankAccountNumber').value.trim() || null, account_digit: $('#bankAccountDigit').value.trim() || null, integration_provider: $('#bankAccountProvider').value, boleto_mode: $('#bankAccountBoletoMode').value, is_default: $('#bankAccountDefault').checked, is_active: $('#bankAccountActive').checked }; validateBankAccount(data); return data; }
export function openBankAccountForm(item = null) {
  $('#bankAccountsForm')?.reset(); renderBankOptions(); $('#bankAccountId').value = item?.id || ''; $('#bankAccountBankId').value = item?.bank_id || ''; $('#bankAccountName').value = item?.name || ''; $('#bankAccountAgency').value = item?.agency || ''; $('#bankAccountNumber').value = item?.account_number || ''; $('#bankAccountDigit').value = item?.account_digit || ''; $('#bankAccountProvider').value = item?.integration_provider || 'MANUAL'; $('#bankAccountBoletoMode').value = item?.boleto_mode || 'MANUAL'; $('#bankAccountDefault').checked = Boolean(item?.is_default); $('#bankAccountActive').checked = item ? Boolean(item.is_active) : true; $('#bankAccountsModalTitle').textContent = item ? 'Editar Conta Bancária' : 'Nova Conta Bancária'; openModal();
}
export function bindBankAccountForm(onSubmit) {
  $('#bankAccountProvider')?.addEventListener('change', (event) => { if (event.target.value === 'ASAAS') $('#bankAccountBoletoMode').value = 'AUTOMATIC'; });
  $('#bankAccountsForm')?.addEventListener('submit', async (event) => { event.preventDefault(); await onSubmit({ id: $('#bankAccountId').value || null, data: readBankAccountForm(), submitButton: event.submitter }); }); return { close: closeModal };
}
