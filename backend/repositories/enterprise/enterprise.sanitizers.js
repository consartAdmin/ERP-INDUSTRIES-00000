// ╔══════════════════════════════════════════════════════════════════════╗
// ║ enterprise.sanitizers.js — Normalização / validação de entrada       ║
// ╚══════════════════════════════════════════════════════════════════════╝

export function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

export function normalizeString(value) {
  return value == null ? null : String(value).trim();
}

export function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;

  const v = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'sim'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off', 'nao', 'não'].includes(v)) return false;
  return fallback;
}

export function normalizeInteger(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function normalizePayload(payload = {}) {
  return {
    corporate_name: normalizeString(payload.corporate_name),
    trade_name: normalizeString(payload.trade_name),
    cnpj: normalizeString(payload.cnpj),
    state_registration: normalizeString(payload.state_registration),
    municipal_registration: normalizeString(payload.municipal_registration),
    tax_regime_code: normalizeString(payload.tax_regime_code),
    cnae: normalizeString(payload.cnae),
    opening_date: payload.opening_date || null,
    status: normalizeString(payload.status) || 'ACTIVE',

    zip_code: normalizeString(payload.zip_code),
    address: normalizeString(payload.address),
    address_number: normalizeString(payload.address_number),
    address_complement: normalizeString(payload.address_complement),
    district: normalizeString(payload.district),
    city: normalizeString(payload.city),
    state: normalizeString(payload.state),
    city_ibge_code: normalizeString(payload.city_ibge_code),

    phone: normalizeString(payload.phone),
    whatsapp: normalizeString(payload.whatsapp),
    email: normalizeString(payload.email),
    website: normalizeString(payload.website),

    financial_contact: normalizeString(payload.financial_contact),
    fiscal_contact: normalizeString(payload.fiscal_contact),
    commercial_contact: normalizeString(payload.commercial_contact),

    nfe_environment: normalizeString(payload.nfe_environment) || 'homologation',
    nfe_series: normalizeString(payload.nfe_series),
    next_nfe_number: normalizeInteger(payload.next_nfe_number, 1),
    nfce_series: normalizeString(payload.nfce_series),
    next_nfce_number: normalizeInteger(payload.next_nfce_number, 1),

    default_cfop_sale: normalizeString(payload.default_cfop_sale),
    default_cfop_purchase: normalizeString(payload.default_cfop_purchase),
    sped_profile: normalizeString(payload.sped_profile),
    sped_activity_type: normalizeString(payload.sped_activity_type),

    logo_url: normalizeString(payload.logo_url),
    slogan: normalizeString(payload.slogan),
    document_notes: normalizeString(payload.document_notes),
    pdf_footer: normalizeString(payload.pdf_footer),

    certificate_a1_path: normalizeString(payload.certificate_a1_path),
    certificate_password: normalizeString(payload.certificate_password),

    accountant_name: normalizeString(payload.accountant_name),
    accountant_cpf: normalizeString(payload.accountant_cpf),
    accountant_crc: normalizeString(payload.accountant_crc),
    accountant_email: normalizeString(payload.accountant_email),
    accountant_phone: normalizeString(payload.accountant_phone),

    is_active: normalizeBoolean(payload.is_active, true)
  };
}

export function validateRequired(payload) {
  if (!payload.corporate_name) {
    throw new Error('Corporate name is required.');
  }

  if (!payload.cnpj) {
    throw new Error('CNPJ is required.');
  }

  const cnpjDigits = onlyDigits(payload.cnpj);
  if (cnpjDigits.length !== 14) {
    throw new Error('Invalid CNPJ.');
  }

  if (payload.state && String(payload.state).length !== 2) {
    throw new Error('State must contain 2 characters.');
  }
}
