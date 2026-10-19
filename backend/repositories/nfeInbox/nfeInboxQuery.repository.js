// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInboxQuery.repository.js — list / count / getById                 ║
// ║ Tabela: public."nfeInbox" (+ JOIN inboundInvoices / expenseEntries)  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './nfeInbox.constants.js';
import {
  buildListFilters,
  buildOrderBy,
  LIST_COLUMNS,
  INBOUND_JOIN,
  ENTRADA_CRIADA_EXPR,
  HAS_XML_EXPR,
} from './nfeInbox.sql.js';

// ======================================================================
// LIST + filtros (JOIN inboundInvoices + flags)
// ======================================================================
export async function list({
  cnpjEmpresa,
  situacao,
  manifestacao,
  dataIni,
  dataFim,
  q,
  sort,
  order,
  limit = 100,
  offset = 0,
} = {}) {
  const { values, whereSql } = buildListFilters({
    cnpjEmpresa,
    situacao,
    manifestacao,
    dataIni,
    dataFim,
    q,
  });

  const lim = Number(limit);
  const off = Number(offset);

  values.push(Number.isFinite(lim) && lim > 0 ? lim : 100);
  const limitIdx = values.length;

  values.push(Number.isFinite(off) && off >= 0 ? off : 0);
  const offsetIdx = values.length;

  const sql = `
    SELECT
      ${LIST_COLUMNS},
      inv.inbound_id AS inbound_invoice_id,
      (inv.inbound_id IS NOT NULL) AS has_inbound,
      ${ENTRADA_CRIADA_EXPR} AS entrada_criada,
      exp.expenseentryid AS expense_entry_id,
      ${HAS_XML_EXPR} AS has_xml
    FROM ${TB} ni
    ${INBOUND_JOIN}
    ${whereSql}
    ${buildOrderBy(sort, order)}
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const { rows } = await pool.query(sql, values);
  return rows;
}

// ======================================================================
// COUNT + mesmos filtros da listagem
// (a ordenação não altera o total, então não entra aqui; o JOIN também
//  não, porque nenhum filtro referencia inv e o LATERAL não multiplica)
// ======================================================================
export async function count({
  cnpjEmpresa,
  situacao,
  manifestacao,
  dataIni,
  dataFim,
  q,
} = {}) {
  const { values, whereSql } = buildListFilters({
    cnpjEmpresa,
    situacao,
    manifestacao,
    dataIni,
    dataFim,
    q,
  });

  const { rows } = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM ${TB} AS ni
      ${whereSql};
    `,
    values
  );

  return Number(rows[0]?.total || 0);
}

// ======================================================================
// GET BY ID (anti-NaN)
// Aqui ni.* fica: é a tela de detalhe, que precisa do xml_completo.
// A flag calculada usa outro nome para não colidir com ni.entrada_criada.
// ======================================================================
export async function getById(id) {
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return null;

  const { rows } = await pool.query(
    `
    SELECT
      ni.*,
      inv.inbound_id AS inbound_invoice_id,
      (inv.inbound_id IS NOT NULL) AS has_inbound,
      ${ENTRADA_CRIADA_EXPR} AS entrada_criada_efetiva,
      exp.expenseentryid AS expense_entry_id,
      ${HAS_XML_EXPR} AS has_xml
    FROM ${TB} AS ni
    ${INBOUND_JOIN}
    WHERE ni.id = $1;
    `,
    [idNum]
  );

  return rows[0] || null;
}
