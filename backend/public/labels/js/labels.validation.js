import { showModal } from './labels.utils.js';

export function validPositiveQuantity(value, message = '') {
  const quantity = Number(value);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;

  showModal({
    variant: 'warning',
    title: 'Quantidade inválida',
    message: message || 'Informe uma quantidade maior que zero.',
  });
  return null;
}

export function requireProductSource({ code, selectedProduct }) {
  if (String(code || '').trim() || selectedProduct) return true;

  showModal({
    variant: 'warning',
    title: 'Produto obrigatório',
    message:
      'Selecione um produto em “Buscar produto” ou digite o código interno/código de barras.',
  });
  return false;
}

