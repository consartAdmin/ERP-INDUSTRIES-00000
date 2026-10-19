// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.core.js — CRUD colaboradores + seleção (PRODNEX ERP | ESM)         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { el } from './employees.dom.js';
import { state } from './employees.state.js';
import { fetchJSON, API_EMP } from './employees.api.js';
import { qsa, toast } from './employees.utils.js';
import { renderEmployeesTable, renderDocsTable } from './employees.render.js';
import { fillEmployeeForm, resetEmployeeForm, currentEmployeePayload } from './employees.form.js';
import { enableDetailsTabIfNeeded, setEmpView } from './employees.view.js';
import { loadEmployeeDocs, resetDocForm } from './employees.docs.js';

export async function loadEmployees({
  q = state.lastQuery,
  includeInactive = state.includeInactive,
  page = state.page,
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);

  // '' = todos (ativos + inativos) | 'true' = somente ativos
  params.set('active', includeInactive ? '' : 'true');

  const pageNum = Math.max(1, Number(page) || 1);
  params.set('limit', String(state.pageSize));
  params.set('offset', String((pageNum - 1) * state.pageSize));

  const data = await fetchJSON(`${API_EMP}?${params.toString()}`);

  state.list = data?.rows || [];
  state.total = Number(data?.total ?? state.list.length) || 0;
  state.page = pageNum;
  state.lastQuery = q;
  state.includeInactive = includeInactive;

  // página ficou vazia (ex.: inativou o último registro da última página) → volta uma
  if (!state.list.length && state.total > 0 && pageNum > 1) {
    return loadEmployees({ q, includeInactive, page: Math.ceil(state.total / state.pageSize) });
  }

  renderEmployeesTable();
  enableDetailsTabIfNeeded();
}

export async function selectEmployee(id) {
  if (!id) return;
  state.selectedId = Number(id);

  qsa('#employeesTableBody tr').forEach((tr) => tr.classList.remove('emp-row--selected'));
  const tr = document.querySelector(`#employeesTableBody tr[data-id="${CSS.escape(String(id))}"]`);
  if (tr) tr.classList.add('emp-row--selected');

  resetDocForm();

  const row = state.list.find((x) => Number(x.employee_id) === Number(id));
  if (row) fillEmployeeForm(row);
  else {
    const got = await fetchJSON(`${API_EMP}/${encodeURIComponent(id)}`);
    if (got) fillEmployeeForm(got);
  }

  await loadEmployeeDocs(id);
  enableDetailsTabIfNeeded();
}

export async function clearSelection() {
  state.selectedId = null;
  el.selectedEmployeeHint.textContent = 'Selecione um colaborador na lista para ver/editar e gerenciar documentos.';
  qsa('#employeesTableBody tr').forEach((tr) => tr.classList.remove('emp-row--selected'));
  resetEmployeeForm(false);
  resetDocForm();
  state.docs = [];
  renderDocsTable([]);
  enableDetailsTabIfNeeded();
  setEmpView('list');
}

export async function saveEmployee() {
  const payload = currentEmployeePayload();
  const id = el.employee_id.value ? Number(el.employee_id.value) : null;

  if (!payload.full_name) throw new Error('Nome completo é obrigatório.');
  if (!payload.cpf) throw new Error('CPF é obrigatório.');
  if (!payload.admission_date) throw new Error('Admissão é obrigatória.');

  let saved;
  if (id) {
    saved = await fetchJSON(`${API_EMP}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  } else {
    saved = await fetchJSON(`${API_EMP}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  toast('✅ Colaborador salvo.');
  await loadEmployees();
  await selectEmployee(saved.employee_id);
  setEmpView('details');
}

export async function softInactivateSelected() {
  const id = state.selectedId;
  if (!id) return;
  const ok = confirm('Inativar este colaborador? (soft delete)');
  if (!ok) return;

  await fetchJSON(`${API_EMP}/${encodeURIComponent(id)}`, { method: 'DELETE' });

  toast('✅ Colaborador inativado.');
  await loadEmployees();
  await clearSelection();
}

export async function hardDeleteSelected() {
  const id = state.selectedId;
  if (!id) return;
  const ok = confirm('EXCLUIR (HARD) este colaborador? Isso remove também os documentos (cascade).');
  if (!ok) return;

  await fetchJSON(`${API_EMP}/${encodeURIComponent(id)}?hard=true`, { method: 'DELETE' });

  toast('✅ Excluído (hard).');
  await loadEmployees();
  await clearSelection();
}