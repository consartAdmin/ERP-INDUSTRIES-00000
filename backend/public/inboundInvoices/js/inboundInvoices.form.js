/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.form.js — Form + Itens + Parcelas + renders             ║
   ║ PRODNEX ERP | Frontend (ESM)                                    ║
   ║ ✅ Usa product_code canônico do ERP                              ║
   ║ ✅ Nunca usa nf_product_code como fallback de product_code       ║
   ║ ✅ Compatível com STOCK_SIMPLE                                   ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import { getStockMode, isSimpleStockMode, clearItemLotState } from './inboundInvoices.stock.js';

import { buildUnitOptionsHtml } from './inboundInvoices.api.js';

import {
  buildLotOptionsHtml,
  loadGradesByProductCode,
  loadLotsForItem,
  clearLotsCaches,
} from './inboundInvoices.api.js';

function formatDateOnlyBR(value) {
  if (!value) return '';

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  return raw;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function initForm({ core, ROUTES, state, refs, switchTab }) {
  const API_INBOUND = ROUTES.inboundBase();
  let renderVersion = 0;

  function applyReadOnlyMode(readOnly) {
    const enabled = Boolean(readOnly);
    const form = refs.form || document.querySelector('#formInvoice');

    state.inboundInvoiceReadOnly = enabled;
    refs.editModal?.classList.toggle('is-read-only', enabled);

    form?.querySelectorAll('input, textarea, select').forEach((field) => {
      if (field.type === 'hidden') return;

      if (field.matches('select, input[type="checkbox"], input[type="radio"], input[type="file"]')) {
        if (enabled) {
          if (!('inboundPreviousDisabled' in field.dataset)) {
            field.dataset.inboundPreviousDisabled = String(field.disabled);
          }
          field.disabled = true;
        } else if ('inboundPreviousDisabled' in field.dataset) {
          field.disabled = field.dataset.inboundPreviousDisabled === 'true';
          delete field.dataset.inboundPreviousDisabled;
        }
      } else {
        if (enabled) {
          if (!('inboundPreviousReadOnly' in field.dataset)) {
            field.dataset.inboundPreviousReadOnly = String(field.readOnly);
          }
          field.readOnly = true;
        } else if ('inboundPreviousReadOnly' in field.dataset) {
          field.readOnly = field.dataset.inboundPreviousReadOnly === 'true';
          delete field.dataset.inboundPreviousReadOnly;
        }
      }

      field.setAttribute('aria-readonly', String(enabled));
    });

    form?.querySelectorAll('[data-act="link-product"]').forEach((button) => {
      if (enabled) {
        if (!('inboundPreviousDisabled' in button.dataset)) {
          button.dataset.inboundPreviousDisabled = String(button.disabled);
        }
        if (!('inboundPreviousHidden' in button.dataset)) {
          button.dataset.inboundPreviousHidden = String(button.hidden);
        }
        button.disabled = true;
        button.hidden = true;
      } else {
        button.disabled = button.dataset.inboundPreviousDisabled === 'true';
        button.hidden = button.dataset.inboundPreviousHidden === 'true';
        delete button.dataset.inboundPreviousDisabled;
        delete button.dataset.inboundPreviousHidden;
      }
    });

    const saveButton = refs.btnSaveInvoice || document.querySelector('#btnSaveInvoice');
    if (saveButton) {
      saveButton.disabled = enabled;
      saveButton.hidden = enabled;
    }

    const cancelButton = refs.btnCancelForm || document.querySelector('#btnCancelForm');
    if (cancelButton) {
      cancelButton.textContent = enabled ? 'Fechar' : 'Cancelar';
      cancelButton.setAttribute('aria-label', enabled ? 'Fechar visualização' : 'Cancelar edição');
    }
  }

  async function enrichItem(item) {
    if (isSimpleStockMode(state)) {
      clearItemLotState(item);
      return item;
    }

    const productCode = String(item?.product_code ?? '').trim();
    const stockId = item?.product_stock_id ?? item?.stock_id ?? item?.productStockId ?? null;
    const gradeId = item.product_grade_id ?? null;
    // A newer product pick can arrive while the previous request is pending.
    const isCurrent = () =>
      String(item?.product_code ?? '').trim() === productCode &&
      (item?.product_stock_id ?? item?.stock_id ?? item?.productStockId ?? null) === stockId &&
      (item.product_grade_id ?? null) === gradeId;

    try {
      const lots = await loadLotsForItem({ core, ROUTES, state }, item, gradeId);
      let grades = Array.from(new Map(
        lots.filter((lot) => lot.product_grade_id).map((lot) => [
          Number(lot.product_grade_id),
          {
            product_grade_id: Number(lot.product_grade_id),
            grade_id: Number(lot.grade_id || 0) || null,
            name: lot.grade_name || 'Padr\u00e3o',
          },
        ])
      ).values());
      if (!grades.length && productCode) {
        grades = await loadGradesByProductCode({ core, ROUTES, state }, productCode);
      }
      if (!isCurrent()) return item;
      item._lots = lots;
      item._grades = grades;
      item._lotsLoadError = null;

      if (!state.inboundInvoiceReadOnly) {
        let selected = lots.find((lot) => Number(lot.lot_id) === Number(item.lot_id));
        if (!selected && lots.length === 1) selected = lots[0];
        item.lot_id = selected?.lot_id ?? null;
        if (selected) {
          item.product_grade_id = selected.product_grade_id ?? null;
          item.grade_id = selected.grade_id ?? null;
        }
      }
    } catch (error) {
      if (!isCurrent()) return item;
      item._lots = [];
      item._grades = [];
      item._lotsLoadError = error?.message || 'Falha ao consultar lotes.';
      if (!state.inboundInvoiceReadOnly) item.lot_id = null;
      console.error('[INBOUND][LOTS_LOAD_ERROR]', { productCode, stockId, error });
    }
    return item;
  }

  async function renderItemsTable(items) {
    if (!refs.itemsTbody) return;
    const currentRender = ++renderVersion;

    refs.itemsTbody.innerHTML = '';

    const simpleMode = isSimpleStockMode(state);

    document.querySelectorAll('[data-role="lot-column"]').forEach((element) => {
      element.hidden = simpleMode;
      element.style.display = simpleMode ? 'none' : '';
    });

    if (!items || !items.length) {
      if (refs.itemsEmpty) refs.itemsEmpty.style.display = '';
      return;
    }

    if (refs.itemsEmpty) refs.itemsEmpty.style.display = 'none';

    console.log('[INBOUND][STOCK_MODE][RESOLVED]', {
      stockMode: state?.stockMode ?? null,
      productStockMode: state?.productStockMode ?? null,
      PRODUCT_STOCK_MODE: state?.PRODUCT_STOCK_MODE ?? null,
      resolvedMode: getStockMode(state),
      simpleMode,
    });

    for (const [idx, originalItem] of items.entries()) {
      const item = await enrichItem(originalItem);
      if (currentRender !== renderVersion) return;

      const tr = document.createElement('tr');

      const finalLots = Array.isArray(item._lots) ? item._lots : [];
      const lotOptions = simpleMode
        ? ''
        : buildLotOptionsHtml({ core }, finalLots, item.lot_id);

      const erpProductCode = String(item?.product_code ?? '').trim();
      const erpProductDescription = String(
        item?.product_description ??
        item?.product_name ??
        item?.erp_description ??
        ''
      ).trim();
      const erpProductLabel = erpProductCode
        ? `${erpProductCode}${erpProductDescription ? ` — ${erpProductDescription}` : ''}`
        : 'Nenhum produto vinculado';

      tr.innerHTML = `
        <td>${idx + 1}</td>

        <td>${item.nf_product_code ?? ''}</td>

        <td>
          <div class="table-cell-inline">
            <span class="table-cell-inline__text">
              ${escapeHtml(erpProductLabel)}
            </span>

            <button
              type="button"
              class="btn btn-lookup btn-icon-xs table-cell-inline__action"
              data-act="link-product"
              data-index="${idx}"
              title="Vincular produto"
              aria-label="Vincular produto"
              style="
                width:20px !important;
                min-width:20px !important;
                max-width:20px !important;
                height:20px !important;
                min-height:20px !important;
                max-height:20px !important;
                padding:0 !important;
                margin:0 !important;
                font-size:8px !important;
                line-height:1 !important;
                flex:0 0 20px !important;
                box-sizing:border-box !important;
              "
            >
              <span style="font-size:8px !important; line-height:1 !important;">🔍</span>
            </button>
          </div>
        </td>

        ${simpleMode ? '' : `
        <td>
          <select
            class="form-control form-control-sm"
            data-role="lot-select"
            data-index="${idx}"
            ${(!erpProductCode || item._lotsLoadError ? 'disabled' : '')}
          >
            ${lotOptions}
          </select>

          <div class="muted" style="font-size:.75rem; margin-top:2px;">
            ${escapeHtml(item._lotsLoadError || (erpProductCode ? 'Lote obrigat\u00f3rio' : 'Vincule o produto'))}
          </div>
        </td>
        `}

        <td>${item.description || ''}</td>
        <td>${item.ncm || ''}</td>
        <td>${item.cfop || ''}</td>

        <td>
          <select
            class="form-control form-control-sm"
            data-role="unit-select"
            data-index="${idx}"
          >
            ${buildUnitOptionsHtml({ state }, item.unit)}
          </select>
        </td>

        <td>${item.quantity ?? ''}</td>
        <td>${item.unit_price != null ? Number(item.unit_price).toFixed(2) : ''}</td>
        <td>${item.total_price != null ? Number(item.total_price).toFixed(2) : ''}</td>
        <td>${item.ipi != null ? Number(item.ipi).toFixed(2) : ''}</td>
        <td>${item.icms != null ? Number(item.icms).toFixed(2) : ''}</td>
      `;

      tr.dataset.productGradeId = item.product_grade_id || '';
      tr.dataset.productId = item.product_id || '';
      tr.dataset.productCode = erpProductCode;

      refs.itemsTbody.appendChild(tr);
    }

    applyReadOnlyMode(Boolean(state.inboundInvoiceReadOnly));
  }

  function renderInstallmentsTable(rows) {
    const list = Array.isArray(rows) ? rows : [];

    refs.instTbody.innerHTML = '';

    list.forEach((it, idx) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${it.installment_code || ''}</td>
        <td>${formatDateOnlyBR(it.due_date)}</td>
        <td>${it.amount != null ? Number(it.amount).toFixed(2) : ''}</td>
        <td>${it.is_paid ? 'Sim' : 'Não'}</td>
      `;

      refs.instTbody.appendChild(tr);
    });

    if (refs.instEmpty) refs.instEmpty.hidden = list.length > 0;
  }

  async function resetFormState() {
    applyReadOnlyMode(false);
    refs.form?.reset?.();

    if (refs.fldId) refs.fldId.value = '';
    if (refs.xmlFileInput) refs.xmlFileInput.value = '';

    state.currentItems = [];
    state.currentInstallments = [];

    clearLotsCaches(state);

    await renderItemsTable(state.currentItems);
    renderInstallmentsTable(state.currentInstallments);
  }

  async function openFormNew() {
    await resetFormState();

    applyReadOnlyMode(false);

    switchTab('form');
  }

  async function openFormEdit(id) {
    const inboundId = Number(id);
    if (!Number.isInteger(inboundId) || inboundId <= 0) {
      return core.toast.error('Erro', 'Identificador da nota inválido.');
    }

    clearLotsCaches(state);
    applyReadOnlyMode(true);
    switchTab('form');

    refs.editModal?.classList.add('is-loading');
    refs.editModal?.setAttribute('aria-busy', 'true');

    if (refs.editModalTitle) refs.editModalTitle.textContent = 'Carregando NF-e de entrada…';
    if (refs.editModalSubtitle) refs.editModalSubtitle.textContent = `Registro #${inboundId}`;

    try {
      const [invoiceRes, itemsRes, installmentsRes] = await Promise.all([
        fetch(`${API_INBOUND}/${encodeURIComponent(inboundId)}`),
        fetch(`${API_INBOUND}/${encodeURIComponent(inboundId)}/items`),
        fetch(`${API_INBOUND}/${encodeURIComponent(inboundId)}/installments`),
      ]);

      const [row, itemsJson, installmentsJson] = await Promise.all([
        invoiceRes.json().catch(() => null),
        itemsRes.json().catch(() => []),
        installmentsRes.json().catch(() => []),
      ]);

      if (!invoiceRes.ok || !row) {
        throw new Error(row?.error || row?.detail || 'Não foi possível abrir a nota.');
      }

      if (!itemsRes.ok) {
        console.warn('[INBOUND][EDIT_MODAL][ITEMS_ERROR]', itemsJson);
      }

      if (!installmentsRes.ok) {
        console.warn('[INBOUND][EDIT_MODAL][INSTALLMENTS_ERROR]', installmentsJson);
      }

      const resolvedId = row.inbound_id ?? row.id ?? inboundId;
      refs.fldId.value = resolvedId;
      refs.fldKey.value = row.access_key || '';
      refs.fldNum.value = row.invoice_number || '';
      refs.fldSeries.value = row.series || '';
      refs.fldIssuer.value = row.issuer || '';
      refs.fldRec.value = row.recipient || '';
      refs.fldTotal.value = row.total_amount ?? 0;
      if (refs.fldIssueDate) refs.fldIssueDate.value = String(row.issue_date || '').slice(0, 10);
      if (refs.fldEntryDate) refs.fldEntryDate.value = String(row.entry_date || '').slice(0, 10);
      if (refs.fldStatus) refs.fldStatus.value = row.status || '';

      state.currentItems = (Array.isArray(itemsJson) ? itemsJson : []).map((it) => ({
        ...it,
        inbound_item_id: it.inbound_item_id ?? it.id ?? null,
        id: it.id ?? it.inbound_item_id ?? null,
        nf_product_code: it.nf_product_code ?? null,
        product_code: it.product_code ?? null,
        product_description:
          it.product_description ?? it.product_name ?? it.erp_description ?? null,
        product_id: it.product_id ?? null,
        product_stock_id: it.product_stock_id ?? null,
        product_grade_id: isSimpleStockMode(state) ? null : (it.product_grade_id ?? null),
        lot_id: isSimpleStockMode(state) ? null : (it.lot_id ?? null),
        _lots: [],
        _grades: [],
      }));

      state.currentInstallments = Array.isArray(installmentsJson)
        ? installmentsJson.map((installment) => ({
          ...installment,
          inbound_installment_id:
            installment.inbound_installment_id ?? installment.id ?? null,
          id: installment.id ?? installment.inbound_installment_id ?? null,
        }))
        : [];

      await renderItemsTable(state.currentItems);
      renderInstallmentsTable(state.currentInstallments);
      applyReadOnlyMode(true);

      if (refs.editModalTitle) {
        refs.editModalTitle.textContent = `NF-e de Entrada ${row.invoice_number || ''}`.trim();
      }
      if (refs.editModalSubtitle) {
        refs.editModalSubtitle.textContent =
          `Somente leitura • ID ${resolvedId} • Série ${row.series || '-'} • ${row.supplier_name || row.issuer || 'Fornecedor não identificado'}`;
      }

      refs.btnCloseInvoiceModal?.focus();
    } catch (error) {
      console.error('[INBOUND][EDIT_MODAL][OPEN_ERROR]', error);
      switchTab('list');
      core.toast.error('Erro', error?.message || 'Não foi possível abrir a nota.');
    } finally {
      refs.editModal?.classList.remove('is-loading');
      refs.editModal?.removeAttribute('aria-busy');
    }
  }

  async function closeEditModal({ reload = false } = {}) {
    await resetFormState();
    switchTab('list');
    if (reload) await state.actions.loadInvoices?.();
  }

  refs.form?.addEventListener('submit', (event) => {
    if (!state.inboundInvoiceReadOnly) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    core.toast.warn('Somente leitura', 'Esta nota de entrada não pode ser alterada.');
  }, true);

  refs.btnCancelForm?.addEventListener('click', async () => {
    await closeEditModal({ reload: true });
  });

  refs.btnCloseInvoiceModal?.addEventListener('click', () => {
    void closeEditModal();
  });

  refs.editModal?.addEventListener('mousedown', (event) => {
    if (event.target === refs.editModal) void closeEditModal();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || refs.editModal?.hidden) return;
    event.preventDefault();
    void closeEditModal();
  });

  refs.itemsTbody?.addEventListener('change', (ev) => {
    if (state.inboundInvoiceReadOnly) return;

    const sel = ev.target.closest('select[data-role="unit-select"]');
    if (!sel) return;

    const idx = Number(sel.dataset.index);
    if (!state.currentItems[idx]) return;

    state.currentItems[idx].unit = sel.value || null;
  });

  refs.itemsTbody?.addEventListener('change', async (ev) => {
    if (state.inboundInvoiceReadOnly) return;
    if (isSimpleStockMode(state)) return;

    const sel = ev.target.closest('select[data-role="grade-select"]');
    if (!sel) return;

    const idx = Number(sel.dataset.index);
    const item = state.currentItems[idx];
    if (!item) return;

    item.product_grade_id = Number(sel.value || 0) || null;
    item.lot_id = null;

    await enrichItem(item);
    if (state.inboundInvoiceReadOnly || state.currentItems[idx] !== item) return;

    const tr = sel.closest('tr');
    const lotSelect = tr?.querySelector('select[data-role="lot-select"]');

    if (lotSelect) {
      lotSelect.innerHTML = buildLotOptionsHtml(
        { core },
        item._lots,
        item.lot_id
      );
      lotSelect.disabled = !String(item.product_code ?? '').trim() || Boolean(item._lotsLoadError);
    }
  });

  refs.itemsTbody?.addEventListener('change', (ev) => {
    if (state.inboundInvoiceReadOnly) return;
    if (isSimpleStockMode(state)) return;

    const sel = ev.target.closest('select[data-role="lot-select"]');
    if (!sel) return;

    const idx = Number(sel.dataset.index);
    const item = state.currentItems[idx];
    if (!item) return;

    const opt = sel.options[sel.selectedIndex];

    const lotId = sel.value ? Number(sel.value) : null;
    const productGradeId = opt?.dataset?.productGradeId
      ? Number(opt.dataset.productGradeId)
      : null;

    const gradeId = opt?.dataset?.gradeId
      ? Number(opt.dataset.gradeId)
      : null;

    item.lot_id = lotId;
    item.product_grade_id = productGradeId;
    item.grade_id = gradeId;

    const tr = sel.closest('tr');
    if (tr) {
      tr.dataset.productGradeId = productGradeId || '';
      tr.dataset.gradeId = gradeId || '';
    }

    console.log('[INBOUND][LOT_SELECT][GRADE_IMPORTED]', {
      idx,
      lot_id: item.lot_id,
      product_grade_id: item.product_grade_id,
      grade_id: item.grade_id,
    });
  });

  state.actions.openFormNew = openFormNew;
  state.actions.openFormEdit = openFormEdit;
  state.actions.resetFormState = resetFormState;
  state.actions.renderItemsTable = renderItemsTable;
  state.actions.renderInstallmentsTable = renderInstallmentsTable;
  state.actions.applyInvoiceReadOnlyMode = applyReadOnlyMode;
}
