export const state = {
  manualItems: [],
  labelParametersPresets: [],
  priceTables: [],
  currentPriceId: null,
  selectedProduct: null,
  loading: false,
};

export function resetSelectedProduct() {
  state.selectedProduct = null;
}

