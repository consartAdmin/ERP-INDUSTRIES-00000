// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.view.js — View/Tabs (PRODNEX ERP | ESM)                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { qs } from './employees.utils.js';
import { el } from './employees.dom.js';
import { state } from './employees.state.js';

export function enableDetailsTabIfNeeded() {
  const canDetails = Boolean(state.selectedId) || Boolean(el.employee_id?.value);
  const onDetails = document.body.dataset.empView === 'details';
  if (el.tabEmployeesDetails) el.tabEmployeesDetails.disabled = !(canDetails || onDetails);
}

export function setEmpView(view /* 'list' | 'details' */, { force = false } = {}) {
  const canDetails = Boolean(state.selectedId) || Boolean(el.employee_id?.value);

  // details só com colaborador selecionado (ou "novo" via force)
  const v = (view === 'details' && (canDetails || force)) ? 'details' : 'list';
  document.body.dataset.empView = v;

  el.tabEmployeesList?.classList.toggle('is-active', v === 'list');
  el.tabEmployeesDetails?.classList.toggle('is-active', v === 'details');
  if (el.tabEmployeesDetails) el.tabEmployeesDetails.disabled = !(canDetails || v === 'details');

  const target = (v === 'details') ? '.emp-card--details' : '.emp-card--list';
  qs(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
