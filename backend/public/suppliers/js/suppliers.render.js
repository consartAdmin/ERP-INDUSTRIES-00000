import { suppliersState as state } from './suppliers.state.js';
import { escapeHtml, qs } from './suppliers.utils.js';

export function renderLoading() {
  const body = qs('#suppliersTableBody');
  if (body) body.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Carregando fornecedores...</td></tr>';
}
export function renderSuppliers(rows = []) {
  const body = qs('#suppliersTableBody');
  if (!body) return;
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhum fornecedor encontrado para o filtro atual.</td></tr>';
    return;
  }
  body.innerHTML = rows.map((row) => {
    const id = escapeHtml(row.supplier_id);
    return `<tr data-id="${id}">
      <td>${id}</td><td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.tax_id)}</td>
      <td>${escapeHtml(row.city)}</td><td>${escapeHtml(row.state)}</td>
      <td>${escapeHtml(row.phone)}</td><td>${escapeHtml(row.email)}</td>
      <td class="col-actions">
        <button type="button" class="btn btn-toolbar btn-sm" data-action="edit" data-id="${id}">✏️</button>
        <button type="button" class="btn btn-toolbar btn-sm" data-action="delete" data-id="${id}">🗑️</button>
      </td></tr>`;
  }).join('');
}
export function renderPagination() {
  const pages = Math.max(Math.ceil(state.total / state.limit), 1);
  if (qs('#apTableInfo')) qs('#apTableInfo').textContent = `${state.total} ${state.total === 1 ? 'Registro' : 'Registros'}`;
  if (qs('#pageInfo')) qs('#pageInfo').textContent = `Página ${state.page} de ${pages}`;
  if (qs('#btnPrevious')) qs('#btnPrevious').disabled = state.page <= 1;
  if (qs('#btnNext')) qs('#btnNext').disabled = state.page * state.limit >= state.total;
}
export function renderAttachments(files = []) {
  const container = qs('#supplierAttachments');
  if (!container) return;
  if (!files.length) { container.innerHTML = '<div class="attachments-empty">Nenhum anexo enviado.</div>'; return; }
  container.innerHTML = files.map((file) => `<div class="attachment-row">
    <a href="${escapeHtml(file.signed_url || file.file_url || '#')}" target="_blank" rel="noopener" class="attachment-link">📄 ${escapeHtml(file.file_name)}</a>
    <button type="button" class="btn btn-danger btn-sm" data-attachment-delete="${escapeHtml(file.attachment_id)}">Delete</button>
  </div>`).join('');
}
