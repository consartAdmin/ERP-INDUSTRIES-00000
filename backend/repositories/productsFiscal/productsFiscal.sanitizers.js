// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscal.sanitizers.js — Helpers de normalização             ║
// ║ NCM/CEST/CFOP, JSON, payload fiscal com aliases e espelhos         ║
// ╚════════════════════════════════════════════════════════════════════╝

import { FISCAL_FIELDS } from './productsFiscal.constants.js';

/* ──────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────── */
export const isFiniteNum = (v) => {
  if (v === '' || v == null) return false;
  const s = String(v).trim().replace(',', '.');
  return Number.isFinite(Number(s));
};

export const toNumOrNull = (v) => {
  if (!isFiniteNum(v)) return null;
  return Number(String(v).trim().replace(',', '.'));
};

export const toTrimOrNull = (v) => (v == null ? null : (String(v).trim() || null));
export const toTextOrNull = (v) => (v == null ? null : String(v));

export const q = (col) => `"${String(col).replace(/"/g, '""')}"`; // quote seguro para nomes de coluna

export function toJsonObject(value, fallback = {}) {
  if (value == null || value === '') return fallback;

  let parsed = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('tax_reform_details deve conter um JSON válido.');
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('tax_reform_details deve ser um objeto JSON.');
  }

  return parsed;
}

export function normalizeDigits(value, exactLength, fieldName) {
  if (value == null || value === '') return null;

  const digits = String(value).replace(/\D/g, '');

  if (digits.length !== exactLength) {
    throw new Error(
      `${fieldName} deve possuir exatamente ${exactLength} dígitos.`,
    );
  }

  return digits;
}

export function normalizeNCM(ncmLike) {
  if (ncmLike == null) return null;
  let digits = String(ncmLike).replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length < 8) digits = digits.padEnd(8, '0');
  if (digits.length > 8) digits = digits.slice(0, 8);
  return digits;
}

