// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.modal.js — Estrutura e comportamento do modal          ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { MODAL_ID } from './transporters.config.js';

export function ensureTransporterModal() {
  const existing = document.getElementById(MODAL_ID);
  if (existing) return existing;

  const modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal modal-width-9 modal-height-7 is-hidden';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="modal__backdrop" data-modal-close="true"></div>

    <div class="modal__dialog">
      <section class="modal__panel modal-width-12 modal-height-12 transporter-modal-panel" role="dialog" aria-modal="true" aria-labelledby="tpmTitle">
        <header class="modal__header">
          <h2 id="tpmTitle" class="modal__title">Nova Transportadora</h2>

          <button type="button" class="modal__close" id="tpmCloseBtn"
            aria-label="Fechar modal" title="Fechar">&times;</button>
        </header>

        <form id="tpmForm" class="transporter-modal-form" autocomplete="off">
          <div class="modal__body modal-section">
            <div class="tpm-error is-hidden" id="tpmError"></div>

            <div class="transporter-modal-tabs" role="tablist" aria-label="Seções da transportadora">
              <button type="button" class="transporter-modal-tab is-active" data-tab="general" role="tab"
                aria-selected="true">Informações</button>
              <button type="button" class="transporter-modal-tab" data-tab="attachments" role="tab"
                aria-selected="false">Anexos</button>
            </div>

            <section class="tpm-tab-panel is-active" data-tab-panel="general" role="tabpanel">
            <div class="tpm-section-title">Identificação</div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-20 fields-font-3">
                <label for="tpm_legal_name">Razão Social *</label>
                <input id="tpm_legal_name" type="text" placeholder="Razão social" />
              </div>

              <div class="fields fields-h-6 fields-w-16 fields-font-3">
                <label for="tpm_trade_name">Nome Fantasia</label>
                <input id="tpm_trade_name" type="text" placeholder="Nome fantasia" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_tax_id">CNPJ</label>
                <input id="tpm_tax_id" type="text" placeholder="00.000.000/0000-00" inputmode="numeric" />
                <small id="tpmCnpjStatus" class="tpm-cnpj-status is-hidden" aria-live="polite"></small>
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_cpf">CPF</label>
                <input id="tpm_cpf" type="text" placeholder="000.000.000-00" />
              </div>
            </div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_state_registration">Inscrição Estadual</label>
                <input id="tpm_state_registration" type="text" placeholder="Inscrição estadual" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_municipal_registration">Inscrição Municipal</label>
                <input id="tpm_municipal_registration" type="text" placeholder="Inscrição municipal" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_rntrc">RNTRC</label>
                <input id="tpm_rntrc" type="text" placeholder="RNTRC" />
              </div>

              <div class="fields fields-h-6 fields-w-12 fields-font-3">
                <label for="tpm_is_active">Ativo</label>
                <select id="tpm_is_active">
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
            </div>

            <div class="tpm-section-title">Endereço</div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-12 fields-font-3">
                <label for="tpm_postal_code">CEP</label>
                <input id="tpm_postal_code" type="text" placeholder="00000-000" />
              </div>

              <div class="fields fields-h-6 fields-w-6 fields-font-3">
                <label for="tpm_street_type">Tipo</label>
                <input id="tpm_street_type" type="text" placeholder="Rua, Av." />
              </div>

              <div class="fields fields-h-6 fields-w-25 fields-font-3">
                <label for="tpm_street_name">Endereço</label>
                <input id="tpm_street_name" type="text" placeholder="Logradouro" />
              </div>

              <div class="fields fields-h-6 fields-w-6 fields-font-3">
                <label for="tpm_street_number">Número</label>
                <input id="tpm_street_number" type="text" placeholder="Número" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_address_complement">Complemento</label>
                <input id="tpm_address_complement" type="text" placeholder="Complemento" />
              </div>
            </div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-16 fields-font-3">
                <label for="tpm_neighborhood">Bairro</label>
                <input id="tpm_neighborhood" type="text" placeholder="Bairro" />
              </div>

              <div class="fields fields-h-6 fields-w-16 fields-font-3">
                <label for="tpm_city">Cidade</label>
                <input id="tpm_city" type="text" placeholder="Cidade" />
              </div>

              <div class="fields fields-h-6 fields-w-5 fields-font-3">
                <label for="tpm_state">UF</label>
                <input id="tpm_state" type="text" maxlength="2" placeholder="UF" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_ibge_location_id">Cód. IBGE (Município)</label>
                <input id="tpm_ibge_location_id" type="text" placeholder="Código IBGE" />
              </div>
            </div>

            <div class="tpm-section-title">Contato</div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-20 fields-font-3">
                <label for="tpm_contact_name">Contato</label>
                <input id="tpm_contact_name" type="text" placeholder="Nome do contato" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_phone_number">Telefone</label>
                <input id="tpm_phone_number" type="text" placeholder="(00) 0000-0000" />
              </div>

              <div class="fields fields-h-6 fields-w-15 fields-font-3">
                <label for="tpm_mobile_number">Celular</label>
                <input id="tpm_mobile_number" type="text" placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div class="tpm-section-title">Observações</div>

            <div class="fields-inline fields-gap-3">
              <div class="fields fields-h-6 fields-w-full fields-font-3">
                <label for="tpm_notes">Observações Internas</label>
                <textarea id="tpm_notes" rows="3" placeholder="Digite uma observação..."></textarea>
              </div>
            </div>
            </section>

            <section class="tpm-tab-panel" data-tab-panel="attachments" role="tabpanel">
            <div class="tpm-section-title">Anexos</div>

            <div class="transporter-files-layout">
              <div class="transporter-files-box">
                <span class="modal-box-title">Adicionar arquivos</span>

                <input id="tpm_attachment_input" type="file" hidden multiple />
                <button type="button" class="modal-dropzone transporter-dropzone" id="tpmSelectAttachmentBtn">
                  <strong>📎 Arraste os arquivos aqui</strong>
                  <span>ou clique para selecionar</span>
                  <span>Contratos, ANTT, seguros...</span>
                </button>
              </div>

              <div class="transporter-files-box transporter-attachments-column">
                <span class="modal-box-title">Anexos da Transportadora</span>

                <div class="table-scroll--rounded transporter-attachments-table-wrap">
                  <table class="table table-zebra table-zebra-hover tpm-attachments-table">
                    <thead>
                      <tr>
                        <th class="transporter-col-file">Arquivo</th>
                        <th class="transporter-col-size">Tamanho</th>
                        <th class="transporter-col-date">Data</th>
                        <th class="transporter-col-actions">Ações</th>
                      </tr>
                    </thead>
                    <tbody id="tpmAttachmentsTable"></tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="tpm-attachments-alert is-hidden" id="tpmAttachmentsAlert"></div>
            <div class="tpm-attachments-disabled" id="tpmAttachmentsDisabled">
              Salve a transportadora primeiro para habilitar os anexos.
            </div>
            </section>
          </div>

          <footer class="modal__footer">
            <button type="button" class="btn btn-cancel btn-sm" id="tpmCancelBtn">Cancelar</button>
            <button type="submit" class="btn btn-save btn-sm" id="tpmSaveBtn">Salvar Transportadora</button>
          </footer>
        </form>
      </section>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

export function getModalElements() {
  const overlay = ensureTransporterModal();
  return {
    overlay,
    form: overlay.querySelector('#tpmForm'),
    title: overlay.querySelector('#tpmTitle'),
    error: overlay.querySelector('#tpmError'),
    closeBtn: overlay.querySelector('#tpmCloseBtn'),
    cancelBtn: overlay.querySelector('#tpmCancelBtn'),
    saveBtn: overlay.querySelector('#tpmSaveBtn'),
    tabButtons: overlay.querySelectorAll('.transporter-modal-tab'),
    tabPanels: overlay.querySelectorAll('.tpm-tab-panel'),
    legal_name: overlay.querySelector('#tpm_legal_name'),
    trade_name: overlay.querySelector('#tpm_trade_name'),
    tax_id: overlay.querySelector('#tpm_tax_id'),
    cnpjStatus: overlay.querySelector('#tpmCnpjStatus'),
    cpf: overlay.querySelector('#tpm_cpf'),
    state_registration: overlay.querySelector('#tpm_state_registration'),
    municipal_registration: overlay.querySelector('#tpm_municipal_registration'),
    rntrc: overlay.querySelector('#tpm_rntrc'),
    street_type: overlay.querySelector('#tpm_street_type'),
    street_name: overlay.querySelector('#tpm_street_name'),
    street_number: overlay.querySelector('#tpm_street_number'),
    address_complement: overlay.querySelector('#tpm_address_complement'),
    neighborhood: overlay.querySelector('#tpm_neighborhood'),
    city: overlay.querySelector('#tpm_city'),
    state: overlay.querySelector('#tpm_state'),
    ibge_location_id: overlay.querySelector('#tpm_ibge_location_id'),
    postal_code: overlay.querySelector('#tpm_postal_code'),
    contact_name: overlay.querySelector('#tpm_contact_name'),
    phone_number: overlay.querySelector('#tpm_phone_number'),
    mobile_number: overlay.querySelector('#tpm_mobile_number'),
    is_active: overlay.querySelector('#tpm_is_active'),
    notes: overlay.querySelector('#tpm_notes'),
    attachmentInput: overlay.querySelector('#tpm_attachment_input'),
    selectAttachmentBtn: overlay.querySelector('#tpmSelectAttachmentBtn'),
    attachmentsTable: overlay.querySelector('#tpmAttachmentsTable'),
    attachmentsAlert: overlay.querySelector('#tpmAttachmentsAlert'),
    attachmentsDisabled: overlay.querySelector('#tpmAttachmentsDisabled')
  };
}

export function setActiveModalTab(tabName = 'general') {
  const els = getModalElements();
  els.tabButtons.forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  els.tabPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.tabPanel === tabName);
  });
  els.overlay.querySelector('.modal__body')?.scrollTo(0, 0);
}

