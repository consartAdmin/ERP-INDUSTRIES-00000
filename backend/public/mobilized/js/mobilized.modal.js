'use strict';

import { dom, fields, itemFields, state } from './mobilized.state.js';
import { fillItem } from './mobilized.form.js';

let details = null;
let onItemImageRefresh = () => { };

export function configureModal({ refreshItemImage }) {
  onItemImageRefresh = refreshItemImage || onItemImageRefresh;
}

export function buildDetailsModal() {
  if (!dom.editor) throw new Error('Elemento ".mz-editor" não encontrado.');

  document.querySelector('#mobilizedDetailsModal')?.remove();

  const root = document.createElement('div');
  root.id = 'mobilizedDetailsModal';
  root.className = 'modal modal-width-10 modal-height-10 modal-header-color-3 modal-footer-color-3';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');

  const backdrop = document.createElement('div');
  backdrop.id = 'mobilizedDetailsModalBackdrop';
  backdrop.className = 'modal__backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const dialog = document.createElement('div');
  dialog.className = 'modal__dialog';

  const editorHead = dom.editor.querySelector('.mz-editor__head');
  const editorBody = dom.editor.querySelector('.mz-card__body');
  const heading = editorHead?.querySelector(':scope > div:first-child');
  const actions = editorHead?.querySelector('.mz-actions');
  const title = editorHead?.querySelector('.mz-h2');

  dom.editor.classList.add('modal__panel');
  dom.editor.setAttribute('role', 'dialog');
  dom.editor.setAttribute('aria-modal', 'true');
  dom.editor.setAttribute('aria-labelledby', 'mobilizedDetailsModalTitle');
  dom.editor.tabIndex = -1;

  const header = document.createElement('header');
  header.className = 'modal__header';

  if (title) {
    title.id = 'mobilizedDetailsModalTitle';
    title.classList.add('modal__title');
  }

  if (heading) header.appendChild(heading);

  const close = document.createElement('button');
  close.id = 'btnCloseMobilizedDetails';
  close.className = 'modal__close';
  close.type = 'button';
  close.title = 'Fechar';
  close.setAttribute('aria-label', 'Fechar detalhes do mobilizado');
  close.textContent = '✕';
  header.appendChild(close);

  if (editorBody) editorBody.classList.add('modal__body');

  const footer = document.createElement('footer');
  footer.className = 'modal__footer';
  if (actions) footer.appendChild(actions);

  editorHead?.remove();
  dom.editor.prepend(header);
  if (editorBody) dom.editor.appendChild(editorBody);
  dom.editor.appendChild(footer);

  dialog.appendChild(dom.editor);
  root.append(backdrop, dialog);
  document.body.appendChild(root);

  details = { root, backdrop, dialog, panel: dom.editor, close };
  state.detailsReady = true;

  close.addEventListener('click', closeDetailsModal);
  backdrop.addEventListener('click', closeDetailsModal);
}

export function isDetailsOpen() {
  return Boolean(details?.root.classList.contains('is-open'));
}

export function openDetailsModal({ focusTitle = false } = {}) {
  if (!details) buildDetailsModal();
  state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  details.root.hidden = false;
  details.root.classList.add('is-open');
  details.root.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    if (focusTitle) fields.title?.focus();
    else details.panel.focus({ preventScroll: true });
  });
}

export function closeDetailsModal() {
  if (!isDetailsOpen()) return;

  details.root.classList.remove('is-open');
  details.root.hidden = true;
  details.root.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');

  if (state.lastFocusedElement?.isConnected) state.lastFocusedElement.focus({ preventScroll: true });
  state.lastFocusedElement = null;
}

export function openItemModal(row = null) {
  fillItem(row); onItemImageRefresh();

  // The details modal is created dynamically and can otherwise be painted
  // above this modal. Move the item modal to the end of <body> and give it
  // a z-index higher than the currently open details layer.
  document.body.appendChild(dom.itemModal);
  const detailsModal = document.querySelector('#mobilizedDetailsModal');
  const detailsZIndex = Number.parseInt(
    detailsModal ? getComputedStyle(detailsModal).zIndex : '',
    10
  );
  dom.itemModal.style.setProperty(
    'z-index',
    String(Number.isFinite(detailsZIndex) ? detailsZIndex + 10 : 10010),
    'important'
  );

  dom.itemModal.hidden = false;
  dom.itemModal.classList.add('is-open');
  dom.itemModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => itemFields.description?.focus());
}

export function closeItemModal() {
  if (!dom.itemModal) return;

  dom.itemModal.classList.remove('is-open');
  dom.itemModal.hidden = true;
  dom.itemModal.setAttribute('aria-hidden', 'true');

  if (!isDetailsOpen()) document.body.classList.remove('modal-open');
}

export function bindModalEvents() {
  dom.btnCloseItemModal?.addEventListener('click', closeItemModal);
  dom.btnItemCancel?.addEventListener('click', closeItemModal);
  dom.itemBackdrop?.addEventListener('click', closeItemModal);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (dom.itemModal?.classList.contains('is-open')) {
      event.preventDefault(); closeItemModal(); return;
    }

    if (isDetailsOpen()) { event.preventDefault(); closeDetailsModal(); }
  });
}
export function exposeDetailsApi() {
  window.mobilizedDetailsModal = Object.freeze({ open: openDetailsModal, close: closeDetailsModal, isOpen: isDetailsOpen });
}
