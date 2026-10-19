'use strict';

import { bindTabs, activateTab, bindListUI, syncReturnOrderButtons } from './orders.actions.js';
import { bindEditorUI, loadPaymentMethods } from './orders.form.js';
import { fetchPedidos } from './orders.render.js';
import { $ } from './orders.utils.js';

document.addEventListener('DOMContentLoaded', () => {
  bindTabs();
  bindListUI();
  bindEditorUI();
  activateTab('list');
  fetchPedidos();
  loadPaymentMethods();
  syncReturnOrderButtons({});

  const btnEditor = $('#btnReturnOrder');
  if (btnEditor) {
    btnEditor.disabled = true;
    btnEditor.title = 'Abra um pedido para usar Return Order.';
  }

  const btnReloadPedidos = $('#btnReloadPedidos');
  btnReloadPedidos?.addEventListener('click', async () => {
    const originalHtml = btnReloadPedidos.innerHTML;
    try {
      btnReloadPedidos.disabled = true;
      btnReloadPedidos.innerHTML = '⏳ Atualizando...';
      await fetchPedidos();
    } catch (error) {
      console.error('[orders] Erro ao atualizar pedidos:', error);
    } finally {
      btnReloadPedidos.disabled = false;
      btnReloadPedidos.innerHTML = originalHtml;
    }
  });
});

