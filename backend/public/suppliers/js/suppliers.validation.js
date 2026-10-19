import { cleanValue, onlyDigits } from './suppliers.utils.js';

export function validateSupplier(payload) {
  if (!cleanValue(payload.name)) return { valid: false, message: 'Nome é obrigatório.', field: '#name' };
  const taxId = onlyDigits(payload.tax_id);
  if (taxId && ![11, 14].includes(taxId.length)) {
    return { valid: false, message: 'Informe um CNPJ ou CPF válido.', field: '#tax_id' };
  }
  if (payload.state && String(payload.state).trim().length !== 2) {
    return { valid: false, message: 'A UF deve possuir 2 letras.', field: '#state' };
  }
  if (payload.cash_subcategory_id && !payload.cash_category_id) {
    return {
      valid: false,
      message: 'Selecione a categoria financeira da subcategoria.',
      field: '#cash_category_id',
    };
  }
  return { valid: true };
}
