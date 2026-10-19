// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.modal.js                                 ║
// ║ MODULE: Products Fiscal Batch — Modal                              ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function confirmCenterModal({
  title = 'Confirmar ação',
  message = 'Deseja continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pfb-confirm-overlay';

    overlay.innerHTML = `
      <div class="pfb-confirm-card" role="dialog" aria-modal="true" aria-label="${title}">
        <header class="pfb-confirm-head">
          <strong>${title}</strong>
        </header>

        <div class="pfb-confirm-body">${message}</div>

        <footer class="pfb-confirm-foot">
          <button type="button" class="btn btn-toolbar btn-sm" data-action="cancel">
            ${cancelText}
          </button>

          <button type="button" class="btn btn-toolbar btn-sm" data-action="confirm">
            ${confirmText}
          </button>
        </footer>
      </div>
    `;

    let finished = false;

    function close(result) {
      if (finished) return;
      finished = true;
      document.removeEventListener('keydown', handleEscape);
      overlay.remove();
      resolve(result);
    }

    function handleEscape(event) {
      if (event.key === 'Escape') close(false);
    }

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(false);
    });

    overlay
      .querySelector('[data-action="cancel"]')
      .addEventListener('click', () => close(false));

    overlay
      .querySelector('[data-action="confirm"]')
      .addEventListener('click', () => close(true));

    document.addEventListener('keydown', handleEscape);
    document.body.appendChild(overlay);

    overlay.querySelector('[data-action="cancel"]').focus();
  });
}

