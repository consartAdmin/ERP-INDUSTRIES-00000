// ╔══════════════════════════════════════════════════════════════════════╗
// ║ settings.kanban.js — Engrenagem ⚙️ do Kanban do CRM (ESM)            ║
// ║ PRODNEX ERP                                                          ║
// ║                                                                      ║
// ║ Mesma ideia do tableSettings.js, mas para o Kanban (não é tabela):   ║
// ║ • Kanban: largura/altura das colunas, espaço entre elas, tamanho dos ║
// ║   cards e a coluna "Conclusão do Lead".                              ║
// ║ • Cards: quais informações aparecem.                                 ║
// ║ • Etapas: quais colunas aparecem.                                    ║
// ║ Salvo por USUÁRIO no banco (/api/user-table-preferences/:key), uma   ║
// ║ chave por CRM (Gestão de Vendas x Consart ERP). O localStorage é só  ║
// ║ cache para aplicar o layout sem piscar.                              ║
// ║ Aplicado por um <style> gerado: sobrevive a cada re-render.          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { apiFetch } from '/public/includes/js/apiFetch.js';
import { Modal } from '/public/includes/js/modal.js';

const PREFS_URL = '/api/user-table-preferences/';
const CACHE_PREFIX = 'consart.kanbanSettings.v1.';

const LIMITS = {
  colWidth: { min: 180, max: 600, step: 10, label: 'Largura das colunas (px)', placeholder: 260 },
  colHeight: { min: 200, max: 3000, step: 10, label: 'Altura das colunas (px)', placeholder: 560 },
  colGap: { min: 0, max: 80, step: 1, label: 'Espaço entre colunas (px)', placeholder: 18 },
  cardScale: { min: 60, max: 160, step: 5, label: 'Tamanho dos cards (%)', placeholder: 100 },
};

// Informações do card (render.deals.js)
const CARD_FIELDS = [
  { key: 'value', label: 'Valor estimado', selector: '.crm-card__value' },
  { key: 'seller', label: 'Vendedor', selector: '.crm-card__row-seller .crm-card__seller' },
  { key: 'status', label: 'Tag / Status', selector: '.crm-card__row-seller .crm-chip' },
  { key: 'origin', label: 'Origem do lead', selector: '.crm-card__row-origin' },
  { key: 'nextStep', label: 'Próxima ação', selector: '.crm-card__next-step' },
  { key: 'lastActivity', label: 'Última atividade', selector: '.crm-card__footer' },
];

const KANBAN = '#crm-kanban'; // id: ganha das regras por classe do crmDeals.css

/* ---------------------------------------------------------------- helpers */

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clone = (obj) => JSON.parse(JSON.stringify(obj || {}));

function inRange(value, { min, max }) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null;
}

/** Valor de atributo seguro para seletor CSS [data-x="..."] */
const attr = (value) => JSON.stringify(String(value ?? ''));

function readCache(cacheKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cacheKey, prefs) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(prefs));
  } catch {
    // modo privado / armazenamento bloqueado: o banco continua valendo
  }
}

/* ---------------------------------------------------------------- estado */

const inst = {
  key: '',
  cacheKey: '',
  prefs: {},
  savedPrefs: {},
  dirty: false,
  style: null,
  trigger: null,
  modal: null,
};

/** Remove valores padrão para guardar só o que o usuário mudou. */
function compact(prefs) {
  const out = {};
  Object.keys(LIMITS).forEach((k) => {
    const n = inRange(prefs[k], LIMITS[k]);
    if (n !== null) out[k] = n;
  });
  if (prefs.hideOutcomes) out.hideOutcomes = true;
  const hiddenFields = (prefs.hiddenFields || []).filter((k) => CARD_FIELDS.some((f) => f.key === k));
  if (hiddenFields.length) out.hiddenFields = [...new Set(hiddenFields)];
  const hiddenStages = (prefs.hiddenStages || []).map(String).filter(Boolean);
  if (hiddenStages.length) out.hiddenStages = [...new Set(hiddenStages)];
  return out;
}

/* ---------------------------------------------------------------- estilo */

function applyStyles() {
  const p = inst.prefs;
  const rules = [];
  const root = KANBAN;

  const vars = [];
  if (p.colWidth) vars.push(`--crm-col-min: ${p.colWidth}px; --crm-col-max: ${p.colWidth}px;`);
  if (p.colHeight) vars.push(`--crm-col-body-h: ${p.colHeight}px; --crm-col-body-minh: ${Math.min(p.colHeight, 500)}px;`);
  if (p.colGap !== undefined && p.colGap !== null) vars.push(`--crm-col-gap: ${p.colGap}px;`);
  if (vars.length) rules.push(`${root} { ${vars.join(' ')} }`);

  if (p.cardScale && p.cardScale !== 100) rules.push(`${root} .crm-card { zoom: ${p.cardScale / 100}; }`);
  if (p.hideOutcomes) rules.push(`${root} .crm-kanban__outcomes { display: none !important; }`);

  (p.hiddenFields || []).forEach((key) => {
    const field = CARD_FIELDS.find((f) => f.key === key);
    if (field) rules.push(`${root} .crm-card ${field.selector} { display: none !important; }`);
  });

  (p.hiddenStages || []).forEach((code) => {
    rules.push(`${root} .crm-column[data-stage-code=${attr(code)}] { display: none !important; }`);
  });

  inst.style.textContent = rules.join('\n');
}

