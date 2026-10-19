// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMovimentsQuery.repository.js — list / listForPdf / getById /   ║
// ║ summary                                                            ║
// ║ Tabela: "cashMoviments"                                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import { q, parseOrder } from './cashMoviments.utils.js';
import { movementSelectSql, movementTypeSql, buildMovementsWhere } from './cashMoviments.sql.js';

/* =========================================================================
   MOVIMENTAÇÕES
============================================================================*/

export async function listMovements({
  date_from,
  date_to,
  tipo,
  conta,
  categoria,
  subcategoria,
  search,
  anexos,
  limit = 50,
  offset = 0,
  orderBy = 'movement_date DESC',
} = {}) {
  const allowedOrder = ['movement_date', 'amount', 'movement_type', 'cash_account'];
  const order = parseOrder(orderBy, allowedOrder);

  const { sqlWhere, params } = buildMovementsWhere({
    date_from,
    date_to,
    tipo,
    conta,
    categoria,
    subcategoria,
    search,
    anexos,
  });

  const base = `
    ${movementSelectSql()}
    ${sqlWhere}
    ${order}
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
  `;

  const res = await q(base, [...params, Number(limit), Number(offset)]);

  const countSql = `
    SELECT COUNT(*) AS total
    FROM "cashMoviments" m
    LEFT JOIN "cashCategories" c
      ON c.id::text = m.category::text
      OR UPPER(TRIM(c.name)) = UPPER(TRIM(m.category::text))
    LEFT JOIN "cashSubcategories" s
      ON s.id::text = m.subcategory::text
      OR UPPER(TRIM(s.name)) = UPPER(TRIM(m.subcategory::text))
    ${sqlWhere}
  `;

  const count = await q(countSql, params);

  return {
    items: res.rows,
    total: Number(count.rows?.[0]?.total || 0),
    limit: Number(limit),
    offset: Number(offset),
  };
}

export async function listForPdf({
  date_from,
  date_to,
  tipo,
  conta,
  categoria,
  subcategoria,
  search,
  anexos,
  orderBy = 'movement_date ASC',
} = {}) {
  const allowedOrder = ['movement_date', 'amount', 'movement_type', 'cash_account'];
  const order = parseOrder(orderBy, allowedOrder);

  const { sqlWhere, params } = buildMovementsWhere({
    date_from,
    date_to,
    tipo,
    conta,
    categoria,
    subcategoria,
    search,
    anexos,
  });

  const sql = `
    SELECT
      m.id,
      m.movement_date AS data_hora,
      m.movement_type AS tipo_movimentacao,
      m.cash_account AS conta_caixa,
      m.document_type AS tipo_documento,
      m.document_number AS numero_documento,

      m.chart_account_id,
      coa.code AS chart_account_code,
      coa.description AS chart_account_description,

      COALESCE(
        NULLIF(CONCAT(coa.code, ' - ', coa.description), ' - '),
        'Não Informado'
      ) AS plano_contas,

      m.supplier_name AS fornecedor,
      m.notes AS observacao,
      m.amount AS valor,
      m.penalty_amount AS multa,
      m.interest_amount AS juros,
      m.fee_amount AS encargos,

      m.is_deductible,
      s.is_deductible AS subcategoria_is_deductible,
      COALESCE(m.is_deductible, s.is_deductible, FALSE) AS is_deductible_final,
      m.is_pis_cofins_creditable,
      m.deduct_charges_only,
      s.dre_type AS dre_tipo,

      (
        SELECT COUNT(*)::int
        FROM "cashMovimentsAttachments" a
        WHERE a.cash_movement_id = m.id
      ) AS anexos_count

    FROM "cashMoviments" m

    LEFT JOIN "cashCategories" c
      ON c.id::text = m.category::text
      OR UPPER(TRIM(c.name)) = UPPER(TRIM(m.category::text))

    LEFT JOIN "cashSubcategories" s
      ON s.id::text = m.subcategory::text
      OR UPPER(TRIM(s.name)) = UPPER(TRIM(m.subcategory::text))

    LEFT JOIN "chartOfAccounts" coa
      ON coa.id = m.chart_account_id

    ${sqlWhere}
    ${order}
  `;

  const res = await q(sql, params);

  return res.rows.map((r) => ({
    ...r,
    tem_anexo: Number(r.anexos_count || 0) > 0,
  }));
}

export async function getMovementById(id) {
  const sql = `
    ${movementSelectSql({ includeAll: true })}
    WHERE m.id = $1
  `;

  const res = await q(sql, [Number(id)]);
  return res.rows[0] || null;
}

export async function summary({
  date_from,
  date_to,
  tipo,
  conta,
  categoria,
  subcategoria,
  search,
  anexos,
} = {}) {
  const { sqlWhere, params } = buildMovementsWhere({
    date_from,
    date_to,
    tipo,
    conta,
    categoria,
    subcategoria,
    search,
    anexos,
  });

  const typeSql = movementTypeSql();

  const sql = `
    SELECT
      COALESCE(SUM(
        CASE
          WHEN (${typeSql}) = 'ENTRADA'
          THEN (
            m.amount
            + COALESCE(m.penalty_amount, 0)
            + COALESCE(m.interest_amount, 0)
            + COALESCE(m.fee_amount, 0)
          )
          ELSE 0
        END
      ), 0) AS total_entradas,

      COALESCE(SUM(
        CASE
          WHEN (${typeSql}) = 'SAIDA'
          THEN (
            m.amount
            + COALESCE(m.penalty_amount, 0)
            + COALESCE(m.interest_amount, 0)
            + COALESCE(m.fee_amount, 0)
          )
          ELSE 0
        END
      ), 0) AS total_saidas
    FROM "cashMoviments" m
    ${sqlWhere}
  `;

  const res = await q(sql, params);
  const row = res.rows[0] || { total_entradas: 0, total_saidas: 0 };
  const saldo = Number(row.total_entradas || 0) - Number(row.total_saidas || 0);

  return { ...row, saldo };
}
