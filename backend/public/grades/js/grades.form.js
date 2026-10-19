import { createGrade, updateGrade } from './grades.api.js';
import { loadGrades } from './grades.actions.js';
import { closeModal, setSaving } from './grades.modal.js';
import { elements, state } from './grades.state.js';
import { showToast } from './grades.utils.js';
import { validateGradeForm } from './grades.validation.js';

export async function handleGradeSubmit(event) {
  event.preventDefault();

  if (!validateGradeForm()) return;

  const grade = elements.inputGrade.value.trim();
  const description = elements.inputDescricao.value.trim() || null;

  setSaving(true);

  try {
    if (state.mode === 'create') {
      await createGrade({ grade, description });
      state.offset = 0;
      showToast('Grade cadastrada com sucesso.');
    } else {
      await updateGrade(elements.inputGradeId.value, {
        description,
        isActive: elements.inputAtivo.checked,
      });
      showToast('Grade atualizada com sucesso.');
    }

    closeModal();
    await loadGrades();
  } catch (error) {
    console.error(error);

    const message = error.status === 409
      ? 'Essa grade já existe.'
      : error.message || 'Erro ao salvar grade.';

    showToast(message, 'erro');
  } finally {
    setSaving(false);
  }
}
