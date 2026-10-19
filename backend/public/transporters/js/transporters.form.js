// ╔══════════════════════════════════════════════════════════════════════╗
// ║ transporters.form.js — Leitura, preenchimento e máscaras do formulário ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  getModalElements,
  showAttachmentsAlert,
  showCnpjLookupStatus
} from './transporters.modal.js';
import {
  formatCnpj,
  formatCpf,
  formatPhone,
  formatZipCode,
  normalizeState,
  onlyDigits
} from './transporters.utils.js';

export function clearTransporterForm() {
  const els = getModalElements();
  els.form.reset();
  els.legal_name.value = '';
  els.trade_name.value = '';
  els.tax_id.value = '';
  els.cpf.value = '';
  els.state_registration.value = '';
  els.municipal_registration.value = '';
  els.rntrc.value = '';
  els.street_type.value = '';
  els.street_name.value = '';
  els.street_number.value = '';
  els.address_complement.value = '';
  els.neighborhood.value = '';
  els.city.value = '';
  els.state.value = '';
  els.ibge_location_id.value = '';
  els.postal_code.value = '';
  els.contact_name.value = '';
  els.phone_number.value = '';
  els.mobile_number.value = '';
  els.is_active.value = 'true';
  els.notes.value = '';
  els.attachmentInput.value = '';
  showAttachmentsAlert('');
  showCnpjLookupStatus('');
}

export function fillTransporterForm(data = {}) {
  const els = getModalElements();
  els.legal_name.value = data.legal_name ?? data.corporate_name ?? '';
  els.trade_name.value = data.trade_name ?? '';
  els.tax_id.value = formatCnpj(data.tax_id ?? data.cnpj ?? '');
  els.cpf.value = formatCpf(data.cpf ?? '');
  els.state_registration.value = data.state_registration ?? '';
  els.municipal_registration.value = data.municipal_registration ?? '';
  els.rntrc.value = data.rntrc ?? '';
  els.street_type.value = data.street_type ?? '';
  els.street_name.value = data.street_name ?? data.address ?? '';
  els.street_number.value = data.street_number ?? data.address_number ?? '';
  els.address_complement.value = data.address_complement ?? '';
  els.neighborhood.value = data.neighborhood ?? data.district ?? '';
  els.city.value = data.city ?? '';
  els.state.value = normalizeState(data.state ?? '');
  els.ibge_location_id.value = data.ibge_location_id ?? data.city_ibge_code ?? '';
  els.postal_code.value = formatZipCode(data.postal_code ?? data.zip_code ?? '');
  els.contact_name.value = data.contact_name ?? '';
  els.phone_number.value = formatPhone(data.phone_number ?? data.phone ?? '');
  els.mobile_number.value = formatPhone(data.mobile_number ?? '');
  els.is_active.value = String(data.is_active !== false);
  els.notes.value = data.notes ?? '';
  showCnpjLookupStatus('');
}

export function getTransporterFormData() {
  const els = getModalElements();
  return {
    legal_name: els.legal_name.value.trim(),
    trade_name: els.trade_name.value.trim(),
    tax_id: els.tax_id.value.trim(),
    cpf: els.cpf.value.trim(),
    state_registration: els.state_registration.value.trim(),
    municipal_registration: els.municipal_registration.value.trim(),
    rntrc: els.rntrc.value.trim(),
    street_type: els.street_type.value.trim(),
    street_name: els.street_name.value.trim(),
    street_number: els.street_number.value.trim(),
    address_complement: els.address_complement.value.trim(),
    neighborhood: els.neighborhood.value.trim(),
    city: els.city.value.trim(),
    state: normalizeState(els.state.value),
    ibge_location_id: els.ibge_location_id.value.trim(),
    postal_code: els.postal_code.value.trim(),
    contact_name: els.contact_name.value.trim(),
    phone_number: els.phone_number.value.trim(),
    mobile_number: els.mobile_number.value.trim(),
    notes: els.notes.value.trim(),
    is_active: els.is_active.value === 'true'
  };
}

