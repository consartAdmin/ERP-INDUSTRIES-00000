import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { $ } from './labelParameters.utils.js';

export const toast = {
  info: (title, message, timeoutMs = 3800) =>
    showCenterModal({ variant: 'info', title, message, timeoutMs }),
  success: (title, message, timeoutMs = 4200) =>
    showCenterModal({ variant: 'success', title, message, timeoutMs }),
  warn: (title, message) =>
    showCenterModal({ variant: 'warning', title, message }),
  error: (title, message) =>
    showCenterModal({ variant: 'error', title, message }),
};

const DESIGNER_MODAL_ID = 'labelDesignerModal';

function findDesignerSection() {
  return (
    $('#labelParameterEditor') ||
    $('#labelParametersForm')?.closest('article') ||
    $('#labelDesignerSection') ||
    $('#labelPreviewCanvas')?.closest('fieldset') ||
    $('#labelPreviewCanvas')?.parentElement
  );
}

function ensureDesignerModal() {
  let modal = $(`#${DESIGNER_MODAL_ID}`);
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = DESIGNER_MODAL_ID;
  modal.className = 'lp-designer-modal';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="lp-designer-modal__backdrop" data-designer-modal-close></div>
    <section class="lp-designer-modal__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="labelDesignerModalTitle">
      <header class="lp-designer-modal__header">
        <div>
          <h2 id="labelDesignerModalTitle">Designer da Etiqueta</h2>
          <p>Posicione e configure os elementos da etiqueta.</p>
        </div>
        <button type="button"
          class="lp-designer-modal__close"
          data-designer-modal-close
          aria-label="Fechar designer">×</button>
      </header>
      <div class="lp-designer-modal__label-size" aria-label="Tamanho da etiqueta">
        <strong>Tamanho da etiqueta</strong>
        <label for="labelDesignerWidthMm">Largura (mm)
          <input id="labelDesignerWidthMm" type="number" min="10" step="0.1" inputmode="decimal" />
        </label>
        <label for="labelDesignerHeightMm">Altura (mm)
          <input id="labelDesignerHeightMm" type="number" min="10" step="0.1" inputmode="decimal" />
        </label>
      </div>
      <div class="lp-designer-modal__body"></div>
      <footer class="lp-designer-modal__footer">
        <button type="button"
          class="btn btn-primary"
          data-designer-modal-close>
          Concluir
        </button>
      </footer>
    </section>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-designer-modal-close]').forEach((element) => {
    element.addEventListener('click', closeDesignerModal);
  });

  const bindDimension = (modalInputId, formInputId) => {
    const modalInput = $(`#${modalInputId}`, modal);
    const formInput = $(`#${formInputId}`);
    if (!modalInput || !formInput) return;
    modalInput.addEventListener('input', () => {
      formInput.value = modalInput.value;
      formInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  bindDimension('labelDesignerWidthMm', 'label_width_mm');
  bindDimension('labelDesignerHeightMm', 'label_height_mm');

  return modal;
}

export function openDesignerModal() {
  const section = findDesignerSection();
  const modal = ensureDesignerModal();
  const body = $('.lp-designer-modal__body', modal);
  if (!section || !body) return;

  section.hidden = false;
  section.removeAttribute('aria-hidden');
  body.appendChild(section);

  const widthInput = $('#labelDesignerWidthMm', modal);
  const heightInput = $('#labelDesignerHeightMm', modal);
  if (widthInput) widthInput.value = $('#label_width_mm')?.value || '60';
  if (heightInput) heightInput.value = $('#label_height_mm')?.value || '30';

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('lp-designer-modal-open');
  $('.lp-designer-modal__close', modal)?.focus();
}

export function closeDesignerModal() {
  const modal = $(`#${DESIGNER_MODAL_ID}`);
  if (!modal || modal.hidden) return;
  const section = findDesignerSection();
  if (section) {
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
  }
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('lp-designer-modal-open');
}

export function bindDesignerModalKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDesignerModal();
  });
}
