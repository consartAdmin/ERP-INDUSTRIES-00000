// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.form.js                                 ║
// ║ MODULE: Fiscal Classification — Form                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { $, toNullableText, toNumber } from './fiscalClassification.utils.js';

function elements() {
  return {
    form: $('#formFiscalClassification'),
    id: $('#fiscal_classification_id'),
    name: $('#classification_name'),
    description: $('#description'),
    ncm: $('#ncm_code'),
    exTipi: $('#ex_tipi'),
    cest: $('#cest_code'),
    ncmDescription: $('#ncm_description'),
    cestDescription: $('#cest_description'),
    profile: $('#fiscal_profile_id'),
    isCst: $('#is_cst'),
    isClassification: $('#is_classification'),
    isRate: $('#is_rate'),
    isSpecificRate: $('#is_specific_rate'),
    isUnit: $('#is_unit'),
    ibscbsCst: $('#ibscbs_cst'),
    ibscbsClassification: $('#ibscbs_classification'),
    ibsUfRate: $('#ibs_uf_rate'),
    ibsMunicipalRate: $('#ibs_municipal_rate'),
    cbsRate: $('#cbs_rate'),
    donationIndicator: $('#donation_indicator'),
    active: $('#is_active'),
    title: $('#formTitulo'),
    subtitle: $('#formSubtitulo'),
  };
}

export function getClassificationForm() {
  return elements().form;
}

export function clearClassificationForm() {
  const fields = elements();
  if (!fields.form) return;

  fields.form.reset();
  if (fields.id) fields.id.value = '';
  if (fields.profile) fields.profile.value = '';
  if (fields.active) fields.active.checked = true;
  if (fields.title) fields.title.textContent = 'Nova Classificação';
  if (fields.subtitle) fields.subtitle.textContent = 'Preencha os dados e salve.';
}

export function fillClassificationForm(row) {
  const fields = elements();
  if (!fields.form) return;

  fields.id.value = row.fiscal_classification_id || '';
  fields.name.value = row.classification_name || '';
  fields.description.value = row.description || '';
  fields.ncm.value = row.ncm_code || '';
  fields.exTipi.value = row.ex_tipi || '';
  fields.cest.value = row.cest_code || '';
  fields.ncmDescription.value = row.ncm_description || '';
  fields.cestDescription.value = row.cest_description || '';
  fields.isCst.value = row.is_cst || '';
  fields.isClassification.value = row.is_classification || '';
  fields.isRate.value = row.is_rate ?? 0;
  fields.isSpecificRate.value = row.is_specific_rate ?? 0;
  fields.isUnit.value = row.is_unit || 'UN';
  fields.ibscbsCst.value = row.ibscbs_cst || '';
  fields.ibscbsClassification.value = row.ibscbs_classification || '';
  fields.ibsUfRate.value = row.ibs_uf_rate ?? 0;
  fields.ibsMunicipalRate.value = row.ibs_municipal_rate ?? 0;
  fields.cbsRate.value = row.cbs_rate ?? 0;
  fields.donationIndicator.value = String(row.donation_indicator ?? 1);
  if (fields.profile) {
    fields.profile.value =
      row.fiscal_profile_id == null ? '' : String(row.fiscal_profile_id);
  }
  fields.active.checked = row.is_active !== false;
  fields.title.textContent =
    `Editar Classificação #${row.fiscal_classification_id}`;
  fields.subtitle.textContent = 'Altere os dados e salve para atualizar.';
}

export function readClassificationForm() {
  const fields = elements();

  return {
    id: fields.id?.value ? Number(fields.id.value) : null,
    payload: {
      classification_name: String(fields.name?.value || '').trim(),
      description: toNullableText(fields.description?.value),
      ncm_code: toNullableText(fields.ncm?.value),
      ex_tipi: toNullableText(fields.exTipi?.value),
      cest_code: toNullableText(fields.cest?.value),
      ncm_description: toNullableText(fields.ncmDescription?.value),
      cest_description: toNullableText(fields.cestDescription?.value),
      fiscal_profile_id: fields.profile?.value
        ? Number(fields.profile.value)
        : null,
      is_cst: toNullableText(fields.isCst?.value),
      is_classification: toNullableText(fields.isClassification?.value),
      is_rate: toNumber(fields.isRate?.value),
      is_specific_rate: toNumber(fields.isSpecificRate?.value),
      is_unit: toNullableText(fields.isUnit?.value) || 'UN',
      ibscbs_cst: toNullableText(fields.ibscbsCst?.value),
      ibscbs_classification: toNullableText(fields.ibscbsClassification?.value),
      ibs_uf_rate: toNumber(fields.ibsUfRate?.value),
      ibs_municipal_rate: toNumber(fields.ibsMunicipalRate?.value),
      cbs_rate: toNumber(fields.cbsRate?.value),
      donation_indicator: Number(fields.donationIndicator?.value ?? 1),
      is_active: fields.active?.checked !== false,
    },
  };
}

export function focusClassificationName() {
  elements().name?.focus();
}

export function getEditingClassificationId() {
  return elements().id?.value || '';
}