export function openTransporterModal() {
  const els = getModalElements();

  // O modals.css global do CONSART exibe o modal através da classe .is-open.
  els.overlay.hidden = false;
  els.overlay.classList.remove('is-hidden');
  els.overlay.classList.add('is-open');
  els.overlay.setAttribute('aria-hidden', 'false');

  document.body.classList.add('modal-open');
  document.body.classList.add('tpm-body-lock');

  setActiveModalTab('general');

  requestAnimationFrame(() => {
    els.legal_name?.focus({ preventScroll: true });
  });
}

export function closeTransporterModal() {
  const els = getModalElements();

  els.overlay.classList.remove('is-open');
  els.overlay.classList.add('is-hidden');
  els.overlay.setAttribute('aria-hidden', 'true');
  els.overlay.hidden = true;

  document.body.classList.remove('tpm-body-lock');

  const hasOpenModal = document.querySelector('.modal.is-open:not([hidden])');
  if (!hasOpenModal) {
    document.body.classList.remove('modal-open');
  }
}

export function setTransporterModalMode(mode = 'create', id = null) {
  const els = getModalElements();
  const isEdit = mode === 'edit';

  els.title.textContent = isEdit
    ? `Editar Transportadora${id ? ` #${id}` : ''}`
    : 'Nova Transportadora';
  els.saveBtn.textContent = isEdit
    ? 'Atualizar Transportadora'
    : 'Salvar Transportadora';
}

