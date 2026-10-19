// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.validation.js                                   ║
// ║ MODULE: Fiscal Profile — Validation                                 ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function validateFiscalProfile(payload) {
  if (!payload.profile_name) {
    return {
      valid: false,
      field: 'profileName',
      title: 'Campo obrigatório',
      message: 'Informe o nome do perfil fiscal.',
    };
  }

  const origin = payload.origin_code == null ? null : Number(payload.origin_code);
  if (
    origin != null &&
    (!Number.isInteger(origin) || origin < 0 || origin > 8)
  ) {
    return {
      valid: false,
      field: 'originCode',
      title: 'Origem inválida',
      message: 'A origem deve ser um número inteiro entre 0 e 8.',
    };
  }

  const rates = [
    ['icmsRate', payload.icms_rate, 'ICMS'],
    ['pisRate', payload.pis_rate, 'PIS'],
    ['cofinsRate', payload.cofins_rate, 'COFINS'],
  ];

  for (const [field, value, label] of rates) {
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      return {
        valid: false,
        field,
        title: 'Alíquota inválida',
        message: `Informe uma alíquota entre 0 e 100 para ${label}.`,
      };
    }
  }

  return { valid: true };
}
