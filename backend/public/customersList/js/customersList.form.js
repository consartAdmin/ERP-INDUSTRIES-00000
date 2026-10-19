// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.form.js                                         ║
// ║ MODULE: Customers List — Form                                       ║
// ║ PRODNEX ERP                                                         ║
// ║ Form reading, clearing and report query construction                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './customersList.state.js';
import { $ } from './customersList.utils.js';

export function readInitialForm() {
  state.limit = Math.max(1, Number($('#perPage')?.value || 10));
  state.q = $('#q')?.value?.trim() || '';
  state.is_active = $('#status')?.value || '';
  state.status_type_id = $('#statusType')?.value || '';
  state.segment_id = $('#segmento')?.value || '';
  state.seller_id = $('#vendedor')?.value || '';
}

export function clearFilterForm() {
  const values = {
    q: '',
    status: '',
    statusType: '',
    segmento: '',
    vendedor: '',
    perPage: String(state.limit),
  };

  for (const [id, value] of Object.entries(values)) {
    const element = $(`#${id}`);
    if (element) element.value = value;
  }
}

export function buildReportQuery(extra = {}) {
  const query = new URLSearchParams();
  const q = String(state.q ?? '').trim();

  if (q) query.set('q', q);

  if (state.is_active !== '') {
    const value = state.is_active === 'true' ? 'true' : 'false';
    query.set('is_active', value);
    query.set('status', value);
  }

  if (/^\d+$/.test(String(state.status_type_id || ''))) {
    query.set('status_type_id', String(state.status_type_id));
  }
  if (state.business_segment) {
    query.set('business_segment', String(state.business_segment));
  }
  if (/^\d+$/.test(String(state.seller_id || ''))) {
    query.set('seller_id', String(state.seller_id));
  }
  if (/^\d+$/.test(String(state.segment_id || ''))) {
    query.set('segment_id', String(state.segment_id));
  }
  if (state.orderBy) {
    query.set('orderBy', String(state.orderBy));
    query.set('orderDirection', String(state.orderDirection || 'asc'));
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value != null && String(value).trim()) {
      query.set(key, String(value).trim());
    }
  }

  return query.toString();
}