export function normalizeCEST(cestLike) {
  if (cestLike == null) return null;
  let digits = String(cestLike).replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length !== 7) return digits;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 7)}`;
}

export function normalizeCFOPList(v) {
  if (v == null) return null;
  const arr = Array.isArray(v) ? v : String(v).split(',');
  const out = [];
  for (const item of arr) {
    const digits = String(item).replace(/\D+/g, '');
    if (!digits) continue;
    out.push(digits.padStart(4, '0').slice(-4));
  }
  return out.length ? out : null;
}

export const takeFirst = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : null);

/* ──────────────────────────────────────────────────────────
   Normalização com aliases + preenchimento dos espelhos
────────────────────────────────────────────────────────── */
export function normalizePayload(payload = {}) {
  const profileId = payload.fiscal_profile_id ?? payload.fiscalProfileId ?? payload.profile_id;
  const classId = payload.fiscal_classification_id ?? payload.fiscalClassificationId ?? payload.classification_id;

  const classification_name =
    payload.classification_name ?? payload.classificationName ?? payload.name_class ?? null;
  const profile_name =
    payload.profile_name ?? payload.profileName ?? null;

  // Classificação
  const ncmRaw = payload.ncm ?? payload.ncm_code ?? payload.ncmCode;
  const cestRaw = payload.cest ?? payload.cest_code ?? payload.cestCode;

  const ncm = normalizeNCM(ncmRaw);
  const ex_tipi = toTrimOrNull(payload.ex_tipi ?? payload.ex_tipi_code ?? payload.exTipi);
  const cest = normalizeCEST(cestRaw);

  // ICMS
  const origem_mercadoria =
    payload.origem_mercadoria ?? payload.origem ?? payload.origin_code ?? payload.orig ?? null;

  const cst_icms = toTrimOrNull(payload.cst_icms ?? payload.icms_cst ?? payload.cst);
  const csosn = toTrimOrNull(payload.csosn);
  const modalidade_bc = toTrimOrNull(payload.modalidade_bc ?? payload.mod_bc);
  const modalidade_bc_st = toTrimOrNull(payload.modalidade_bc_st ?? payload.mod_bc_st);

  const aliquota_icms = toNumOrNull(payload.aliquota_icms ?? payload.icms_rate);
  const reducao_bc = toNumOrNull(payload.reducao_bc);
  const mva_st = toNumOrNull(payload.mva_st);
  const aliquota_st = toNumOrNull(payload.aliquota_st);
  const aliquota_fcp = toNumOrNull(payload.aliquota_fcp);

  // CFOP
  const cfops_entrada = normalizeCFOPList(payload.cfops_entrada ?? payload.cfop_entry ?? payload.cfopEntrada);
  const cfops_saida = normalizeCFOPList(payload.cfops_saida ?? payload.cfop_exit ?? payload.cfopSaida);

  // PIS/COFINS
  const pis_cst = toTrimOrNull(payload.pis_cst);
  const pis_aliquota = toNumOrNull(payload.pis_aliquota ?? payload.pis_rate);
  const cofins_cst = toTrimOrNull(payload.cofins_cst);
  const cofins_aliquota = toNumOrNull(payload.cofins_aliquota ?? payload.cofins_rate);

  // IPI
  const ipi_cst = toTrimOrNull(payload.ipi_cst);
  const ipi_aliquota = toNumOrNull(payload.ipi_aliquota ?? payload.ipi_rate);

  // IBPT
  const ibpt_nacional = toNumOrNull(payload.ibpt_nacional);
  const ibpt_importado = toNumOrNull(payload.ibpt_importado);
  const ibpt_estadual = toNumOrNull(payload.ibpt_estadual);
  const ibpt_municipal = toNumOrNull(payload.ibpt_municipal);

  // Descrições e benefit
  const description_class = toTrimOrNull(payload.description_class) ?? classification_name ?? null;
  const description_profile = toTrimOrNull(payload.description_profile) ?? profile_name ?? null;
  const ncm_description = toTrimOrNull(payload.ncm_description);
  const cest_description = toTrimOrNull(payload.cest_description);
  const benefit_code = toTrimOrNull(payload.benefit_code);

  // Espelhos legados derivados
  const ncm_code = ncm ?? null;
  const cest_code = cest ?? null;

  const origin_code = origem_mercadoria == null ? null : String(origem_mercadoria);
  const icms_rate = aliquota_icms;
  const pis_rate = pis_aliquota;
  const cofins_rate = cofins_aliquota;
  const icms_cst = cst_icms;
  const cfop_entry = takeFirst(cfops_entrada);
  const cfop_exit = takeFirst(cfops_saida);

  // Reforma Tributária — IS
  const is_cst = toTrimOrNull(payload.is_cst);
  const is_classification = toTrimOrNull(payload.is_classification);
  const is_rate = toNumOrNull(payload.is_rate);
  const is_specific_rate = toNumOrNull(payload.is_specific_rate);
  const is_unit = toTrimOrNull(payload.is_unit)?.toUpperCase() || 'UN';

  // Reforma Tributária — IBS/CBS
  const ibscbs_cst =
    payload.ibscbs_cst == null || payload.ibscbs_cst === ''
      ? null
      : normalizeDigits(payload.ibscbs_cst, 3, 'CST IBS/CBS');

  const ibscbs_classification =
    payload.ibscbs_classification == null ||
      payload.ibscbs_classification === ''
      ? null
      : normalizeDigits(
        payload.ibscbs_classification,
        6,
        'Classificação IBS/CBS',
      );

  const ibs_uf_rate = toNumOrNull(payload.ibs_uf_rate);
  const ibs_municipal_rate = toNumOrNull(
    payload.ibs_municipal_rate,
  );
  const cbs_rate = toNumOrNull(payload.cbs_rate);
  const donation_indicator = toNumOrNull(
    payload.donation_indicator,
  );

  if (
    donation_indicator != null &&
    ![0, 1].includes(donation_indicator)
  ) {
    throw new Error('donation_indicator deve ser 0 ou 1.');
  }

  const tax_reform_details = toJsonObject(
    payload.tax_reform_details,
    {},
  );

  const base = {
    fiscal_profile_id: profileId == null ? null : Number(profileId),
    fiscal_classification_id: classId == null ? null : Number(classId),
    classification_name,
    profile_name,

    ncm, ex_tipi, cest,
    origem_mercadoria: origem_mercadoria == null ? null : Number(origem_mercadoria),
    cst_icms, csosn, modalidade_bc, modalidade_bc_st,
    aliquota_icms, reducao_bc, mva_st, aliquota_st, aliquota_fcp,
    cfops_entrada, cfops_saida,
    pis_cst, pis_aliquota, cofins_cst, cofins_aliquota,
    ipi_cst, ipi_aliquota,
    ibpt_nacional, ibpt_importado, ibpt_estadual, ibpt_municipal,
    observacao: toTrimOrNull(payload.observacao ?? payload.observation ?? payload.obs),

    description_class,
    description_profile,
    ncm_code,
    ncm_description,
    cest_code,
    cest_description,
    icms_cst,
    icms_rate,
    pis_rate,
    cofins_rate,
    origin_code,
    cfop_entry,
    cfop_exit,
    benefit_code,

    is_cst,
    is_classification,
    is_rate,
    is_specific_rate,
    is_unit,

    ibscbs_cst,
    ibscbs_classification,
    ibs_uf_rate,
    ibs_municipal_rate,
    cbs_rate,
    donation_indicator,
    tax_reform_details,
  };

  const out = {};
  for (const k of FISCAL_FIELDS) out[k] = (k in base ? base[k] : null);
  return out;
}

export function shallowEqualFiscal(a, b) {
  for (const k of FISCAL_FIELDS) {
    const va = a[k];
    const vb = b[k];
    if (Array.isArray(va) || Array.isArray(vb)) {
      const sa = (va ?? []).map(String);
      const sb = (vb ?? []).map(String);
      if (sa.length !== sb.length) return false;
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    } else if (String(va ?? '') !== String(vb ?? '')) {
      return false;
    }
  }
  return true;
}