export function showTransporterModalError(message = '') {
  const els = getModalElements();
  els.error.classList.toggle('is-hidden', !message);
  els.error.textContent = message || '';
}


export function showCnpjLookupStatus(message = '', type = 'info') {
  const els = getModalElements();
  if (!els.cnpjStatus) return;

  els.cnpjStatus.classList.toggle('is-hidden', !message);
  els.cnpjStatus.textContent = message || '';
  els.cnpjStatus.dataset.type = message ? type : '';
}

export function showAttachmentsAlert(message = '', type = 'info') {
  const els = getModalElements();
  els.attachmentsAlert.classList.toggle('is-hidden', !message);
  els.attachmentsAlert.textContent = message || '';
  els.attachmentsAlert.dataset.type = message ? type : '';
}

export function setAttachmentsEnabled(enabled = false) {
  const els = getModalElements();
  els.selectAttachmentBtn.disabled = !enabled;
  els.attachmentsDisabled.classList.toggle('is-hidden', enabled);
}

export function setTransporterModalLoading(isLoading = false) {
  const els = getModalElements();
  els.saveBtn.disabled = isLoading;
  els.cancelBtn.disabled = isLoading;
  els.closeBtn.disabled = isLoading;

  if (isLoading) {
    if (!els.saveBtn.dataset.originalText) {
      els.saveBtn.dataset.originalText = els.saveBtn.textContent;
    }
    els.saveBtn.textContent = 'Salvando...';
  } else if (els.saveBtn.dataset.originalText) {
    els.saveBtn.textContent = els.saveBtn.dataset.originalText;
    delete els.saveBtn.dataset.originalText;
  }
}

