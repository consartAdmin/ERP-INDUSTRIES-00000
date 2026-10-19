// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.init.js — Initialization and events (PRODNEX ERP)    ║
// ║ Path: backend/public/expenseEntries/expenseEntries.init.js           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  cancelEntry,
  clearFilters,
  deleteEntry,
  importXmlFile,
  loadList,
  nextPage,
  openEdit,
  openNew,
  postEntry,
  previousPage,
  saveCurrent,
} from './expenseEntries.actions.js';
import { initImportFromDfe } from '/public/inboundInvoices/js/inboundInvoices.dfe.js';
import { apiBase } from './expenseEntries.config.js';
import { setupExpenseEntriesModal } from './expenseEntries.modal.js';
import { state } from './expenseEntries.state.js';
import { $, toast } from './expenseEntries.utils.js';

function bindEvents() {
  $('#btnNew').addEventListener('click', openNew);
  $('#btnApply').addEventListener('click', () => {
    state.page = 1;
    loadList();
  });
  $('#btnClear').addEventListener('click', clearFilters);
  $('#btnPrevious').addEventListener('click', previousPage);
  $('#btnNext').addEventListener('click', nextPage);

  $('#pageSize').addEventListener('change', () => {
    state.page = 1;
    loadList();
  });

  $('#fQ').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    state.page = 1;
    loadList();
  });

  $('#form').addEventListener('submit', saveCurrent);

  $('#tbody').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-act]');
    if (!button || button.disabled) return;

    const id = Number(button.dataset.id);
    if (button.dataset.act === 'post') postEntry(id);
    if (button.dataset.act === 'edit') openEdit(id);
    if (button.dataset.act === 'cancel') cancelEntry(id);
    if (button.dataset.act === 'delete') deleteEntry(id);
  });

  $('#btnImportXml').addEventListener('click', () => $('#xmlFile').click());
  $('#xmlFile').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) await importXmlFile(file);
  });
}

// Reaproveita o modal "Importar do DF-e" de Entradas Fiscais: lista a caixa
// de entrada DF-e, baixa o XML e entrega ao mesmo fluxo do "Importar XML".
function setupImportFromDfe() {
  initImportFromDfe({
    core: {
      toast: {
        error: (title, message) => toast(`${title}: ${message}`, 'error'),
      },
    },
    ROUTES: {
      nfeInboxList: () => `${apiBase}/api/nfe-inbox`,
      nfeInboxXmlById: (id) => `${apiBase}/api/nfe-inbox/${encodeURIComponent(String(id))}/xml`,
    },
    state: { actions: { importXmlFile } },
    refs: {
      btnImportFromDfe: $('#btnImportFromDfe'),
      dfeModal: $('#dfeImportModal'),
      dfeModalBackdrop: $('#dfeImportBackdrop'),
      dfeModalClose: $('#btnCloseDfeModal'),
      dfeSearch: $('#dfeSearch'),
      dfeOnlyPending: $('#dfeOnlyPending'),
      dfeReload: $('#btnReloadDfe'),
      dfeTbody: $('#dfeTableBody'),
      dfeStatus: $('#dfeStatus'),
    },
  });
}

export function initExpenseEntries() {
  setupExpenseEntriesModal();
  bindEvents();
  setupImportFromDfe();
  loadList();
}

initExpenseEntries();
