// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalV2Query.repository.js — list / listBatchProducts / getCurrent║
// ╚══════════════════════════════════════════════════════════════════════╝

import db from '../../config/db.js';
import { PRODUCTS_FISCAL_V2_TABLE as TABLE, PRODUCTS_FISCAL_V2_CURRENT_WHERE_SQL as CURRENT_WHERE } from './productsFiscalV2.catalog.js';
import { FISCAL_CLASSIFICATION_V2_TABLE } from '../fiscalClassificationV2/fiscalClassificationV2.catalog.js';
import { FISCAL_PROFILE_V2_TABLE } from '../fiscalProfileV2/fiscalProfileV2.catalog.js';
import { badRequest, parseBoolean, normalizePagination } from './productsFiscalV2.sanitizers.js';
import { FULL_SELECT } from './productsFiscalV2.sql.js';

// ============================================================================
// LISTAR VÍNCULOS FISCAIS
// ============================================================================

export async function list({
  productCode,
  current,
  active,
  limit = 100,
  offset = 0,
} = {}) {
  const values = [];
  const where = [];
  const pagination = normalizePagination(limit, offset, 100);

  const addCondition = (column, value) => {
    values.push(value);
    where.push(`${column} = $${values.length}`);
  };

  const normalizedProductCode = String(productCode ?? '').trim();
  if (normalizedProductCode) addCondition('pf.product_code', normalizedProductCode);
  if (current !== undefined && current !== null && current !== '') {
    addCondition('pf.is_current', parseBoolean(current, 'current'));
  }
  if (active !== undefined && active !== null && active !== '') {
    addCondition('pf.is_active', parseBoolean(active, 'active'));
  }

  values.push(pagination.limit);
  const limitPosition = values.length;

  values.push(pagination.offset);
  const offsetPosition = values.length;

  const result = await db.query(
    `
      ${FULL_SELECT}
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY pf.product_code, pf.version DESC
      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `,
    values
  );

  return result.rows;
}

// ============================================================================
// LISTAR PRODUTOS PARA A TELA DE VÍNCULO EM LOTE
// ============================================================================

export async function listBatchProducts({
  search,
  linked,
  limit = 20,
  offset = 0,
} = {}) {
  const values = [];
  const pagination = normalizePagination(limit, offset, 20);
  const where = [
    'p.is_active = true',
  ];

  const normalizedSearch = String(search ?? '').trim();
  if (normalizedSearch) {
    values.push(`%${normalizedSearch}%`);

    const position = values.length;

    where.push(`
      (
        p.product_code ILIKE $${position}
        OR p.description ILIKE $${position}
        OR COALESCE(p.barcode, '') ILIKE $${position}
        OR CAST(p.product_id AS TEXT) ILIKE $${position}
      )
    `);
  }

  const normalizedLinked =
    linked === undefined || linked === null || linked === ''
      ? undefined
      : parseBoolean(linked, 'linked');

  if (normalizedLinked === true) {
    where.push(
      'pf.products_fiscal_id IS NOT NULL'
    );
  }

  if (normalizedLinked === false) {
    where.push(
      'pf.products_fiscal_id IS NULL'
    );
  }

  const whereSql = `
    WHERE ${where.join(' AND ')}
  `;

  const countResult = await db.query(
    `
      SELECT
        COUNT(*)::integer AS total

      FROM public.products p

      LEFT JOIN ${TABLE} pf
        ON pf.product_code = p.product_code
       AND ${CURRENT_WHERE}

      ${whereSql}
    `,
    values
  );

  const listValues = [
    ...values,
    pagination.limit,
    pagination.offset,
  ];

  const limitPosition =
    listValues.length - 1;

  const offsetPosition =
    listValues.length;

  const rowsResult = await db.query(
    `
      SELECT
        p.product_id,
        p.product_code,
        p.description AS product_description,
        p.barcode,

        pf.products_fiscal_id,
        pf.fiscal_classification_id,
        pf.version AS fiscal_version,

        fc.classification_name,
        fc.ncm_code,
        fc.cest_code,

        fp.fiscal_profile_id,
        fp.profile_name,

        CASE
          WHEN pf.products_fiscal_id IS NOT NULL
          THEN true
          ELSE false
        END AS fiscal_is_linked

      FROM public.products p

      LEFT JOIN ${TABLE} pf
        ON pf.product_code = p.product_code
       AND ${CURRENT_WHERE}

      LEFT JOIN ${FISCAL_CLASSIFICATION_V2_TABLE} fc
        ON fc.fiscal_classification_id =
           pf.fiscal_classification_id

      LEFT JOIN ${FISCAL_PROFILE_V2_TABLE} fp
        ON fp.fiscal_profile_id =
           fc.fiscal_profile_id

      ${whereSql}

      ORDER BY p.product_code

      LIMIT $${limitPosition}
      OFFSET $${offsetPosition}
    `,
    listValues
  );

  return {
    rows: rowsResult.rows,
    total: Number(
      countResult.rows[0]?.total || 0
    ),
  };
}

// ============================================================================
// CONSULTAR VÍNCULO FISCAL ATUAL
// ============================================================================

export async function getCurrent(productCode) {
  const normalizedProductCode = String(productCode ?? '').trim();
  if (!normalizedProductCode) {
    throw badRequest('productCode é obrigatório.');
  }

  const result = await db.query(
    `
      ${FULL_SELECT}
      WHERE pf.product_code = $1
        AND ${CURRENT_WHERE}
    `,
    [normalizedProductCode]
  );

  return result.rows[0] ?? null;
}
