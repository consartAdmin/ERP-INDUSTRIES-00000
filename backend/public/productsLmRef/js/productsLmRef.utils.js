export function escapeHtml(value = '') {
  const element = document.createElement('div');
  element.textContent = String(value);
  return element.innerHTML;
}

export function debounce(callback, delay) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

export function showMessage(message, type = 'success') {
  const element = document.querySelector('#productsLmRefMessage');
  element.textContent = message;
  element.className = `products-lm-ref-message ${type}`;
  element.hidden = false;
  window.setTimeout(() => { element.hidden = true; }, 4000);
}

export function normalizeProductLmRef(record) {
  return {
    productLmRefId: record.product_lm_ref_id ?? record.productLmRefId,
    supplierId: record.supplier_id ?? record.supplierId,
    nfProductCode: record.nf_product_code ?? record.nfProductCode ?? '',
    productCode: record.product_code ?? record.productCode ?? '',
    description: record.description ?? '',
    isActive: record.is_active ?? record.isActive ?? true,
  };
}
