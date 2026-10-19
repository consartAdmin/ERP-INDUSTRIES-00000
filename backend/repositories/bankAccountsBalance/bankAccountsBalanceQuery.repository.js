// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalanceQuery.repository.js — listCheckpoints /         ║
// ║ getCheckpointById | Tabela: public."bankAccountsBalance"           ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_BANK_ACCOUNTS } from './bankAccountsBalance.constants.js';
import { SELECT_FIELDS } from './bankAccountsBalance.sql.js';
import { positiveId, requireId, isoDate } from './bankAccountsBalance.sanitizers.js';

export async function listCheckpoints({ bankAccountId, from, to, limit } = {}) {
  const where = [];
  const params = [];

  if (bankAccountId) {
    params.push(requireId(bankAccountId, 'Conta bancária'));
    where.push(`bb.bank_account_id = $${params.length}`);
  }
  if (from) {
    params.push(isoDate(from, 'Data inicial'));
    where.push(`bb.balance_date >= $${params.length}::date`);
  }
  if (to) {
    params.push(isoDate(to, 'Data final'));
    where.push(`bb.balance_date <= $${params.length}::date`);
  }

  const max = Math.min(Math.max(Number(limit) || 500, 1), 2000);
  params.push(max);

  const { rows } = await pool.query(
    `
    SELECT ${SELECT_FIELDS}
    FROM ${TB} bb
    INNER JOIN ${TB_BANK_ACCOUNTS} ba ON ba.id = bb.bank_account_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY bb.balance_date DESC, ba.name ASC, bb.id DESC
    LIMIT $${params.length}
    `,
    params
  );
  return rows;
}

export async function getCheckpointById(value, db = pool) {
  const id = positiveId(value);
  if (!id) return null;
  const { rows } = await db.query(
    `
    SELECT ${SELECT_FIELDS}
    FROM ${TB} bb
    INNER JOIN ${TB_BANK_ACCOUNTS} ba ON ba.id = bb.bank_account_id
    WHERE bb.id = $1
    `,
    [id]
  );
  return rows[0] || null;
}
