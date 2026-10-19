import { dom } from './prices.state.js';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';


let toastTimer = null;
const EDITOR_MODAL_ID = 'priceEditorModal';

function bindExistingModal(modal) {
  if (!modal || modal.dataset.priceModalBound === 'true') return modal;

  modal.dataset.priceModalBound = 'true';

  modal.querySelectorAll('[data-price-modal-close]').forEach((element) => {
    element.addEventListener('click', closePriceEditorModal);
  });

  return modal;
}

export function ensurePriceEditorModal() {
  let modal = document.getElementById(EDITOR_MODAL_ID);
  if (modal) return bindExistingModal(modal);

  modal = document.createElement('div');
  modal.id = EDITOR_MODAL_ID;
  modal.className = 'modal modal-width-6 modal-height-auto';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');

  modal.innerHTML = `
    <div class="modal__backdrop" data-price-modal-close></div>

    <div class="modal__dialog">
      <section class="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formTitle">

        <header class="modal__header">
          <div>
            <h2 id="formTitle" class="modal__title">
              Nova Tabela de Preço
            </h2>
            <p id="formSubtitle" class="modal__subtitle">
              Preencha os campos abaixo para cadastrar uma nova tabela.
            </p>
          </div>

          <div class="btn-inline">
            <span id="formModeBadge" class="badge badge-neutral">NOVO</span>
            <button
              type="button"
              class="btn btn-clean btn-sm"
              data-price-modal-close
              aria-label="Fechar">
              ×
            </button>
          </div>
        </header>

        <div class="modal__body">
          <form id="priceForm" novalidate>
            <input type="hidden" id="priceId">

            <div class="fields-lines fields-gap-3">
              <div class="fields-inline fields-gap-3">
                <div class="fields fields-h-6 fields-w-20 fields-font-3">
                  <label for="priceName">
                    Nome da Tabela <span class="required">*</span>
                  </label>
                  <input
                    id="priceName"
                    name="priceName"
                    type="text"
                    maxlength="100"
                    placeholder="Ex.: VAREJO, ATACADO, PROMOCIONAL"
                    required>
                </div>

                <div class="fields fields-h-6 fields-w-8 fields-font-3">
                  <label class="checkbox-line" for="priceActive">
                    <input id="priceActive" type="checkbox" checked>
                    <span>Ativa</span>
                  </label>
                </div>
              </div>

              <div class="fields fields-font-3">
                <label for="priceDescription">Descrição</label>
                <textarea
                  id="priceDescription"
                  name="priceDescription"
                  rows="6"
                  placeholder="Descreva a finalidade desta tabela de preço..."></textarea>
              </div>

              <div class="fields-inline fields-gap-3">
                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                  <label for="createdAt">Criado em</label>
                  <input
                    id="createdAt"
                    type="text"
                    readonly
                    placeholder="Preenchido automaticamente">
                </div>

                <div class="fields fields-h-6 fields-w-15 fields-font-3">
                  <label for="updatedAt">Atualizado em</label>
                  <input
                    id="updatedAt"
                    type="text"
                    readonly
                    placeholder="Preenchido automaticamente">
                </div>
              </div>
            </div>
          </form>
        </div>

        <footer class="modal__footer">
          <button
            id="btnCancelarEdicao"
            class="btn btn-clean btn-sm"
            type="button">
            Cancelar
          </button>

          <button
            id="btnSalvar"
            class="btn btn-save btn-sm"
            type="submit"
            form="priceForm">
            Salvar
          </button>
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(modal);

  return bindExistingModal(modal);
}

export function openPriceEditorModal() {
  const modal = ensurePriceEditorModal();
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('modal-open');
}

export function closePriceEditorModal() {
  const modal = document.getElementById(EDITOR_MODAL_ID);
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

export function bindPriceEditorModalKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePriceEditorModal();
  });
}

export function showToast(message, type = 'info') {
  if (!dom.toast) return;
  dom.toast.textContent = message || '';
  dom.toast.className = `toast ${type}`;
  dom.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.hidden = true;
  }, 3200);
}

export function confirmDeactivate() {
  return showCenterModal({
    variant: 'warning',
    title: 'Inativar tabela',
    message: 'Deseja realmente inativar esta tabela de preço?',
    closeOnEscape: false,
    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => false,
      },
      {
        label: 'Inativar',
        variant: 'confirm',
        action: () => true,
      },
    ],
  });
}

export function confirmPermanentDelete() {
  return showCenterModal({
    variant: 'error',
    title: 'Excluir tabela',
    message:
      'Deseja excluir permanentemente esta tabela de preço? Esta ação não poderá ser desfeita.',
    closeOnEscape: false,
    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => false,
      },
      {
        label: 'Excluir',
        variant: 'danger',
        action: () => true,
      },
    ],
  });
}

export function confirmRestore() {
  return showCenterModal({
    variant: 'info',
    title: 'Restaurar tabela',
    message: 'Deseja restaurar esta tabela de preço?',
    closeOnEscape: false,
    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => false,
      },
      {
        label: 'Restaurar',
        variant: 'confirm',
        action: () => true,
      },
    ],
  });
}