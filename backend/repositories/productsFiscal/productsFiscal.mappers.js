// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscal.mappers.js — Linha do banco → modelo                ║
// ║ e fiscalProfile/fiscalClassification → payload fiscal              ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  toNumOrNull,
  toTrimOrNull,
  toJsonObject,
  normalizeNCM,
  normalizeCEST,
  normalizeCFOPList,
} from './productsFiscal.sanitizers.js';

/* ──────────────────────────────────────────────────────────
   Row mapper
────────────────────────────────────────────────────────── */
export function rowToModel(r) {
  if (!r) return null;

  const asArray = (v) => (Array.isArray(v) ? v.map(String) : v == null ? null : normalizeCFOPList(v));

  return {
    ...r,
    cfops_entrada: asArray(r.cfops_entrada),
    cfops_saida: asArray(r.cfops_saida),

    aliquota_icms: toNumOrNull(r.aliquota_icms),
    reducao_bc: toNumOrNull(r.reducao_bc),
    mva_st: toNumOrNull(r.mva_st),
    aliquota_st: toNumOrNull(r.aliquota_st),
    aliquota_fcp: toNumOrNull(r.aliquota_fcp),
    pis_aliquota: toNumOrNull(r.pis_aliquota),
    cofins_aliquota: toNumOrNull(r.cofins_aliquota),
    ipi_aliquota: toNumOrNull(r.ipi_aliquota),
    ibpt_nacional: toNumOrNull(r.ibpt_nacional),
    ibpt_importado: toNumOrNull(r.ibpt_importado),
    ibpt_estadual: toNumOrNull(r.ibpt_estadual),
    ibpt_municipal: toNumOrNull(r.ibpt_municipal),

    icms_rate: toNumOrNull(r.icms_rate),
    pis_rate: toNumOrNull(r.pis_rate),
    cofins_rate: toNumOrNull(r.cofins_rate),

    is_rate: toNumOrNull(r.is_rate),
    is_specific_rate: toNumOrNull(r.is_specific_rate),
    ibs_uf_rate: toNumOrNull(r.ibs_uf_rate),
    ibs_municipal_rate: toNumOrNull(r.ibs_municipal_rate),
    cbs_rate: toNumOrNull(r.cbs_rate),
    donation_indicator: toNumOrNull(r.donation_indicator),

    tax_reform_details: toJsonObject(
      r.tax_reform_details,
      {},
    ),
  };
}

export function mapClassificationToFiscalPayload(c = {}) {
  return {
    classification_name: c.classification_name ?? c.name ?? null,
    description_class: c.description_class ?? c.description ?? null,
    ncm: normalizeNCM(c.ncm ?? c.ncm_code),
    ncm_code: normalizeNCM(c.ncm ?? c.ncm_code),
    ncm_description: toTrimOrNull(c.ncm_description),

    ex_tipi: toTrimOrNull(c.ex_tipi ?? c.ex_tipi_code),
    cest: normalizeCEST(c.cest ?? c.cest_code),
    cest_code: normalizeCEST(c.cest ?? c.cest_code),
    cest_description: toTrimOrNull(c.cest_description),

    origem_mercadoria: c.origem_mercadoria ?? c.origin_code ?? null,

    cfops_entrada: normalizeCFOPList(c.cfops_entrada ?? c.cfop_entry),
    cfops_saida: normalizeCFOPList(c.cfops_saida ?? c.cfop_exit),

    ibpt_nacional: toNumOrNull(c.ibpt_nacional),
    ibpt_importado: toNumOrNull(c.ibpt_importado),
    ibpt_estadual: toNumOrNull(c.ibpt_estadual),
    ibpt_municipal: toNumOrNull(c.ibpt_municipal),

    benefit_code: toTrimOrNull(c.benefit_code),
    observacao: toTrimOrNull(c.observacao)
  };
}

export function mapProfileToFiscalPayload(p = {}) {
  const aliqICMS = toNumOrNull(p.aliquota_icms ?? p.icms_rate);
  const aliqPIS = toNumOrNull(p.pis_aliquota ?? p.pis_rate);
  const aliqCOF = toNumOrNull(p.cofins_aliquota ?? p.cofins_rate);

  const srcCstIcms =
    p.cst_icms ??
    p.icms_cst ??
    p.cst ??
    null;

  return {
    profile_name: p.profile_name ?? p.name ?? null,
    description_profile: toTrimOrNull(p.description_profile ?? p.description),

    cst_icms: toTrimOrNull(srcCstIcms),
    csosn: toTrimOrNull(p.csosn),
    modalidade_bc: toTrimOrNull(p.modalidade_bc),
    modalidade_bc_st: toTrimOrNull(p.modalidade_bc_st),
    aliquota_icms: aliqICMS,
    reducao_bc: toNumOrNull(p.reducao_bc),
    mva_st: toNumOrNull(p.mva_st),
    aliquota_st: toNumOrNull(p.aliquota_st),
    aliquota_fcp: toNumOrNull(p.aliquota_fcp),

    pis_cst: toTrimOrNull(p.pis_cst),
    pis_aliquota: aliqPIS,
    cofins_cst: toTrimOrNull(p.cofins_cst),
    cofins_aliquota: aliqCOF,

    ipi_cst: toTrimOrNull(p.ipi_cst),
    ipi_aliquota: toNumOrNull(p.ipi_aliquota ?? p.ipi_rate),

    cfops_entrada: normalizeCFOPList(p.cfops_entrada ?? p.cfop_entry),
    cfops_saida: normalizeCFOPList(p.cfops_saida ?? p.cfop_exit),

    benefit_code: toTrimOrNull(p.benefit_code),
    observacao: toTrimOrNull(p.observacao),

    // espelhos legados
    icms_cst: toTrimOrNull(srcCstIcms),
    icms_rate: aliqICMS,
    pis_rate: aliqPIS,
    cofins_rate: aliqCOF,

    // Reforma Tributária — IS
    is_cst: toTrimOrNull(p.is_cst),
    is_classification: toTrimOrNull(p.is_classification),
    is_rate: toNumOrNull(p.is_rate),
    is_specific_rate: toNumOrNull(p.is_specific_rate),
    is_unit: toTrimOrNull(p.is_unit)?.toUpperCase() || 'UN',

    // Reforma Tributária — IBS/CBS
    ibscbs_cst: toTrimOrNull(p.ibscbs_cst),
    ibscbs_classification: toTrimOrNull(
      p.ibscbs_classification,
    ),
    ibs_uf_rate: toNumOrNull(p.ibs_uf_rate),
    ibs_municipal_rate: toNumOrNull(
      p.ibs_municipal_rate,
    ),
    cbs_rate: toNumOrNull(p.cbs_rate),
    donation_indicator: toNumOrNull(
      p.donation_indicator,
    ),
    tax_reform_details: toJsonObject(
      p.tax_reform_details,
      {},
    ),
  };
}

export function mergeFiscalPayload({ classification, profile, override = {} }) {
  const fromClass = mapClassificationToFiscalPayload(classification || {});
  const fromProf = mapProfileToFiscalPayload(profile || {});
  return { ...fromClass, ...fromProf, ...(override || {}) };
}