export function bindTransporterModal({ onSave, onUploadAttachments, onDeleteAttachment } = {}) {
  const els = getModalElements();
  if (els.overlay.dataset.bound === 'true') return;
  els.overlay.dataset.bound = 'true';

  els.overlay.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-close="true"]') && !els.saveBtn.disabled) {
      closeTransporterModal();
    }
  });

  els.closeBtn.addEventListener('click', () => {
    if (!els.closeBtn.disabled) closeTransporterModal();
  });

  els.cancelBtn.addEventListener('click', () => {
    if (!els.cancelBtn.disabled) closeTransporterModal();
  });

  els.tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveModalTab(button.dataset.tab || 'general'));
  });

  document.addEventListener('keydown', (event) => {
    if (
      event.key === 'Escape' &&
      !els.overlay.classList.contains('is-hidden') &&
      !els.saveBtn.disabled
    ) {
      closeTransporterModal();
    }
  });

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (typeof onSave === 'function') await onSave();
  });

  els.selectAttachmentBtn.addEventListener('click', () => els.attachmentInput.click());

  // Drag and drop: impede o navegador de abrir o arquivo se ele cair fora da área
  ['dragover', 'drop'].forEach((type) => {
    els.overlay.addEventListener(type, (event) => event.preventDefault());
  });

  const dropzone = els.selectAttachmentBtn;
  const setDragOver = (active) => {
    dropzone.classList.toggle('is-dragover', active && !dropzone.disabled);
  };

  ['dragenter', 'dragover'].forEach((type) => {
    dropzone.addEventListener(type, (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = dropzone.disabled ? 'none' : 'copy';
      }
      setDragOver(true);
    });
  });

  dropzone.addEventListener('dragleave', (event) => {
    if (!dropzone.contains(event.relatedTarget)) setDragOver(false);
  });

  dropzone.addEventListener('drop', async (event) => {
    event.preventDefault();
    setDragOver(false);
    if (dropzone.disabled) return;

    const files = event.dataTransfer?.files;
    if (files?.length && typeof onUploadAttachments === 'function') {
      await onUploadAttachments(files);
    }
  });

  els.attachmentInput.addEventListener('change', async () => {
    if (typeof onUploadAttachments === 'function') {
      await onUploadAttachments(els.attachmentInput.files);
    }
  });

  els.attachmentsTable.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-attachment-delete]');
    if (!button || typeof onDeleteAttachment !== 'function') return;
    await onDeleteAttachment(button.dataset.attachmentDelete);
  });
}
