import { createSortableTable } from '/public/includes/js/sortableTable.js';
import { SORTABLE_COLUMNS } from './suppliers.config.js';
import { suppliersState as state } from './suppliers.state.js';
import { deleteAttachment, deleteSupplier, exportSuppliers, formatCnpjInput, loadSuppliers,
  lookupCnpj, saveSupplier, uploadAttachments } from './suppliers.actions.js';
import { openEditSupplierModal, openNewSupplierModal, showSupplierModal } from './suppliers.modal.js';
import { qs, showToast } from './suppliers.utils.js';
import {
  clearSupplierChartAccount,
  initializeSupplierFinancialFields,
  searchSupplierChartAccount,
  syncSupplierSubcategories,
} from './suppliers.financial.js';

function bindEvents() {
  state.sortableTable = createSortableTable({
    table: '#suppliersTable', defaultColumn: state.sort, defaultDirection: state.dir,
    allowedColumns: SORTABLE_COLUMNS,
    onSort: async ({ column, direction }) => { state.sort = column; state.dir = direction; state.page = 1; await loadSuppliers(); },
    onError: () => void showToast('Não foi possível ordenar os fornecedores.', 'error'),
  });
  let timer;
  qs('#searchInput')?.addEventListener('input', (event) => {
    state.search = event.currentTarget.value.trim(); state.page = 1;
    clearTimeout(timer); timer = setTimeout(loadSuppliers, 350);
  });
  qs('#pageSize')?.addEventListener('change', (event) => { state.limit = Number(event.currentTarget.value) || 50; state.page = 1; loadSuppliers(); });
  qs('#btnPrevious')?.addEventListener('click', () => { if (state.page > 1) { state.page -= 1; loadSuppliers(); } });
  qs('#btnNext')?.addEventListener('click', () => { if (state.page * state.limit < state.total) { state.page += 1; loadSuppliers(); } });
  qs('#btnReload')?.addEventListener('click', loadSuppliers);
  qs('#btnNewSupplier')?.addEventListener('click', openNewSupplierModal);
  qs('#btnExportPdf')?.addEventListener('click', (e) => exportSuppliers('pdf', e.currentTarget));
  qs('#btnExportExcel')?.addEventListener('click', (e) => exportSuppliers('excel', e.currentTarget));
  qs('#btnCloseModal')?.addEventListener('click', () => showSupplierModal(false));
  qs('#btnCancelModal')?.addEventListener('click', () => showSupplierModal(false));
  qs('#supplierForm')?.addEventListener('submit', saveSupplier);
  qs('#suppliersTableBody')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    if (button.dataset.action === 'edit') openEditSupplierModal(button.dataset.id);
    if (button.dataset.action === 'delete') deleteSupplier(button.dataset.id);
  });
  qs('#btnUploadAttachment')?.addEventListener('click', () => state.currentSupplierId
    ? qs('#supplierAttachmentInput')?.click() : showToast('Salve o fornecedor antes de enviar anexos.', 'warning'));
  qs('#supplierAttachmentInput')?.addEventListener('change', async (event) => {
    await uploadAttachments(Array.from(event.currentTarget.files || [])); event.currentTarget.value = '';
  });
  qs('#supplierAttachments')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-attachment-delete]'); if (button) deleteAttachment(button.dataset.attachmentDelete);
  });
  qs('#tax_id')?.addEventListener('input', (event) => { formatCnpjInput(event); clearTimeout(timer); timer = setTimeout(lookupCnpj, 250); });
  qs('#tax_id')?.addEventListener('blur', lookupCnpj);
  qs('#state')?.addEventListener('input', (event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase().slice(0, 2); });
  qs('#cash_category_id')?.addEventListener('change', () => syncSupplierSubcategories(null));
  qs('#btnSearchChartAccount')?.addEventListener('click', searchSupplierChartAccount);
  qs('#chart_account_display')?.addEventListener('click', searchSupplierChartAccount);
  qs('#btnClearChartAccount')?.addEventListener('click', clearSupplierChartAccount);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') showSupplierModal(false); });
}

async function initSuppliers() {
  bindEvents();
  await initializeSupplierFinancialFields();
  await loadSuppliers();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSuppliers, { once: true });
else initSuppliers();
