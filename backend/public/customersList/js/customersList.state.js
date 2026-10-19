// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: customersList.state.js                                        ║
// ║ MODULE: Customers List — State                                      ║
// ║ PRODNEX ERP                                                         ║
// ║ Filters, pagination state and lookup caches                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  q: '',
  is_active: '',
  status_type_id: '',
  business_segment: '',
  segment_id: '',
  seller_id: '',
  limit: 10,
  offset: 0,
  total: 0,
  page: 1,
  totalPages: 1,
  orderBy: 'trade_name',
  orderDirection: 'asc',
};

export const lookups = {
  sellersById: new Map(),
  segmentsByKey: new Map(),
  segmentOptions: new Map(), // segment_id → rótulo (1 opção por segmento no filtro)
  statusById: new Map(),
  sellerByCustomerId: new Map(),
};

export function resetFiltersState() {
  Object.assign(state, {
    q: '',
    is_active: '',
    status_type_id: '',
    business_segment: '',
    segment_id: '',
    seller_id: '',
    page: 1,
    offset: 0,
  });
}

export function resetPagination() {
  state.page = 1;
  state.offset = 0;
}
