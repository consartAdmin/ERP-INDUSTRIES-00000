// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsLookup.repository.js — Resolução de vendedor e comissão       ║
// ║ resolveSellerIdByUserId / resolveCommissionId                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  TB_PRICE_COMISSIONS,
  ALIAS_PC,
  TB_COMMISSIONS,
  ALIAS_C,
  TB_SELLER_BY_USER,
} from './budgets.constants.js';
import {
  safeString,
  getTableColumns,
  tableExists,
  pickFirstExisting,
} from './budgets.utils.js';

// ----------------------------------------------------------------------
// Resolve seller_id via sellerByUser
// ----------------------------------------------------------------------
export async function resolveSellerIdByUserId(client, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;

  try {
    const colsSql = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'sellerByUser'
      `;
    const colsRes = await client.query(colsSql);
    const realCols = (colsRes.rows || []).map((r) => String(r.column_name));

    if (!realCols.length) return null;

    const colMap = new Map();
    for (const c of realCols) colMap.set(c.toLowerCase(), c);

    const pickReal = (name) => colMap.get(String(name).toLowerCase()) || null;

    const where = [];
    const args = [uid];

    const userColsCandidates = [
      'user_id', 'usuario_id', 'userid', 'userId', 'usuarioid', 'usuarioId',
    ];
    for (const c of userColsCandidates) {
      const rc = pickReal(c);
      if (rc) where.push(`"${rc}" = $1`);
    }
    if (!where.length) return null;

    const candidatesWanted = [
      'seller_id',
      'sellerId',
      'sellerid',
      'seller',
      'vendedor_id',
      'vendedorId',
      'vendedorid',
      'vendedor',
      'seller_code',
      'seller_codigo',
      'sellercode',
      'sellercodigo',
    ];

    const candidatesReal = [];
    for (const c of candidatesWanted) {
      const rc = pickReal(c);
      if (rc && !candidatesReal.includes(rc)) candidatesReal.push(rc);
    }
    if (!candidatesReal.length) return null;

    const orderParts = [];
    const updatedAt = pickReal('updated_at') ?? pickReal('updatedAt');
    const createdAt = pickReal('created_at') ?? pickReal('createdAt');
    const idCol = pickReal('id');

    if (updatedAt) orderParts.push(`"${updatedAt}" DESC NULLS LAST`);
    if (createdAt) orderParts.push(`"${createdAt}" DESC NULLS LAST`);
    if (idCol) orderParts.push(`"${idCol}" DESC NULLS LAST`);

    const orderBy = orderParts.length ? `ORDER BY ${orderParts.join(', ')}` : '';

    const sql = `
        SELECT ${candidatesReal.map((c) => `"${c}"`).join(', ')}
        FROM ${TB_SELLER_BY_USER}
        WHERE ${where.join(' OR ')}
        ${orderBy}
        LIMIT 1
      `;

    const r = await client.query(sql, args);
    const row = r.rows?.[0];
    if (!row) return null;

    let pick = null;

    for (const wanted of candidatesWanted) {
      const real = pickReal(wanted);
      if (!real) continue;

      const v = row[real];
      if (v !== null && v !== undefined && String(v).trim()) {
        pick = v;
        break;
      }
    }

    if (pick == null) {
      for (const real of candidatesReal) {
        const v = row[real];
        if (v !== null && v !== undefined && String(v).trim()) {
          pick = v;
          break;
        }
      }
    }

    const out = pick == null ? null : String(pick).trim();
    return out || null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------
// Resolve commission_id automaticamente
// ----------------------------------------------------------------------
export async function resolveCommissionId(client, { price_id, issue_date } = {}) {
  const priceId = Number(price_id);
  const issueDate = safeString(issue_date, 30) || new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(priceId)) return null;

  const hasPriceCommissions = await tableExists(client, 'public', 'priceCommissions');
  const hasCommissions = await tableExists(client, 'public', 'commissions');

  if (!hasPriceCommissions || !hasCommissions) {
    return null;
  }

  const pcCols = await getTableColumns(client, 'public', 'priceCommissions');
  const cCols = await getTableColumns(client, 'public', 'commissions');

  const pcPriceIdCol = pickFirstExisting(pcCols, ['price_id', 'priceId']);
  const pcCommissionIdCol = pickFirstExisting(pcCols, ['commission_id', 'commissionId']);
  const pcActiveCol = pickFirstExisting(pcCols, ['is_active', 'active']);

  const cIdCol = pickFirstExisting(cCols, ['commission_id', 'id']);
  const cActiveCol = pickFirstExisting(cCols, ['is_active', 'active']);
  const cStartCol = pickFirstExisting(cCols, ['start_date', 'valid_from', 'effective_from', 'date_from']);
  const cEndCol = pickFirstExisting(cCols, ['end_date', 'valid_to', 'effective_to', 'date_to']);
  const cCreatedAtCol = pickFirstExisting(cCols, ['created_at', 'createdAt']);

  if (!pcPriceIdCol || !pcCommissionIdCol || !cIdCol) {
    return null;
  }

  const where = [`${ALIAS_PC}."${pcPriceIdCol}" = $1`];
  const args = [priceId];
  let ai = 2;

  if (pcActiveCol) {
    where.push(`COALESCE(${ALIAS_PC}."${pcActiveCol}", TRUE) = TRUE`);
  }

  if (cActiveCol) {
    where.push(`COALESCE(${ALIAS_C}."${cActiveCol}", TRUE) = TRUE`);
  }

  if (cStartCol) {
    where.push(`(${ALIAS_C}."${cStartCol}" IS NULL OR ${ALIAS_C}."${cStartCol}" <= $${ai})`);
    args.push(issueDate);
    ai++;
  }

  if (cEndCol) {
    where.push(`(${ALIAS_C}."${cEndCol}" IS NULL OR ${ALIAS_C}."${cEndCol}" >= $${ai})`);
    args.push(issueDate);
    ai++;
  }

  const orderParts = [];
  if (cStartCol) orderParts.push(`${ALIAS_C}."${cStartCol}" DESC NULLS LAST`);
  if (cCreatedAtCol) orderParts.push(`${ALIAS_C}."${cCreatedAtCol}" DESC NULLS LAST`);
  orderParts.push(`${ALIAS_C}."${cIdCol}" DESC`);

  const sql = `
      SELECT ${ALIAS_C}."${cIdCol}" AS commission_id
      FROM ${TB_PRICE_COMISSIONS} ${ALIAS_PC}
      INNER JOIN ${TB_COMMISSIONS} ${ALIAS_C}
        ON ${ALIAS_C}."${cIdCol}" = ${ALIAS_PC}."${pcCommissionIdCol}"
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderParts.join(', ')}
      LIMIT 1
    `;

  const r = await client.query(sql, args);
  if (!r.rowCount) return null;

  const cid = Number(r.rows[0]?.commission_id);
  return Number.isFinite(cid) ? cid : null;
}
