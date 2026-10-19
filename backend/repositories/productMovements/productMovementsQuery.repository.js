// ╔══════════════════════════════════════════════════════════════╗
// ║ productMovementsQuery.repository.js — listByProductCode     ║
// ║ ✅ productMovements como fonte principal                    ║
// ║ ✅ auditLogs somente como fallback histórico                ║
// ║ ✅ NF-e, estoque antes/depois, grade e lote                  ║
// ╚══════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { MAX_ROWS } from './productMovements.constants.js';
import { normalizeProductCode } from './productMovements.sanitizers.js';

export async function listByProductCode(productCode) {
  const sku = normalizeProductCode(productCode);

  const sql = `
    WITH native_movements AS (
      SELECT
        pm.movement_id,
        BTRIM(pm.product_code) AS product_code,
        UPPER(BTRIM(pm.movement_type)) AS movement_type,
        pm.origin_module,
        pm.origin_table,
        pm.origin_id::text AS origin_id,
        ABS(COALESCE(pm.quantity, 0))::numeric AS quantity,
        pm.previous_stock,
        pm.new_stock,
        pm.unit,
        pm.lot_code,
        pm.nfe_key,
        pm.nfe_number,
        pm.notes,
        pm.user_id,
        COALESCE(pm.metadata, '{}'::jsonb) AS metadata,
        pm.created_at,
        'PRODUCT_MOVEMENTS'::text AS record_source
      FROM public."productMovements" pm
      WHERE
        BTRIM(pm.product_code) = BTRIM($1)
        OR regexp_replace(BTRIM(pm.product_code), '^0+', '') =
           regexp_replace(BTRIM($1), '^0+', '')
    ),

    legacy_audit_movements AS (
      SELECT
        -al.id::bigint AS movement_id,
        BTRIM(al.register_id) AS product_code,
        'SAIDA'::text AS movement_type,
        'invoicesIssued'::text AS origin_module,
        'auditLogs'::text AS origin_table,
        COALESCE(ii.invoice_id::text, al.id::text) AS origin_id,
        ABS(
          COALESCE(
            NULLIF(al.after::jsonb->>'quantity_out', '')::numeric,
            NULLIF(al.after::jsonb->>'quantity', '')::numeric,
            0
          )
        ) AS quantity,
        NULLIF(al.after::jsonb->>'stock_before', '')::numeric
          AS previous_stock,
        NULLIF(al.after::jsonb->>'stock_after', '')::numeric
          AS new_stock,
        NULLIF(al.after::jsonb->>'unit', '') AS unit,
        COALESCE(
          NULLIF(al.after::jsonb->>'lot_code', ''),
          NULLIF(al.before::jsonb->>'lot_code', '')
        ) AS lot_code,
        COALESCE(
          NULLIF(ii.nfe_key, ''),
          NULLIF(al.after::jsonb->>'nfe_key', '')
        ) AS nfe_key,
        COALESCE(
          ii.nfe_number::text,
          NULLIF(al.after::jsonb->>'nfe_number', '')
        ) AS nfe_number,
        COALESCE(
          NULLIF(al.after::jsonb->>'observation', ''),
          'Saída histórica por NF-e emitida'
        ) AS notes,
        al.user_id::text AS user_id,
        COALESCE(al.after::jsonb, '{}'::jsonb) || jsonb_build_object(
          'legacy_source', 'auditLogs',
          'audit_log_id', al.id,
          'invoice_id', ii.invoice_id
        ) AS metadata,
        al.created_at,
        'AUDIT_LOG_FALLBACK'::text AS record_source
      FROM public."auditLogs" al
      LEFT JOIN public."invoicesIssued" ii
        ON ii.invoice_id = CASE
          WHEN NULLIF(al.after::jsonb->>'invoice_id', '') ~ '^\\d+$'
          THEN (al.after::jsonb->>'invoice_id')::bigint
          ELSE NULL
        END
      WHERE
        al.tabela = 'invoicesIssued'
        AND al.operation = 'PRODUCT_STOCK_OUT'
        AND (
          BTRIM(al.register_id) = BTRIM($1)
          OR regexp_replace(BTRIM(al.register_id), '^0+', '') =
             regexp_replace(BTRIM($1), '^0+', '')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public."productMovements" pm
          WHERE UPPER(BTRIM(pm.movement_type)) = 'SAIDA'
            AND (
              BTRIM(pm.product_code) = BTRIM(al.register_id)
              OR regexp_replace(BTRIM(pm.product_code), '^0+', '') =
                 regexp_replace(BTRIM(al.register_id), '^0+', '')
            )
            AND (
              pm.metadata->>'audit_log_id' = al.id::text
              OR (
                ii.invoice_id IS NOT NULL
                AND pm.origin_id = ii.invoice_id::text
              )
              OR (
                ii.nfe_number IS NOT NULL
                AND BTRIM(pm.nfe_number) = ii.nfe_number::text
              )
            )
        )
    )

    SELECT * FROM native_movements
    UNION ALL
    SELECT * FROM legacy_audit_movements
    ORDER BY created_at DESC, movement_id DESC
    LIMIT ${MAX_ROWS};
  `;

  const { rows } = await pool.query(sql, [sku]);
  return rows;
}
