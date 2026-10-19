// ╔════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalImport.repository.js — previewMerge / importFromRefs ║
// ║ Integração com fiscalProfile / fiscalClassification                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  normalizePayload,
} from './productsFiscal.sanitizers.js';
import { mergeFiscalPayload } from './productsFiscal.mappers.js';
import { resolveProductCode, getFiscalProfileByIdOrName, getFiscalClassificationByIdOrName } from './productsFiscalLookup.repository.js';
import { createFromImport } from './productsFiscalSnapshot.repository.js';

export async function previewMerge(args) {
  const client = await pool.connect();
  try {
    const profile = await getFiscalProfileByIdOrName(client, { id: args.fiscal_profile_id, name: args.fiscal_profile_name });
    const classification = await getFiscalClassificationByIdOrName(client, { id: args.fiscal_classification_id, name: args.fiscal_classification_name });
    const merged = mergeFiscalPayload({ classification, profile, override: args.override });

    if (profile?.fiscal_profile_id) {
      merged.fiscal_profile_id = profile.fiscal_profile_id;
      merged.profile_name = merged.profile_name ?? profile.profile_name ?? null;
      merged.description_profile = merged.description_profile ?? profile.description_profile ?? profile.description ?? null;
    }
    if (classification?.fiscal_classification_id) {
      merged.fiscal_classification_id = classification.fiscal_classification_id;
      merged.classification_name = merged.classification_name ?? classification.classification_name ?? null;
      merged.description_class = merged.description_class ?? classification.description_class ?? classification.description ?? null;
    }
    return normalizePayload(merged);
  } finally {
    client.release();
  }
}

export async function importFromRefs(args) {
  const client = await pool.connect();
  try {
    const product_code = await resolveProductCode(client, args);
    if (!product_code) throw new Error('product_code é obrigatório (ou informe product_id para resolver SKU).');

    await client.query('BEGIN');

    const profile = await getFiscalProfileByIdOrName(client, { id: args.fiscal_profile_id, name: args.fiscal_profile_name });
    const classification = await getFiscalClassificationByIdOrName(client, { id: args.fiscal_classification_id, name: args.fiscal_classification_name });

    if (!profile && !classification && (!args.override || Object.keys(args.override).length === 0)) {
      throw new Error('Nenhum fiscalProfile/fiscalClassification encontrado e nenhum override informado.');
    }

    const merged = mergeFiscalPayload({ classification, profile, override: args.override });

    if (profile?.fiscal_profile_id) {
      merged.fiscal_profile_id = profile.fiscal_profile_id;
      merged.profile_name = merged.profile_name ?? profile.profile_name ?? null;
      merged.description_profile = merged.description_profile ?? profile.description_profile ?? profile.description ?? null;
    }
    if (classification?.fiscal_classification_id) {
      merged.fiscal_classification_id = classification.fiscal_classification_id;
      merged.classification_name = merged.classification_name ?? classification.classification_name ?? null;
      merged.description_class = merged.description_class ?? classification.description_class ?? classification.description ?? null;
    }

    // ✅ usa o MESMO client/tx (sem nested transaction)
    const created = await createFromImport({ product_code, ...merged }, client);

    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
