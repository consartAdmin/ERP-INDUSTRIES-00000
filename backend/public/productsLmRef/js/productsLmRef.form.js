import { validateProductLmRef } from './productsLmRef.validation.js';
import { loadSupplierName, setSupplier } from './productsLmRef.lookups.js';

const form = () => document.querySelector('#productsLmRefForm');

export function readProductsLmRefForm() {
  const data = new FormData(form());
  return {
    supplierId: Number(data.get('supplierId')),
    nfProductCode: data.get('nfProductCode').trim(),
    productCode: data.get('productCode').trim(),
    description: data.get('description').trim(),
    isActive: data.get('isActive') === 'on',
  };
}

export function validateProductsLmRefForm(data) {
  document.querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
  const result = validateProductLmRef(data);
  Object.entries(result.errors).forEach(([field, message]) => {
    document.querySelector(`[data-error="${field}"]`).textContent = message;
  });
  return result.isValid;
}

export function fillProductsLmRefForm(item) {
  const element = form();
  setSupplier(item.supplierId);
  loadSupplierName(item.supplierId);
  element.elements.nfProductCode.value = item.nfProductCode;
  element.elements.productCode.value = item.productCode;
  element.elements.description.value = item.description;
  element.elements.isActive.checked = item.isActive;
  document.querySelector('#formTitle').textContent = 'Editar referência de produto';
  document.querySelector('#productsLmRefModal').showModal();
}

export function resetProductsLmRefForm() {
  form().reset();
  setSupplier('');
  form().elements.isActive.checked = true;
  document.querySelector('#formTitle').textContent = 'Nova referência de produto';
  document.querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
}