/* ---------------------------------------------------------------- persistência */

async function save() {
  const url = `${PREFS_URL}${inst.key}`;
  inst.prefs = compact(inst.prefs);
  if (Object.keys(inst.prefs).length) {
    await apiFetch(url, { method: 'PUT', body: JSON.stringify({ prefs: inst.prefs }) });
  } else {
    await apiFetch(url, { method: 'DELETE' });
  }
  inst.savedPrefs = clone(inst.prefs);
  writeCache(inst.cacheKey, inst.prefs);
}

async function loadServerPrefs() {
  try {
    const data = await apiFetch(`${PREFS_URL}${inst.key}`);
    if (inst.dirty) return; // usuário já está editando: não sobrescreve
    inst.prefs = data?.prefs && typeof data.prefs === 'object' ? compact(data.prefs) : {};
    inst.savedPrefs = clone(inst.prefs);
    writeCache(inst.cacheKey, inst.prefs);
    applyStyles();
  } catch (err) {
    console.warn(`[kanbanSettings] ${inst.key}: preferências do servidor indisponíveis, usando cache local:`, err);
  }
}

/* ---------------------------------------------------------------- modal */

function getStages() {
  return [...document.querySelectorAll('#crm-kanban-stages .crm-column')].map((col) => ({
    code: col.dataset.stageCode || col.dataset.stageId || '',
    name: col.querySelector('.crm-column__title')?.firstChild?.textContent?.trim()
      || col.dataset.stageCode || 'Etapa',
  })).filter((s) => s.code);
}

