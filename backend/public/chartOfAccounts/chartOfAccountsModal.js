/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ FILE: chartOfAccountsModal.js                                       ║
   ║ MODULE: Chart Of Accounts                                           ║
   ║ DESCRIPTION: Modal de criação/edição do Plano de Contas             ║
   ║ PRODNEX ERP · ESM                                                   ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

import { Modal } from '/public/includes/js/modal.js';
import { openParentModal } from './chartOfAccountsParentModal.js';

const API_BASE = '/api/chart-of-accounts';
const MODAL_ID = 'chart-of-accounts-modal';

const modalState = {
  mode: 'create',
  id: null,
  saving: false,
  loadedParents: false,
  onSaved: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  if (typeof window.toast === 'function') {
    window.toast(message, type);
    return;
  }
  console.log(`[${type}] ${message}`);
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
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

function getModal() {
  return document.getElementById(MODAL_ID);
}

function ensureModal() {
  let modal = getModal();
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal__backdrop" data-close="true"></div>

    <div class="modal__dialog">
      <section class="modal__panel modal-width-6" role="dialog" aria-modal="true" aria-labelledby="coaModalTitle">

        <header class="modal__header modal-header-color-3">
          <h3 id="coaModalTitle" class="modal__title">Nova Conta</h3>
          <button type="button" class="modal__close" id="coaModalCloseBtn" aria-label="Fechar" title="Fechar">×</button>
        </header>

        <div class="modal__body">
          <form id="coaModalForm" novalidate>
            <p id="coaModalSubtitle" class="coa-modal__subtitle">Preencha os dados da conta contábil.</p>

            <div class="modal-form-grid modal-form-grid--3">
              <div class="fields fields-h-6 fields-w-full">
                <label for="coaCode">Código</label>
                <input type="text" id="coaCode" name="code" placeholder="Ex: 1.1.1.001" autocomplete="off" />
              </div>

              <div class="fields fields-h-6 fields-w-full modal-field--span-2">
                <label for="coaDescription">Descrição</label>
                <input type="text" id="coaDescription" name="description" placeholder="Ex: Caixa" autocomplete="off" />
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaType">Tipo</label>
                <select id="coaType" name="account_type">
                  <option value="">Selecione...</option>
                  <option value="ASSET">Ativo</option>
                  <option value="LIABILITY">Passivo</option>
                  <option value="EQUITY">Patrimônio Líquido</option>
                  <option value="REVENUE">Receita</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaNature">Natureza</label>
                <select id="coaNature" name="nature">
                  <option value="">Selecione...</option>
                  <option value="DEBIT">Débito</option>
                  <option value="CREDIT">Crédito</option>
                </select>
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaLevel">Nível</label>
                <input type="number" id="coaLevel" name="level" min="1" step="1" placeholder="Ex: 4" />
              </div>

              <div class="fields fields-h-6 fields-w-full modal-field--span-2">
                <label for="coaParent">Conta Pai</label>
                <div class="inline-field">
                  <select id="coaParent" name="parent_account_id">
                    <option value="">Sem conta pai</option>
                  </select>
                  <button type="button" id="coaNewParentBtn" class="btn btn-new btn-sm"
                    title="Cadastrar nova conta pai" aria-label="Cadastrar nova conta pai">＋ Nova</button>
                </div>
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaPosting">Aceita Lançamento</label>
                <select id="coaPosting" name="allows_posting">
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>

              <div class="fields fields-h-6 fields-w-full">
                <label for="coaActive">Status</label>
                <select id="coaActive" name="is_active">
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </div>

              <div class="fields fields-w-full modal-field--span-full">
                <label for="coaNotes">Observações</label>
                <textarea id="coaNotes" name="notes" rows="4" placeholder="Observações da conta..."></textarea>
              </div>
            </div>

            <div id="coaModalError" class="coa-modal__error hidden"></div>
          </form>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <button type="button" id="coaModalCancelBtn" class="btn btn-cancel btn-sm">Cancelar</button>
          <button type="submit" id="coaModalSaveBtn" class="btn btn-save btn-sm" form="coaModalForm">Salvar</button>
        </footer>

      </section>
    </div>
  `;

  document.body.appendChild(modal);
  bindModalEvents(modal);
  return modal;
}

function getFields() {
  const modal = getModal();
  if (!modal) return null;

  return {
    modal,
    form: modal.querySelector('#coaModalForm'),
    title: modal.querySelector('#coaModalTitle'),
    subtitle: modal.querySelector('#coaModalSubtitle'),
    closeBtn: modal.querySelector('#coaModalCloseBtn'),
    cancelBtn: modal.querySelector('#coaModalCancelBtn'),
    saveBtn: modal.querySelector('#coaModalSaveBtn'),
    errorBox: modal.querySelector('#coaModalError'),

    code: modal.querySelector('#coaCode'),
    description: modal.querySelector('#coaDescription'),
    type: modal.querySelector('#coaType'),
    nature: modal.querySelector('#coaNature'),
    level: modal.querySelector('#coaLevel'),
    parent: modal.querySelector('#coaParent'),
    newParentBtn: modal.querySelector('#coaNewParentBtn'),
    posting: modal.querySelector('#coaPosting'),
    active: modal.querySelector('#coaActive'),
    notes: modal.querySelector('#coaNotes'),
  };
}

function inferLevelFromCode(code) {
  const safe = String(code || '').trim();
  if (!safe) return 1;
  return safe.split('.').filter(Boolean).length || 1;
}

function normalizeBooleanString(value, fallback = 'true') {
  if (value === true || String(value).toLowerCase() === 'true') return 'true';
  if (value === false || String(value).toLowerCase() === 'false') return 'false';
  return fallback;
}

function setError(message = '') {
  const fields = getFields();
  if (!fields?.errorBox) return;

  if (!message) {
    fields.errorBox.textContent = '';
    fields.errorBox.classList.add('hidden');
    return;
  }

  fields.errorBox.textContent = message;
  fields.errorBox.classList.remove('hidden');
}

function setSaving(isSaving) {
  modalState.saving = isSaving;
  const fields = getFields();
  if (!fields) return;

  fields.saveBtn.disabled = isSaving;
  fields.cancelBtn.disabled = isSaving;
  fields.closeBtn.disabled = isSaving;

  fields.saveBtn.textContent = isSaving ? 'Salvando...' : 'Salvar';
}

function resetForm() {
  const fields = getFields();
  if (!fields) return;

  fields.form.reset();
  fields.parent.innerHTML = `<option value="">Sem conta pai</option>`;
  fields.posting.value = 'true';
  fields.active.value = 'true';
  fields.level.value = '';
  setError('');
}

async function loadParentOptions({ selectedId = null, excludeId = null } = {}) {
  const fields = getFields();
  if (!fields?.parent) return;

  const response = await fetchJson(`${API_BASE}/flat?is_active=true`);
  const rows = Array.isArray(response?.data) ? response.data : [];

  const options = ['<option value="">Sem conta pai</option>'];

  for (const row of rows) {
    if (excludeId && Number(row.id) === Number(excludeId)) continue;

    const selected = selectedId && Number(selectedId) === Number(row.id) ? 'selected' : '';
    const label = escapeHtml(row.label || `${row.code} - ${row.description}`);

    options.push(`<option value="${row.id}" ${selected}>${label}</option>`);
  }

  fields.parent.innerHTML = options.join('');
  modalState.loadedParents = true;
}

function fillForm(data = {}) {
  const fields = getFields();
  if (!fields) return;

  fields.code.value = data.code ?? '';
  fields.description.value = data.description ?? '';
  fields.type.value = data.account_type ?? '';
  fields.nature.value = data.nature ?? '';
  fields.level.value = data.level ?? inferLevelFromCode(data.code ?? '');
  fields.posting.value = normalizeBooleanString(data.allows_posting, 'true');
  fields.active.value = normalizeBooleanString(data.is_active, 'true');
  fields.notes.value = data.notes ?? '';
}

async function loadAccount(id) {
  const response = await fetchJson(`${API_BASE}/${id}`);
  return response?.data || null;
}

function buildPayload() {
  const fields = getFields();
  if (!fields) return null;

  const code = fields.code.value.trim();
  const description = fields.description.value.trim();
  const account_type = fields.type.value;
  const nature = fields.nature.value;
  const levelRaw = fields.level.value.trim();
  const parentRaw = fields.parent.value;
  const allows_posting = fields.posting.value === 'true';
  const is_active = fields.active.value === 'true';
  const notes = fields.notes.value.trim();

  const level = levelRaw ? Number(levelRaw) : inferLevelFromCode(code);

  if (!code) throw new Error('Informe o código da conta.');
  if (!description) throw new Error('Informe a descrição da conta.');
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
    allows_posting,
    is_active,
    notes: notes || null,
  };
}

async function saveForm(event) {
  event.preventDefault();
  if (modalState.saving) return;

  try {
    setError('');
    setSaving(true);

    const payload = buildPayload();
    let saved = null;

    if (modalState.mode === 'edit' && modalState.id) {
      await fetchJson(`${API_BASE}/${modalState.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Conta atualizada com sucesso.', 'success');
    } else {
      const res = await fetchJson(`${API_BASE}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Conta criada com sucesso.', 'success');
      saved = res?.data ?? res;
    }

    closeChartOfAccountsModal();

    // Callback opcional de quem abriu o modal (ex.: Edição de Clientes)
    if (typeof modalState.onSaved === 'function') {
      modalState.onSaved(saved);
    }

    if (typeof window.chartOfAccountsReload === 'function') {
      window.chartOfAccountsReload();
    }
  } catch (error) {
    console.error('[chartOfAccountsModal] save error:', error);
    setError(error.message || 'Falha ao salvar conta.');
  } finally {
    setSaving(false);
  }
}

function onNewParentClick() {
  const fields = getFields();
  if (!fields || modalState.saving) return;

  openParentModal({
    account_type: fields.type.value,
    nature: fields.nature.value,
    onCreated: async (created) => {
      showToast('Conta pai criada com sucesso.', 'success');

      try {
        await loadParentOptions({
          selectedId: created?.id ?? null,
          excludeId: modalState.mode === 'edit' ? modalState.id : null,
        });
      } catch (error) {
        console.error('[chartOfAccountsModal] reload parents error:', error);
        setError(error.message || 'Falha ao recarregar contas pai.');
      }

      if (typeof window.chartOfAccountsReload === 'function') {
        window.chartOfAccountsReload();
      }
    },
  });
}

function onCodeInput() {
  const fields = getFields();
  if (!fields?.code || !fields?.level) return;

  const code = fields.code.value.trim();
  if (!fields.level.value.trim()) {
    fields.level.value = String(inferLevelFromCode(code));
  }
}

function closeChartOfAccountsModal() {
  const modal = getModal();
  if (!modal) return;

  Modal.close(modal);
  setError('');
}

function openModalUi() {
  const modal = ensureModal();
  Modal.open(modal, { focusSelector: '#coaCode' });
}

async function openChartOfAccountsModal({ mode = 'create', id = null, onSaved = null } = {}) {
  ensureModal();
  resetForm();

  modalState.onSaved = onSaved;

  modalState.mode = mode === 'edit' ? 'edit' : 'create';
  modalState.id = id ? Number(id) : null;
  modalState.loadedParents = false;

  const fields = getFields();
  if (!fields) return;

  fields.title.textContent = modalState.mode === 'edit' ? 'Editar Conta' : 'Nova Conta';
  fields.subtitle.textContent = modalState.mode === 'edit'
    ? 'Atualize os dados da conta contábil.'
    : 'Preencha os dados da nova conta contábil.';

  openModalUi();

  try {
    if (modalState.mode === 'edit' && modalState.id) {
      const data = await loadAccount(modalState.id);
      if (!data) throw new Error('Conta não encontrada.');

      fillForm(data);
      await loadParentOptions({
        selectedId: data.parent_account_id,
        excludeId: data.id,
      });
    } else {
      await loadParentOptions();
    }
  } catch (error) {
    console.error('[chartOfAccountsModal] open error:', error);
    setError(error.message || 'Falha ao carregar dados do modal.');
  }
}

function bindModalEvents(modal) {
  const fields = getFields();
  if (!fields) return;

  modal.addEventListener('click', (event) => {
    const closeTarget = event.target.closest('[data-close="true"]');
    if (closeTarget && !modalState.saving) {
      closeChartOfAccountsModal();
    }
  });

  fields.closeBtn.addEventListener('click', () => {
    if (!modalState.saving) closeChartOfAccountsModal();
  });

  fields.cancelBtn.addEventListener('click', () => {
    if (!modalState.saving) closeChartOfAccountsModal();
  });

  fields.form.addEventListener('submit', saveForm);
  fields.code.addEventListener('input', onCodeInput);
  fields.newParentBtn.addEventListener('click', onNewParentClick);

  // ESC e foco ficam com o controlador global (modal.js)
  Modal.setup();
}

window.openChartOfAccountsModal = openChartOfAccountsModal;
window.closeChartOfAccountsModal = closeChartOfAccountsModal;

export {
  openChartOfAccountsModal,
  closeChartOfAccountsModal,
};