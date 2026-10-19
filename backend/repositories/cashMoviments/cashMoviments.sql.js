// ╔════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.sql.js — Fragmentos SQL (SELECT, tipo, WHERE,        ║
// ║ resolução de bank_account_id)                                      ║
// ╚════════════════════════════════════════════════════════════════════╝

import { normalizeTipoMovimentacao } from './cashMoviments.sanitizers.js';

/**
 * SQL do bank_account_id da movimentação:
 * 1) ID informado (se existir em "bankAccounts")
 * 2) conta bancária com o mesmo nome de cash_account (sem diferenciar maiúsculas)
 */
export function bankAccountIdSql(idParam, nameParam) {
  return `COALESCE(
    (SELECT ba.id FROM "bankAccounts" ba WHERE ba.id = ${idParam}::bigint),
    (
      SELECT ba.id
      FROM "bankAccounts" ba
      WHERE UPPER(TRIM(ba.name)) = UPPER(TRIM(${nameParam}::varchar))
      ORDER BY ba.is_active DESC, ba.id ASC
      LIMIT 1
    )
  )`;
}

export function movementTypeSql() {
  return `
    CASE
      WHEN translate(upper(m.movement_type),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC') LIKE 'ENTR%' THEN 'ENTRADA'
      WHEN translate(upper(m.movement_type),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC') LIKE 'SAID%' THEN 'SAIDA'
      ELSE translate(upper(m.movement_type),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC')
    END
  `;
}

export function movementSelectSql({ includeAll = false } = {}) {
  const allFields = includeAll
    ? `
      m.movement_date,
      m.movement_type,
      m.cash_account,
      m.amount,
      m.document_type,
      m.document_number,
      m.supplier_name,
      m.notes,
      m.penalty_amount,
      m.interest_amount,
      m.fee_amount,
      m.category,
      m.subcategory,
      m.chart_account_id,
      m.bank_account_id,
    `
    : '';

  return `
    SELECT
      m.id,

      ${allFields}

      m.movement_date AS data_hora,
      m.movement_type AS tipo_movimentacao,
      m.cash_account AS conta_caixa,
      m.amount AS valor,
      m.document_type AS tipo_documento,
      m.document_number AS numero_documento,
      m.supplier_name AS fornecedor,
      m.notes AS observacao,
      m.penalty_amount AS multa,
      m.interest_amount AS juros,
      m.fee_amount AS encargos,
      m.category AS categoria,
      c.name AS categoria_nome,
      m.subcategory AS subcategoria,
      s.name AS subcategoria_nome,

      m.chart_account_id,
      coa.code AS chart_account_code,
      coa.description AS chart_account_description,
      coa.account_type AS chart_account_type,
      coa.nature AS chart_account_nature,

      m.is_deductible,
      s.is_deductible AS subcategoria_is_deductible,
      COALESCE(m.is_deductible, s.is_deductible, FALSE) AS is_deductible_final,
      m.is_pis_cofins_creditable,
      m.deduct_charges_only,
      s.dre_type AS dre_tipo,

      m.created_at,
      m.updated_at,
      m.is_active
    FROM "cashMoviments" m
    LEFT JOIN "cashCategories" c
      ON c.id::text = m.category::text
      OR UPPER(TRIM(c.name)) = UPPER(TRIM(m.category::text))
    LEFT JOIN "cashSubcategories" s
      ON s.id::text = m.subcategory::text
      OR UPPER(TRIM(s.name)) = UPPER(TRIM(m.subcategory::text))
    LEFT JOIN "chartOfAccounts" coa
      ON coa.id = m.chart_account_id
  `;
}

export function buildMovementsWhere({
  date_from,
  date_to,
  tipo,
  conta,
  categoria,
  subcategoria,
  search,
  anexos,
}) {
  const where = [];
  const params = [];
  let i = 1;

  if (date_from) {
    where.push(`m.movement_date >= $${i++}`);
    params.push(date_from);
  }

  if (date_to) {
    where.push(`m.movement_date <= $${i++}`);
    params.push(date_to);
  }

  const tipoNorm = normalizeTipoMovimentacao(tipo);

  if (tipoNorm) {
    where.push(`(${movementTypeSql()}) = $${i++}`);
    params.push(tipoNorm);
  }

  if (conta) {
    where.push(`
      (
        UPPER(TRIM(m.cash_account::text)) = UPPER(TRIM($${i}::text))
        OR EXISTS (
          SELECT 1
          FROM "bankAccounts" ba
          WHERE ba.id::text = $${i}::text
            AND UPPER(TRIM(ba.name)) = UPPER(TRIM(m.cash_account::text))
        )
      )
    `);
    params.push(String(conta));
    i++;
  }

  if (categoria) {
    where.push(`
      (
        m.category::text = $${i}::text
        OR m.category::text ILIKE (
          SELECT c.name
          FROM "cashCategories" c
          WHERE c.id::text = $${i}::text
        )
      )
    `);
    params.push(String(categoria));
    i++;
  }

  if (subcategoria) {
    where.push(`
      (
        m.subcategory::text = $${i}::text
        OR m.subcategory::text ILIKE (
          SELECT s.name
          FROM "cashSubcategories" s
          WHERE s.id::text = $${i}::text
        )
      )
    `);
    params.push(String(subcategoria));
    i++;
  }

  if (search) {
    where.push(`(
      m.supplier_name ILIKE $${i}
      OR m.notes ILIKE $${i}
      OR m.document_number ILIKE $${i}
    )`);
    params.push(`%${search}%`);
    i++;
  }

  if (anexos === 'com') {
    where.push(`
      EXISTS (
        SELECT 1
        FROM "cashMovimentsAttachments" a
        WHERE a.cash_movement_id = m.id
      )
    `);
  } else if (anexos === 'sem') {
    where.push(`
      NOT EXISTS (
        SELECT 1
        FROM "cashMovimentsAttachments" a
        WHERE a.cash_movement_id = m.id
      )
    `);
  }

  const sqlWhere = where.length ? ` WHERE ${where.join(' AND ')} ` : '';
  return { sqlWhere, params };
}
