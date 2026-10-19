// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.state.js — Estado central                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const state = {
  page: 1,
  limit: 50,
  q: '',
  order: 'description_asc',
  loading: false,
  aborter: null,

  supplier_id: '',
  group_id: '',
  subgroup_id: '',
  brand_id: '',

  only_stock: false,
  active: '1',

  cost_min: '',
  cost_max: '',
};