// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOriginsResolve.repository.js — resolveForItem          ║
// ║ Origem fiscal aplicável a um item (lote/grade)                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, ST_PROJECTION } from './productsFiscalOrigins.constants.js';
import { clean, positiveInteger } from './productsFiscalOrigins.sanitizers.js';
import { ensureOnce } from './productsFiscalOriginsSchema.repository.js';

/**
 * Origem fiscal aplicável a um item, na ordem de especificidade:
 *
 *   1) lote + grade exatos
 *   2) lote, qualquer grade
 *   3) sem lote + grade exata   (padrão do produto para aquela grade)
 *   4) sem lote, qualquer grade (padrão do produto)
 *
 * O item 3/4 é o que atende STOCK_SIMPLE, onde não existe lot_id.
 *
 * As colunas retornadas têm exatamente os mesmos nomes de
 * "inboundInvoiceItems", de modo que nfeIssuanceApi possa reaproveitar
 * normalizeInboundIcmsSt() sobre esta linha.
 */
export async function resolveForItem(
  {
    productCode,
    lotId = null,
    productGradeId = null,
  } = {},
  client = pool,
) {
  const code = clean(productCode);
  if (!code) throw new Error('product_code é obrigatório.');

  await ensureOnce(client);

  const lot = positiveInteger(lotId);
  const grade = positiveInteger(productGradeId);

  const { rows } = await client.query(
    `
      SELECT
        ${ST_PROJECTION}
      FROM ${TB}
      WHERE TRIM(product_code) = $1
        AND is_active = TRUE
        AND (lot_id IS NULL OR lot_id = $2::integer)
      ORDER BY
        -- Mais específico primeiro: o lote exato ganha da origem padrão.
        CASE WHEN lot_id IS NOT NULL THEN 0 ELSE 1 END,

        /*
         * A grade é PREFERÊNCIA, nunca filtro — mesma convenção do
         * resolvedor de inboundInvoiceItems.
         *
         * Os itens do orçamento carregam grade_id (catálogo de grades),
         * não product_grade_id (vínculo produto x grade), então filtrar por
         * product_grade_id descartaria origens válidas.
         */
        CASE
          WHEN $3::integer IS NOT NULL
           AND product_grade_id = $3::integer
          THEN 0
          WHEN product_grade_id IS NULL
          THEN 1
          ELSE 2
        END,

        -- Origens com ICMS-ST completo vêm à frente.
        CASE
          WHEN icms_st_base IS NOT NULL
           AND icms_st_rate IS NOT NULL
           AND icms_st_value IS NOT NULL
          THEN 0
          ELSE 1
        END,

        calculated_at DESC,
        fiscal_origin_id DESC
      LIMIT 1
    `,
    [code, lot, grade],
  );

  return rows[0] || null;
}
