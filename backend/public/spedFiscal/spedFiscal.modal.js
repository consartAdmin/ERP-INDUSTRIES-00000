// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.modal.js — Modal de pesquisa de empresa                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openEnterpriseSearchModal } from '/public/modalsSearch/enterpriseModalSearch.js';
import { API_BASE } from './spedFiscal.config.js';
import { fillEnterprise } from './spedFiscal.form.js';
import { els } from './spedFiscal.state.js';

let previousFocus = null;
let issuesObserver = null;

export function openEnterpriseModal() {
  openEnterpriseSearchModal({
    apiBase: `${API_BASE}/api/enterprises`,
    onlyActive: true,
    onPick: fillEnterprise,
  });
}

export function openIssuesModal() {
  if (!els.issuesModal) return;

  previousFocus = document.activeElement;
  els.issuesModal.classList.add('is-open');
  els.issuesModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  els.btnCloseIssues?.focus();
}

export function closeIssuesModal() {
  if (!els.issuesModal) return;

  els.issuesModal.classList.remove('is-open');
  els.issuesModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  if (previousFocus instanceof HTMLElement) {
    previousFocus.focus();
  }

  previousFocus = null;
}

function handleIssuesModalKeydown(event) {
  if (event.key === 'Escape' && els.issuesModal?.classList.contains('is-open')) {
    closeIssuesModal();
  }
}

function updateIssuesCounter() {
  const rows = els.issuesTableBody
    ? [...els.issuesTableBody.querySelectorAll('tr')]
    : [];

  const total = rows.filter(row => !row.querySelector('.sf-empty-row')).length;
  const formattedTotal = total.toLocaleString('pt-BR');

  if (els.issuesCount) {
    els.issuesCount.textContent = formattedTotal;
  }

  if (els.btnOpenIssues) {
    els.btnOpenIssues.textContent = total
      ? `Ver inconsistências (${formattedTotal})`
      : 'Ver inconsistências';
  }
}

export function initializeIssuesModal() {
  els.btnOpenIssues?.addEventListener('click', openIssuesModal);
  els.btnCloseIssues?.addEventListener('click', closeIssuesModal);

  els.issuesModal
    ?.querySelectorAll('[data-modal-close="issues"]')
    .forEach(element => element.addEventListener('click', closeIssuesModal));

  if (els.issuesTableBody) {
    issuesObserver?.disconnect();
    issuesObserver = new MutationObserver(updateIssuesCounter);
    issuesObserver.observe(els.issuesTableBody, { childList: true });
    updateIssuesCounter();
  }

  document.addEventListener('keydown', handleIssuesModalKeydown);
}
