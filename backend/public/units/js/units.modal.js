// ╔════════════════════════════════════════════════════════════╗
// ║ units.modal.js — Modal de Unidades                            ║
// ╚════════════════════════════════════════════════════════════╝

import { state } from './units.state.js';
import { clearForm, fillForm, setFormMessage } from './units.form.js';

export function openNewUnitModal() {
  state.editingId = null;
  clearForm();
  setFormMessage('');

  const title = state.refs.modalTitle;
  const caption = state.refs.modalCaption;

  if (title) title.textContent = 'Nova unidade';
  if (caption) caption.textContent = 'Cadastre uma unidade para uso no catálogo de produtos.';

  state.refs.modal?.showModal();
  state.refs.inputUnit?.focus();
}

export function openEditUnitModal(row) {
  state.editingId = Number(row?.id ?? row?.unit_id);

  if (!Number.isFinite(state.editingId) || state.editingId <= 0) {
    throw new Error('ID da unidade inválido.');
  }

  fillForm(row);
  setFormMessage('');

  if (state.refs.modalTitle) state.refs.modalTitle.textContent = 'Editar unidade';
  if (state.refs.modalCaption) {
    state.refs.modalCaption.textContent = 'Atualize os dados da unidade selecionada.';
  }

  state.refs.modal?.showModal();
  state.refs.inputUnit?.focus();
}

export function closeUnitModal() {
  if (state.refs.modal?.open) {
    state.refs.modal.close();
  }

  state.editingId = null;
  setFormMessage('');
}
