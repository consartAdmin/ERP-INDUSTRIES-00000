// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalClassification.state.js                                ║
// ║ MODULE: Fiscal Classification — State                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { DEFAULT_PAGE_SIZE } from './fiscalClassification.config.js';

export const state = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  filters: {
    query: '',
    ncm: '',
    cest: '',
    active: 'all',
  },
  fiscalProfilesById: new Map(),
};
