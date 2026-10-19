// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsRemove.repository.js — remove (soft delete)     ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, SELECT_COLUMNS } from './productsFiscalOrigins.constants.js';
import { positiveInteger } from './productsFiscalOrigins.sanitizers.js';
import { ensureOnce } from './productsFiscalOriginsSchema.repository.js';

/** Soft delete: libera o escopo para uma nova origem ativa. */
export async function remove(fiscalOriginId, client = pool) {
  const id = positiveInteger(fiscalOriginId);
  if (!id) throw new Error('fiscal_origin_id inválido.');

  await ensureOnce(client);

  const { rows } = await client.query(
    `
      UPDATE ${TB}
         SET is_active  = FALSE,
             updated_at = NOW()
       WHERE fiscal_origin_id = $1
         AND is_active = TRUE
      RETURNING
        ${SELECT_COLUMNS}
    `,
    [id],
  );

  return rows[0] || null;
}
