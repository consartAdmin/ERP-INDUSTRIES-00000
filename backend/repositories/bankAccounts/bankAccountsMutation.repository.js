// ╔════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsMutation.repository.js — create / update / deactivate  ║
// ║ Tabela: public."bankAccounts" (conta padrão única)                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './bankAccounts.constants.js';
import { positiveId, normalizedPayload } from './bankAccounts.sanitizers.js';
import { getBankAccountById } from './bankAccountsQuery.repository.js';

async function saveBankAccount(client, id, payload) {
  if (payload.isDefault) {
    await client.query(`UPDATE ${TB} SET is_default = FALSE, updated_at = now() WHERE is_default = TRUE${id ? ' AND id <> $1' : ''};`, id ? [id] : []);
  }

  const values = [payload.bankId, payload.name, payload.agency, payload.accountNumber,
    payload.accountDigit, payload.provider, payload.boletoMode, payload.isDefault, payload.isActive];

  if (!id) {
    const { rows } = await client.query(`
      INSERT INTO ${TB} (bank_id, name, agency, account_number, account_digit,
        integration_provider, boleto_mode, is_default, is_active)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id;
    `, values);
    return rows[0].id;
  }

  await client.query(`
    UPDATE ${TB}
    SET bank_id=$1, name=$2, agency=$3, account_number=$4, account_digit=$5,
      integration_provider=$6, boleto_mode=$7, is_default=$8, is_active=$9,
      updated_at=now()
    WHERE id=$10;
  `, [...values, id]);
  return id;
}

export async function createBankAccount(data = {}) {
  const payload = normalizedPayload(data);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await saveBankAccount(client, null, payload);
    const result = await getBankAccountById(id, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function updateBankAccount(value, data = {}) {
  const id = positiveId(value);
  if (!id) throw Object.assign(new Error('ID da conta bancária inválido.'), { statusCode: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await getBankAccountById(id, client);
    if (!current) { await client.query('ROLLBACK'); return null; }
    const payload = normalizedPayload(data, current);
    await saveBankAccount(client, id, payload);
    const result = await getBankAccountById(id, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function deactivateBankAccount(value) {
  const id = positiveId(value);
  if (!id) throw Object.assign(new Error('ID da conta bancária inválido.'), { statusCode: 400 });
  const { rows } = await pool.query(`
    UPDATE ${TB}
    SET is_active=FALSE, is_default=FALSE, updated_at=now()
    WHERE id=$1 RETURNING id;
  `, [id]);
  return rows[0] ? getBankAccountById(id) : null;
}
