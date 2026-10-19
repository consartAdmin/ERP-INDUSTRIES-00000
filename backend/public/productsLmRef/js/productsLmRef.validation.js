export function validateProductLmRef(data) {
  const errors = {};

  if (!Number.isInteger(Number(data.supplierId)) || Number(data.supplierId) <= 0) {
    errors.supplierId = 'Select a supplier.';
  }
  if (!data.nfProductCode?.trim()) errors.nfProductCode = 'NF product code is required.';
  if (!data.productCode?.trim()) errors.productCode = 'Product code is required.';
  if (!data.description?.trim()) errors.description = 'Description is required.';
  if (data.nfProductCode?.length > 60) errors.nfProductCode = 'Maximum 60 characters.';
  if (data.productCode?.length > 50) errors.productCode = 'Maximum 50 characters.';
  if (data.description?.length > 255) errors.description = 'Maximum 255 characters.';

  return { isValid: Object.keys(errors).length === 0, errors };
}

