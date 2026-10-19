/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.init.js — Entry point e orquestrador do módulo          ║
   ║ PRODNEX ERP | Frontend (ESM)                                    ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { createSortableTable } from '/public/includes/js/sortableTable.js';
import '/public/includes/js/date-range-field.js';

import { core } from './inboundInvoices.utils.js';
import { ROUTES } from './inboundInvoices.config.js';
import { state } from './inboundInvoices.state.js';

import { initTabs, switchTab, initImportXml } from './inboundInvoices.actions.js';
import { initImportFromDfe } from './inboundInvoices.dfe.js';
import { initQuickSupplier } from './inboundInvoices.supplier.js';
import { initList } from './inboundInvoices.render.js';
import { initForm } from './inboundInvoices.form.js';
import { initLinkProduct } from './inboundInvoices.modal.js';
import { initSave } from './inboundInvoices.validation.js';
import { loadUnits } from './inboundInvoices.api.js';
import { initInboundStockMode } from './inboundInvoices.stock.js';

const SORTABLE_COLUMNS = Object.freeze([
  'id',
  'supplier_name',
  'access_key',
  'invoice_number',
  'series',
  'issuer',
  'recipient',
  'total_amount',
  'issue_date',
  'created_at',
]);

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initTabs({ core });

    const refs = {
      // LIST
      table: core.qs('#inboundTable'),
      tbody: core.qs('#corpoTabelaMovimentacoes'),
      search: core.qs('#search'),
      btnSearch: core.qs('#btnSearch'),
      btnNewFromList: core.qs('#btnNewFromList'),
      pagePrev: core.qs('#pagePrev'),
      pageNext: core.qs('#pageNext'),
      pageInfo: core.qs('#pageInfo'),

      filterDateRange: core.qs('#filterDateRange'),

      tableInfo: core.qs('#apTableInfo'),
      rowsPerPage: core.qs('#apRowsPerPage'),

      // FORM HEADER
      form: core.qs('#formInvoice'),
      fldId: core.qs('#invoiceId'),
      fldKey: core.qs('#access_key'),
      fldNum: core.qs('#invoice_number'),
      fldSeries: core.qs('#series'),
      fldIssuer: core.qs('#issuer'),
      fldRec: core.qs('#recipient'),
      fldTotal: core.qs('#total_amount'),
      fldIssueDate: core.qs('#issue_date'),
      fldEntryDate: core.qs('#entry_date'),
      fldStatus: core.qs('#invoice_status'),

      // EDIT MODAL
      editModal: core.qs('#tab-form'),
      btnCloseInvoiceModal: core.qs('#btnCloseInvoiceModal'),
      editModalTitle: core.qs('#inboundEditModalTitle'),
      editModalSubtitle: core.qs('#inboundEditModalSubtitle'),

      // FORM BUTTONS
      btnSave: core.qs('#btnSaveInvoice'),
      btnSubmit: core.qs('#btnSaveInvoice'),
      btnCancelForm: core.qs('#btnCancelForm'),

      // ITEMS + INSTALLMENTS
      itemsTbody: core.qs('#tblItemsBody'),
      itemsEmpty: core.qs('#itemsEmpty'),
      instTbody: core.qs('#tblInstallments tbody'),
      instEmpty: core.qs('#instEmpty'),

      // XML IMPORT
      btnImportXml: core.qs('#btnImportXml'),
      xmlFileInput: core.qs('#xmlFileInput'),

      // QUICK SUPPLIER
      supplierModal: core.qs('#supplierModal'),
      supplierForm: core.qs('#formQuickSupplier'),
      supplierBackdrop: core.qs('#supplierModalBackdrop'),
      supplierTaxId: core.qs('#supplier_tax_id'),
      supplierName: core.qs('#supplier_name'),
      supplierFantasy: core.qs('#supplier_fantasy'),
      supplierEmail: core.qs('#supplier_email'),
      supplierPhone: core.qs('#supplier_phone'),
      supplierClose: core.qs('#btnCloseSupplierModal'),
      supplierCancel: core.qs('#btnCancelSupplier'),
      supplierSave: core.qs('#btnSaveSupplier'),
      supplierWarning: core.qs('#supplierWarning'),
      btnOpenSupplierModal: core.qs('#btnOpenSupplierModal'),

      // IMPORT FROM DF-e
      btnImportFromDfe: core.qs('#btnImportFromDfe'),
      dfeModal: core.qs('#dfeImportModal'),
      dfeModalBackdrop: core.qs('#dfeImportBackdrop'),
      dfeModalClose: core.qs('#btnCloseDfeModal'),
      dfeSearch: core.qs('#dfeSearch'),
      dfeOnlyPending: core.qs('#dfeOnlyPending'),
      dfeReload: core.qs('#btnReloadDfe'),
      dfeTbody: core.qs('#dfeTableBody'),
      dfeStatus: core.qs('#dfeStatus'),
    };

    state.actions = state.actions || {};
    state.currentItems = Array.isArray(state.currentItems) ? state.currentItems : [];
    state.currentInstallments = Array.isArray(state.currentInstallments)
      ? state.currentInstallments
      : [];

    state.lotsByProductCache = state.lotsByProductCache || new Map();
    state.lotsByStockCache = state.lotsByStockCache || new Map();

    state.actions.confirmDelete = async ({
      title,
      message,
      confirmText,
      cancelText,
    } = {}) => {
      return core.confirmDanger({
        variant: 'warning',
        title: title || 'Excluir',
        message: message || 'Tem certeza que deseja excluir?',
        confirmText: confirmText || 'Excluir',
        cancelText: cancelText || 'Cancelar',
      });
    };

    // Resolve PRODUCT_STOCK_MODE before any form/item module starts.
    // This guarantees that lot UI, lot queries and payload normalization all
    // use the same appFeature from the first render.
    await initInboundStockMode({ core, ROUTES, state });

    await loadUnits({ core, ROUTES, state });

    initList({ core, ROUTES, state, refs, switchTab });

    state.actions.sortableTable = createSortableTable({
      table: refs.table,
      defaultColumn: state.orderBy,
      defaultDirection: state.orderDirection,
      allowedColumns: SORTABLE_COLUMNS,
      onSort: async ({ column, direction }) => {
        state.orderBy = column;
        state.orderDirection = direction;
        state.page = 1;

        await state.actions.loadInvoices?.();
      },
      onError: (error) => {
        console.error('[INBOUND][SORT_ERROR]', error);

        core.toast.error(
          'Erro ao ordenar tabela',
          error?.message || 'Não foi possível atualizar a ordenação.',
        );
      },
    });

    initForm({ core, ROUTES, state, refs, switchTab });
    initLinkProduct({ core, ROUTES, state, refs });
    initSave({ core, ROUTES, state, refs, switchTab });
    initQuickSupplier({ core, ROUTES, state, refs });
    initImportXml({ core, ROUTES, state, refs, switchTab });
    initImportFromDfe({ core, ROUTES, state, refs });

    await state.actions.loadInvoices?.();
  } catch (err) {
    console.error('[INBOUND][INDEX][INIT_ERROR]', err);

    core.toast.error(
      'Erro ao iniciar tela',
      err?.message || 'Falha ao carregar o módulo de entradas fiscais.',
    );
  }
});
