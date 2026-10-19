// ╔════════════════════════════════════════════════════════════════════╗
// ║ expenseEntries.sql.js — query helper, ORDER BY, WHERE e SELECT     ║
// ║ Tabela: public."expenseEntries" (colunas minúsculas)               ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

/** Helper: query com log leve (descomente se quiser) */
export async function q(text, params = []) {
  // console.debug('[SQL]', text, params);
  const res = await pool.query(text, params);
  return res;
}

/** Ordenação segura (entrada aceita camelCase e/ou snake/lower) */
export function parseOrder(orderBy) {
  if (!orderBy) return ' ORDER BY issuedate DESC, expenseentryid DESC ';

  // mapa: o que o frontend pode mandar -> coluna real do banco
  const map = new Map([
    ['expenseentryid', 'expenseentryid'],
    ['issuedate', 'issuedate'],
    ['entrydate', 'entrydate'],
    ['status', 'status'],
    ['documenttype', 'documenttype'],
    ['documentnumber', 'documentnumber'],
    ['documentseries', 'documentseries'],
    ['documentkey', 'documentkey'],
    ['supplierid', 'supplierid'],
    ['suppliername', 'suppliername'],
    ['supplierdocument', 'supplierdocument'],
    ['totalexpensevalue', 'totalexpensevalue'],
    ['createdat', 'createdat'],
    ['updatedat', 'updatedat'],

    // alias usados no front (sem quebrar se vierem)
    ['expenseentryid', 'expenseentryid'],
    ['issuedate', 'issuedate'],
    ['entrydate', 'entrydate'],
  ]);

  const raw = String(orderBy).trim();
  const [colRaw, dirRaw] = raw.split(/\s+/);

  const colNorm = String(colRaw || '')
    .replaceAll('"', '')
    .trim()
    .toLowerCase();

  const dir = /^(asc|desc)$/i.test(dirRaw || '') ? String(dirRaw).toUpperCase() : 'ASC';

  // normalização extra
  const camelToLower = colNorm
    .replaceAll('expenseentryid', 'expenseentryid')
    .replaceAll('issuedate', 'issuedate')
    .replaceAll('entrydate', 'entrydate');

  const colDb = map.get(camelToLower) || null;
  if (!colDb) return ' ORDER BY issuedate DESC, expenseentryid DESC ';

  return ` ORDER BY ${colDb} ${dir} `;
}

/** Monta WHERE dinâmico (SEM companyId) — usando colunas reais (minúsculas) */
export function buildWhere({ status, supplierDocument, q: queryText, dateFrom, dateTo } = {}) {
  const where = [];
  const params = [];

  if (status) {
    params.push(String(status).toUpperCase());
    where.push(`status = $${params.length}`);
  }

  if (supplierDocument) {
    params.push(String(supplierDocument).trim());
    where.push(`supplierdocument = $${params.length}`);
  }

  if (dateFrom) {
    params.push(String(dateFrom));
    where.push(`issuedate >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(String(dateTo));
    where.push(`issuedate <= $${params.length}::date`);
  }

  if (queryText) {
    const qt = `%${String(queryText).trim()}%`;
    params.push(qt);
    const p = params.length;

    where.push(`(
      suppliername ILIKE $${p}
      OR documentnumber ILIKE $${p}
      OR documentseries ILIKE $${p}
      OR documentkey ILIKE $${p}
      OR notes ILIKE $${p}
    )`);
  }

  return {
    whereSql: where.length ? ` WHERE ${where.join(' AND ')} ` : '',
    params,
  };
}

export const SELECT_ALIASED = `
  SELECT
    expenseentryid     AS "expenseEntryId",
    supplierid         AS "supplierId",
    suppliername       AS "supplierName",
    supplierdocument   AS "supplierDocument",
    documenttype       AS "documentType",
    documentnumber     AS "documentNumber",
    documentseries     AS "documentSeries",
    documentkey        AS "documentKey",
    issuedate          AS "issueDate",
    entrydate          AS "entryDate",
    totalproductsvalue AS "totalProductsValue",
    totaldiscountvalue AS "totalDiscountValue",
    totaltaxvalue      AS "totalTaxValue",
    totalexpensevalue  AS "totalExpenseValue",
    generatestaxcredit AS "generatesTaxCredit",
    fiscalstatus       AS "fiscalStatus",
    costcenterid       AS "costCenterId",
    vehicleid          AS "vehicleId",
    notes              AS "notes",
    xmlpath            AS "xmlPath",
    pdfpath            AS "pdfPath",
    status             AS "status",
    createdby          AS "createdBy",
    createdat          AS "createdAt",
    updatedat          AS "updatedAt"
  FROM public."expenseEntries"
`;
