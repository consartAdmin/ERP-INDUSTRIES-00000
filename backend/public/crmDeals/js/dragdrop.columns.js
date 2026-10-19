// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dragdrop.columns.js — CRM Deals (PRODNEX ERP)                       ║
// ║ Drag & drop entre colunas                                            ║
// ║                                                                      ║
// ║ ✔ stage_id sempre numérico                                           ║
// ║ ✔ fallback seguro de stage_code                                      ║
// ║ ✔ rollback automático se API falhar                                  ║
// ║ ✔ prevenção de stage inválido                                        ║
// ║ ✔ evita duplicação de listeners ao re-renderizar                     ║
// ║ ✔ logs de depuração claros                                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state, setDeals, setDraggedId } from './state.js';
import { normalizeCode, cssEscape } from './helpers.js';
import { moveDealToStage } from './api.js';
import { renderDeals } from './render.deals.js';
import { loadDeals } from './loaders.js';

/* --------------------------------------------------------------------- */
/* Helpers                                                               */
/* --------------------------------------------------------------------- */

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getCardByDealId(dealId) {

  if (!dealId) return null;

  try {
    return document.querySelector(`.crm-card[data-id="${cssEscape(String(dealId))}"]`);
  } catch (err) {
    console.error('[CRM][DND] Falha ao localizar card:', err);
    return null;
  }

}

function getColumnMeta(col) {

  if (!col) {
    return {
      stageId: null,
      stageCodeRaw: '',
      stageNorm: '',
    };
  }

  const stageCodeRaw = String(
    col.dataset.stageCode ||
    col.dataset.column ||
    ''
  ).trim();

  const stageNorm = normalizeCode(
    col.dataset.columnNorm ||
    stageCodeRaw
  );

  const stageId = toPositiveNumber(
    col.dataset.stageId
  );

  return {
    stageId,
    stageCodeRaw,
    stageNorm,
  };

}

function snapshotDeals(deals) {

  if (!Array.isArray(deals)) return [];

  return deals.map((d) => ({ ...d }));

}

function updateDealStageInState(dealId, payload) {

  const currentDeals = Array.isArray(state.deals) ? state.deals : [];

  const nextDeals = currentDeals.map((deal) => {

    if (String(deal.id) !== String(dealId)) return deal;

    return {
      ...deal,
      ...payload,
    };

  });

  setDeals(nextDeals);

}

function clearAllDragHoverStates() {

  document
    .querySelectorAll('#crm-kanban-stages .crm-column__body.crm-column__body--drag-over')
    .forEach((el) => el.classList.remove('crm-column__body--drag-over'));

}

/* --------------------------------------------------------------------- */
/* Attach eventos dinamicamente nas colunas                              */
/* --------------------------------------------------------------------- */

export function attachDynamicEvents() {

  document
    .querySelectorAll('#crm-kanban-stages .crm-column__body')
    .forEach((col) => {

      if (col.dataset.boundDragdrop === '1') return;

      col.dataset.boundDragdrop = '1';

      col.addEventListener('dragover', onDragOverColumn);
      col.addEventListener('drop', onDropColumn);
      col.addEventListener('dragleave', onDragLeaveColumn);

    });

}

/* --------------------------------------------------------------------- */
/* Drag Start                                                            */
/* --------------------------------------------------------------------- */

export function onDragStart(e) {

  const card = e.currentTarget;
  const draggedId = String(card?.dataset?.id || '').trim();

  setDraggedId(draggedId || null);

  if (e.dataTransfer && draggedId) {

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.dropEffect = 'move';
    e.dataTransfer.setData('text/plain', draggedId);

  }

  card?.classList?.add('crm-card--dragging');

}

/* --------------------------------------------------------------------- */
/* Drag End                                                              */
/* --------------------------------------------------------------------- */

export function onDragEnd(e) {

  e?.currentTarget?.classList?.remove('crm-card--dragging');

  clearAllDragHoverStates();

  setDraggedId(null);

}

/* --------------------------------------------------------------------- */
/* Drag Over                                                             */
/* --------------------------------------------------------------------- */

function onDragOverColumn(e) {

  e.preventDefault();

  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }

  e.currentTarget.classList.add('crm-column__body--drag-over');

}

/* --------------------------------------------------------------------- */
/* Drag Leave                                                            */
/* --------------------------------------------------------------------- */

function onDragLeaveColumn(e) {

  const col = e.currentTarget;
  const related = e.relatedTarget;

  if (related && col.contains(related)) return;

  col.classList.remove('crm-column__body--drag-over');

}

/* --------------------------------------------------------------------- */
/* Drop                                                                  */
/* --------------------------------------------------------------------- */

async function onDropColumn(e) {

  e.preventDefault();

  const targetCol = e.currentTarget;
  targetCol.classList.remove('crm-column__body--drag-over');

  const draggedId = String(
    e.dataTransfer?.getData('text/plain') ||
    state.draggedId ||
    ''
  ).trim();

  if (!draggedId) {

    console.warn('[CRM][DND] Drop ignorado: sem ID.');

    setDraggedId(null);
    return;

  }

  const cardEl = getCardByDealId(draggedId);

  if (!cardEl) {

    console.warn('[CRM][DND] Card não encontrado:', draggedId);

    setDraggedId(null);
    return;

  }

  const fromCol = cardEl.closest('.crm-column__body');

  const fromMeta = getColumnMeta(fromCol);
  const toMeta = getColumnMeta(targetCol);

  console.log('[CRM][DND] Drop', {
    dealId: draggedId,
    from: fromMeta,
    to: toMeta,
  });

  if (!toMeta.stageId || !toMeta.stageCodeRaw) {

    console.error('[CRM][DND] Stage inválido:', targetCol.dataset);

    setDraggedId(null);
    return;

  }

  const sameStageById =
    fromMeta.stageId &&
    toMeta.stageId &&
    Number(fromMeta.stageId) === Number(toMeta.stageId);

  const sameStageByNorm =
    fromMeta.stageNorm &&
    toMeta.stageNorm &&
    fromMeta.stageNorm === toMeta.stageNorm;

  if (sameStageById || sameStageByNorm) {

    console.log('[CRM][DND] Mesmo stage, ignorando drop.');

    setDraggedId(null);
    return;

  }

  const currentDeals = Array.isArray(state.deals) ? state.deals : [];

  const currentDeal = currentDeals.find(
    (d) => String(d.id) === String(draggedId)
  );

  if (!currentDeal) {

    console.warn('[CRM][DND] Deal não encontrado no state:', draggedId);

    setDraggedId(null);
    return;

  }

  const prevDeals = snapshotDeals(currentDeals);

  updateDealStageInState(draggedId, {
    stage_id: toMeta.stageId,
    stage_code: toMeta.stageCodeRaw,
    stage_code_norm: toMeta.stageNorm,
  });

  renderDeals();

  try {

    const moved = await moveDealToStage(
      draggedId,
      toMeta.stageCodeRaw,
      toMeta.stageId
    );

    if (!moved?.ok) {

      console.error('[CRM][DND] Falha API:', moved?.error || moved);

      setDeals(prevDeals);
      renderDeals();
      setDraggedId(null);
      return;

    }

  } catch (err) {

    console.error('[CRM][DND] Exceção API:', err);

    setDeals(prevDeals);
    renderDeals();
    setDraggedId(null);
    return;

  }

  try {

    await loadDeals();
    renderDeals();

  } catch (err) {

    console.error('[CRM][DND] Falha reload:', err);

  } finally {

    setDraggedId(null);

  }

}