// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.form.js                                                  ║
// ║ Leitura, preenchimento e máscaras do formulário de Empresas         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { SELECTORS } from './enterprise.config.js';
import {
  $,
  applyCepMask,
  applyCnpjMask,
  applyPhoneMask,
  normalizeDateInput,
} from './enterprise.utils.js';

const FIELD_NAMES = [
  'enterpriseId',
  'corporate_name',
  'trade_name',
  'cnpj',
  'state_registration',
  'municipal_registration',
  'tax_regime_code',
  'status',
  'opening_date',
  'cnae',
  'zip_code',
  'address',
  'address_number',
  'address_complement',
  'district',
  'city',
  'state',
  'city_ibge_code',
  'phone',
  'whatsapp',
  'email',
  'website',
  'nfe_environment',
  'nfe_series',
  'next_nfe_number',
  'logo_url',
  'slogan',
  'document_notes',
  'is_active',
];

function getFields() {
  return Object.fromEntries(
    FIELD_NAMES.map((name) => [name, $(SELECTORS[name])]),
  );
}

export function getEnterpriseFormElement() {
  return $(SELECTORS.form);
}

export function getEnterpriseFormData() {
  const f = getFields();

  return {
    corporate_name: f.corporate_name.value.trim(),
    trade_name: f.trade_name.value.trim(),
    cnpj: f.cnpj.value.trim(),
    state_registration: f.state_registration.value.trim(),
    municipal_registration: f.municipal_registration.value.trim(),
    tax_regime_code: f.tax_regime_code.value,
    status: f.status.value,
    opening_date: f.opening_date.value || null,
    cnae: f.cnae.value.trim(),
    zip_code: f.zip_code.value.trim(),
    address: f.address.value.trim(),
    address_number: f.address_number.value.trim(),
    address_complement: f.address_complement.value.trim(),
    district: f.district.value.trim(),
    city: f.city.value.trim(),
    state: f.state.value.trim().toUpperCase(),
    city_ibge_code: f.city_ibge_code.value.trim(),
    phone: f.phone.value.trim(),
    whatsapp: f.whatsapp.value.trim(),
    email: f.email.value.trim(),
    website: f.website.value.trim(),
    nfe_environment: f.nfe_environment.value,
    nfe_series: f.nfe_series.value.trim(),
    next_nfe_number: Number(f.next_nfe_number.value || 1),
    logo_url: f.logo_url.value.trim(),
    slogan: f.slogan.value.trim(),
    document_notes: f.document_notes.value.trim(),
    is_active: f.is_active.value === 'true',
  };
}

export function fillEnterpriseForm(data = {}) {
  const f = getFields();
  const id = data.id ?? data.enterprise_id ?? '';

  f.enterpriseId.value = id;
  f.corporate_name.value = data.corporate_name ?? '';
  f.trade_name.value = data.trade_name ?? '';
  f.cnpj.value = applyCnpjMask(data.cnpj ?? '');
  f.state_registration.value = data.state_registration ?? '';
  f.municipal_registration.value = data.municipal_registration ?? '';
  f.tax_regime_code.value = data.tax_regime_code ?? '';
  f.status.value = data.status ?? 'ACTIVE';
  f.opening_date.value = normalizeDateInput(data.opening_date);
  f.cnae.value = data.cnae ?? '';
  f.zip_code.value = applyCepMask(data.zip_code ?? '');
  f.address.value = data.address ?? '';
  f.address_number.value = data.address_number ?? '';
  f.address_complement.value = data.address_complement ?? '';
  f.district.value = data.district ?? '';
  f.city.value = data.city ?? '';
  f.state.value = String(data.state ?? '').toUpperCase().slice(0, 2);
  f.city_ibge_code.value = data.city_ibge_code ?? '';
  f.phone.value = applyPhoneMask(data.phone ?? '');
  f.whatsapp.value = applyPhoneMask(data.whatsapp ?? '');
  f.email.value = data.email ?? '';
  f.website.value = data.website ?? '';
  f.nfe_environment.value = data.nfe_environment ?? 'homologation';
  f.nfe_series.value = data.nfe_series ?? '';
  f.next_nfe_number.value = data.next_nfe_number ?? 1;
  setEnterpriseLogoView(data.logo_url ?? '');
  f.slogan.value = data.slogan ?? '';
  f.document_notes.value = data.document_notes ?? '';
  f.is_active.value = String(data.is_active !== false);
}

