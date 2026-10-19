// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.address.js                               ║
// ║ MODULE: Customer Registration — Address Lookups                     ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { fetchCep, fetchCnpj } from './customerRegistration.api.js';
import { showError, showSuccess, showWarning } from './customerRegistration.modal.js';
import { getValue, onlyDigits, setValue } from './customerRegistration.utils.js';
import { isValidCnpjDigits } from './customerRegistration.validation.js';
import { selectIbgeLocation } from './customerRegistration.ibge.js';

export async function searchCep() {
  const cep = onlyDigits(getValue('postal_code'));
  if (cep.length !== 8) return;

  try {
    const data = await fetchCep(cep);
    const street = splitStreetTypeAndName(data.logradouro || '');

    setValue('street_type', street.type);
    setValue('street_name', street.name);
    setValue('neighborhood', data.bairro || '');
    await selectIbgeLocation({
      state: data.uf,
      city: data.localidade,
      ibgeCode: data.ibge,
    });
  } catch (error) {
    console.error('[customerRegistration.searchCep]', error);
    showWarning('CEP', 'Erro ao buscar CEP.');
  }
}

export async function searchCnpj() {
  if (getValue('person_type') === 'F') {
    showWarning('Consulta CNPJ', 'Consulta de CNPJ é apenas para Pessoa Jurídica.');
    return;
  }

  const cnpj = onlyDigits(getValue('tax_id'));
  if (!isValidCnpjDigits(cnpj)) {
    showWarning('CNPJ inválido', 'Informe 14 dígitos.');
    return;
  }

  const button = document.getElementById('btnBuscarCNPJ');
  setSearchButton(button, true);

  try {
    const data = await fetchCnpj(cnpj);
    await fillCnpjData(data);
    showSuccess('CNPJ encontrado', 'Dados preenchidos a partir da consulta pública.');
  } catch (error) {
    console.error('[customerRegistration.searchCnpj]', error);
    showError('Consulta CNPJ', 'Não foi possível consultar o CNPJ.');
  } finally {
    setSearchButton(button, false);
  }
}

async function fillCnpjData(data) {
  const establishment = data?.estabelecimento || {};
  const city = establishment.cidade || {};
  const state = establishment.estado || {};

  const legalName =
    data?.razao_social ||
    establishment.razao_social ||
    '';

  const tradeName =
    establishment.nome_fantasia ||
    data?.nome_fantasia ||
    legalName;

  setValue('trade_name', tradeName);
  setValue('legal_name', legalName);
  setValue('postal_code', onlyDigits(establishment.cep));
  setValue(
    'street_number',
    establishment.numero ??
    establishment.numero_endereco ??
    establishment.number ??
    establishment.street_number ??
    ''
  );
  setValue('address_complement', establishment.complemento || '');
  setValue('neighborhood', establishment.bairro || '');
  await selectIbgeLocation({
    state: state.sigla,
    city: city.nome,
    ibgeCode: city.ibge_id || city.ibge_code || city.ibgeCode || city.id,
  });
  setValue('email', establishment.email || '');
  setValue('phone_number', formatCnpjPhone(establishment));

  const registrations = Array.isArray(establishment.inscricoes_estaduais)
    ? establishment.inscricoes_estaduais
    : [];

  if (registrations.length) {
    setValue('state_registration', registrations[0]?.inscricao_estadual || '');
  }

  const streetTypeApi =
    establishment.tipo_logradouro ||
    establishment.tipoLogradouro ||
    establishment.street_type ||
    establishment.streetType ||
    '';

  const streetFull =
    establishment.logradouro ||
    establishment.street ||
    establishment.endereco ||
    '';

  if (streetTypeApi) {
    setValue('street_type', normalizeStreetType(streetTypeApi));
    setValue('street_name', streetFull);
  } else {
    const street = splitStreetTypeAndName(streetFull);
    setValue('street_type', street.type);
    setValue('street_name', street.name || streetFull);
  }
}

export function normalizeStreetType(value = '') {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '');

  const types = {
    R: 'RUA', RUA: 'RUA',
    AV: 'AVENIDA', AVE: 'AVENIDA', AVENIDA: 'AVENIDA',
    AL: 'ALAMEDA', ALAMEDA: 'ALAMEDA',
    TV: 'TRAVESSA', TRAV: 'TRAVESSA', TRAVESSA: 'TRAVESSA',
    ROD: 'RODOVIA', RDV: 'RODOVIA', RODOVIA: 'RODOVIA',
    EST: 'ESTRADA', ESTR: 'ESTRADA', ESTRADA: 'ESTRADA',
    PC: 'PRAÇA', PCA: 'PRAÇA', PRACA: 'PRAÇA', PRAÇA: 'PRAÇA',
    LG: 'LARGO', LARGO: 'LARGO',
    VIA: 'VIA',
    VL: 'VIELA', VIELA: 'VIELA',
    BEC: 'BECO', BECO: 'BECO',
    PASS: 'PASSAGEM', PASSAGEM: 'PASSAGEM',
    CONJ: 'CONJUNTO', CONJUNTO: 'CONJUNTO',
    QD: 'QUADRA', QUADRA: 'QUADRA',
    ST: 'SETOR', SETOR: 'SETOR',
    SERV: 'SERVIDÃO', SERVIDAO: 'SERVIDÃO', SERVIDÃO: 'SERVIDÃO',
  };

  return types[raw] || raw;
}

export function splitStreetTypeAndName(value = '') {
  const street = String(value || '').trim();
  if (!street) return { type: '', name: '' };

  const parts = street.split(/\s+/);
  const first = String(parts[0] || '').toUpperCase().replace(/\./g, '');
  const normalized = normalizeStreetType(first);

  const knownTypes = new Set([
    'RUA', 'AVENIDA', 'ALAMEDA', 'TRAVESSA', 'RODOVIA', 'ESTRADA',
    'PRAÇA', 'LARGO', 'VIA', 'VIELA', 'BECO', 'PASSAGEM', 'CONJUNTO',
    'QUADRA', 'SETOR', 'SERVIDÃO',
  ]);

  if (parts.length >= 2 && knownTypes.has(normalized)) {
    return {
      type: normalized,
      name: parts.slice(1).join(' ').trim(),
    };
  }

  return { type: '', name: street };
}

function formatCnpjPhone(establishment) {
  if (establishment.ddd1 && establishment.telefone1) {
    return `(${establishment.ddd1}) ${establishment.telefone1}`;
  }
  return establishment.telefone1 || '';
}

function setSearchButton(button, loading) {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? 'Buscando…' : 'Buscar';
}
