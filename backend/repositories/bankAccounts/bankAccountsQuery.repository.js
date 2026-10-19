// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsQuery.repository.js — listBankAccounts /               ║
// ║ getBankAccountById | Tabela: public."bankAccounts"                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_BANKS, PROVIDERS } from './bankAccounts.constants.js';
import { positiveId, enumValue } from './bankAccounts.sanitizers.js';
import { SELECT_FIELDS } from './bankAccounts.sql.js';

export async function listBankAccounts({ search, active, provider, bankId } = {}) {
  const where = [];
  const params = [];

  if (search) {
    params.push(`%${String(search).trim()}%`);
    where.push(`(ba.name ILIKE $${params.length} OR b.name ILIKE $${params.length} OR ba.account_number ILIKE $${params.length})`);
  }
  if (active !== undefined && active !== null && active !== '') {
    params.push(String(active).toLowerCase() !== 'false');
    where.push(`ba.is_active = $${params.length}`);
  }
  if (provider) {
    params.push(enumValue(provider, PROVIDERS, 'MANUAL', 'Provedor'));
    where.push(`ba.integration_provider = $${params.length}`);
  }
  if (bankId) {
    const id = positiveId(bankId);
    if (!id) throw Object.assign(new Error('bankId inválido.'), { statusCode: 400 });
    params.push(id);
    where.push(`ba.bank_id = $${params.length}`);
  }

  const { rows } = await pool.query(`
    SELECT ${SELECT_FIELDS}
    FROM ${TB} ba
    INNER JOIN ${TB_BANKS} b ON b.id = ba.bank_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ba.is_default DESC, ba.name ASC, ba.id ASC;
  `, params);
  return rows;
}

export async function getBankAccountById(value, db = pool) {
  const id = positiveId(value);
  if (!id) return null;
  const { rows } = await db.query(`
    SELECT ${SELECT_FIELDS}
    FROM ${TB} ba
    INNER JOIN ${TB_BANKS} b ON b.id = ba.bank_id
    WHERE ba.id = $1;
  `, [id]);
  return rows[0] || null;
}
