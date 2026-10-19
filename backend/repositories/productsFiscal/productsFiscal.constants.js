// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscal.constants.js — Tabelas, sequence da PK e campos fiscais ║
// ║ Tabela REAL: public."productsFiscal" (product_code SEM FK)         ║
// ╚════════════════════════════════════════════════════════════════════╝

export const TB = 'public."productsFiscal"';
export const ALIAS = 'pf';
export const TB_PRODUCTS = 'public."products"'; // opcional: traz descrição via SKU (product_code)

// sequence padrão para a PK (sem serial/identity, mas com default)
export const PK_SEQ = 'productsFiscal_products_fiscal_id_seq';

/* ──────────────────────────────────────────────────────────
   Campos fiscais + espelhos legados
────────────────────────────────────────────────────────── */
export const FISCAL_FIELDS = [
  'fiscal_profile_id',
  'fiscal_classification_id',

  'classification_name',
  'profile_name',

  'ncm', 'ex_tipi', 'cest',

  'origem_mercadoria',
  'cst_icms', 'csosn', 'modalidade_bc', 'modalidade_bc_st',
  'aliquota_icms', 'reducao_bc', 'mva_st', 'aliquota_st', 'aliquota_fcp',

  'cfops_entrada', 'cfops_saida',

  'pis_cst', 'pis_aliquota', 'cofins_cst', 'cofins_aliquota',

  'ipi_cst', 'ipi_aliquota',

  'ibpt_nacional', 'ibpt_importado', 'ibpt_estadual', 'ibpt_municipal',

  'observacao',

  // ── Espelhos legados
  'description_class',
  'description_profile',
  'ncm_code',
  'ncm_description',
  'cest_code',
  'cest_description',
  'icms_cst',
  'icms_rate',
  'pis_rate',
  'cofins_rate',
  'origin_code',
  'cfop_entry',
  'cfop_exit',
  'benefit_code',

  // Reforma Tributária — IS
  'is_cst',
  'is_classification',
  'is_rate',
  'is_specific_rate',
  'is_unit',

  // Reforma Tributária — IBS/CBS
  'ibscbs_cst',
  'ibscbs_classification',
  'ibs_uf_rate',
  'ibs_municipal_rate',
  'cbs_rate',
  'donation_indicator',
  'tax_reform_details',
];
