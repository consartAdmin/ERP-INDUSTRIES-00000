// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalProfile.constants.js — Tabela, alias e listas de campos      ║
// ║ Tabela: public."fiscalProfile"                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."fiscalProfile"';
export const ALIAS = 'fp';

export const nowSql = 'NOW()';

export const STRING_FIELDS = Object.freeze([
  'profile_name',
  'description',
  'icms_cst',
  'cfop_entry',
  'cfop_exit',
  'origin_code',
  'pis_cst',
  'cofins_cst',
  'benefit_code',
  'is_unit',
]);

export const NUMERIC_FIELDS = Object.freeze([
  'icms_rate',
  'pis_rate',
  'cofins_rate',
  'is_rate',
  'is_specific_rate',
  'ibs_uf_rate',
  'ibs_municipal_rate',
  'cbs_rate',
  'donation_indicator',
]);

export const REFORMA_CODE_FIELDS = Object.freeze({
  is_cst: { max: 3, label: 'IS CST' },
  is_classification: { max: 10, label: 'IS classification' },
  ibscbs_cst: { exact: 3, label: 'IBS/CBS CST' },
  ibscbs_classification: { exact: 6, label: 'IBS/CBS classification' },
});
