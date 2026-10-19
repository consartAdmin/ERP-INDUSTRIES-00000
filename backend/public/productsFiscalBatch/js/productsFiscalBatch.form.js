// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.form.js                                  ║
// ║ MODULE: Products Fiscal Batch — Form                               ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { dom, state } from './productsFiscalBatch.state.js';

export function setClassification(classification) {
  state.classification = classification;

  const label = [
    classification?.ncm,
    classification?.cest,
    classification?.description,
  ]
    .filter(Boolean)
    .join(' • ');

  if (dom.classificationDisplay) {
    dom.classificationDisplay.value =
      label || (classification?.id ? `ID #${classification.id}` : '');
  }

  if (dom.summaryClassification) {
    dom.summaryClassification.textContent = label || '-';
  }
}

export function setFiscalProfile(profileId) {
  state.fiscalProfileId = profileId ? String(profileId) : '';

  if (dom.fiscalProfileSelect) {
    dom.fiscalProfileSelect.value = state.fiscalProfileId;
  }

  updateFiscalProfileSummary();
}

export function updateFiscalProfileSummary() {
  const selectedOption = dom.fiscalProfileSelect?.selectedOptions?.[0];

  if (dom.summaryProfile) {
    dom.summaryProfile.textContent =
      state.fiscalProfileId && selectedOption
        ? selectedOption.textContent
        : '-';
  }
}

export function fillFiscalProfiles(profiles) {
  if (!dom.fiscalProfileSelect) return;

  dom.fiscalProfileSelect.innerHTML =
    '<option value="">Selecione um perfil fiscal...</option>';

  profiles.forEach((profile) => {
    const id = profile.id ?? profile.fiscal_profile_id;
    if (id == null) return;

    const option = document.createElement('option');
    option.value = String(id);
    option.textContent =
      profile.name ??
      profile.profile_name ??
      profile.description ??
      profile.description_profile ??
      `Perfil #${id}`;

    dom.fiscalProfileSelect.appendChild(option);
  });

  // No modelo V2, o perfil é definido pela classificação fiscal.
  // O campo permanece visível apenas para informar o perfil herdado.
  dom.fiscalProfileSelect.disabled = true;
  dom.fiscalProfileSelect.setAttribute(
    'title',
    'O perfil fiscal é herdado da classificação selecionada.'
  );

  setFiscalProfile(state.fiscalProfileId);
}

export function readFiscalProfile() {
  setFiscalProfile(dom.fiscalProfileSelect?.value || '');
}
