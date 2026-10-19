// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.init.js — Entrada única do módulo SPED Fiscal            ║
// ║ O HTML deve importar somente este arquivo.                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  handleDownload,
  handleGenerate,
  handlePreview,
  handleValidate,
} from './spedFiscal.actions.js';
import { initializeForm } from './spedFiscal.form.js';
import {
  initializeIssuesModal,
  openEnterpriseModal,
} from './spedFiscal.modal.js';
import { cacheElements, els, requireElements } from './spedFiscal.state.js';

function bindEvents() {
  els.btnPreview?.addEventListener('click', handlePreview);
  els.btnValidate?.addEventListener('click', handleValidate);
  els.btnGenerate?.addEventListener('click', handleGenerate);
  els.btnDownload?.addEventListener('click', handleDownload);
  els.btnSearchEnterprise?.addEventListener('click', openEnterpriseModal);
  els.enterpriseName?.addEventListener('click', openEnterpriseModal);
}

function bootstrap() {
  cacheElements();
  requireElements(['companyId', 'month', 'year', 'statusBox']);
  initializeForm();
  bindEvents();
  initializeIssuesModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
