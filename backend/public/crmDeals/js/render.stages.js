// ╔══════════════════════════════════════════════════════════════════════╗
// ║ render.stages.js — CRM Deals (PRODNEX ERP)                          ║
// ║ renderStages()                                                      ║
// ║                                                                      ║
// ║ ✔ Suporta active / is_active                                        ║
// ║ ✔ Usa code_norm com fallback                                        ║
// ║ ✔ Proteção contra stage inválido                                    ║
// ║ ✔ IDs HTML normalizados                                             ║
// ║ ✔ Compatível com dragdrop.columns.js                                ║
// ║ ✔ Render seguro dos atributos                                       ║
// ║ ✔ Tooltip de roteiro no stage Follow-up                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './state.js';
import { escapeAttr, escapeHtml, normalizeCode } from './helpers.js';

function getStageTitleHtml(stageName) {
  const safeStageName = String(stageName || '').trim();
  const normStageName = normalizeCode(safeStageName);

  const isFollowUp =
    normStageName === 'follow_up' ||
    normStageName === 'followup';

  if (!isFollowUp) {
    return `
      <span class="crm-column__title">
        ${escapeHtml(safeStageName)}
      </span>
    `;
  }

  const tooltipText = `Roteiro:

1. Opening
Olá, tudo bem? Aqui é o Renato da BH3

2. Context
Te enviei um orçamento e quis te ligar pra entender melhor sua necessidade

3. Value question
Faz sentido pra você nesse momento?

4. Explore
Teve algo que não te agradou? Preço, prazo, produto?`;

  return `
    <span class="crm-column__title">
      ${escapeHtml(safeStageName)}

      <span
        class="crm-help-tip"
        tabindex="0"
        aria-label="Roteiro de follow-up"
        data-tooltip="${escapeAttr(tooltipText)}"
      >?</span>
    </span>
  `;
}

export function renderStages() {
  const stagesWrap = document.getElementById('crm-kanban-stages');
  if (!stagesWrap) return;

  stagesWrap.innerHTML = '';

  const stages = Array.isArray(state.stages) ? state.stages : [];

  stages
    .filter((stage) => {
      const isActive = stage?.active ?? stage?.is_active ?? true;
      return Boolean(isActive);
    })
    .sort((a, b) => {
      const orderA = Number(a?.sort_order ?? 0);
      const orderB = Number(b?.sort_order ?? 0);
      return orderA - orderB;
    })
    .forEach((stage) => {
      /* ---------------------------------------------------------------- */
      /* Validação de stage                                               */
      /* ---------------------------------------------------------------- */

      const stageId = stage?.id != null ? String(stage.id) : null;

      if (!stageId) {
        console.warn('[CRM] Stage ignorado sem ID:', stage);
        return;
      }

      /* ---------------------------------------------------------------- */
      /* Dados principais                                                 */
      /* ---------------------------------------------------------------- */

      const stageCode = String(stage?.code || stageId).trim();

      const stageName =
        String(stage?.name || stageCode || 'Stage').trim();

      const stageColor =
        String(stage?.color || '#0ea5e9').trim();

      const stageCodeNorm =
        stage?.code_norm || normalizeCode(stageCode);

      /* ---------------------------------------------------------------- */
      /* IDs HTML seguros                                                 */
      /* ---------------------------------------------------------------- */

      const counterIdBase =
        normalizeCode(stageCode || stageId || 'stage');

      /* ---------------------------------------------------------------- */
      /* Coluna                                                           */
      /* ---------------------------------------------------------------- */

      const col = document.createElement('div');

      col.className = 'crm-column';

      col.dataset.stageId = stageId;
      col.dataset.stageCode = stageCode;

      /* ---------------------------------------------------------------- */
      /* HTML da coluna                                                   */
      /* ---------------------------------------------------------------- */

      col.innerHTML = `
        <header class="crm-column__header">

          <div class="crm-column__title-wrap">
            <span class="crm-column__badge"
                  style="background:${escapeAttr(stageColor)}">
            </span>

            ${getStageTitleHtml(stageName)}
          </div>

          <span
            class="crm-column__counter"
            id="counter-${escapeAttr(counterIdBase)}"
          >
            0
          </span>

        </header>

        <div
          class="crm-column__body"
          data-column="${escapeAttr(stageCode)}"
          data-column-norm="${escapeAttr(stageCodeNorm)}"
          data-stage-id="${escapeAttr(stageId)}"
        ></div>
      `;

      stagesWrap.appendChild(col);
    });
}