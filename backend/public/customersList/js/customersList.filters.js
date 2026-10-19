// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.filters.js                                      ║
// ║ MODULE: Customers List — Filters                                    ║
// ║ PRODNEX ERP                                                         ║
// ║ Filter events and lookup select population                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { lookups, resetPagination, state } from './customersList.state.js';
import { $ } from './customersList.utils.js';

export function bindFilterEvents(loadAndRender) {
  $('#btnSearch')?.addEventListener('click', () => {
    state.q = $('#q')?.value?.trim() || '';
    resetPagination();
    void loadAndRender();
  });

  $('#q')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    $('#btnSearch')?.click();
  });

  bindChange('#perPage', (value) => {
    const limit = Number(value);
    state.limit = Number.isFinite(limit) && limit > 0 ? limit : 10;
  }, loadAndRender);

  bindChange('#status', (value) => {
    state.is_active = value;
  }, loadAndRender);
  bindChange('#statusType', (value) => {
    state.status_type_id = value;
  }, loadAndRender);
  bindChange('#segmento', (value) => {
    state.segment_id = value.trim();
  }, loadAndRender);
  bindChange('#vendedor', (value) => {
    state.seller_id = value;
  }, loadAndRender);
}

function bindChange(selector, updateState, loadAndRender) {
  $(selector)?.addEventListener('change', (event) => {
    updateState(event.currentTarget.value || '');
    resetPagination();
    void loadAndRender();
  });
}

export function fillFiltersCombos() {
  fillSelect(
    '#statusType',
    Array.from(lookups.statusById.entries())
      .filter(([key]) => /^\d+$/.test(String(key)))
  );

  // Uma opção por segmento (o filtro usa segment_id)
  fillSelect('#segmento', Array.from(lookups.segmentOptions.entries()));
  fillSelect('#vendedor', Array.from(lookups.sellersById.entries()));
}

function fillSelect(selector, entries) {
  const select = $(selector);
  if (!select) return;

  const keep = select.value;
  select.innerHTML = '<option value="">Todos</option>';

  entries
    .map(([key, label]) => ({ key: String(key), label: String(label) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
    .forEach(({ key, label }) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });

  select.value = keep;
}