function ensureModal() {
  if (inst.modal) return inst.modal;

  const numberFields = Object.entries(LIMITS).map(([key, l]) => `
    <label class="ts-field">
      <span>${esc(l.label)}</span>
      <input type="number" class="ts-input" data-ks-num="${key}"
        min="${l.min}" max="${l.max}" step="${l.step}" placeholder="${l.placeholder}">
    </label>`).join('');

  const modal = document.createElement('div');
  modal.className = 'modal modal-width-6 modal-height-8 ts-modal';
  modal.id = 'kanbanSettingsModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal__backdrop" data-ks-close></div>
    <div class="modal__dialog">
      <section class="modal__panel" role="dialog"
        aria-modal="true" aria-labelledby="kanbanSettingsModalTitle" tabindex="-1">
        <header class="modal__header modal-header-color-3">
          <div>
            <h2 class="modal__title" id="kanbanSettingsModalTitle">⚙️ Configurar Kanban</h2>
            <p class="ts-subtitle">As mudanças aparecem no Kanban e só valem após Salvar.</p>
          </div>
          <button type="button" class="modal__close" data-ks-close aria-label="Fechar modal" title="Fechar">×</button>
        </header>

        <div class="modal__body">
          <section class="ts-section">
            <h3 class="ts-section__title">Kanban</h3>
            <div class="ts-table-fields">${numberFields}</div>
            <label class="ts-field" style="flex-direction:row;align-items:center;gap:8px;margin-top:8px;">
              <input type="checkbox" data-ks-outcomes>
              <span>Mostrar a coluna "Conclusão do Lead"</span>
            </label>
            <p class="ts-hint">Vazio = tamanho padrão da tela.</p>
          </section>

          <section class="ts-section">
            <h3 class="ts-section__title">Informações dos cards</h3>
            <div class="ts-table-fields" data-ks-fields></div>
            <p class="ts-hint">O nome do cliente sempre aparece.</p>
          </section>

          <section class="ts-section">
            <h3 class="ts-section__title">Etapas (colunas)</h3>
            <div class="ts-table-fields" data-ks-stages></div>
          </section>
        </div>

        <footer class="modal__footer">
          <span class="ts-status" data-ks-status aria-live="polite"></span>
          <button type="button" class="btn btn-clean btn-sm" data-ks-reset>Restaurar padrão</button>
          <button type="button" class="btn btn-cancel btn-sm" data-ks-close>Fechar</button>
          <button type="button" class="btn btn-save btn-sm" data-ks-save disabled>💾 Salvar</button>
        </footer>
      </section>
    </div>`;
  document.body.appendChild(modal);
  inst.modal = modal;
  Modal.setup();

  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-ks-close]')) closeModal();
    else if (event.target.closest('[data-ks-reset]')) {
      inst.prefs = {};
      applyStyles();
      renderModal();
      markDirty();
    } else if (event.target.closest('[data-ks-save]')) saveFromModal();
  });

  modal.addEventListener('input', onInput);
  modal.addEventListener('change', onInput);

  // captura: roda antes do Esc global do modal.js, que fecharia sem perguntar
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !modal.classList.contains('is-open')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeModal();
  }, true);

  return modal;
}

const checkbox = (attrName, value, label, checked) => `
  <label class="ts-field" style="flex-direction:row;align-items:center;gap:8px;">
    <input type="checkbox" ${attrName}="${esc(value)}" ${checked ? 'checked' : ''}>
    <span>${esc(label)}</span>
  </label>`;

function renderModal() {
  const modal = inst.modal;
  const p = inst.prefs;

  modal.querySelectorAll('[data-ks-num]').forEach((input) => {
    const v = p[input.dataset.ksNum];
    input.value = v ?? '';
  });
  modal.querySelector('[data-ks-outcomes]').checked = !p.hideOutcomes;

  const hiddenFields = new Set(p.hiddenFields || []);
  modal.querySelector('[data-ks-fields]').innerHTML = CARD_FIELDS
    .map((f) => checkbox('data-ks-field', f.key, f.label, !hiddenFields.has(f.key))).join('');

  const hiddenStages = new Set(p.hiddenStages || []);
  const stages = getStages();
  modal.querySelector('[data-ks-stages]').innerHTML = stages.length
    ? stages.map((s) => checkbox('data-ks-stage', s.code, s.name, !hiddenStages.has(s.code))).join('')
    : '<p class="ts-hint">As etapas ainda estão carregando.</p>';
}

function onInput(event) {
  const t = event.target;
  const p = inst.prefs;

  if (t.matches('[data-ks-num]')) {
    const key = t.dataset.ksNum;
    const n = inRange(t.value, LIMITS[key]);
    if (n === null) delete p[key];
    else p[key] = n;
  } else if (t.matches('[data-ks-outcomes]')) {
    p.hideOutcomes = !t.checked;
  } else if (t.matches('[data-ks-field]')) {
    const set = new Set(p.hiddenFields || []);
    if (t.checked) set.delete(t.dataset.ksField);
    else set.add(t.dataset.ksField);
    p.hiddenFields = [...set];
  } else if (t.matches('[data-ks-stage]')) {
    const set = new Set(p.hiddenStages || []);
    if (t.checked) set.delete(t.dataset.ksStage);
    else set.add(t.dataset.ksStage);
    p.hiddenStages = [...set];
  } else {
    return;
  }

  applyStyles();
  markDirty();
}

function setStatus(text, kind = '') {
  const el = inst.modal?.querySelector('[data-ks-status]');
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
}

function markDirty() {
  inst.dirty = true;
  setStatus('● Alterações não salvas', 'dirty');
  inst.modal.querySelector('[data-ks-save]').disabled = false;
}

function markClean(text = '', kind = '') {
  inst.dirty = false;
  setStatus(text, kind);
  inst.modal.querySelector('[data-ks-save]').disabled = true;
}

async function saveFromModal() {
  const btn = inst.modal.querySelector('[data-ks-save]');
  btn.disabled = true;
  setStatus('Salvando…');
  try {
    await save();
    markClean('✓ Salvo no seu usuário', 'ok');
  } catch (err) {
    console.warn(`[kanbanSettings] ${inst.key}: falha ao salvar preferências:`, err);
    setStatus('Não foi possível salvar. Tente novamente.', 'error');
    btn.disabled = false;
  }
}

function openModal() {
  ensureModal();
  renderModal();
  markClean();
  Modal.open(inst.modal, { focusSelector: '.modal__close' });
  inst.trigger?.setAttribute('aria-expanded', 'true');
}

function closeModal() {
  if (inst.dirty) {
    if (!confirm('Há alterações não salvas no Kanban. Descartar e fechar?')) return;
    inst.prefs = clone(inst.savedPrefs);
    inst.dirty = false;
    applyStyles();
  }
  Modal.close(inst.modal);
  inst.trigger?.setAttribute('aria-expanded', 'false');
}

/* ---------------------------------------------------------------- init */

/**
 * Liga a ⚙️ do Kanban.
 * @param {object} opts
 * @param {HTMLElement} opts.mount onde o botão ⚙️ entra (ex.: .crm-actions)
 * @param {string}      opts.key   chave das preferências (uma por CRM)
 */
export function initKanbanSettings({ mount, key }) {
  if (inst.style || !mount || !key) return;

  inst.key = key;
  inst.cacheKey = `${CACHE_PREFIX}${key}`;
  inst.prefs = compact(readCache(inst.cacheKey));
  inst.savedPrefs = clone(inst.prefs);

  inst.style = document.createElement('style');
  inst.style.dataset.kanbanSettings = key;
  document.head.appendChild(inst.style);
  applyStyles();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ts-trigger crm-kanban-settings';
  btn.title = 'Configurar Kanban';
  btn.setAttribute('aria-label', 'Configurar Kanban');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.textContent = '⚙️';
  btn.addEventListener('click', openModal);
  mount.appendChild(btn);
  inst.trigger = btn;

  void loadServerPrefs();
}

export default initKanbanSettings;
