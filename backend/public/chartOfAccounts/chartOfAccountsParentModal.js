/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: chartOfAccountsParentModal.js                                 ║
   ║ MODULE: Chart Of Accounts                                           ║
   ║ DESCRIPTION: Modal "Nova Conta Pai" (conta grupo, sem lançamento)   ║
   ║ Global: /public/includes/js/modal.js + modals.css                   ║
   ║ PRODNEX ERP · ESM                                                   ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Modal } from '/public/includes/js/modal.js';

const API_BASE = '/api/chart-of-accounts';
const MODAL_ID = 'coaParentModal';

const parentState = {
  bound: false,
  saving: false,
  groups: [],
  onCreated: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error = new Error(data?.message || `HTTP_${res.status}`);
    error.status = res.status;
    error.payload = data;
    throw error;
  }

  return data;
}

// Markup criado sob demanda: o modal funciona em qualquer página que abra o
// "Nova Conta" (Plano de Contas, Edição de Clientes...), sem HTML na página.
function ensureParentModal() {
  if (document.getElementById(MODAL_ID)) return;

  document.body.insertAdjacentHTML('beforeend', `
  <div id="coaParentModal" class="modal" aria-hidden="true">

    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">

      <section class="modal__panel modal-width-5" role="dialog" aria-modal="true"
        aria-labelledby="coaParentModalTitle">

        <!-- HEADER -->
        <header class="modal__header modal-header-color-3">
          <h3 id="coaParentModalTitle" class="modal__title">Nova Conta Pai</h3>

          <button class="modal__close" type="button" data-modal-close aria-label="Fechar" title="Fechar">
            ×
          </button>
        </header>

        <!-- BODY -->
        <div class="modal__body">
          <form id="coaParentForm" novalidate>

            <div class="modal-form-grid modal-form-grid--3">

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaParentCode">Código</label>
                <input id="coaParentCode" type="text" placeholder="Ex.: 3.2" autocomplete="off">
              </div>

              <div class="fields fields-h-6 fields-w-full modal-field--span-2">
                <label for="coaParentDescription">Descrição</label>
                <input id="coaParentDescription" type="text" placeholder="Ex.: Despesas com Vendas" autocomplete="off">
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaParentType">Tipo</label>
                <select id="coaParentType">
                  <option value="">Selecione...</option>
                  <option value="ASSET">Ativo</option>
                  <option value="LIABILITY">Passivo</option>
                  <option value="EQUITY">Patrimônio Líquido</option>
                  <option value="REVENUE">Receita</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaParentNature">Natureza</label>
                <select id="coaParentNature">
                  <option value="">Selecione...</option>
                  <option value="DEBIT">Débito</option>
                  <option value="CREDIT">Crédito</option>
                </select>
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaParentLevel">Nível</label>
                <input id="coaParentLevel" type="number" min="1" step="1" placeholder="Automático">
              </div>

              <div class="fields fields-h-6 fields-w-full modal-field--span-full">
                <label for="coaParentParent">Conta Superior</label>
                <select id="coaParentParent">
                  <option value="">Sem conta superior (raiz)</option>
                </select>
              </div>

            </div>

            <div id="coaParentError" class="coa-modal__error hidden"></div>

          </form>
        </div>

        <!-- FOOTER -->
        <footer class="modal__footer modal-footer-color-3">
          <button class="btn btn-cancel btn-sm" type="button" data-modal-close>Cancelar</button>
          <button id="coaParentSaveBtn" class="btn btn-save btn-sm" type="submit" form="coaParentForm">Salvar</button>
        </footer>

      </section>
    </div>
  </div>
`);
}

function getFields() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return null;

  return {
    modal,
    form: modal.querySelector('#coaParentForm'),
    code: modal.querySelector('#coaParentCode'),
    description: modal.querySelector('#coaParentDescription'),
    type: modal.querySelector('#coaParentType'),
    nature: modal.querySelector('#coaParentNature'),
    level: modal.querySelector('#coaParentLevel'),
    parent: modal.querySelector('#coaParentParent'),
    errorBox: modal.querySelector('#coaParentError'),
    saveBtn: modal.querySelector('#coaParentSaveBtn'),
  };
}

function inferLevelFromCode(code) {
  const safe = String(code || '').trim();
  if (!safe) return 1;
  return safe.split('.').filter(Boolean).length || 1;
}

function getParentCodeFromCode(code) {
  const parts = String(code || '').trim().split('.').filter(Boolean);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('.');
}

function setError(message = '') {
  const fields = getFields();
  if (!fields?.errorBox) return;

  fields.errorBox.textContent = message;
  fields.errorBox.classList.toggle('hidden', !message);
}

function setSaving(isSaving) {
  parentState.saving = isSaving;
  const fields = getFields();
  if (!fields?.saveBtn) return;

  fields.saveBtn.disabled = isSaving;
  fields.saveBtn.textContent = isSaving ? 'Salvando...' : 'Salvar';
}

// ──────────────────────────────────────────────────────────────────────
// CONTAS SUPERIORES (somente contas grupo)
// ──────────────────────────────────────────────────────────────────────

