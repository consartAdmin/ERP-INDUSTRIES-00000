export const productsLmRefState = {
  items: [],
  editingId: null,
  loading: false,
  filters: { search: '', isActive: '' },
};

export function setProductsLmRefState(patch) {
  Object.assign(productsLmRefState, patch);
}

