// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customerRegistration.ibge.js                                  ║
// ║ MODULE: Customer Registration — UF, city and IBGE code              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { fetchIbgeCities, fetchIbgeUfs } from './customerRegistration.api.js';

const stateSelect = () => document.getElementById('state');
const citySelect = () => document.getElementById('city');
const ibgeInput = () => document.getElementById('ibge_city_code');

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function setIbgeCode(value = '') {
  const input = ibgeInput();
  if (input) input.value = String(value ?? '').replace(/\D+/g, '').slice(0, 7);
}

export async function loadUfs(selectedState = '') {
  const select = stateSelect();
  if (!select) return;

  select.disabled = true;
  select.innerHTML = '<option value="">Carregando UFs...</option>';

  try {
    const rows = await fetchIbgeUfs();
    select.innerHTML = '<option value="">Selecione a UF...</option>';

    for (const item of rows) {
      const uf = String(item?.uf ?? item?.state ?? '').trim().toUpperCase();
      if (!uf) continue;

      const option = document.createElement('option');
      option.value = uf;
      option.textContent = item?.name && item.name !== uf ? `${uf} — ${item.name}` : uf;
      select.appendChild(option);
    }

    select.value = String(selectedState ?? '').trim().toUpperCase();
  } catch (error) {
    select.innerHTML = '<option value="">Erro ao carregar UFs</option>';
    throw error;
  } finally {
    select.disabled = false;
  }
}

export async function loadCities(state, selectedCity = '', preferredIbgeCode = '') {
  const select = citySelect();
  if (!select) return null;

  select.disabled = true;
  select.innerHTML = '<option value="">Carregando municípios...</option>';
  setIbgeCode('');

  const uf = String(state ?? '').trim().toUpperCase();
  if (!uf) {
    select.innerHTML = '<option value="">Selecione primeiro a UF</option>';
    return null;
  }

  try {
    const rows = await fetchIbgeCities(uf);
    select.innerHTML = '<option value="">Selecione a cidade...</option>';

    for (const item of rows) {
      const city = String(item?.city ?? item?.name ?? '').trim();
      if (!city) continue;

      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      option.dataset.ibgeCode = String(item?.ibge_code ?? item?.ibgeCode ?? '');
      select.appendChild(option);
    }

    const wantedCity = normalizeName(selectedCity);
    const wantedCode = String(preferredIbgeCode ?? '').replace(/\D+/g, '');
    const match = [...select.options].find((option) =>
      (wantedCode && option.dataset.ibgeCode === wantedCode) ||
      (wantedCity && normalizeName(option.value) === wantedCity)
    );

    if (match) {
      select.value = match.value;
      setIbgeCode(match.dataset.ibgeCode || wantedCode);
      return {
        state: uf,
        city: match.value,
        ibgeCode: match.dataset.ibgeCode || wantedCode,
      };
    }

    setIbgeCode(wantedCode);
    return null;
  } finally {
    select.disabled = false;
  }
}

export async function selectIbgeLocation({ state, city, ibgeCode = '' } = {}) {
  const uf = String(state ?? '').trim().toUpperCase();
  if (!uf) return null;

  const select = stateSelect();
  if (!select) return null;

  if (![...select.options].some((option) => option.value === uf)) {
    await loadUfs(uf);
  } else {
    select.value = uf;
  }

  return loadCities(uf, city, ibgeCode);
}

export async function initializeIbgeLocations() {
  const state = stateSelect();
  const city = citySelect();
  if (!state || !city) return;

  state.addEventListener('change', () => {
    void loadCities(state.value).catch((error) => {
      console.error('[customerRegistration.loadCities]', error);
    });
  });

  city.addEventListener('change', () => {
    setIbgeCode(city.selectedOptions[0]?.dataset.ibgeCode || '');
  });

  await loadUfs();
}
