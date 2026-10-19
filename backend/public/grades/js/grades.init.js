import {
  changePageSize,
  applyFilters,
  goToNextPage,
  goToPreviousPage,
  handleTableAction,
  loadGrades,
} from './grades.actions.js';
import { ELEMENT_IDS } from './grades.config.js';
import { handleGradeSubmit } from './grades.form.js';
import { closeModal, openCreateModal } from './grades.modal.js';
import { elements } from './grades.state.js';

function cacheElements() {
  ELEMENT_IDS.forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.btnNovaGrade.addEventListener('click', openCreateModal);
  elements.btnFecharModal.addEventListener('click', closeModal);
  elements.btnCancelar.addEventListener('click', closeModal);
  elements.formGrade.addEventListener('submit', handleGradeSubmit);
  elements.listaGrades.addEventListener('click', handleTableAction);
  elements.pagAnterior.addEventListener('click', goToPreviousPage);
  elements.pagProxima.addEventListener('click', goToNextPage);
  elements.apRowsPerPage.addEventListener('change', changePageSize);
  elements.btnFiltrar.addEventListener('click', applyFilters);

  elements.inputBusca.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyFilters();
    }
  });

  elements.gradeModal.addEventListener('click', (event) => {
    if (event.target.closest('[data-modal-close]')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !elements.gradeModal.hidden) {
      closeModal();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  loadGrades();
});
