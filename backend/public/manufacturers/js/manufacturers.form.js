import { apiCreate, apiUpdate } from './manufacturers.api.js';
import { $, elements } from './manufacturers.config.js';
import {
  closeManufacturerModal,
  openManufacturerModal,
  showMessage,
} from './manufacturers.modal.js';
import { state } from './manufacturers.state.js';
import { valorFormulario } from './manufacturers.utils.js';
import { validarFabricante } from './manufacturers.validation.js';

export function resetForm() {
  elements.form?.reset();
  if (elements.fieldId) elements.fieldId.value = '';
}

export function buildPayloadFromForm() {
  return {
    trade_name: valorFormulario('#trade_name'),
    corporate_name: valorFormulario('#legal_name'),
    tax_id: valorFormulario('#tax_id'),
    state_registration: valorFormulario('#state_registration'),
    phone: valorFormulario('#phone'),
    email: valorFormulario('#email'),
    website: valorFormulario('#website'),
    city: valorFormulario('#city'),
    state: valorFormulario('#state'),
    street: valorFormulario('#address'),
    neighborhood: valorFormulario('#neighborhood'),
    zipcode: valorFormulario('#postal_code'),
    notes: valorFormulario('#notes'),
  };
}

export function handleNewClick() {
  resetForm();
  openManufacturerModal('Novo Fabricante');
}

export function registrarFormulario(recarregar) {
  elements.form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = elements.fieldId?.value ? Number(elements.fieldId.value) : null;
    const payload = buildPayloadFromForm();
    const error = validarFabricante(payload);
    if (error) {
      showMessage(error);
      $('#trade_name')?.focus();
      return;
    }
    const result = id ? await apiUpdate(id, payload) : await apiCreate(payload);
    if (!result.ok) {
      showMessage(`Erro ao salvar fabricante: ${result.error}`);
      return;
    }
    closeManufacturerModal();
    recarregar({ page: state.currentPage, q: state.currentQuery });
  });
}
