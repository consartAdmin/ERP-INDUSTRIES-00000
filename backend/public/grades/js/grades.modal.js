import { elements, state } from './grades.state.js';

export function showModal() {
  document.body.classList.add('modal-open');
  elements.gradeModal.hidden = false;
  elements.gradeModal.setAttribute('aria-hidden', 'false');
  elements.gradeModal.classList.add('is-open');
}

export function closeModal() {
  document.body.classList.remove('modal-open');
  elements.gradeModal.classList.remove('is-open');
  elements.gradeModal.setAttribute('aria-hidden', 'true');
  elements.gradeModal.hidden = true;
}

export function openCreateModal() {
  state.mode = 'create';

  elements.formGrade.reset();
  elements.inputGradeId.value = '';
  elements.modalEyebrow.textContent = 'Cadastro';
  elements.modalTitulo.textContent = 'Nova grade';
  elements.btnSalvar.textContent = 'Salvar grade';
  elements.inputGrade.disabled = false;
  elements.gradeHelp.textContent = 'O nome será usado para identificar a grade.';
  elements.ativoField.hidden = true;

  showModal();
  elements.inputGrade.focus();
}

export function openEditModal(id) {
  const row = state.rows.find(
    (item) => String(item.grade_id) === String(id),
  );

  if (!row) return;

  state.mode = 'edit';

  elements.formGrade.reset();
  elements.inputGradeId.value = row.grade_id;
  elements.inputGrade.value = row.grade || '';
  elements.inputDescricao.value = row.description || '';
  elements.inputAtivo.checked = row.is_active !== false;
  elements.modalEyebrow.textContent = `Grade #${row.grade_id}`;
  elements.modalTitulo.textContent = 'Editar grade';
  elements.btnSalvar.textContent = 'Salvar alterações';
  elements.inputGrade.disabled = true;
  elements.gradeHelp.textContent =
    'O nome da grade não pode ser alterado após o cadastro.';
  elements.ativoField.hidden = false;

  showModal();
  elements.inputDescricao.focus();
}

export function setSaving(isSaving) {
  elements.btnSalvar.disabled = isSaving;
  elements.btnCancelar.disabled = isSaving;
  elements.btnFecharModal.disabled = isSaving;

  elements.btnSalvar.textContent = isSaving
    ? 'Salvando...'
    : state.mode === 'create'
      ? 'Salvar grade'
      : 'Salvar alterações';
}
