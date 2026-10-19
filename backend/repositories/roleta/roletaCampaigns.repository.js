// ╔════════════════════════════════════════════════════════════════════╗
// ║ roletaCampaigns.repository.js — Campanhas (ADMIN)                  ║
// ║ listCampaigns / createCampaign                                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAMPAIGNS } from './roleta.constants.js';

export async function listCampaigns({ q }) {
  const params = [];
  let where = 'WHERE 1=1';

  if (q) {
    params.push(`%${q}%`);
    where += ` AND name ILIKE $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT id, name, is_active, max_spins_per_customer
     FROM ${TB_CAMPAIGNS}
     ${where}
     ORDER BY id DESC
     LIMIT 200`,
    params
  );

  return rows;
}

export async function createCampaign({ name, description, starts_at, ends_at, max_spins_per_customer, is_active }) {
  const { rows } = await pool.query(
    `INSERT INTO ${TB_CAMPAIGNS}
      (name, description, starts_at, ends_at, max_spins_per_customer, is_active)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, name`,
    [name, description || null, starts_at || null, ends_at || null, max_spins_per_customer, is_active]
  );
  return rows[0];
}