export function setEnterpriseLogoView(url = '', options = {}) {
  const normalizedUrl = String(url || '').trim();
  const input = $(SELECTORS.logo_url);
  const fileInput = $(SELECTORS.enterpriseLogoFile);
  const status = $(SELECTORS.enterpriseLogoStatus);
  const previewBox = $(SELECTORS.enterpriseLogoPreviewBox);
  const preview = $(SELECTORS.enterpriseLogoPreview);
  const removeButton = $(SELECTORS.btnRemoveEnterpriseLogo);

  if (input) input.value = normalizedUrl;

  if (preview && previewBox) {
    if (normalizedUrl) {
      preview.src = normalizedUrl;
      previewBox.hidden = false;
    } else {
      preview.removeAttribute('src');
      previewBox.hidden = true;
    }
  }

  if (removeButton) removeButton.hidden = !normalizedUrl;

  if (status) {
    status.textContent =
      options.statusText ||
      (normalizedUrl ? 'Logo carregada.' : 'Nenhum arquivo selecionado.');
    status.classList.toggle('is-success', Boolean(options.success));
    status.classList.toggle('is-error', Boolean(options.error));
    status.classList.toggle('is-loading', Boolean(options.loading));
  }

  if (options.clearFileInput !== false && fileInput) {
    fileInput.value = '';
  }
}

export function showEnterpriseLogoLocalPreview(file) {
  if (!(file instanceof File)) return;

  const status = $(SELECTORS.enterpriseLogoStatus);
  const previewBox = $(SELECTORS.enterpriseLogoPreviewBox);
  const preview = $(SELECTORS.enterpriseLogoPreview);

  if (preview && previewBox) {
    const objectUrl = URL.createObjectURL(file);
    preview.onload = () => URL.revokeObjectURL(objectUrl);
    preview.src = objectUrl;
    previewBox.hidden = false;
  }

  if (status) {
    status.textContent = `${file.name} — aguardando envio...`;
    status.classList.remove('is-success', 'is-error', 'is-loading');
  }
}

export function getSelectedEnterpriseLogoFile() {
  return $(SELECTORS.enterpriseLogoFile)?.files?.[0] || null;
}

export function resetEnterpriseLogoFileInput() {
  const fileInput = $(SELECTORS.enterpriseLogoFile);
  if (fileInput) fileInput.value = '';
}

export function setEnterpriseLogoUploadState({ loading = false, message = '', error = false, success = false } = {}) {
  const status = $(SELECTORS.enterpriseLogoStatus);
  const selectButton = $(SELECTORS.btnSelectEnterpriseLogo);
  const removeButton = $(SELECTORS.btnRemoveEnterpriseLogo);

  if (selectButton) {
    selectButton.disabled = loading;
    selectButton.textContent = loading ? 'Enviando...' : 'Selecionar logo';
  }

  if (removeButton) removeButton.disabled = loading;

  if (status && message) status.textContent = message;
  if (status) {
    status.classList.toggle('is-loading', loading);
    status.classList.toggle('is-error', error);
    status.classList.toggle('is-success', success);
  }
}

export function getEnterpriseIdFromForm() {
  return $(SELECTORS.enterpriseId)?.value || '';
}

export function focusEnterpriseForm() {
  window.requestAnimationFrame(() => {
    $(SELECTORS.corporate_name)?.focus();
  });
}

async function searchCep() {
  const f = getFields();
  const cep = String(f.zip_code.value || '').replace(/\D+/g, '');

  if (cep.length !== 8) return;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) return;

    const data = await response.json();
    if (data?.erro) return;

    if (!f.address.value) f.address.value = data.logradouro || '';
    if (!f.district.value) f.district.value = data.bairro || '';
    if (!f.city.value) f.city.value = data.localidade || '';
    if (!f.state.value) f.state.value = data.uf || '';
    if (!f.city_ibge_code.value) f.city_ibge_code.value = data.ibge || '';
  } catch {
    // Consulta auxiliar: falhas de CEP não impedem a edição manual.
  }
}

export function bindEnterpriseFormMasks() {
  const f = getFields();

  f.cnpj?.addEventListener('input', () => {
    f.cnpj.value = applyCnpjMask(f.cnpj.value);
  });

  f.zip_code?.addEventListener('input', () => {
    f.zip_code.value = applyCepMask(f.zip_code.value);
  });

  f.zip_code?.addEventListener('blur', searchCep);

  f.phone?.addEventListener('input', () => {
    f.phone.value = applyPhoneMask(f.phone.value);
  });

  f.whatsapp?.addEventListener('input', () => {
    f.whatsapp.value = applyPhoneMask(f.whatsapp.value);
  });

  f.state?.addEventListener('input', () => {
    f.state.value = f.state.value.toUpperCase().slice(0, 2);
  });
}
