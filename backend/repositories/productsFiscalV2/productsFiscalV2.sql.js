// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2.sql.js — consulta completa do vínculo (FULL_SELECT) ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { PRODUCTS_FISCAL_V2_TABLE as TABLE, PRODUCTS_FISCAL_V2_SELECT_SQL } from './productsFiscalV2.catalog.js';
import { FISCAL_CLASSIFICATION_V2_TABLE } from '../fiscalClassificationV2/fiscalClassificationV2.catalog.js';
import { FISCAL_PROFILE_V2_TABLE } from '../fiscalProfileV2/fiscalProfileV2.catalog.js';

// ============================================================================
// CONSULTA COMPLETA DO VÍNCULO
// ============================================================================

export const FULL_SELECT = `
  SELECT
    ${PRODUCTS_FISCAL_V2_SELECT_SQL},

    fc.classification_name,
    fc.description AS description_class,
    fc.ncm_code,
    fc.ncm_description,
    fc.cest_code,
    fc.cest_description,
    fc.is_cst,
    fc.is_classification,
    fc.is_rate,
    fc.is_specific_rate,
    fc.is_unit,
    fc.ibscbs_cst,
    fc.ibscbs_classification,
    fc.ibs_uf_rate,
    fc.ibs_municipal_rate,
    fc.cbs_rate,
    fc.donation_indicator,
    fc.tax_reform_details,

    fp.fiscal_profile_id,
    fp.profile_name,
    fp.description AS description_profile,
    fp.icms_cst,
    fp.icms_rate,
    fp.cfop_entry,
    fp.cfop_exit,
    fp.origin_code,
    fp.pis_cst,
    fp.pis_rate,
    fp.cofins_cst,
    fp.cofins_rate,
    fp.benefit_code

  FROM ${TABLE} pf

  JOIN ${FISCAL_CLASSIFICATION_V2_TABLE} fc
    ON fc.fiscal_classification_id = pf.fiscal_classification_id

  LEFT JOIN ${FISCAL_PROFILE_V2_TABLE} fp
    ON fp.fiscal_profile_id = fc.fiscal_profile_id
`;
