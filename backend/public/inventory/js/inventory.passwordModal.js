// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inventory.passwordModal.js — Password modal                        ║
// ║ PRODNEX ERP | Inventário                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

let cancelActiveModal = null;

export function askPasswordModal({
  title = 'Senha requerida',
  subtitle = 'Digite a senha para continuar.',
} = {}) {
  const modal = document.getElementById('passwordModal');
  const titleEl = document.getElementById('passwordModalTitle');
  const subtitleEl = document.getElementById('passwordModalSubtitle');
  const input = document.getElementById('passwordModalInput');
  const errorBox = document.getElementById('passwordModalError');
  const closeButton = document.getElementById('passwordModalClose');
  const cancelButton = document.getElementById('passwordModalCancel');
  const confirmButton = document.getElementById('passwordModalOk');

  if (
    !modal ||
    !input ||
    !closeButton ||
    !cancelButton ||
    !confirmButton
  ) {
    const password = window.prompt(subtitle);

    return Promise.resolve(
      password === null ? null : String(password).trim()
    );
  }

  if (typeof cancelActiveModal === 'function') {
    cancelActiveModal();
  }

  titleEl && (titleEl.textContent = title);
  subtitleEl && (subtitleEl.textContent = subtitle);

  return new Promise((resolve) => {
    let settled = false;

    const clearError = () => {
      if (!errorBox) return;
      errorBox.textContent = '';
      errorBox.hidden = true;
    };

    const showError = (message) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.hidden = false;
    };

    // Overlay, centralização e z-index vêm do modals.css via .is-open
    const close = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };

    const cleanup = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      closeButton.removeEventListener('click', onCancel);
      cancelButton.removeEventListener('click', onCancel);
      confirmButton.removeEventListener('click', onConfirm);
      modal.removeEventListener('click', onBackdrop);
      input.removeEventListener('input', clearError);
    };

    const finish = (value) => {
      if (settled) return;

      settled = true;
      cleanup();
      close();

      if (cancelActiveModal === onCancel) {
        cancelActiveModal = null;
      }

      resolve(value);
    };

    function onCancel(event) {
      event?.preventDefault();
      event?.stopPropagation();
      finish(null);
    }

    function onConfirm(event) {
      event?.preventDefault();
      event?.stopPropagation();

      const password = String(input.value || '').trim();

      if (!password) {
        showError('Informe a senha para continuar.');
        input.focus();
        return;
      }

      finish(password);
    }

    function onBackdrop(event) {
      if (event.target.closest('[data-password-modal-close]')) {
        onCancel(event);
      }
    }

    function onKeyDown(event) {
      if (!modal.classList.contains('is-open')) return;

      if (event.key === 'Escape') {
        onCancel(event);
        return;
      }

      if (event.key === 'Enter') {
        onConfirm(event);
      }
    }

    cancelActiveModal = onCancel;

    clearError();
    input.value = '';

    closeButton.addEventListener('click', onCancel);
    cancelButton.addEventListener('click', onCancel);
    confirmButton.addEventListener('click', onConfirm);
    modal.addEventListener('click', onBackdrop);
    input.addEventListener('input', clearError);
    document.addEventListener('keydown', onKeyDown, true);

    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  });
}