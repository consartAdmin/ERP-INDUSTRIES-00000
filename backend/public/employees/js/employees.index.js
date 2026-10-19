// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.index.js — Bootstrap do módulo (PRODNEX ERP | ESM)                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { bindEvents } from './employees.events.js';
import { resetEmployeeForm } from './employees.form.js';
import { loadEmployees } from './employees.core.js';
import { renderDocsTable } from './employees.render.js';
import { resetDocForm } from './employees.docs.js';
import { setEmpView } from './employees.view.js';

async function boot() {
  bindEvents();
  resetEmployeeForm(false);

  await loadEmployees({ q: '', includeInactive: false });
  renderDocsTable([]);
  resetDocForm();

  setEmpView('list');
}

boot().catch((e) => {
  console.error(e);
  alert(`Falha ao iniciar: ${e.message}`);
});