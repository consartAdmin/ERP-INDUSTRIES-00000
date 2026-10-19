import { PRODUCTS_LM_REF_CONFIG } from './productsLmRef.config.js';
import { fillProductsLmRefForm, readProductsLmRefForm, resetProductsLmRefForm, validateProductsLmRefForm } from './productsLmRef.form.js';
import { loadProductsLmRef, removeProductLmRef, saveProductLmRef } from './productsLmRef.model.js';
import { renderLoading, renderProductsLmRef } from './productsLmRef.render.js';
import { productsLmRefState, setProductsLmRefState } from './productsLmRef.state.js';
import { debounce, showMessage } from './productsLmRef.utils.js';

export async function refreshProductsLmRef() {
  setProductsLmRefState({ loading: true });
  renderLoading(true);
  try {
    const items = await loadProductsLmRef(productsLmRefState.filters);
    setProductsLmRefState({ items });
    renderProductsLmRef(items);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    setProductsLmRefState({ loading: false });
    renderLoading(false);
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const data = readProductsLmRefForm();
  if (!validateProductsLmRefForm(data)) return;

  try {
    await saveProductLmRef(productsLmRefState.editingId, data);
    showMessage(productsLmRefState.editingId ? 'Product reference updated.' : 'Product reference created.');
    setProductsLmRefState({ editingId: null });
    resetProductsLmRefForm();
    document.querySelector('#productsLmRefModal').close();
    await refreshProductsLmRef();
  } catch (error) {
    showMessage(error.message, 'error');
  }
}

async function handleTableClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;

  if (button.dataset.action === 'edit') {
    const item = productsLmRefState.items.find(
      (entry) => String(entry.productLmRefId) === id,
    );
    if (item) {
      setProductsLmRefState({ editingId: id });
      fillProductsLmRefForm(item);
    }
  }

  if (button.dataset.action === 'delete' && window.confirm('Delete this product reference?')) {
    try {
      await removeProductLmRef(id);
      showMessage('Product reference deleted.');
      await refreshProductsLmRef();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }
}

export function bindProductsLmRefActions() {
  document.querySelector('#productsLmRefForm').addEventListener('submit', handleSubmit);
  const modal = document.querySelector('#productsLmRefModal');
  document.querySelector('#bodyTable').addEventListener('click', handleTableClick);
  document.querySelector('#cancelEditButton').addEventListener('click', () => {
    setProductsLmRefState({ editingId: null });
    resetProductsLmRefForm();
    modal.close();
  });
  document.querySelector('#btnCloseModal').addEventListener('click', () => modal.close());
  document.querySelector('#btnNew').addEventListener('click', () => {
    setProductsLmRefState({ editingId: null });
    resetProductsLmRefForm();
    modal.showModal();
  });
  document.querySelector('#btnRefresh').addEventListener('click', refreshProductsLmRef);
  document.querySelector('#btnSearch').addEventListener('click', refreshProductsLmRef);
  document.querySelector('#searchStatus').addEventListener('change', (event) => {
    productsLmRefState.filters.isActive = event.target.value;
    refreshProductsLmRef();
  });
  document.querySelector('#searchInput').addEventListener('input', debounce((event) => {
    productsLmRefState.filters.search = event.target.value.trim();
    refreshProductsLmRef();
  }, PRODUCTS_LM_REF_CONFIG.searchDebounceMs));
}
