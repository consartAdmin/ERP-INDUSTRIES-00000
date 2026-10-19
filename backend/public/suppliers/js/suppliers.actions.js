import { createSupplier, downloadReport, listAttachments, listSuppliers, removeSupplier,
  removeSupplierAttachment, sefazApi, updateSupplier, uploadSupplierAttachment } from './suppliers.api.js';
import { suppliersState as state } from './suppliers.state.js';
import { collectSupplierPayload } from './suppliers.form.js';
import { showSupplierModal } from './suppliers.modal.js';
import { renderAttachments, renderLoading, renderPagination, renderSuppliers } from './suppliers.render.js';
import { validateSupplier } from './suppliers.validation.js';
import { askConfirm, formatCep, formatCnpj, onlyDigits, qs, showToast } from './suppliers.utils.js';

export async function loadSuppliers() {
  renderLoading();
  try {
    const params = new URLSearchParams({ page: state.page, limit: state.limit, sort: state.sort, dir: state.dir });
    if (state.search) params.set('q', state.search);
    const data = await listSuppliers(params);
    state.total = Number(data?.total || 0); state.page = Number(data?.page || 1);
    state.limit = Number(data?.limit || state.limit);
    renderSuppliers(Array.isArray(data?.rows) ? data.rows : []); renderPagination();
  } catch (error) { renderSuppliers([]); await showToast(error.message || 'Erro ao carregar fornecedores.', 'error'); }
}
export async function saveSupplier(event) {
  event.preventDefault();
  const { id, payload } = collectSupplierPayload(event.currentTarget);
  const validation = validateSupplier(payload);
  if (!validation.valid) { await showToast(validation.message, 'warning'); qs(validation.field)?.focus(); return; }
  try {
    if (id) await updateSupplier(id, payload); else await createSupplier(payload);
    await showToast(id ? 'Fornecedor atualizado com sucesso.' : 'Fornecedor criado com sucesso.', 'success');
    showSupplierModal(false); await loadSuppliers();
  } catch (error) { await showToast(error.message || 'Erro ao salvar fornecedor.', 'error'); }
}
export async function deleteSupplier(id) {
  if (!id || !await askConfirm(`Deseja excluir o fornecedor #${id}?`, 'Excluir fornecedor')) return;
  try {
    await removeSupplier(id);
    if ((state.page - 1) * state.limit >= Math.max(state.total - 1, 0) && state.page > 1) state.page -= 1;
    await showToast('Fornecedor deletado com sucesso.', 'success'); await loadSuppliers();
  } catch (error) { await showToast(error.message || 'Erro ao deletar fornecedor.', 'error'); }
}
export async function uploadAttachments(files) {
  if (!state.currentSupplierId) { await showToast('Salve o fornecedor antes de enviar anexos.', 'warning'); return; }
  try {
    for (const file of files) await uploadSupplierAttachment(state.currentSupplierId, file);
    renderAttachments(await listAttachments(state.currentSupplierId));
    await showToast('Anexo enviado com sucesso.', 'success');
  } catch (error) { await showToast(error.message || 'Erro ao enviar anexo.', 'error'); }
}
export async function deleteAttachment(id) {
  if (!id || !await askConfirm('Deseja excluir este anexo?', 'Excluir anexo')) return;
  try {
    await removeSupplierAttachment(state.currentSupplierId, id);
    renderAttachments(await listAttachments(state.currentSupplierId));
    await showToast('Anexo excluído.', 'success');
  } catch (error) { await showToast(error.message || 'Erro ao excluir anexo.', 'error'); }
}
export async function exportSuppliers(format, button) {
  button.disabled = true;
  try {
    const params = new URLSearchParams({ sort: state.sort, dir: state.dir });
    if (state.search) params.set('q', state.search);
    const response = await downloadReport(format, params);
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a'); link.href = blobUrl;
    link.download = `fornecedores-${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) { await showToast(error.message, 'error'); } finally { button.disabled = false; }
}
let lastCnpj = '';
export async function lookupCnpj() {
  const input = qs('#tax_id'); const cnpj = onlyDigits(input?.value);
  if (cnpj.length !== 14 || cnpj === lastCnpj) return; lastCnpj = cnpj;
  try {
    const data = await sefazApi.searchSefazByCnpj({ cnpj, uf: null });
    const values = { name: data.razao_social || data.nome || data.fantasia, state_registration: data.inscricao_estadual,
      phone: data.telefone, email: data.email, postal_code: formatCep(data.cep), address_street_type: data.tipo_logradouro, address_street: data.logradouro,
      address_number: data.numero, address_complement: data.complemento, address_district: data.bairro,
      city: data.municipio, state: data.uf };
    // Preenche apenas campos vazios para não sobrescrever dados já cadastrados.
    Object.entries(values).forEach(([id, value]) => { const field = qs(`#${id}`); if (field && value && !field.value.trim()) field.value = value; });
  } catch (error) { console.warn('[suppliers] CNPJ:', error.message); await showToast(error.message || 'CNPJ não localizado.', 'warning'); }
}
export function formatCnpjInput(event) {
  event.currentTarget.value = formatCnpj(event.currentTarget.value);
  if (onlyDigits(event.currentTarget.value).length !== 14) lastCnpj = '';
}
