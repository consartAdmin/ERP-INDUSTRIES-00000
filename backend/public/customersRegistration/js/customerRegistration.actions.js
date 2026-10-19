// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.actions.js                               ║
// ║ MODULE: Customer Registration — Actions                             ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { createCustomer } from './customerRegistration.api.js';
import { searchCep, searchCnpj } from './customerRegistration.address.js';
import { buildCustomerPayload } from './customerRegistration.form.js';
import { renderTaxMask } from './customerRegistration.masks.js';
import { showError, showSuccess, showValidation } from './customerRegistration.modal.js';
import { $, setValue } from './customerRegistration.utils.js';
import { validateCustomerPayload } from './customerRegistration.validation.js';

const CUSTOMERS_EDIT_URL = '/public/customersEdit/customersEdit.html';

export function bindActions() {
  $('#btnVoltar')?.addEventListener('click', goBack);
  $('#btnCancelar')?.addEventListener('click', goBack);
  $('#formCliente')?.addEventListener('submit', onSubmit);
  $('#postal_code')?.addEventListener('blur', onSearchCep);
  $('#btnBuscarCNPJ')?.addEventListener('click', onSearchCnpj);
  $('#person_type')?.addEventListener('change', () => updatePersonTypeUI({ clearExclusiveFields: true }));

  initCustomerTabs();
  updatePersonTypeUI({ clearExclusiveFields: false });
}

export function updatePersonTypeUI({ clearExclusiveFields = false } = {}) {
  const physicalPerson = $('#person_type')?.value === 'F';

  const tradeNameLabel = document.getElementById('tradeNameLabel');
  const legalNameField = document.getElementById('fieldLegalName');
  const stateRegistrationField = document.getElementById('fieldStateRegistration');
  const municipalRegistrationField = document.getElementById('fieldMunicipalRegistration');
  const btnCNPJ = document.getElementById('btnBuscarCNPJ');
  const taxLabel = document.getElementById('tax_id_label');
  const taxInput = document.getElementById('tax_id');

  if (physicalPerson) {
    if (tradeNameLabel) tradeNameLabel.textContent = 'Nome Completo';
    if (taxLabel) taxLabel.textContent = 'CPF';
    if (taxInput) taxInput.placeholder = '000.000.000-00';

    if (legalNameField) legalNameField.hidden = true;
    if (stateRegistrationField) stateRegistrationField.hidden = true;
    if (municipalRegistrationField) municipalRegistrationField.hidden = true;
    if (btnCNPJ) btnCNPJ.hidden = true;

    if (clearExclusiveFields) {
      setValue('legal_name', '');
      setValue('state_registration', '');
      setValue('municipal_registration', '');
    }
  } else {
    if (tradeNameLabel) tradeNameLabel.textContent = 'Nome Fantasia';
    if (taxLabel) taxLabel.textContent = 'CNPJ/CPF';
    if (taxInput) taxInput.placeholder = '12.345.678/0001-00';

    if (legalNameField) legalNameField.hidden = false;
    if (stateRegistrationField) stateRegistrationField.hidden = false;
    if (municipalRegistrationField) municipalRegistrationField.hidden = false;
    if (btnCNPJ) btnCNPJ.hidden = false;
  }

  renderTaxMask();
}

function initCustomerTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab[data-tab]'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  if (!buttons.length || !panels.length) return;

  const activate = (selectedButton) => {
    if (!selectedButton || selectedButton.disabled) return;
    const panel = document.getElementById(selectedButton.dataset.tab);
    if (!panel) return;

    buttons.forEach((button) => {
      const selected = button === selectedButton;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((item) => {
      const selected = item === panel;
      item.classList.toggle('is-active', selected);
      item.hidden = !selected;
    });
  };

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => activate(button));
    button.addEventListener('keydown', (event) => {
      const enabledButtons = buttons.filter((item) => !item.disabled);
      const enabledIndex = enabledButtons.indexOf(button);
      let nextIndex = enabledIndex;
      if (event.key === 'ArrowRight') nextIndex = (enabledIndex + 1) % enabledButtons.length;
      else if (event.key === 'ArrowLeft') nextIndex = (enabledIndex - 1 + enabledButtons.length) % enabledButtons.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = enabledButtons.length - 1;
      else return;

      event.preventDefault();
      activate(enabledButtons[nextIndex]);
      enabledButtons[nextIndex].focus();
    });
  });

  activate(buttons.find((button) => button.classList.contains('is-active')) || buttons[0]);
}

function goBack(event) {
  event?.preventDefault();
  if (history.length > 1) return history.back();
  location.href = (window.erpCompanyUrl ? window.erpCompanyUrl('/public/customersList/customersList.html') : '/public/customersList/customersList.html');
}

async function onSearchCep(event) {
  event?.preventDefault();
  try {
    await searchCep();
  } catch (error) {
    console.error('[customerRegistration.searchCep]', error);
    showError('Consulta de CEP', error?.message || 'Não foi possível consultar o CEP informado.');
  }
}

async function onSearchCnpj(event) {
  event?.preventDefault();
  try {
    await searchCnpj();
  } catch (error) {
    console.error('[customerRegistration.searchCnpj]', error);
    showError('Consulta de CNPJ', error?.message || 'Não foi possível consultar o CNPJ informado.');
  }
}

async function onSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitButton = form?.querySelector('button[type="submit"], input[type="submit"]');
  const payload = buildCustomerPayload();
  const validationMessage = validateCustomerPayload(payload);

  if (validationMessage) {
    showValidation(validationMessage);
    return;
  }

  try {
    setSubmitting(submitButton, true);
    const json = await createCustomer(payload);

    const customerId =
      json?.customer_id ??
      json?.id ??
      json?.data?.customer_id ??
      json?.data?.id;

    showSuccess('Cliente criado', 'Cadastro realizado com sucesso!', 2200);

    if (customerId != null && customerId !== '') {
      window.setTimeout(() => {
        const params = new URLSearchParams({ id: String(customerId) });
        location.replace((window.erpCompanyUrl ? window.erpCompanyUrl(`${CUSTOMERS_EDIT_URL}?${params.toString()}`) : `${CUSTOMERS_EDIT_URL}?${params.toString()}`));
      }, 300);
    }
  } catch (error) {
    console.error('[customerRegistration.onSubmit]', error);
    showError(error?.title || 'Falha ao salvar', error?.message || 'Não foi possível salvar o cliente.');
  } finally {
    setSubmitting(submitButton, false);
  }
}

function setSubmitting(button, isSubmitting) {
  if (!button) return;

  if (isSubmitting) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = 'Salvando...';
    return;
  }

  button.disabled = false;
  button.removeAttribute('aria-busy');

  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}
