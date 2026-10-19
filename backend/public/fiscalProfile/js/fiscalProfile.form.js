// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.form.js                                         ║
// ║ MODULE: Fiscal Profile — Form                                       ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom } from './fiscalProfile.state.js';
import { numberOrNull } from './fiscalProfile.utils.js';

export function resetForm() {
  dom.form?.reset();

  dom.fields.id.value = '';
  dom.fields.isActive.checked = true;
  dom.formTitle.textContent = 'Novo Perfil Fiscal';
  dom.formSubtitle.textContent = 'Preencha os campos e salve.';
}

export function fillForm(profile) {
  const fields = dom.fields;

  fields.id.value = profile.fiscal_profile_id || '';
  fields.profileName.value = profile.profile_name || '';
  fields.description.value = profile.description || '';
  fields.icmsCst.value = profile.icms_cst || '';
  fields.icmsRate.value = profile.icms_rate ?? '';
  fields.cfopEntry.value = profile.cfop_entry || '';
  fields.cfopExit.value = profile.cfop_exit || '';
  fields.originCode.value = profile.origin_code ?? '';
  fields.pisCst.value = profile.pis_cst || '';
  fields.pisRate.value = profile.pis_rate ?? '';
  fields.cofinsCst.value = profile.cofins_cst || '';
  fields.cofinsRate.value = profile.cofins_rate ?? '';
  fields.benefitCode.value = profile.benefit_code || '';
  fields.isActive.checked = profile.is_active !== false;

  dom.formTitle.textContent = `Editar Perfil #${profile.fiscal_profile_id}`;
  dom.formSubtitle.textContent = 'Altere os dados e salve para atualizar.';
}

export function readForm() {
  const fields = dom.fields;

  return {
    id: fields.id.value ? Number(fields.id.value) : null,
    payload: {
      profile_name: fields.profileName.value.trim(),
      description: fields.description.value.trim() || null,
      icms_cst: fields.icmsCst.value.trim() || null,
      icms_rate: numberOrNull(fields.icmsRate.value) ?? 0,
      cfop_entry: fields.cfopEntry.value.trim() || null,
      cfop_exit: fields.cfopExit.value.trim() || null,
      origin_code: fields.originCode.value.trim() || null,
      pis_cst: fields.pisCst.value.trim() || null,
      pis_rate: numberOrNull(fields.pisRate.value) ?? 0,
      cofins_cst: fields.cofinsCst.value.trim() || null,
      cofins_rate: numberOrNull(fields.cofinsRate.value) ?? 0,
      benefit_code: fields.benefitCode.value.trim() || null,
      is_active: fields.isActive.checked,
    },
  };
}
