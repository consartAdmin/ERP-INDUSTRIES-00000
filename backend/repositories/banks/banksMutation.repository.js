// ╔════════════════════════════════════════════════════════════════════╗
// ║ banksMutation.repository.js — createBank / updateBank /            ║
// ║ deactivateBank | Tabela: public."banks"                            ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './banks.constants.js';
import { positiveId, optionalText } from './banks.sanitizers.js';
import { getBankById } from './banksQuery.repository.js';

export async function createBank(data = {}) {
  const name = optionalText(data.name, 150);
  const code = optionalText(data.code, 10);

  if (!name) throw Object.assign(new Error('Informe o nome do banco.'), { statusCode: 400 });

  const { rows } = await pool.query(`
    INSERT INTO ${TB} (code, name, is_active)
    VALUES ($1, $2, $3)
    RETURNING id, code, name, is_active, created_at, updated_at;
  `, [code, name, data.is_active !== false]);

  return rows[0];
}

export async function updateBank(value, data = {}) {
  const id = positiveId(value);
  if (!id) throw Object.assign(new Error('ID do banco inválido.'), { statusCode: 400 });

  const current = await getBankById(id);
  if (!current) return null;

  const name = data.name === undefined ? current.name : optionalText(data.name, 150);
  const code = data.code === undefined ? current.code : optionalText(data.code, 10);
  const isActive = data.is_active === undefined ? current.is_active : Boolean(data.is_active);

  if (!name) throw Object.assign(new Error('Informe o nome do banco.'), { statusCode: 400 });

  const { rows } = await pool.query(`
    UPDATE ${TB}
    SET code = $1, name = $2, is_active = $3, updated_at = now()
    WHERE id = $4
    RETURNING id, code, name, is_active, created_at, updated_at;
  `, [code, name, isActive, id]);

  return rows[0] || null;
}

export async function deactivateBank(value) {
  const id = positiveId(value);
  if (!id) throw Object.assign(new Error('ID do banco inválido.'), { statusCode: 400 });

  const { rows } = await pool.query(`
    UPDATE ${TB}
    SET is_active = FALSE, updated_at = now()
    WHERE id = $1
    RETURNING id, code, name, is_active, created_at, updated_at;
  `, [id]);

  return rows[0] || null;
}
