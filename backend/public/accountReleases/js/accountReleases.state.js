// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.state.js                                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { DEFAULT_PAGE_LIMIT } from './accountReleases.constants.js';

export const state = {
  items: [],
  selectedId: null,
  limit: DEFAULT_PAGE_LIMIT,
  offset: 0,
  page: 1,
  customer: null,
  customerAttachFilter: {
    year: null,
    month: null,
    category: null,
  },
};