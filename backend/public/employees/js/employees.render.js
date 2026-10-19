// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ employees.render.js — Render tabelas + paginação (PRODNEX ERP | ESM)         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
'use strict';

import { el } from './employees.dom.js';
import { state } from './employees.state.js';
import { escapeHtml, fmtDateBR, toBool } from './employees.utils.js';

export function totalPages() {
  return Math.max(1, Math.ceil((state.total || 0) / state.pageSize));
}

export function renderPagination() {
  const pages = totalPages();
  const total = state.total || 0;

  el.empTableInfo.textContent =
    `${total} ${total === 1 ? 'Registro' : 'Registros'}${state.includeInactive ? ' (com inativos)' : ''}`;
  el.empPageInfo.textContent = `Página ${state.page} de ${pages}`;

  el.btnPreviousPage.disabled = state.page <= 1;
  el.btnNextPage.disabled = state.page >= pages;
}

export function setSummaryDocs(total, employeeId) {
  if (!employeeId) {
    el.docsSummary.textContent = 'Selecione um colaborador para ver os documentos.';
    return;
  }
  el.docsSummary.textContent = `${total} documento(s) para o colaborador #${employeeId}`;
}

function pill(active) {
  const ok = toBool(active);
  const cls = ok ? 'emp-pill emp-pill--active' : 'emp-pill emp-pill--inactive';
  return `<span class="${cls}">${ok ? '● Ativo' : '○ Inativo'}</span>`;
}

export function renderEmployeesTable() {
  const rows = state.list || [];

  if (!rows.length) {
    el.employeesTableBody.innerHTML = `
      <tr><td colspan="8" class="emp-empty">Nenhum colaborador encontrado.</td></tr>
    `;
    renderPagination();
    return;
  }

  el.employeesTableBody.innerHTML = rows.map((r) => {
    const id = escapeHtml(r.employee_id);
    const selected = (Number(r.employee_id) === Number(state.selectedId)) ? 'emp-row--selected' : '';
    return `
      <tr class="${selected}" data-id="${id}">
        <td>${id}</td>
        <td>${escapeHtml(r.full_name)}</td>
        <td>${escapeHtml(r.cpf)}</td>
        <td>${escapeHtml(r.department)}</td>
        <td>${escapeHtml(r.position)}</td>
        <td>${fmtDateBR(r.admission_date)}</td>
        <td>${pill(r.active)}</td>
        <td>
          <div class="emp-table-actions">
            <button type="button" class="btn btn-toolbar btn-sm js-edit" data-id="${id}" title="Editar">✏️</button>
            <button type="button" class="btn btn-toolbar btn-sm js-viewdocs" data-id="${id}" title="Documentos">📄</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination();
}

export function normalizeDocRow(d){
  return {
    employee_document_id: d.employee_document_id ?? d.id ?? null,
    employee_id: d.employee_id ?? null,
    document_type: d.document_type ?? d.doc_type ?? '',
    file_name: d.file_name ?? d.filename ?? '',
    file_path: d.file_path ?? d.url ?? '',
    gcs_bucket: d.gcs_bucket ?? null,
    gcs_path: d.gcs_path ?? null,
    mime_type: d.mime_type ?? '',
    file_size: d.file_size ?? d.size_bytes ?? '',
    notes: d.notes ?? '',
    uploaded_at: d.uploaded_at ?? d.created_at ?? null,
  };
}

export function renderDocsTable(rows) {
  const employeeId = state.selectedId;

  if (!employeeId) {
    el.docsTableBody.innerHTML = `
      <tr><td colspan="5" class="emp-empty">Selecione um colaborador.</td></tr>
    `;
    setSummaryDocs(0, null);
    return;
  }

  if (!rows?.length) {
    el.docsTableBody.innerHTML = `
      <tr><td colspan="5" class="emp-empty">Nenhum documento registrado.</td></tr>
    `;
    setSummaryDocs(0, employeeId);
    return;
  }

  el.docsTableBody.innerHTML = rows.map((raw) => {
    const d = normalizeDocRow(raw);
    const docId = escapeHtml(d.employee_document_id);
    const file = escapeHtml(d.file_name || 'arquivo');
    const pathHint = escapeHtml(d.gcs_path || d.file_path || '');
    const canOpen = Boolean(d.gcs_path || d.file_path);

    const dataAttrs = `
          data-docid="${docId}"
          data-gcs="${escapeHtml(d.gcs_path || '')}"
          data-url="${escapeHtml(d.file_path || '')}"
          data-fname="${escapeHtml(d.file_name || '')}"`;

    const openBtn = canOpen
      ? `<button type="button" class="btn btn-toolbar btn-sm js-doc-open" ${dataAttrs} title="Ver">👁️</button>`
      : '';

    const downloadBtn = canOpen
      ? `<button type="button" class="btn btn-toolbar btn-sm js-doc-download" ${dataAttrs} title="Baixar">⬇️</button>`
      : '';

    return `
      <tr data-docid="${docId}">
        <td>${docId}</td>
        <td>${escapeHtml(d.document_type)}</td>
        <td title="${pathHint}">${file}</td>
        <td>${fmtDateBR(d.uploaded_at)}</td>
        <td>
          <div class="emp-table-actions">
            ${openBtn}
            ${downloadBtn}
            <button type="button" class="btn btn-toolbar btn-sm js-doc-edit" data-docid="${docId}" title="Editar">✏️</button>
            <button type="button" class="btn btn-toolbar btn-sm js-doc-del" data-docid="${docId}" title="Excluir">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  setSummaryDocs(rows.length, employeeId);
}
