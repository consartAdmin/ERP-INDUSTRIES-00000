// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalanceMutation.repository.js — create / update /      ║
// ║ delete de conferências. system_balance = saldo do ERP na data      ║
// ║ usando a conferência ANTERIOR (difference é gerada pelo banco).    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB, TB_BANK_ACCOUNTS } from './bankAccountsBalance.constants.js';
import { httpError, requireId, isoDate, requireMoney, optionalText } from './bankAccountsBalance.sanitizers.js';
import { todayIso } from './bankAccountsBalance.utils.js';
import { calculateBalance } from './bankAccountsBalanceCalculate.repository.js';
import { getCheckpointById } from './bankAccountsBalanceQuery.repository.js';

async function ensureBankAccount(db, bankAccountId) {
  const { rows } = await db.query(
    `SELECT id, name FROM ${TB_BANK_ACCOUNTS} WHERE id = $1`,
    [bankAccountId]
  );
  if (!rows[0]) throw httpError('Conta bancária não encontrada.', 404);
  return rows[0];
}

export async function createCheckpoint(payload = {}, { user = null } = {}) {
  const bankAccountId = requireId(payload.bank_account_id, 'Conta bancária');
  const balanceDate = isoDate(payload.balance_date || todayIso(), 'Data da conferência');
  if (balanceDate > todayIso()) throw httpError('A data da conferência não pode ser futura.');
  const balance = requireMoney(payload.balance, 'o saldo do extrato');
  const notes = optionalText(payload.notes, 2000);

  await ensureBankAccount(pool, bankAccountId);

  const calc = await calculateBalance(bankAccountId, balanceDate, { beforeDate: true });

  const { rows } = await pool.query(
    `
    INSERT INTO ${TB} (bank_account_id, balance_date, balance, system_balance, notes, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [bankAccountId, balanceDate, balance, calc.balance, notes, optionalText(user, 150)]
  );
  return getCheckpointById(rows[0].id);
}

export async function updateCheckpoint(value, payload = {}) {
  const id = requireId(value);
  const current = await getCheckpointById(id);
  if (!current) return null;

  const balanceDate = payload.balance_date !== undefined
    ? isoDate(payload.balance_date, 'Data da conferência')
    : current.balance_date;
  if (balanceDate > todayIso()) throw httpError('A data da conferência não pode ser futura.');
  const balance = payload.balance !== undefined
    ? requireMoney(payload.balance, 'o saldo do extrato')
    : Number(current.balance);
  const notes = payload.notes !== undefined ? optionalText(payload.notes, 2000) : current.notes;

  // Recalcula o saldo do sistema para a (nova) data
  const calc = await calculateBalance(current.bank_account_id, balanceDate, {
    beforeDate: true,
    excludeId: id,
  });

  await pool.query(
    `
    UPDATE ${TB}
    SET balance_date = $1, balance = $2, system_balance = $3, notes = $4, updated_at = now()
    WHERE id = $5
    `,
    [balanceDate, balance, calc.balance, notes, id]
  );
  return getCheckpointById(id);
}

export async function deleteCheckpoint(value) {
  const id = requireId(value);
  const { rows } = await pool.query(`DELETE FROM ${TB} WHERE id = $1 RETURNING id`, [id]);
  return rows[0] ? { id: Number(rows[0].id) } : null;
}
