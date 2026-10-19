// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersKanbanPendingsQuery.repository.js — consultas de pendências  ║
// ║ Tabela: public."ordersKanbanPendingItems"                          ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
  TB_CARDS,
  TB_COLUMNS,
  TB_PENDINGS,
  TB_BARCODES,
  TB_CUSTOMERS,
  TB_PRODUCTS,
} from './ordersKanban.constants.js';
import {
  STATUS_TO_COLUMN,
  IS_OPEN_PENDING,
  IS_DONE_PENDING,
  PRODUCT_JOIN,
  BARCODE_JOIN,
} from './ordersKanban.sql.js';

// ===========================================================================
// 📌 PENDÊNCIAS
// ===========================================================================

// ✅ Pendências de um card (com filtro pendentes|concluidas|todas)
export async function getPendingsByCard(cardId, pendencias = 'todas') {
  const safeCardId = Number(cardId);
  if (!safeCardId || Number.isNaN(safeCardId)) throw new Error('cardId inválido');

  const filtros = ['p.card_id = $1'];
  const params = [safeCardId];

  const f = String(pendencias || 'todas').toLowerCase();
  if (f.startsWith('pend')) filtros.push(IS_OPEN_PENDING);
  else if (f.startsWith('concl')) filtros.push(IS_DONE_PENDING);

  const sql = `
    SELECT
      p.pending_id,
      p.card_id,
      p.product_code,
      p.barcode_id,
      p.quantity,
      p.note,
      p.status,
      p.created_at,
      p.updated_at,
      pr.product_id,
      COALESCE(pr.description, '-') AS product_description,
      b.unit,
      b.fator,
      b.barcode
    FROM ${TB_PENDINGS} p
    LEFT JOIN ${TB_PRODUCTS} pr
           ON ${PRODUCT_JOIN}
    LEFT JOIN ${TB_BARCODES} b
           ON ${BARCODE_JOIN}
    WHERE ${filtros.join(' AND ')}
    ORDER BY p.created_at DESC;
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// ✅ Relatório (PDF / tela): pendências com contexto
export async function listPendingsWithContext({ columnId, statusName, pendenciasFilter } = {}) {
  const filtros = [];
  const params = [];

  if (columnId) {
    filtros.push(`s.column_id = $${params.length + 1}`);
    params.push(Number(columnId));
  }

  if (statusName) {
    const arr = String(statusName)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    if (arr.length) {
      filtros.push(`s.name = ANY($${params.length + 1})`);
      params.push(arr);
    }
  }

  const pendRaw = String(pendenciasFilter || 'todas').toLowerCase();
  if (pendRaw.startsWith('pend')) filtros.push(IS_OPEN_PENDING);
  else if (pendRaw.startsWith('concl')) filtros.push(IS_DONE_PENDING);

  filtros.push('COALESCE(k.is_finished,false) = false');

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const sql = `
    SELECT
      p.*,
      COALESCE(pr.description, '-') AS product_description,
      b.unit,
      b.fator,
      k.card_id,
      k.separation_number          AS order_separation_number,
      c.trade_name                 AS customer_name,
      c.tax_id                     AS customer_tax_id,
      COALESCE(p.note, '-')        AS obs,
      s.name                       AS column_name
    FROM ${TB_PENDINGS} p
    LEFT JOIN ${TB_PRODUCTS} pr
           ON ${PRODUCT_JOIN}
    LEFT JOIN ${TB_BARCODES} b
           ON ${BARCODE_JOIN}
    LEFT JOIN ${TB_CARDS} k
           ON p.card_id = k.card_id
    LEFT JOIN ${TB_CUSTOMERS} c
           ON c.customer_id = k.customer_id
    LEFT JOIN ${TB_COLUMNS} s
           ON ${STATUS_TO_COLUMN} = s.name
    ${where}
    ORDER BY
      s.sort_order NULLS LAST,
      k.card_id,
      CASE WHEN ${IS_OPEN_PENDING} THEN 0 ELSE 1 END,
      p.product_code NULLS LAST;
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
}

// ✅ Contador global para badge (abertas/concluidas/todas) com filtro opcional por coluna
export async function countPendings({ columnId, pendenciasFilter } = {}) {
  const filtros = [];
  const params = [];

  if (columnId) {
    filtros.push(`s.column_id = $${params.length + 1}`);
    params.push(Number(columnId));
  }

  const pendRaw = String(pendenciasFilter || 'todas').toLowerCase();
  if (pendRaw.startsWith('pend')) filtros.push(IS_OPEN_PENDING);
  else if (pendRaw.startsWith('concl')) filtros.push(IS_DONE_PENDING);

  filtros.push('COALESCE(k.is_finished,false) = false');

  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const sql = `
    SELECT
      COUNT(*)::int AS total,
      COALESCE(SUM(CASE WHEN ${IS_OPEN_PENDING} THEN 1 ELSE 0 END),0)::int AS abertas,
      COALESCE(SUM(CASE WHEN ${IS_DONE_PENDING} THEN 1 ELSE 0 END),0)::int AS concluidas
    FROM ${TB_PENDINGS} p
    LEFT JOIN ${TB_CARDS} k ON p.card_id = k.card_id
    LEFT JOIN ${TB_COLUMNS} s ON ${STATUS_TO_COLUMN} = s.name
    ${where};
  `;

  const { rows } = await pool.query(sql, params);
  return rows[0] || { total: 0, abertas: 0, concluidas: 0 };
}
