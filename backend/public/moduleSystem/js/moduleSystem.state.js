export const state = {
  modules: [],
  editingId: null,
  page: 1,
  pageSize: 50,
};

export function setPage(page) {
  state.page = page;
}

export function setPageSize(size) {
  state.pageSize = size;
  state.page = 1;
}

export function setModules(modules) {
  state.modules = modules;
}

export function setEditingId(id) {
  state.editingId = id || null;
}
