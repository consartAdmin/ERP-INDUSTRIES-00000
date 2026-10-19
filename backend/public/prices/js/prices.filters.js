import { DEFAULT_FILTERS } from './prices.config.js';
import { dom, state } from './prices.state.js';

export function syncFiltersFromDom() {
  state.q = String(dom.searchInput?.value || '').trim();
  state.status = dom.filterStatus?.value || 'all';
  state.sort = dom.sortField?.value || 'name';
  state.dir = dom.sortDir?.value || 'asc';
  state.limit = Math.max(1, Number(dom.pageSize?.value) || DEFAULT_FILTERS.limit);
}

export function clearFilters() {
  if (dom.searchInput) dom.searchInput.value = '';
  if (dom.filterStatus) dom.filterStatus.value = DEFAULT_FILTERS.status;
  if (dom.sortField) dom.sortField.value = DEFAULT_FILTERS.sort;
  if (dom.sortDir) dom.sortDir.value = DEFAULT_FILTERS.dir;
  if (dom.pageSize) dom.pageSize.value = String(DEFAULT_FILTERS.limit);
  Object.assign(state, DEFAULT_FILTERS);
}

export function buildListParams() {
  const params = new URLSearchParams({
    page: String(state.page),
    limit: String(state.limit),
    sort: state.sort,
    dir: state.dir,
  });
  if (state.q) params.set('q', state.q);
  if (state.status === 'active') params.set('active', 'true');
  return params;
}
