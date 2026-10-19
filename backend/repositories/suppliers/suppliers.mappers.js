// ╔══════════════════════════════════════════════════════════════════════╗
// ║ suppliers.mappers.js — linha do banco → objeto (normalizeRow)        ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ──────────────────────────────────────────────────────────────
   Normalização de linha vinda do banco
────────────────────────────────────────────────────────────── */
export function normalizeRow(row) {
  if (!row) return null;

  const address_street =
    row.address_street ?? null;

  return {
    supplier_id: row.supplier_id,
    name: row.name,
    tax_id: row.tax_id,
    state_registration: row.state_registration,
    phone: row.phone,
    email: row.email,
    website: row.website,
    login: row.login,
    password: row.password,
    observations: row.observations,

    address: row.address,
    address_street_type: row.address_street_type ?? null,
    address_street: address_street || row.address || null,
    address_number: row.address_number,
    address_complement: row.address_complement,
    address_district: row.address_district,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,

    sales_rep: row.sales_rep,
    sales_rep_email: row.sales_rep_email,
    finance_email: row.finance_email,

    chart_account_id: row.chart_account_id ?? null,
    chart_account_code: row.chart_account_code ?? null,
    chart_account_description: row.chart_account_description ?? null,
    cash_category_id: row.cash_category_id ?? null,
    cash_category_name: row.cash_category_name ?? null,
    cash_subcategory_id: row.cash_subcategory_id ?? null,
    cash_subcategory_name: row.cash_subcategory_name ?? null,
  };
}
