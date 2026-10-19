// ╔════════════════════════════════════════════════════════════════════╗
// ║ erpCompany.js — Empresa da tela (BH3 x CONSART)                    ║
// ║ 'BH3'     = cadastros originais (padrão)                           ║
// ║ 'CONSART' = cadastros da Consart ERP                               ║
// ║ As telas da Consart enviam o header X-ERP-Company                  ║
// ║ (/public/includes/js/erpCompany.js) ou ?company=CONSART.           ║
// ╚════════════════════════════════════════════════════════════════════╝

export const ERP_COMPANY_DEFAULT = 'BH3';
export const ERP_COMPANIES = ['BH3', 'CONSART'];

export function normalizeErpCompany(v) {
  const c = String(v || '').trim().toUpperCase();
  return ERP_COMPANIES.includes(c) ? c : ERP_COMPANY_DEFAULT;
}

export function getErpCompany(req) {
  return normalizeErpCompany(req.get('x-erp-company') || req.query?.company);
}
