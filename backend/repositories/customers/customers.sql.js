// ╔════════════════════════════════════════════════════════════════════╗
// ║ customers.sql.js — Fragmentos SQL compartilhados                   ║
// ║ SELECT completo, JOINs e filtros usados por getById/list/export    ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  ALIAS,
  TB_IBGE,
  TB_SEG,
  TB_DELIVERY,
  TB_STATUS,
  TB_STATUS_TYPES,
  TB_SELLER_FOR_CUSTOMER,
  TB_SELLERS,
} from './customers.constants.js';
import { erpTable } from '../../utils/erpCompanyContext.js';

// ---------------------------------------------------------------------
// Colunas da projeção completa (mapRow)
// ---------------------------------------------------------------------
export const CUSTOMER_FULL_COLUMNS = `
      ${ALIAS}.*,

      -- IBGE
      ci.codigo_ibge      AS ibge_city_code,
      ci.source           AS ibge_source,
      ci.confidence       AS ibge_confidence,

      -- STATUS
      cs.status_type_id,
      cst.name_pt         AS status_name_pt,
      cst.internal_code   AS status_internal_code,
      cst.color_hex       AS status_color_hex,
      COALESCE(cst.name_pt, cst.internal_code) AS status_label,

      -- SEGMENTO
      seg.segment_code    AS segment_code,
      seg.segment_name    AS segment_name,

      -- SELLER
      sfc.seller_id       AS seller_id,
      COALESCE(s.nickname, s.name) AS seller_name,

      -- ENDEREÇO DE ENTREGA
      ad.customer_ad_street_type,
      ad.customer_ad_street_name,
      ad.customer_ad_street_number,
      ad.customer_ad_address_complement,
      ad.customer_ad_neighborhood,
      ad.customer_ad_city,
      ad.customer_ad_state,
      ad.active AS customer_ad_active
`;

// ---------------------------------------------------------------------
// JOINs
// ---------------------------------------------------------------------
export const JOIN_STATUS = () => `
    LEFT JOIN ${erpTable(TB_STATUS)} cs
      ON cs.customer_id = ${ALIAS}.customer_id

    LEFT JOIN ${erpTable(TB_STATUS_TYPES)} cst
      ON cst.id = cs.status_type_id
`;

export const JOIN_SEGMENT = () => `
    LEFT JOIN ${erpTable(TB_SEG)} seg
      ON seg.segment_id = ${ALIAS}.segment_id
`;

// Vendedor ativo mais recente
export const JOIN_SELLER = () => `
    LEFT JOIN LATERAL (
      SELECT sfc1.seller_id
      FROM ${erpTable(TB_SELLER_FOR_CUSTOMER)} sfc1
      WHERE sfc1.customer_id = ${ALIAS}.customer_id
        AND (sfc1.active IS NULL OR sfc1.active = TRUE)
      ORDER BY sfc1.created_at DESC
      LIMIT 1
    ) sfc ON TRUE

    LEFT JOIN ${erpTable(TB_SELLERS)} s
      ON s.id = sfc.seller_id
`;

export const JOIN_IBGE = `
    LEFT JOIN ${TB_IBGE} ci
      ON ci.customer_id = ${ALIAS}.customer_id
`;

export const JOIN_DELIVERY = `
    LEFT JOIN ${TB_DELIVERY} ad
      ON ad.customer_ad_id = ${ALIAS}.customer_ad_id
`;

// Funções: as tabelas de status/segmento/vendedor dependem da empresa da request
export const CUSTOMER_FULL_JOINS = () => [
  JOIN_STATUS(),
  JOIN_SEGMENT(),
  JOIN_SELLER(),
  JOIN_IBGE,
  JOIN_DELIVERY,
].join('\n');

// ---------------------------------------------------------------------
// Filtros de list / listAllForExport
// Empilha os valores em `params` e devolve o WHERE pronto.
// ---------------------------------------------------------------------
export function buildCustomerFilters(
  { q, is_active, status_type_id, seller_id, segment_id } = {},
  params = []
) {
  const where = [];

  if (q && String(q).trim()) {
    const norm = String(q)
      .toLowerCase()
      .trim();

    params.push(`%${norm}%`);

    where.push(`(
      LOWER(COALESCE(${ALIAS}.trade_name,'')) LIKE $${params.length} OR
      LOWER(COALESCE(${ALIAS}.legal_name,'')) LIKE $${params.length} OR
      COALESCE(${ALIAS}.tax_id,'') LIKE $${params.length}
    )`);
  }

  if (typeof is_active === 'boolean') {
    params.push(is_active);
    where.push(`${ALIAS}.is_active = $${params.length}`);
  }

  if (Number.isFinite(Number(status_type_id))) {
    params.push(Number(status_type_id));
    where.push(`cs.status_type_id = $${params.length}`);
  }

  if (Number.isFinite(Number(seller_id))) {
    params.push(Number(seller_id));
    where.push(`sfc.seller_id = $${params.length}`);
  }

  if (Number.isFinite(Number(segment_id))) {
    params.push(Number(segment_id));
    where.push(`${ALIAS}.segment_id = $${params.length}`);
  }

  return {
    params,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
  };
}
