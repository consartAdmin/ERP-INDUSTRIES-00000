// ╔══════════════════════════════════════════════════════════════════════╗
// ║ customersEdit.quickAdd.js — "+" de cadastro rápido                   ║
// ║ Aba Informações Complementares: Segmento / Vendedor / Status        ║
// ║ Padrão global: /public/includes/js/modal.js + modals.css            ║
// ║ Cada janela salva no MESMO endpoint da tela de cadastro da entidade.║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/public/includes/js/modal.js';
import { apiFetch } from '/public/includes/js/apiFetch.js';
import { openCustomerStatusModalWithType } from '/public/modalsSearch/customersStatusModal.js';

const API_BASE = (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');

const ROUTES = Object.freeze({
  segments: `${API_BASE}/api/customer-segments`,          // tela customerSegments
  sellers: `${API_BASE}/api/sellers`,                     // tela sellers
  statusTypes: `${API_BASE}/api/customer-status-types`,   // tela customerStatusTypes
});

const MODAL_ID = 'ceQuickAddModal';
const byId = (id) => document.getElementById(id);

const quickState = { save: null, resolve: null, saving: false };

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// "Novo Cliente Ouro" → "NOVO_CLIENTE_OURO" (Código Interno do status)
function toInternalCode(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------
// Modal genérico (markup criado uma vez; campos trocados a cada abertura)
// ---------------------------------------------------------------------
function ensureModal() {
  let modal = byId(MODAL_ID);
  if (modal) return modal;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="${MODAL_ID}" class="modal" aria-hidden="true">
      <div class="modal__backdrop" data-modal-close></div>

      <div class="modal__dialog">
        <section class="modal__panel modal-width-5" role="dialog" aria-modal="true"
          aria-labelledby="ceQuickAddTitle">

          <header class="modal__header modal-header-color-3">
            <h3 id="ceQuickAddTitle" class="modal__title"></h3>
            <button class="modal__close" type="button" data-modal-close aria-label="Fechar" title="Fechar">×</button>
          </header>

          <div class="modal__body">
            <form id="ceQuickAddForm" novalidate>
              <div id="ceQuickAddFields" class="modal-form-grid modal-form-grid--3"></div>
              <div id="ceQuickAddError" class="coa-modal__error hidden"></div>
            </form>
          </div>

          <footer class="modal__footer modal-footer-color-3">
            <button class="btn btn-cancel btn-sm" type="button" data-modal-close>Cancelar</button>
            <button id="ceQuickAddSaveBtn" class="btn btn-save btn-sm" type="submit" form="ceQuickAddForm">Salvar</button>
          </footer>

        </section>
      </div>
    </div>
  `);

  modal = byId(MODAL_ID);
  Modal.setup();

  // Fechou sem salvar (X, Cancelar, backdrop, ESC) → resolve null
  modal.addEventListener('modal:close', () => {
    const resolve = quickState.resolve;
    quickState.resolve = null;
    resolve?.(null);
  });

  byId('ceQuickAddForm').addEventListener('submit', onSubmit);
  return modal;
}

function showError(message) {
  const box = byId('ceQuickAddError');
  box.textContent = message;
  box.classList.toggle('hidden', !message);
}

function readValues() {
  const values = {};
  byId('ceQuickAddFields').querySelectorAll('[data-key]').forEach((el) => {
    values[el.dataset.key] = String(el.value ?? '').trim();
  });
  return values;
}

async function onSubmit(ev) {
  ev.preventDefault();
  if (quickState.saving) return;

  const btnSave = byId('ceQuickAddSaveBtn');
  showError('');

  quickState.saving = true;
  btnSave.disabled = true;
  btnSave.textContent = 'Salvando...';

  try {
    const created = await quickState.save(readValues());
    const resolve = quickState.resolve;
    quickState.resolve = null;
    Modal.close(MODAL_ID);
    resolve?.(created);
  } catch (err) {
    console.error('[customersEdit] cadastro rápido:', err);
    showError(err?.message || 'Falha ao salvar.');
  } finally {
    quickState.saving = false;
    btnSave.disabled = false;
    btnSave.textContent = 'Salvar';
  }
}

function fieldHtml(f) {
  const id = `ceQuick_${f.key}`;
  const span = f.span ? ` modal-field--span-${f.span}` : '';
  const attrs = `id="${id}" data-key="${f.key}"`;

  let control;
  if (f.type === 'select') {
    control = `<select ${attrs}>${f.options
      .map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`)
      .join('')}</select>`;
  } else {
    control = `<input ${attrs} type="${f.type || 'text'}" autocomplete="off"
      placeholder="${escapeHtml(f.placeholder || '')}" value="${escapeHtml(f.value ?? '')}"
      ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} ${f.step ? `step="${f.step}"` : ''}
      ${f.min != null ? `min="${f.min}"` : ''}>`;
  }

  return `
    <div class="fields fields-h-6 fields-w-full${span}">
      <label for="${id}">${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
      ${control}
    </div>`;
}

/**
 * Abre a janela de cadastro rápido.
 * Resolve com o registro criado, ou null se fechada sem salvar.
 */
function openQuickAddModal({ title, fields, save }) {
  ensureModal();

  byId('ceQuickAddTitle').textContent = title;
  byId('ceQuickAddFields').innerHTML = fields.map(fieldHtml).join('');
  showError('');

  return new Promise((resolve) => {
    quickState.save = save;
    quickState.resolve = resolve;
    Modal.open(MODAL_ID, { focusSelector: `#ceQuick_${fields[0].key}` });
  });
}

function required(value, message) {
  if (!value) throw new Error(message);
}

// ---------------------------------------------------------------------
// Segmento — mesmos campos/endpoint da tela Segmentos de Clientes
// ---------------------------------------------------------------------
async function onNewSegment(reloadSegments) {
  const created = await openQuickAddModal({
    title: 'Novo Segmento',
    fields: [
      { key: 'segment_name', label: 'Nome do Segmento', required: true, span: 2, maxlength: 120,
        placeholder: 'Ex.: Varejo, Atacado, Clientes VIP...' },
      { key: 'is_active', label: 'Status', type: 'select',
        options: [{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }] },
      { key: 'description', label: 'Descrição', span: 'full',
        placeholder: 'Observações adicionais sobre o segmento...' },
    ],
    save: async (v) => {
      required(v.segment_name, 'Preencha o Nome do segmento.');
      const res = await apiFetch(ROUTES.segments, {
        method: 'POST',
        body: JSON.stringify({
          segment_name: v.segment_name,
          description: v.description || null,
          is_active: v.is_active === 'true',
        }),
      });
      return res?.data ?? res;
    },
  });
  if (!created) return;

  await reloadSegments();
  // o select usa segment_code (ou o nome) como valor — ver fillSelect()
  const select = byId('business_segment');
  if (select) select.value = String(created.segment_code || created.segment_name || '');
}

// ---------------------------------------------------------------------
// Vendedor — campos principais da tela Vendedores (POST /api/sellers)
// ---------------------------------------------------------------------
async function onNewSeller(reloadSellers) {
  const created = await openQuickAddModal({
    title: 'Novo Vendedor',
    fields: [
      { key: 'name', label: 'Nome', required: true, span: 2, placeholder: 'Nome do vendedor' },
      { key: 'nickname', label: 'Apelido', placeholder: 'Como aparece nas listas' },
      { key: 'email', label: 'E-mail', type: 'email', span: 2, placeholder: 'vendedor@empresa.com.br' },
      { key: 'mobile', label: 'Celular', type: 'tel', placeholder: '(31) 99999-9999' },
      { key: 'commission_type', label: 'Tipo de Comissão', type: 'select',
        options: [{ value: 'PERCENT', label: 'Percentual (%)' }, { value: 'FIXED', label: 'Valor fixo (R$)' }] },
      { key: 'commission_value', label: 'Comissão', type: 'number', value: '0', min: 0, step: '0.01' },
    ],
    save: async (v) => {
      required(v.name, 'O nome do vendedor é obrigatório.');
      const commission = Number(v.commission_value || 0);
      if (!Number.isFinite(commission) || commission < 0) {
        throw new Error('Informe um valor de comissão válido.');
      }
      if (v.commission_type === 'PERCENT' && commission > 100) {
        throw new Error('A comissão percentual não pode ser maior que 100%.');
      }

      const res = await apiFetch(ROUTES.sellers, {
        method: 'POST',
        body: JSON.stringify({
          name: v.name,
          nickname: v.nickname || null,
          email: v.email || null,
          mobile: v.mobile || null,
          commission_type: v.commission_type || 'PERCENT',
          commission_value: commission,
          is_active: true,
        }),
      });
      return res?.data ?? res;
    },
  });
  if (!created) return;

  await reloadSellers();
  const select = byId('customer-seller-select');
  const id = created.id ?? created.seller_id;
  if (select && id != null) select.value = String(id);
}

// ---------------------------------------------------------------------
// Status do Cliente — cria um TIPO de status (tela Tipos de Status) e
// abre o modal "Status do Cliente" já com ele selecionado.
// ---------------------------------------------------------------------
async function onNewStatusType() {
  const created = await openQuickAddModal({
    title: 'Novo Tipo de Status',
    fields: [
      { key: 'name_pt', label: 'Nome (PT)', required: true, span: 2, placeholder: 'Ex: NOVO CLIENTE' },
      { key: 'internal_code', label: 'Código Interno', placeholder: 'Automático pelo nome' },
      { key: 'sort_order', label: 'Ordem', type: 'number', value: '0', step: '1' },
      { key: 'color_hex', label: 'Cor', type: 'color', value: '#2563EB' },
    ],
    save: async (v) => {
      required(v.name_pt, 'Informe o Nome (PT).');
      const internal_code = v.internal_code || toInternalCode(v.name_pt);
      required(internal_code, 'Informe o Código Interno.');

      const res = await apiFetch(ROUTES.statusTypes, {
        method: 'POST',
        body: JSON.stringify({
          name_pt: v.name_pt,
          internal_code,
          color_hex: v.color_hex ? v.color_hex.toUpperCase() : null,
          sort_order: v.sort_order === '' ? 0 : Number(v.sort_order),
        }),
      });
      return res?.data ?? res;
    },
  });
  if (!created?.id) return;

  await openCustomerStatusModalWithType(created.id);
}

// ---------------------------------------------------------------------
// Init — liga os "+" (chamado por customersEdit.actions.js)
// ---------------------------------------------------------------------
export function initCustomerQuickAdd({ reloadSegments, reloadSellers }) {
  const run = (fn) => () =>
    fn().catch((err) => console.error('[customersEdit] cadastro rápido:', err));

  byId('btnQuickAddSegment')?.addEventListener('click', run(() => onNewSegment(reloadSegments)));
  byId('btnQuickAddSeller')?.addEventListener('click', run(() => onNewSeller(reloadSellers)));
  byId('btnQuickAddStatusType')?.addEventListener('click', run(onNewStatusType));
}
