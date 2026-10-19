import { createType, handleTypesTableClick, loadTypes } from './customerStatusTypes.actions.js';
import { initializeTypeForm, syncColorFromPicker, syncColorFromText } from './customerStatusTypes.form.js';
import { elements } from './customerStatusTypes.state.js';
import { closeTypeModal, handleTypeModalKeydown, openTypeModal } from './customerStatusTypes.modal.js';
function bindEvents() {
  elements.btnCreateType?.addEventListener('click', createType);
  elements.btnOpenTypeModal?.addEventListener('click', openTypeModal);
  elements.btnCloseTypeModal?.addEventListener('click', closeTypeModal);
  elements.btnCancelTypeModal?.addEventListener('click', closeTypeModal);
  elements.typeModal?.querySelector('[data-close-type-modal]')?.addEventListener('click', closeTypeModal);
  document.addEventListener('keydown', handleTypeModalKeydown);
  elements.btnReload?.addEventListener('click', loadTypes);
  elements.typesTableBody?.addEventListener('click', handleTypesTableClick);
  elements.typeColorPicker?.addEventListener('input', syncColorFromPicker);
  elements.typeColorInput?.addEventListener('input', syncColorFromText);
  elements.typeColorInput?.addEventListener('blur', syncColorFromText);
}
async function init() { initializeTypeForm(); bindEvents(); await loadTypes(); }
init();
