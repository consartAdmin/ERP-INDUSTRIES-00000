import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { API_BASE } from './labels.config.js';
import { state } from './labels.state.js';
import { $ } from './labels.utils.js';

export function openProductSearch(onPick) {
  openProductsModalSearch({
    apiBase: API_BASE,
    priceId: state.currentPriceId,
    onPick(product) {
      state.selectedProduct = product || null;
      onPick?.(product);
    },
  });
}

export function bindProductSearch(onPick) {
  const open = (event) => {
    event?.preventDefault();
    openProductSearch(onPick);
  };
  $('#labelsQuery')?.addEventListener('click', open);
  $('#btnOpenSearchProductModal')?.addEventListener('click', open);
}

