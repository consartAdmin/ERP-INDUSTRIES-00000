// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.form.js — Configuração do formulário                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { els } from './spedFiscal.state.js';
import { currentMonth, currentYear } from './spedFiscal.utils.js';

export function initializeForm() {
  if (els.year && !els.year.value) {
    els.year.value = String(currentYear());
  }

  if (els.month && !els.month.value) {
    els.month.value = String(currentMonth()).padStart(2, '0');
  }
}

export function fillEnterprise(enterprise = {}) {
  if (els.companyId) {
    els.companyId.value = enterprise.id || '';
  }

  if (els.enterpriseName) {
    els.enterpriseName.value =
      enterprise.trade_name ||
      enterprise.corporate_name ||
      (enterprise.id ? `Empresa ${enterprise.id}` : '');
  }

  if (els.uf && enterprise.state) {
    els.uf.value = String(enterprise.state).trim().toUpperCase();
  }
}
