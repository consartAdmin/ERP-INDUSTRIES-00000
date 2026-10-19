// ╔══════════════════════════════════════════════════════════════╗
// ║ deliveryLabels.actions.js — Ações e eventos da tela         ║
// ║ PRODNEX ERP | Frontend ESM                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { openOrdersSearchModal } from '../../modalsSearch/ordersModalSearch.js';
import { openBudgetsModal } from '../../modalsSearch/budgetsModal.js';
import { openInvoicesIssuedSearchModal } from '../../modalsSearch/invoicesIssuedModalSearch.js';
import { IMPORT_SOURCES } from './deliveryLabels.config.js';
import {
  buildPrintUrl,
  createDeliveryLabel,
  deleteDeliveryLabel,
  importDeliveryLabel,
  listDeliveryLabels,
  updateDeliveryLabel
} from './deliveryLabels.api.js';
import {
  getEditingLabelId,
  getLabelFormData
} from './deliveryLabels.form.js';
import { buildFilters } from './deliveryLabels.filters.js';
import {
  closeLabelModal,
  isBackdropClick,
  isModalOpen,
  openLabelModal
} from './deliveryLabels.modal.js';
import {
  deliveryLabelsState,
  setLabelsResult,
  setSelectedSource
} from './deliveryLabels.state.js';
import {
  getSelectedLabelIds,
  renderLoading,
  renderPagination,
  renderTable,
  toggleAllRows
} from './deliveryLabels.render.js';
import {
  assertRequiredElements,
  getDeliveryLabelsElements,
  reportError,
  toPositiveInteger
} from './deliveryLabels.utils.js';
import { validateLabelData } from './deliveryLabels.validation.js';
import { initializeLabelSettings } from './deliveryLabels.settings.js';

let elements;

export async function initializeDeliveryLabels() {
  elements = getDeliveryLabelsElements();
  assertRequiredElements(elements);
  setupEvents();
  initializeLabelSettings();
  await loadDeliveryLabels();
}

export async function loadDeliveryLabels({ resetPage = false } = {}) {
  if (deliveryLabelsState.loading) return;
  if (resetPage) deliveryLabelsState.page = 1;

  deliveryLabelsState.loading = true;
  renderLoading(elements);
  renderPagination(elements, deliveryLabelsState);

  try {
    const result = await listDeliveryLabels({
      ...buildFilters(elements),
      page: deliveryLabelsState.page,
      rowsPerPage: deliveryLabelsState.rowsPerPage
    });

    setLabelsResult(result);
    renderTable(elements, deliveryLabelsState.labels);
  } catch (error) {
    deliveryLabelsState.labels = [];
    renderTable(elements, []);
    reportError('loadDeliveryLabels', error, 'Erro ao carregar etiquetas');
  } finally {
    deliveryLabelsState.loading = false;
    renderPagination(elements, deliveryLabelsState);
  }
}

function setupEvents() {
  elements.btnBuscar.addEventListener('click', () => loadDeliveryLabels({ resetPage: true }));
  elements.filtroBusca.addEventListener('keydown', handleSearchKeydown);
  elements.filtroStatus.addEventListener('change', () => loadDeliveryLabels({ resetPage: true }));
  elements.importSource.addEventListener('change', resetImportSelection);
  elements.btnBuscarPedido.addEventListener('click', searchSource);
  elements.btnImportarPedido.addEventListener('click', importSelected);
  elements.btnNovaEtiqueta.addEventListener('click', () => openLabelModal(elements));
  elements.btnImprimirSelecionadas.addEventListener('click', printSelected);
  elements.btnFecharModal.addEventListener('click', () => closeLabelModal(elements));
  elements.btnCancelar.addEventListener('click', () => closeLabelModal(elements));
  elements.modalEtiqueta.addEventListener('click', handleModalBackdropClick);
  elements.formEtiqueta.addEventListener('submit', saveLabel);
  elements.tableBody.addEventListener('click', handleTableClick);
  elements.checkTodos.addEventListener('change', () => toggleAllRows(elements.checkTodos.checked));
  elements.btnPreviousPage.addEventListener('click', previousPage);
  elements.btnNextPage.addEventListener('click', nextPage);
  elements.apRowsPerPage.addEventListener('change', changeRowsPerPage);
  document.addEventListener('keydown', handleEscapeKey);
}

function handleSearchKeydown(event) {
  if (event.key === 'Enter') loadDeliveryLabels({ resetPage: true });
}

async function saveLabel(event) {
  event.preventDefault();

  const id = getEditingLabelId();
  const data = getLabelFormData();

  const validation = validateLabelData(data);

  if (!validation.valid) {
    window.alert(validation.message);
    return;
  }

  try {
    if (id) await updateDeliveryLabel(id, data);
    else await createDeliveryLabel(data);

    closeLabelModal(elements);
    await loadDeliveryLabels();
  } catch (error) {
    reportError('saveLabel', error, 'Erro ao salvar etiqueta');
  }
}

