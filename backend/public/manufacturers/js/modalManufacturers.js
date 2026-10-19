// ╔══════════════════════════════════════════════════════════════════════╗
// ║ modalManufacturers.js — Modal de Fabricantes (UI)                    ║
// ║ FINAL (PRODNEX ERP | ESM)                                            ║
// ║ - 100% reliable close using native `hidden` attribute                ║
// ║ - Also keeps .hidden class for compatibility                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

let modal, dialog, modalTitleEl, form;
let fieldId, fieldTrade, fieldLegal, fieldTaxId, fieldStateReg, fieldPhone, fieldEmail,
    fieldWebsite, fieldCity, fieldState, fieldAddress, fieldNeighborhood, fieldPostal, fieldNotes;
let btnClose, btnCancel;

let lastActiveEl = null;

function bindDom() {
  modal        = document.getElementById('modalForm');        // .modal-backdrop
  modalTitleEl = document.getElementById('modalTitle');
  form         = document.getElementById('formManufacturer');

  fieldId       = document.getElementById('manufacturer_id');
  fieldTrade    = document.getElementById('trade_name');
  fieldLegal    = document.getElementById('legal_name');
  fieldTaxId    = document.getElementById('tax_id');
  fieldStateReg = document.getElementById('state_registration');
  fieldPhone    = document.getElementById('phone');
  fieldEmail    = document.getElementById('email');
  fieldWebsite  = document.getElementById('website');
  fieldCity     = document.getElementById('city');
  fieldState    = document.getElementById('state');
  fieldAddress  = document.getElementById('address');
  fieldNeighborhood = document.getElementById('neighborhood');
  fieldPostal   = document.getElementById('postal_code');
  fieldNotes    = document.getElementById('notes');

  dialog    = modal?.querySelector('.modal-dialog') || null;
  btnClose  = document.getElementById('btnCloseModal');
  btnCancel = document.getElementById('btnCancel');
}

function isOpen() {
  return !!(modal && modal.hidden === false);
}

function lockBodyScroll(lock) {
  const body = document.body;
  if (!body) return;

  if (lock) {
    const scrollBarW = window.innerWidth - document.documentElement.clientWidth;
    body.dataset._scrollLock = '1';
    body.style.overflow = 'hidden';
    if (scrollBarW > 0) body.style.paddingRight = `${scrollBarW}px`;
  } else {
    if (body.dataset._scrollLock === '1') {
      delete body.dataset._scrollLock;
      body.style.overflow = '';
      body.style.paddingRight = '';
    }
  }
}

function ensureA11yAttrs() {
  if (!modal) return;

  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  if (modalTitleEl) {
    if (!modalTitleEl.id) modalTitleEl.id = 'modalTitle';
    modal.setAttribute('aria-labelledby', modalTitleEl.id);
  }

  if (dialog && !dialog.hasAttribute('tabindex')) {
    dialog.setAttribute('tabindex', '-1');
  }
}

function ensureClosedHard() {
  if (!modal) return;

  // ✅ bulletproof close
  modal.hidden = true;                 // native: removes from layout
  modal.classList.add('hidden');       // compatibility
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');

  lockBodyScroll(false);
}

function getFocusable(container) {
  if (!container) return [];
  const nodes = container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(nodes).filter(el => el.offsetParent !== null);
}

function trapFocus(ev) {
  if (!isOpen()) return;
  if (ev.key !== 'Tab') return;

  const focusables = getFocusable(dialog);
  if (!focusables.length) return;

  const first = focusables[0];
  const last  = focusables[focusables.length - 1];

  if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault();
    first.focus();
  }
}

/* ──────────────────────────────────────────────────────────────
   EXPORTS
────────────────────────────────────────────────────────────── */
export function openManufacturerModal(title = 'Novo Fabricante') {
  if (!modal) bindDom();
  if (!modal) return;

  lastActiveEl = document.activeElement;

  if (modalTitleEl) modalTitleEl.textContent = title;

  ensureA11yAttrs();
  lockBodyScroll(true);

  // ✅ show
  modal.hidden = false;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');

  // animation frame so CSS transitions apply
  requestAnimationFrame(() => {
    modal.classList.add('is-open');
  });

  setTimeout(() => {
    if (fieldTrade) fieldTrade.focus();
    else dialog?.focus?.();
  }, 60);
}

export function closeManufacturerModal() {
  if (!modal) bindDom();
  if (!modal) return;

  modal.classList.remove('is-open');

  const ms = 160;
  setTimeout(() => {
    ensureClosedHard();

    try { lastActiveEl?.focus?.(); } catch {}
    lastActiveEl = null;
  }, ms);
}

export function fillManufacturerForm(m = {}) {
  if (!form) bindDom();
  if (!form) return;

  fieldId.value            = m.manufacturer_id ?? '';
  fieldTrade.value         = m.trade_name ?? '';
  fieldLegal.value         = m.corporate_name ?? '';
  fieldTaxId.value         = m.tax_id ?? '';
  fieldStateReg.value      = m.state_registration ?? '';
  fieldPhone.value         = m.phone ?? '';
  fieldEmail.value         = m.email ?? '';
  fieldWebsite.value       = m.website ?? '';
  fieldCity.value          = m.city ?? '';
  fieldState.value         = m.state ?? '';
  fieldAddress.value       = m.street ?? '';
  fieldNeighborhood.value  = m.neighborhood ?? '';
  fieldPostal.value        = m.zipcode ?? '';
  fieldNotes.value         = m.notes ?? '';
}

export function initManufacturerModal() {
  bindDom();
  if (!modal) return;

  ensureA11yAttrs();

  // ✅ Force closed no matter what (even if style.css overrides `.hidden`)
  ensureClosedHard();

  // click outside dialog closes (backdrop itself)
  modal.addEventListener('mousedown', (ev) => {
    if (ev.target === ev.currentTarget) closeManufacturerModal();
  });

  // close buttons
  btnClose?.addEventListener('click', (ev) => {
    ev.preventDefault();
    closeManufacturerModal();
  });

  btnCancel?.addEventListener('click', (ev) => {
    ev.preventDefault();
    closeManufacturerModal();
  });

  // keyboard
  document.addEventListener('keydown', (ev) => {
    if (!isOpen()) return;

    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeManufacturerModal();
      return;
    }
    trapFocus(ev);
  });
}