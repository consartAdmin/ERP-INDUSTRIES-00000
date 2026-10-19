// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.profiles.js                             ║
// ║ MODULE: Fiscal Classification — Fiscal Profiles                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { listFiscalProfiles } from './fiscalClassification.api.js';
import { ROUTES } from './fiscalClassification.config.js';
import { state } from './fiscalClassification.state.js';
import { $, logError, normalizeRows } from './fiscalClassification.utils.js';

export async function loadFiscalProfiles() {
  const profileSelect = $('#fiscal_profile_id');
  state.fiscalProfilesById.clear();
  if (!profileSelect) return;

  profileSelect.innerHTML = '';
  profileSelect.add(new Option('— Sem perfil vinculado —', ''));

  try {
    const params = new URLSearchParams({ limit: '200', offset: '0' });
    const payload = await listFiscalProfiles(
      `${ROUTES.fiscalProfiles}?${params.toString()}`,
    );

    normalizeRows(payload).forEach((profile) => {
      const id = profile.fiscal_profile_id;
      if (id == null) return;

      const name = profile.profile_name || `Perfil #${id}`;
      state.fiscalProfilesById.set(String(id), name);
      profileSelect.add(new Option(name, String(id)));
    });
  } catch (error) {
    logError('Erro ao carregar perfis fiscais', error);
  }
}

export function getFiscalProfileName(profileId) {
  if (profileId == null) return '-';
  return state.fiscalProfilesById.get(String(profileId)) || '-';
}
