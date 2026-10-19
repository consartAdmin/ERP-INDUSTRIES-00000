import {
  changeRowsPerPage,
  goToNextPage,
  goToPreviousPage,
  loadParameters,
  removeParameter,
  submitParameter,
} from './labelParameters.actions.js';
import { bindDesigner } from './labelParameters.designer.js';
import { resetForm } from './labelParameters.form.js';
import { bindDesignerModalKeyboard, openDesignerModal, toast } from './labelParameters.modal.js';
import { $ } from './labelParameters.utils.js';

function bindEvents() {
  $('#btnApplyFilters')?.addEventListener('click', () => loadParameters({ resetPage: true }));
  $('#filterLabelName')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    loadParameters({ resetPage: true });
  });
  $('#btnPreviousPage')?.addEventListener('click', goToPreviousPage);
  $('#btnNextPage')?.addEventListener('click', goToNextPage);
  $('#apRowsPerPage')?.addEventListener('change', (event) => changeRowsPerPage(event.target.value));
  $('#labelParametersForm')?.addEventListener('submit', submitParameter);
  $('#btnDeleteParameter')?.addEventListener('click', removeParameter);
  document.addEventListener('label-parameter-delete', (event) => {
    removeParameter(event.detail?.id);
  });
  $('#btnResetForm')?.addEventListener('click', () => {
    resetForm();
    toast.info('Formulário limpo', 'Os campos foram limpos.');
  });
  $('#btnNewParameter')?.addEventListener('click', () => {
    resetForm();
    openDesignerModal();
    toast.info('Novo parâmetro', 'Preencha os dados e monte o layout visual.');
  });
  bindDesigner();
  bindDesignerModalKeyboard();
}

function init() {
  bindEvents();
  resetForm();
  loadParameters();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init, { once: true })
  : init();