/* ──────────────────────────────────────────────────────────
   Importação: Pedido | Orçamento | Nota Fiscal emitida
────────────────────────────────────────────────────────── */

function currentSource() {
  return IMPORT_SOURCES[elements.importSource.value] ? elements.importSource.value : 'order';
}

function resetImportSelection() {
  setSelectedSource(null);
  elements.inputOrderId.value = '';
  elements.inputOrderId.placeholder = IMPORT_SOURCES[currentSource()].placeholder;
}

// Abre o modal de busca da origem e normaliza o resultado para { id, label }
async function pickFromSource(source) {
  if (source === 'budget') {
    // budgetsModal usa callback (onSelect) em vez de Promise
    const row = await new Promise((resolve) => {
      openBudgetsModal({
        subtitle: 'Selecione um orçamento para gerar a etiqueta de entrega.',
        onSelect: resolve
      });
    });

    return row?.budget_id
      ? { id: row.budget_id, label: `Orçamento #${row.budget_id} — ${row.customer_name || ''}`.trim() }
      : null;
  }

  if (source === 'invoice') {
    const row = await openInvoicesIssuedSearchModal();

    return row?.invoice_id
      ? {
        id: row.invoice_id,
        label: `NF-e ${row.nfe_number ?? `#${row.invoice_id}`} — ${row.customer_name || ''}`.trim()
      }
      : null;
  }

  const result = await openOrdersSearchModal({ limit: 20 });
  const orderId = result?.header?.order_id;

  return orderId
    ? { id: orderId, label: `Pedido #${orderId} — ${result.header.customer_name || ''}`.trim() }
    : null;
}

async function searchSource() {
  const source = currentSource();

  try {
    const picked = await pickFromSource(source);
    if (!picked) return;

    setSelectedSource({ source, ...picked });
    elements.inputOrderId.value = picked.label;
  } catch (error) {
    reportError('searchSource', error, `Erro ao buscar ${IMPORT_SOURCES[source].noun}`);
  }
}

async function importSelected() {
  const selected = deliveryLabelsState.selectedSource;

  if (!selected?.id) {
    window.alert(`Busque e selecione um(a) ${IMPORT_SOURCES[currentSource()].noun} primeiro.`);
    return;
  }

  try {
    await importDeliveryLabel(selected.source, selected.id);
    resetImportSelection();
    await loadDeliveryLabels({ resetPage: true });
  } catch (error) {
    reportError('importSelected', error, `Erro ao importar ${IMPORT_SOURCES[selected.source].noun}`);
  }
}

function printIds(ids) {
  if (!ids.length) {
    window.alert('Selecione pelo menos uma etiqueta para imprimir.');
    return;
  }

  window.open(buildPrintUrl(ids), '_blank', 'noopener');
}

function printSelected() {
  printIds(getSelectedLabelIds());
}

async function removeLabel(id) {
  if (!window.confirm(`Deseja excluir a etiqueta #${id}?`)) return;

  try {
    await deleteDeliveryLabel(id);

    if (deliveryLabelsState.labels.length === 1 && deliveryLabelsState.page > 1) {
      deliveryLabelsState.page -= 1;
    }

    await loadDeliveryLabels();
  } catch (error) {
    reportError('removeLabel', error, 'Erro ao excluir etiqueta');
  }
}

function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const id = Number(button.dataset.id);
  const row = deliveryLabelsState.labels.find(
    (item) => Number(item.delivery_label_id) === id
  );

  if (button.dataset.action === 'edit' && row) openLabelModal(elements, row);
  else if (button.dataset.action === 'print') printIds([id]);
  else if (button.dataset.action === 'delete') void removeLabel(id);
}

function handleModalBackdropClick(event) {
  if (isBackdropClick(event)) closeLabelModal(elements);
}

function handleEscapeKey(event) {
  if (event.key === 'Escape' && isModalOpen(elements.modalEtiqueta)) {
    closeLabelModal(elements);
  }
}

function previousPage() {
  if (deliveryLabelsState.page <= 1) return;
  deliveryLabelsState.page -= 1;
  void loadDeliveryLabels();
}

function nextPage() {
  if (deliveryLabelsState.page >= deliveryLabelsState.totalPages) return;
  deliveryLabelsState.page += 1;
  void loadDeliveryLabels();
}

function changeRowsPerPage() {
  deliveryLabelsState.rowsPerPage = toPositiveInteger(elements.apRowsPerPage.value, 20);
  void loadDeliveryLabels({ resetPage: true });
}
