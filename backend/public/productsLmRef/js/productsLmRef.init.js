import { bindProductsLmRefActions, refreshProductsLmRef } from './productsLmRef.actions.js';
import { resetProductsLmRefForm } from './productsLmRef.form.js';
import { bindProductsLmRefLookups } from './productsLmRef.lookups.js';

function initProductsLmRef() {
  resetProductsLmRefForm();
  bindProductsLmRefActions();
  bindProductsLmRefLookups();
  refreshProductsLmRef();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProductsLmRef);
} else {
  initProductsLmRef();
}

