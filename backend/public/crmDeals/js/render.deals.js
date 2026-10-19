// ╔══════════════════════════════════════════════════════════════════════╗
// ║ render.deals.js — CRM Deals (PRODNEX ERP)                           ║
// ║ renderDeals() + createDealCard()                                    ║
// ║ ✅ CLICK-TO-EDIT: clicar no card abre modal em modo edição          ║
// ║ ✅ Proteção anti-drag                                               ║
// ║ ✅ Exibe origem do lead quando existir                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './state.js';
import {
  alphaBg,
  cssEscape,
  escapeAttr,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatSellerLabel,
  normalizeCode,
} from './helpers.js';
import { dom } from './dom.js';
import { onDragEnd, onDragStart } from './dragdrop.columns.js';
import { openDealModal } from './modal.newCard.js';

export function renderDeals() {
  document
    .querySelectorAll('#crm-kanban-stages .crm-column__body')
    .forEach((col) => { col.innerHTML = ''; });

  const stageIdToNorm = new Map(state.stages.map((s) => [String(s.id), s.code_norm]));

  state.stages.forEach((stage) => {
    const colBody = document.querySelector(
      `#crm-kanban-stages .crm-column__body[data-column-norm="${cssEscape(stage.code_norm)}"]`
    );
    if (!colBody) return;

    const filtered = state.deals.filter((d) => {
      const dNorm = normalizeCode(d.stage_code);
      if (dNorm && dNorm === stage.code_norm) return true;

      const possibleStageId = d.stage_id ?? d.stageId ?? d.stage ?? d.stageID ?? null;
      if (possibleStageId != null) {
        const normFromId = stageIdToNorm.get(String(possibleStageId));
        if (normFromId && normFromId === stage.code_norm) return true;
      }
      return false;
    });

    filtered.forEach((deal) => colBody.appendChild(createDealCard(deal)));

    const counter = document.getElementById(`counter-${escapeAttr(stage.code)}`);
    if (counter) counter.textContent = String(filtered.length);
  });

  // contador final agora representa quantidade de dropzones
  if (dom.counterFinal) {
    dom.counterFinal.textContent = String((state.dealOutcomes || []).length || 0);
  }
}

export function createDealCard(deal) {
  const el = document.createElement('div');
  el.className = 'crm-card';
  el.draggable = true;
  el.dataset.id = String(deal.id);

  const customerName = deal.customer_name || 'Cliente';
  const sellerLabel = formatSellerLabel(deal);

  const statusLabel =
    deal.status_name_pt ||
    deal.status_name ||
    deal.name_pt ||
    deal.tag ||
    'Sem status';

  const statusColor = deal.status_color_hex || deal.color_hex || '#e5e7eb';
  const chipBg = alphaBg(statusColor, 0.12);

  const leadSourceLabel =
    deal.lead_source_name ||
    deal.leadSourceName ||
    '';

  const nextStep = deal.next_step || 'Sem próxima ação';

  el.innerHTML = `
    <div class="crm-card__row-top">
      <div class="crm-card__customer">${escapeHtml(customerName)}</div>
      <div class="crm-card__value">${deal.estimated_value ? formatCurrency(deal.estimated_value) : 'R$ 0,00'}</div>
    </div>

    <div class="crm-card__row-middle crm-card__row-seller">
      <div class="crm-card__seller">Vendedor: ${escapeHtml(sellerLabel)}</div>
      <span class="crm-chip" style="border-color:${escapeAttr(statusColor)}; background:${escapeAttr(chipBg)};">
        ${escapeHtml(statusLabel)}
      </span>
    </div>

    ${
      leadSourceLabel
        ? `
          <div class="crm-card__row-middle crm-card__row-origin">
            <div class="crm-card__seller">Origem: ${escapeHtml(leadSourceLabel)}</div>
            <span class="crm-chip crm-chip--lead">${escapeHtml(leadSourceLabel)}</span>
          </div>
        `
        : ''
    }

    <div class="crm-card__next-step">${escapeHtml(nextStep)}</div>

    <div class="crm-card__footer">
      Última atividade: ${deal.last_activity_date ? formatDate(deal.last_activity_date) : '-'}
    </div>
  `;

  let downX = 0;
  let downY = 0;
  let moved = false;
  let dragging = false;

  el.addEventListener('pointerdown', (e) => {
    downX = e.clientX;
    downY = e.clientY;
    moved = false;
  });

  el.addEventListener('pointermove', (e) => {
    const dx = Math.abs(e.clientX - downX);
    const dy = Math.abs(e.clientY - downY);
    if (dx > 6 || dy > 6) moved = true;
  });

  el.addEventListener('click', (e) => {
    if (dragging || moved) return;

    const ignore = e.target.closest('button, a, input, select, textarea, [data-ignore-card-click]');
    if (ignore) return;

    openDealModal({ mode: 'edit', deal });
  });

  el.addEventListener('dragstart', (ev) => {
    dragging = true;
    onDragStart(ev);
  });

  el.addEventListener('dragend', (ev) => {
    onDragEnd(ev);
    setTimeout(() => { dragging = false; }, 0);
  });

  return el;
}