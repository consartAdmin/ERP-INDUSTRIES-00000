// ╔══════════════════════════════════════════════════════════════════════╗
// ║ dropzones.conclusion.js — CRM Deals (PRODNEX ERP)                   ║
// ║ Dropzones de conclusão + Summary                                    ║
// ║                                                                      ║
// ║ ✅ Conclusão do Lead baseada em crmDealsOutcomes                      ║
// ║ ✅ Queda de venda usa modal.lossReason.js                            ║
// ║ ✅ Drop final usa POST /deals/:id/outcome                            ║
// ║ ✅ Rollback se API falhar                                            ║
// ║ ✅ Refresh Summary sem cache                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './dom.js';
import { state, setDeals } from './state.js';
import { alphaBg, escapeAttr, escapeHtml } from './helpers.js';
import { apiRegisterOutcome } from './api.js';
import { loadDeals, loadOutcomesSummary } from './loaders.js';
import { renderDeals } from './render.deals.js';
import {
  openLossReasonModal,
  ensureLossReasonModalBindings,
} from './modal.lossReason.js';

export {
  renderLeadConclusionZones,
  attachConclusionDropzones,
  mergeDealOutcomesWithSummary,
  renderOutcomesSummary,
  ensureLossReasonModalBindings,
};

/* --------------------------------------------------------------------- */
/* Mapeia code/id do catálogo para outcome_type do backend               */
/* --------------------------------------------------------------------- */

function mapOutcomeCodeToType(code, id = null) {
  const raw = String(code || '').trim().toLowerCase();

  if (raw === 'won_sale' || raw === 'conversion' || raw === 'won') {
    return 'CONVERSION';
  }

  if (raw === 'sales_drop' || raw === 'loss' || raw === 'lost') {
    return 'LOSS';
  }

  if (
    raw === 'lost_no_contact' ||
    raw === 'no_success_contact' ||
    raw === 'no_contact'
  ) {
    return 'NO_SUCCESS_CONTACT';
  }

  if (Number(id) === 1) return 'NO_SUCCESS_CONTACT';
  if (Number(id) === 2) return 'LOSS';
  if (Number(id) === 3) return 'CONVERSION';

  return 'LOSS';
}

function isLossOutcome(code, id = null) {
  return mapOutcomeCodeToType(code, id) === 'LOSS';
}

/* --------------------------------------------------------------------- */
/* Render Dropzones                                                      */
/* --------------------------------------------------------------------- */

function renderLeadConclusionZones() {
  if (!dom.conclusionZones) return;

  const list = Array.isArray(state.dealOutcomes) ? state.dealOutcomes : [];

  if (!list.length) {
    dom.conclusionZones.innerHTML = `
      <div class="crm-outcomes-summary__placeholder" style="padding:10px;">
        Nenhuma conclusão carregada.
      </div>
    `;
    if (dom.counterFinal) dom.counterFinal.textContent = '0';
    return;
  }

  dom.conclusionZones.innerHTML = list
    .map((item) => {
      const id = Number(item.id);
      if (!Number.isFinite(id)) return '';

      const name = item.name || `Conclusão #${item.id}`;
      const code = item.code || '';
      const icon = item.icon || '';
      const color = item.color || '#cbd5e1';

      return `
        <div class="crm-outcome-dropzone"
             data-outcome-id="${escapeAttr(String(id))}"
             data-outcome-code="${escapeAttr(code)}"
             style="border-color:${escapeAttr(color)};">
          <div class="crm-outcome-title">${escapeHtml([icon, name].filter(Boolean).join(' '))}</div>
          <div class="crm-outcome-subtitle">Solte aqui os cards desta conclusão</div>
          ${code ? `<div class="crm-outcome-code">${escapeHtml(code)}</div>` : ''}
        </div>
      `;
    })
    .join('');

  if (dom.counterFinal) {
    dom.counterFinal.textContent = String(list.length);
  }

  ensureLossReasonModalBindings();
}

/* --------------------------------------------------------------------- */
/* Attach Drag & Drop                                                    */
/* --------------------------------------------------------------------- */

