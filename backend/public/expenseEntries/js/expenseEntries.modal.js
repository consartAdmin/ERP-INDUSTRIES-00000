// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.modal.js — Expense Entries Modal (PRODNEX ERP)       ║
// ║ Path: backend/public/expenseEntries/expenseEntries.modal.js          ║
// ║ Uses: backend/public/includes/js/modal.js                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Modal } from '/../includes/js/modal.js';

// ──────────────────────────────────────────────────────────────────────
// 1. CONFIGURATION
// ──────────────────────────────────────────────────────────────────────

const MODAL_ID = 'modal';
const DEFAULT_FOCUS_SELECTOR = '#issueDate';

let initialized = false;

// ──────────────────────────────────────────────────────────────────────
// 2. ELEMENT LOOKUP
// ──────────────────────────────────────────────────────────────────────

function getExpenseEntriesModal() {
  return document.getElementById(MODAL_ID);
}

// ──────────────────────────────────────────────────────────────────────
// 3. PUBLIC OPEN/CLOSE STATE
// ──────────────────────────────────────────────────────────────────────

export function setExpenseEntriesModalOpen(open) {
  if (open) {
    return Modal.open(MODAL_ID, {
      focusSelector: DEFAULT_FOCUS_SELECTOR,
    });
  }

  return Modal.close(MODAL_ID);
}

export function openExpenseEntriesModal() {
  return setExpenseEntriesModalOpen(true);
}

export function closeExpenseEntriesModal() {
  return setExpenseEntriesModalOpen(false);
}

export function isExpenseEntriesModalOpen() {
  return Modal.isOpen(MODAL_ID);
}

// ──────────────────────────────────────────────────────────────────────
// 4. MODAL TITLES
// ──────────────────────────────────────────────────────────────────────

export function setExpenseEntriesModalTitles({
  title = 'Nova Entrada',
  subtitle = 'Preencha os dados da despesa/nota',
} = {}) {
  const modal = getExpenseEntriesModal();
  if (!modal) return false;

  const titleElement = modal.querySelector('#modalTitle');
  const subtitleElement = modal.querySelector('#modalSub');

  if (titleElement) titleElement.textContent = title;
  if (subtitleElement) subtitleElement.textContent = subtitle;

  return true;
}

// ──────────────────────────────────────────────────────────────────────
// 5. CREATE AND EDIT MODES
// ──────────────────────────────────────────────────────────────────────

export function openNewExpenseEntryModal() {
  setExpenseEntriesModalTitles({
    title: 'Nova Entrada',
    subtitle: 'Preencha os dados da despesa/nota',
  });

  return openExpenseEntriesModal();
}

export function openEditExpenseEntryModal() {
  setExpenseEntriesModalTitles({
    title: 'Editar Entrada',
    subtitle: 'Atualize os dados da despesa/nota',
  });

  return openExpenseEntriesModal();
}

// ──────────────────────────────────────────────────────────────────────
// 6. MODULE-SPECIFIC EVENTS
// ──────────────────────────────────────────────────────────────────────

function handleModalOpen() {
  // Add expense-entry-specific behavior here when needed.
  // Focus, body scroll and ARIA state are handled by Modal.open().
}

function handleModalClose() {
  // Add expense-entry-specific cleanup here when needed.
  // Focus restoration and ARIA state are handled by Modal.close().
}

// Supports the previous HTML attribute during migration to
// the standard data-modal-close attribute.
function handleLegacyClose(event) {
  const closeTrigger = event.target.closest?.('[data-close="1"]');
  if (closeTrigger) closeExpenseEntriesModal();
}

// ──────────────────────────────────────────────────────────────────────
// 7. INITIALIZATION
// ──────────────────────────────────────────────────────────────────────

export function setupExpenseEntriesModal() {
  if (initialized) return true;

  const modal = getExpenseEntriesModal();
  if (!modal) return false;

  initialized = true;

  // Safe to call from multiple modules; Modal.setup() initializes once.
  Modal.setup();

  modal.addEventListener('modal:open', handleModalOpen);
  modal.addEventListener('modal:close', handleModalClose);
  modal.addEventListener('click', handleLegacyClose);

  // Normalize the initial closed state used by the HTML template.
  if (modal.getAttribute('aria-hidden') !== 'false') {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  return true;
}

// ──────────────────────────────────────────────────────────────────────
// 8. RECOMMENDED USAGE
// ──────────────────────────────────────────────────────────────────────

// Initialize once after the modal HTML exists:
// setupExpenseEntriesModal();

// Create mode:
// openNewExpenseEntryModal();

// Edit mode:
// openEditExpenseEntryModal();

// Close after saving:
// closeExpenseEntriesModal();
