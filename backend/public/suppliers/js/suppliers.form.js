import { buildLegacyAddress, cleanValue, formatCnpj, onlyDigits, qs } from './suppliers.utils.js';

const fields = ['supplier_id', 'name', 'tax_id', 'state_registration', 'phone', 'email', 'website',
  'login', 'password', 'observations', 'access_website', 'address', 'address_street_type', 'address_street', 'address_number',
  'address_complement', 'address_district', 'city', 'state', 'postal_code', 'sales_rep',
  'sales_rep_email', 'finance_email', 'chart_account_id', 'chart_account_display', 'cash_category_id',
  'cash_subcategory_id'];

export function resetSupplierForm() {
  qs('#supplierForm')?.reset();
  fields.forEach((name) => { const field = qs(`#${name}`); if (field) field.value = ''; });
}
export function fillSupplierForm(data = {}) {
  fields.forEach((name) => {
    const field = qs(`#${name}`); if (!field) return;
    let value = data[name] ?? '';
    if (name === 'tax_id') value = formatCnpj(value);
    if (name === 'state') value = String(value).toUpperCase();
    if (name === 'address_street') value = data.address_street ?? data.address ?? '';
    if (name === 'chart_account_display') {
      value = [data.chart_account_code, data.chart_account_description].filter(Boolean).join(' - ');
    }
    field.value = value;
  });
}
export function collectSupplierPayload(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  Object.keys(payload).forEach((key) => { payload[key] = cleanValue(payload[key]); });
  const id = payload.supplier_id; delete payload.supplier_id;
  payload.tax_id = payload.tax_id ? onlyDigits(payload.tax_id) : null;
  payload.postal_code = payload.postal_code ? onlyDigits(payload.postal_code) : null;
  payload.state = payload.state ? String(payload.state).toUpperCase().slice(0, 2) : null;
  payload.address = buildLegacyAddress(payload);
  payload.chart_account_id = payload.chart_account_id ? Number(payload.chart_account_id) : null;
  payload.cash_category_id = payload.cash_category_id ? Number(payload.cash_category_id) : null;
  payload.cash_subcategory_id = payload.cash_subcategory_id ? Number(payload.cash_subcategory_id) : null;
  return { id, payload };
}
