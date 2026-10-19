// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2Upsert.repository.js — upsertCurrent                 ║
// ║ Inclui upsertCurrentWithClient (conexão/transação já aberta)         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import {
  PRODUCTS_FISCAL_V2_TABLE as TABLE,
  PRODUCTS_FISCAL_V2_PRIMARY_KEY as PRIMARY_KEY,
  PRODUCTS_FISCAL_V2_SELECT_SQL,
  PRODUCTS_FISCAL_V2_CURRENT_WHERE_SQL as CURRENT_WHERE,
} from './productsFiscalV2.catalog.js';
import { RETURNING } from './productsFiscalV2.constants.js';
import { assertValidUpsertPayload } from './productsFiscalV2.sanitizers.js';

// ============================================================================
// UPSERT INTERNO — USA UMA CONEXÃO/TRANSAÇÃO JÁ ABERTA
//
// updated_at é preenchido pelo trigger products_fiscal_v2_updated_at.
// ============================================================================

export async function upsertCurrentWithClient(client, payload) {
  payload = assertValidUpsertPayload(payload);

  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [payload.product_code]
  );

  const currentResult = await client.query(
    `
      SELECT ${PRODUCTS_FISCAL_V2_SELECT_SQL}
      FROM ${TABLE} pf
      WHERE pf.product_code = $1
        AND ${CURRENT_WHERE}
      FOR UPDATE
    `,
    [payload.product_code]
  );

  const current = currentResult.rows[0] ?? null;

  if (
    current &&
    Number(current.fiscal_classification_id) ===
    Number(payload.fiscal_classification_id)
  ) {
    const result = await client.query(
      `
        UPDATE ${TABLE}
        SET source_system = COALESCE($1, source_system),
            source_reference = COALESCE($2, source_reference),
            extra_payload = COALESCE($3, extra_payload)
        WHERE ${PRIMARY_KEY} = $4
        RETURNING ${RETURNING}
      `,
      [
        payload.source_system,
        payload.source_reference,
        payload.extra_payload,
        current.products_fiscal_id,
      ]
    );

    return result.rows[0];
  }

  let nextVersion;

  if (current) {
    nextVersion = Number(current.version) + 1;

    await client.query(
      `
        UPDATE ${TABLE}
        SET is_current = false,
            effective_to = now()
        WHERE ${PRIMARY_KEY} = $1
      `,
      [current.products_fiscal_id]
    );
  } else {
    const versionResult = await client.query(
      `
        SELECT COALESCE(MAX(version), 0) AS version
        FROM ${TABLE}
        WHERE product_code = $1
      `,
      [payload.product_code]
    );

    nextVersion = Number(versionResult.rows[0].version) + 1;
  }

  const insertedResult = await client.query(
    `
      INSERT INTO ${TABLE} (
        product_code,
        fiscal_classification_id,
        version,
        source_system,
        source_reference,
        extra_payload
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, '{}'::jsonb))
      RETURNING ${RETURNING}
    `,
    [
      payload.product_code,
      payload.fiscal_classification_id,
      nextVersion,
      payload.source_system,
      payload.source_reference,
      payload.extra_payload,
    ]
  );

  return insertedResult.rows[0];
}

// ============================================================================
// CRIAR OU ATUALIZAR VÍNCULO FISCAL ATUAL
// ============================================================================

export async function upsertCurrent(payload) {
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const data = await upsertCurrentWithClient(client, payload);
    await client.query('COMMIT');
    return data;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
