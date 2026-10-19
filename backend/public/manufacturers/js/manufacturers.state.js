export const state = {
  currentPage: 1,
  currentLimit: 20,
  currentQuery: '',
  totalRows: 0,
};

export function setPagination({ page, limit, total }) {
  state.currentPage = page;
  state.currentLimit = limit;
  state.totalRows = total;
}

export function setQuery(query) {
  state.currentQuery = query;
  state.currentPage = 1;
}

export function setLimit(limit) {
  state.currentLimit = limit;
  state.currentPage = 1;
}
