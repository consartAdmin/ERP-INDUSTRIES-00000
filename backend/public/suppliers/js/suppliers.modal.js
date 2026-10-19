import { EDIT_SUPPLIER_PASSWORD, EDIT_SUPPLIER_PASSWORD_ENABLED } from './suppliers.config.js';
import { suppliersState as state } from './suppliers.state.js';
import { getSupplier, listAttachments } from './suppliers.api.js';
import { fillSupplierForm, resetSupplierForm } from './suppliers.form.js';
import { renderAttachments } from './suppliers.render.js';
import { qs, showToast } from './suppliers.utils.js';
import { syncSupplierSubcategories } from './suppliers.financial.js';

export function showSupplierModal(visible) {
  const modal = qs('#supplierModalBackdrop'); if (!modal) return;
  modal.classList.toggle('is-open', visible);
  modal.setAttribute('aria-hidden', visible ? 'false' : 'true');
  document.body.classList.toggle('modal-open', visible);
}
export async function openNewSupplierModal() {
  state.currentSupplierId = null; resetSupplierForm();
  syncSupplierSubcategories(null);
  if (qs('#modalTitle')) qs('#modalTitle').textContent = 'Novo Fornecedor';
  renderAttachments([]); showSupplierModal(true); qs('#tax_id')?.focus();
}
async function authorizeEdit() {
  if (!EDIT_SUPPLIER_PASSWORD_ENABLED) return true;
  const password = window.prompt('Informe a senha para editar o fornecedor:');
  if (password === null) return false;
  if (String(password).trim() !== EDIT_SUPPLIER_PASSWORD) {
    await showToast('Senha inválida para edição de fornecedor.', 'error'); return false;
  }
  return true;
}
export async function openEditSupplierModal(id) {
  if (!await authorizeEdit()) return;
  try {
    const data = await getSupplier(id); resetSupplierForm(); fillSupplierForm(data || {});
    syncSupplierSubcategories(data?.cash_subcategory_id ?? null);
    state.currentSupplierId = Number(data?.supplier_id || id) || null;
    if (qs('#modalTitle')) qs('#modalTitle').textContent = `Editar Fornecedor #${id}`;
    renderAttachments(await listAttachments(state.currentSupplierId));
    showSupplierModal(true); qs('#name')?.focus();
  } catch (error) { await showToast(error.message || 'Erro ao carregar fornecedor.', 'error'); }
}