async function loadGroupOptions() {
  const fields = getFields();
  if (!fields?.parent) return;

  const response = await fetchJson(`${API_BASE}/flat?is_active=true`);
  const rows = Array.isArray(response?.data) ? response.data : [];

  parentState.groups = rows.filter((row) => !row.allows_posting);

  const options = ['<option value="">Sem conta superior (raiz)</option>'];
  for (const row of parentState.groups) {
    const label = escapeHtml(row.label || `${row.code} - ${row.description}`);
    options.push(`<option value="${row.id}">${label}</option>`);
  }

  fields.parent.innerHTML = options.join('');
}

function findGroupById(id) {
  return parentState.groups.find((row) => Number(row.id) === Number(id)) || null;
}

function findGroupByCode(code) {
  if (!code) return null;
  return parentState.groups.find((row) => String(row.code) === code) || null;
}

/** Herda tipo/natureza da conta superior quando ainda não preenchidos */
function inheritFromGroup(group) {
  const fields = getFields();
  if (!fields || !group) return;

  if (!fields.type.value && group.account_type) fields.type.value = group.account_type;
  if (!fields.nature.value && group.nature) fields.nature.value = group.nature;
}

// ──────────────────────────────────────────────────────────────────────
// EVENTOS DOS CAMPOS
// ──────────────────────────────────────────────────────────────────────

function onCodeInput() {
  const fields = getFields();
  if (!fields) return;

  const code = fields.code.value.trim();
  fields.level.placeholder = code ? `Automático (${inferLevelFromCode(code)})` : 'Automático';

  // Ex.: código 5.3 → seleciona automaticamente a conta superior 5
  const group = findGroupByCode(getParentCodeFromCode(code));
  if (group) {
    fields.parent.value = String(group.id);
    inheritFromGroup(group);
  }
}

function onParentChange() {
  const fields = getFields();
  if (!fields) return;

  inheritFromGroup(findGroupById(fields.parent.value));
}

// ──────────────────────────────────────────────────────────────────────
// SALVAR
// ──────────────────────────────────────────────────────────────────────

function buildPayload() {
  const fields = getFields();

  const code = fields.code.value.trim();
  const description = fields.description.value.trim();
  const account_type = fields.type.value;
  const nature = fields.nature.value;
  const levelRaw = fields.level.value.trim();
  const parentRaw = fields.parent.value;

  const level = levelRaw ? Number(levelRaw) : inferLevelFromCode(code);

  if (!code) throw new Error('Informe o código da conta pai.');
  if (!description) throw new Error('Informe a descrição da conta pai.');
  if (!account_type) throw new Error('Selecione o tipo da conta.');
  if (!nature) throw new Error('Selecione a natureza da conta.');
  if (!Number.isInteger(level) || level <= 0) throw new Error('Informe um nível válido.');

  return {
    code,
    description,
    account_type,
    nature,
    level,
    parent_account_id: parentRaw ? Number(parentRaw) : null,
    allows_posting: false,
    is_active: true,
    notes: null,
  };
}

async function saveParent(event) {
  event.preventDefault();
  if (parentState.saving) return;

  try {
    setError('');
    setSaving(true);

    const payload = buildPayload();
    const response = await fetchJson(API_BASE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const created = response?.data || null;

    Modal.close(MODAL_ID);

    if (typeof parentState.onCreated === 'function') {
      await parentState.onCreated(created);
    }
  } catch (error) {
    console.error('[chartOfAccountsParentModal] save error:', error);
    setError(error.message || 'Falha ao salvar conta pai.');
  } finally {
    setSaving(false);
  }
}

// ──────────────────────────────────────────────────────────────────────
// API PÚBLICA
// ──────────────────────────────────────────────────────────────────────

function bindParentModal() {
  if (parentState.bound) return;

  ensureParentModal();

  const fields = getFields();
  if (!fields) return;

  Modal.setup();

  fields.form.addEventListener('submit', saveParent);
  fields.code.addEventListener('input', onCodeInput);
  fields.parent.addEventListener('change', onParentChange);

  parentState.bound = true;
}

/**
 * Abre o modal de Nova Conta Pai.
 * @param {object} options
 * @param {string} [options.account_type] tipo sugerido (vindo do modal principal)
 * @param {string} [options.nature] natureza sugerida
 * @param {(created: object) => void|Promise<void>} [options.onCreated] callback pós-criação
 */
async function openParentModal({ account_type = '', nature = '', onCreated = null } = {}) {
  bindParentModal();

  const fields = getFields();
  if (!fields) return;

  parentState.onCreated = onCreated;

  fields.form.reset();
  fields.level.placeholder = 'Automático';
  fields.type.value = account_type || '';
  fields.nature.value = nature || '';
  setError('');
  setSaving(false);

  Modal.open(MODAL_ID, { focusSelector: '#coaParentCode' });

  try {
    await loadGroupOptions();
  } catch (error) {
    console.error('[chartOfAccountsParentModal] load error:', error);
    setError(error.message || 'Falha ao carregar contas superiores.');
  }
}

export { openParentModal };
