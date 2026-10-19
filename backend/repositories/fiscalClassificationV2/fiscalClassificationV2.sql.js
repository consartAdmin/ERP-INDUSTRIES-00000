// ╔════════════════════════════════════════════════════════════════════╗
// ║ fiscalClassificationV2.sql.js — Fragmentos SQL (SELECT/RETURNING)  ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  FISCAL_CLASSIFICATION_V2_TABLE as TABLE,
  FISCAL_CLASSIFICATION_V2_SELECT_COLUMNS,
  FISCAL_CLASSIFICATION_V2_SELECT_SQL,
} from './fiscalClassificationV2.catalog.js';
import { FISCAL_PROFILE_V2_TABLE } from '../fiscalProfileV2/fiscalProfileV2.catalog.js';

export const RETURNING = FISCAL_CLASSIFICATION_V2_SELECT_COLUMNS
  .map((column) => `"${column}"`)
  .join(', ');

export const SELECT = `
  SELECT ${FISCAL_CLASSIFICATION_V2_SELECT_SQL},
         fp.profile_name,
         fp.description AS profile_description
  FROM ${TABLE} fc
  LEFT JOIN ${FISCAL_PROFILE_V2_TABLE} fp
    ON fp.fiscal_profile_id = fc.fiscal_profile_id
`;
