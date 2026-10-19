// ╔══════════════════════════════════════════════════════════════════════╗
// ║ filters.customer.js — CRM Deals (PRODNEX ERP)                       ║
// ║ Filtros do Kanban pelo cadastro do cliente: Estado, Cidade, Segmento ║
// ║ Só age se a página tiver os selects (#crm-estado, #crm-cidade,      ║
// ║ #crm-segmento); a tela da BH3 continua igual.                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { apiUrl } from './config.js';
import { fetchJSON } from './fetchJSON.js';

export const customerFilters = { state: '', city: '', segmentId: '' };

let locations = [];

/** Parâmetros para GET /crm/deals */
export function getCustomerFilterParams() {
  return {
    state: customerFilters.state || undefined,
    city: customerFilters.city || undefined,
    segmentId: customerFilters.segmentId || undefined,
  };
}

function fillSelect(select, firstLabel, entries) {
  if (!select) return;
  const keep = select.value;
  select.innerHTML = '';
  select.appendChild(new Option(firstLabel, ''));
  entries.forEach(([value, label]) => select.appendChild(new Option(label, value)));
  select.value = entries.some(([value]) => value === keep) ? keep : '';
}

function fillCities(selCity) {
  const cities = [...new Set(
    locations
      .filter((l) => !customerFilters.state || l.state === customerFilters.state)
      .map((l) => String(l.city || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  fillSelect(selCity, 'Todas as cidades', cities.map((c) => [c.toUpperCase(), c]));
  customerFilters.city = selCity?.value || '';
}

async function loadOptions(selState, selCity, selSegment) {
  try {
    const json = await fetchJSON(apiUrl('/crm/customer-locations'));
    locations = Array.isArray(json?.data) ? json.data : [];
  } catch (err) {
    console.error('[CRM] Erro ao carregar estados/cidades:', err);
    locations = [];
  }

  const states = [...new Set(locations.map((l) => l.state).filter(Boolean))].sort();
  fillSelect(selState, 'Todos os estados', states.map((s) => [s, s]));
  fillCities(selCity);

  if (selSegment) {
    try {
      const json = await fetchJSON(apiUrl('/customer-segments?limit=100'));
      const rows = Array.isArray(json?.data) ? json.data : [];
      const entries = rows
        .filter((s) => s.is_active !== false)
        .map((s) => [String(s.segment_id ?? s.id), String(s.segment_name ?? s.name ?? '')])
        .filter(([id, name]) => id && name)
        .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
      fillSelect(selSegment, 'Todos os segmentos', entries);
    } catch (err) {
      console.error('[CRM] Erro ao carregar segmentos:', err);
    }
  }
}

/** Monta os filtros; onChange recarrega o Kanban. */
export async function initCustomerFilters(onChange) {
  const selState = document.getElementById('crm-estado');
  const selCity = document.getElementById('crm-cidade');
  const selSegment = document.getElementById('crm-segmento');
  if (!selState && !selCity && !selSegment) return;

  await loadOptions(selState, selCity, selSegment);

  const changed = () => Promise.resolve(onChange?.()).catch((err) =>
    console.error('[CRM] Erro ao aplicar filtro:', err)
  );

  selState?.addEventListener('change', () => {
    customerFilters.state = selState.value;
    fillCities(selCity);
    changed();
  });
  selCity?.addEventListener('change', () => {
    customerFilters.city = selCity.value;
    changed();
  });
  selSegment?.addEventListener('change', () => {
    customerFilters.segmentId = selSegment.value;
    changed();
  });
}