// Aplica no formulário os dados devolvidos pela consulta pública de CNPJ.
// Campos internos da transportadora (RNTRC, contato, observações e ativo) são preservados.
export function applyCnpjLookupData(payload = {}, resolvedIbgeCode = '') {
  const els = getModalElements();
  const d = payload?.dados || payload?.data || payload || {};
  const est = d?.estabelecimento || {};
  const cidade = est?.cidade || {};
  const estado = est?.estado || {};

  const corporateName =
    d?.razao_social ||
    est?.razao_social ||
    d?.nome_empresarial ||
    '';

  const tradeName =
    est?.nome_fantasia ||
    d?.nome_fantasia ||
    '';

  const stateRegistrationList = Array.isArray(est?.inscricoes_estaduais)
    ? est.inscricoes_estaduais
    : [];

  const preferredStateRegistration =
    stateRegistrationList.find((item) => item?.ativo !== false && item?.inscricao_estadual)?.inscricao_estadual ||
    stateRegistrationList[0]?.inscricao_estadual ||
    est?.inscricao_estadual ||
    d?.inscricao_estadual ||
    '';

  let phone = '';
  if (est?.ddd1 && est?.telefone1) phone = `${est.ddd1}${est.telefone1}`;
  else if (est?.telefone1) phone = est.telefone1;
  else if (d?.telefone) phone = d.telefone;

  const cityIbgeCode =
    resolvedIbgeCode ||
    cidade?.ibgeCode ||
    cidade?.ibge_code ||
    cidade?.codigo_ibge ||
    cidade?.codigo ||
    est?.codigo_ibge ||
    '';

  if (corporateName) els.legal_name.value = corporateName;
  if (tradeName) els.trade_name.value = tradeName;
  if (preferredStateRegistration) els.state_registration.value = preferredStateRegistration;

  els.street_type.value = est?.tipo_logradouro || d?.tipo_logradouro || '';
  els.street_name.value = est?.logradouro || d?.logradouro || '';
  els.street_number.value = est?.numero || d?.numero || '';
  els.address_complement.value = est?.complemento || d?.complemento || '';
  els.neighborhood.value = est?.bairro || d?.bairro || '';
  els.city.value = cidade?.nome || est?.cidade_nome || d?.municipio || d?.cidade || '';
  els.state.value = normalizeState(estado?.sigla || est?.uf || d?.uf || '');
  els.ibge_location_id.value = String(cityIbgeCode || '').trim();
  els.postal_code.value = formatZipCode(est?.cep || d?.cep || '');
  els.phone_number.value = formatPhone(phone);
}

export function bindTransporterFormMasks({ onCnpjComplete } = {}) {
  const els = getModalElements();
  if (els.form.dataset.masksBound === 'true') return;
  els.form.dataset.masksBound = 'true';

  let cnpjTimer = null;

  const triggerCnpjLookup = () => {
    const cnpj = onlyDigits(els.tax_id.value);
    if (cnpj.length !== 14 || typeof onCnpjComplete !== 'function') return;

    clearTimeout(cnpjTimer);
    cnpjTimer = setTimeout(() => {
      onCnpjComplete(cnpj).catch((error) => {
        console.error('[transporters.cnpjLookup]', error);
      });
    }, 250);
  };

  els.tax_id.addEventListener('input', () => {
    els.tax_id.value = formatCnpj(els.tax_id.value);
    const cnpj = onlyDigits(els.tax_id.value);

    if (cnpj) els.cpf.value = '';
    if (cnpj.length < 14) showCnpjLookupStatus('');

    triggerCnpjLookup();
  });

  // Também consulta ao sair do campo, útil quando o navegador/autofill preenche o CNPJ.
  els.tax_id.addEventListener('blur', triggerCnpjLookup);

  els.cpf.addEventListener('input', () => {
    els.cpf.value = formatCpf(els.cpf.value);
    if (onlyDigits(els.cpf.value)) {
      els.tax_id.value = '';
      showCnpjLookupStatus('');
    }
  });

  els.postal_code.addEventListener('input', () => {
    els.postal_code.value = formatZipCode(els.postal_code.value);
  });

  els.phone_number.addEventListener('input', () => {
    els.phone_number.value = formatPhone(els.phone_number.value);
  });

  els.mobile_number.addEventListener('input', () => {
    els.mobile_number.value = formatPhone(els.mobile_number.value);
  });

  els.state.addEventListener('input', () => {
    els.state.value = normalizeState(els.state.value);
  });
}
