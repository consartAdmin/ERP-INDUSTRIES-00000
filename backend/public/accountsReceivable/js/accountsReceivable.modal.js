import { showCenterModal } from './accountsReceivable.alert.js';
import { getAccount, receiveAccount } from './accountsReceivable.api.js';
import { $, dateISO } from './accountsReceivable.utils.js';
import { Modal } from './modal.js';
import {
  clearChartAccountPicker,
  setChartAccountPickerFromRecord,
} from './accountsReceivable.chartAccountPicker.js';

function dateInputValue(value) {
  const text = String(value || '');
  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return isoDate || dateISO(value);
}

export async function openReceiveModal(row, id) {
  const accountId = id || row?.dataset.id || '';

  if (!accountId) {
    return showCenterModal({
      type: 'error',
      title: 'Conta não identificada',
      message: 'Não foi possível localizar o ID da conta a receber.',
    });
  }

  $('#receive_account_id').value = accountId;
  ['receive_desconto', 'receive_juros', 'receive_encargos', 'receive_observacao'].forEach((field) => { $(`#${field}`).value = ''; });
  $('#receive_categoria').value = '';
  $('#receive_document_type_id').value = '';
  $('#receive_chart_account_id').value = '';
  clearChartAccountPicker('receive');
  $('#receive_categoria').dispatchEvent(new Event('change', { bubbles: true }));

  try {
    const account = await getAccount(accountId);

    $('#receive_cliente').value = account.customer_name || '';
    $('#receive_documento').value =
      account.document_number || account.invoice_number || '';
    $('#receive_vencimento').value = dateInputValue(account.due_date);
    $('#receive_valor_original').value = Number(account.value || 0).toFixed(2);

    // "Conta Caixa" = conta bancária (public."bankAccounts")
    $('#receive_conta_caixa').value = String(
      account.bank_account_id ??
      account.effective_bank_account_id ??
      ''
    );
    setChartAccountPickerFromRecord('receive', account);
    $('#receive_juros').value = Number(account.interest || 0).toFixed(2);
    $('#receive_encargos').value = Number(account.charges || 0).toFixed(2);
    $('#receive_observacao').value = account.notes || '';
    $('#receive_document_type_id').value = account.document_type_id || '';
    $('#receive_categoria').value = account.category_id || '';
    $('#receive_categoria').dispatchEvent(new Event('change', { bubbles: true }));
    $('#receive_subcategoria').value = account.subcategory_id || '';

    Modal.open('receiveModal', { focusSelector: '#receive_data_hora' });
  } catch (error) {
    showCenterModal({
      type: 'error',
      title: 'Erro ao carregar conta',
      message: error.message || 'Não foi possível carregar os dados da conta.',
    });
  }
}

export function closeReceiveModal() { Modal.close('receiveModal'); }

export function bindReceiveModal(onReceived) {
  $('#fecharModalReceber')?.addEventListener('click', closeReceiveModal);
  $('#btnCancelarRecebimento')?.addEventListener('click', closeReceiveModal);
  $('#receiveForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = $('#receive_account_id').value;
    if (!id) return showCenterModal({ type: 'error', title: 'Conta não identificada', message: 'Registro da conta não localizado.' });
    const payload = {
      payment_datetime: $('#receive_data_hora').value || null,
      document_type_id: $('#receive_document_type_id').value || null,
      bank_account_id: $('#receive_conta_caixa').value || null,
      chart_account_id: $('#receive_chart_account_id').value || null,
      original_value: Number($('#receive_valor_original').value || 0),
      discount: Number($('#receive_desconto').value || 0), interest: Number($('#receive_juros').value || 0),
      charges: Number($('#receive_encargos').value || 0), category_id: $('#receive_categoria').value || null,
      subcategory_id: $('#receive_subcategoria').value || null, notes: $('#receive_observacao').value || null,
    };
    try {
      await receiveAccount(id, payload);
      showCenterModal({ type: 'success', title: 'Recebimento registrado', message: 'Conta marcada como recebida e movimentação registrada.' });
      closeReceiveModal();
      await onReceived();
    } catch (error) { showCenterModal({ type: 'error', title: 'Erro ao registrar recebimento', message: error.message || 'Falha ao comunicar com a API.' }); }
  });
}
