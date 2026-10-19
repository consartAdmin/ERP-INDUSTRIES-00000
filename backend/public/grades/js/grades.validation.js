import { elements, state } from './grades.state.js';

export function validateGradeForm() {
  const grade = elements.inputGrade.value.trim();

  if (state.mode === 'create' && !grade) {
    elements.inputGrade.setCustomValidity('Informe o nome da grade.');
    elements.inputGrade.reportValidity();
    elements.inputGrade.setCustomValidity('');
    return false;
  }

  return true;
}
