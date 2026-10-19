// ╔════════════════════════════════════════════════════════════════════╗
// ║ crmDealsSchema.repository.js — ensureCrmCompanyColumn              ║
// ║ Separa os cards por empresa: BH3 (CRM original) x CONSART (CRM     ║
// ║ Consart ERP). Cards antigos ficam com 'BH3' pelo DEFAULT.          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { buildError } from './crmDeals.utils.js';

export async function ensureCrmCompanyColumn() {
  try {
    await pool.query(`
      ALTER TABLE public."crmDeals"
        ADD COLUMN IF NOT EXISTS crm_company VARCHAR(20) NOT NULL DEFAULT 'BH3';

      CREATE INDEX IF NOT EXISTS idx_crmDeals_crm_company
        ON public."crmDeals"(crm_company);
    `);
    return { ok: true };
  } catch (err) {
    return buildError(err, 'crmDealsApi.ensureCrmCompanyColumn');
  }
}