function attachConclusionDropzones() {
  const zones = dom.conclusionZones?.querySelectorAll?.('.crm-outcome-dropzone');
  if (!zones || !zones.length) return;

  zones.forEach((zone) => {
    if (zone.dataset.bound === '1') return;
    zone.dataset.bound = '1';

    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('crm-dropzone--over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('crm-dropzone--over');
    });

    zone.addEventListener('drop', async (e) => {
      e.preventDefault();
      zone.classList.remove('crm-dropzone--over');

      const id =
        (e.dataTransfer?.getData('text/plain') || state.draggedId || '').trim();

      if (!id) return;

      const outcomeId = Number(zone.dataset.outcomeId || '');
      const outcomeCode = String(zone.dataset.outcomeCode || '').trim();

      if (!Number.isFinite(outcomeId)) {
        console.error('[CRM] outcomeId inválido');
        return;
      }

      const outcomeType = mapOutcomeCodeToType(outcomeCode, outcomeId);

      let extraPayload = {};

      if (isLossOutcome(outcomeCode, outcomeId)) {
        const lossData = await openLossReasonModal();

        if (!lossData) return;

        const parsedLossReasonId = Number(lossData.loss_reason_id);

        if (!Number.isFinite(parsedLossReasonId) || parsedLossReasonId <= 0) {
          console.warn('[CRM] Motivo de perda inválido:', lossData);
          return;
        }

        extraPayload = {
          loss_reason_id: parsedLossReasonId,
          note: lossData.note || null,
        };
      }

      const prevDeals = Array.isArray(state.deals) ? [...state.deals] : [];

      setDeals(prevDeals.filter((d) => String(d.id) !== String(id)));
      renderDeals();

      const payload = {
        outcome_id: outcomeId,
        outcome_type: outcomeType,
        ...extraPayload,
      };

      console.log('[CRM] Registering outcome', { deal_id: id, payload });

      const result = await apiRegisterOutcome(id, payload);

      if (!result?.ok) {
        console.error('[CRM] Falha ao registrar outcome:', result?.error || result);

        setDeals(prevDeals);
        renderDeals();

        try {
          await loadOutcomesSummary();
        } catch (_) {}

        return;
      }

      try {
        await loadDeals();
        renderDeals();
        await loadOutcomesSummary();
      } catch (err) {
        console.error('[CRM] Falha ao atualizar board após outcome:', err);
      }
    });
  });
}

/* --------------------------------------------------------------------- */
/* Summary helpers                                                       */
/* --------------------------------------------------------------------- */

function mergeDealOutcomesWithSummary(outcomesList, summary) {
  const list = Array.isArray(outcomesList) ? outcomesList : [];
  const data = summary || {};

  return list
    .map((item) => {
      const normalizedType = mapOutcomeCodeToType(item.code, item.id);

      let count = 0;
      let total = 0;

      if (normalizedType === 'CONVERSION') {
        count = Number(data.count_converted || 0);
        total = Number(data.total_converted || 0);
      } else if (normalizedType === 'LOSS') {
        count = Number(data.count_lost || 0);
        total = Number(data.total_lost || 0);
      } else if (normalizedType === 'NO_SUCCESS_CONTACT') {
        count = Number(data.count_no_success_contact || 0);
        total = Number(data.total_no_success_contact || 0);
      }

      return {
        id: Number(item.id),
        name: item.name || `Conclusão #${item.id}`,
        code: item.code || '',
        icon: item.icon || '',
        color: item.color || '#e5e7eb',
        sort_order: Number(item.sort_order ?? 0),
        count,
        total,
      };
    })
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/* --------------------------------------------------------------------- */
/* Render Summary                                                        */
/* --------------------------------------------------------------------- */

function renderOutcomesSummary(items) {
  if (!dom.outcomeSummary) return;

  if (!Array.isArray(items) || !items.length) {
    dom.outcomeSummary.innerHTML = `
      <div class="crm-outcomes-summary__row">
        <div class="crm-outcomes-summary__metric">
          <span class="crm-outcomes-summary__label">Sem dados</span>
          <span class="crm-outcomes-summary__sub">Nenhuma conclusão carregada</span>
        </div>
      </div>
    `;
    return;
  }

  dom.outcomeSummary.innerHTML = `
    <div class="crm-outcomes-summary__row">
      ${items
        .map((it) => {
          const bg = alphaBg(it.color, 0.10);

          return `
          <button type="button"
          class="crm-outcomes-summary__metric crm-outcomes-summary__metric--btn crm-conclusion-summary-card"
          data-outcome-id="${escapeAttr(String(it.id))}"
          data-conclusion-code="${escapeAttr(String(it.code || ''))}"
          style="border:1px solid ${escapeAttr(it.color)}; background:${escapeAttr(bg)};">
              
              <span class="crm-outcomes-summary__label">
                ${escapeHtml([it.icon, it.name].filter(Boolean).join(' '))}
              </span>

              <span class="crm-outcomes-summary__value">
                ${Number(it.total || 0).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </span>

              <span class="crm-outcomes-summary__sub">
                ${it.count} card(s)
              </span>

            </button>
          `;
        })
        .join('')}
    </div>
  `;
}