// ╔════════════════════════════════════════════════════════════════════╗
// ║ roletaSpins.repository.js — Giros da Roleta                        ║
// ║ countCustomerSpins / saveSpin / listSpinsAdmin                     ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_SPINS } from './roleta.constants.js';

export async function countCustomerSpins(clientOrPool, campaign_id, customer_id) {
  const runner = clientOrPool?.query ? clientOrPool : pool;
  const { rows } = await runner.query(
    `SELECT COUNT(*)::int AS count
     FROM ${TB_SPINS}
     WHERE campaign_id=$1 AND customer_id=$2`,
    [campaign_id, customer_id]
  );
  return rows[0]?.count ?? 0;
}

/**
 * Save spin (inside transaction if needed)
 */
export async function saveSpin(clientOrPool, { campaign_id, customer_id, token, product_code }) {
  const runner = clientOrPool?.query ? clientOrPool : pool;

  await runner.query(
    `INSERT INTO ${TB_SPINS}
     (campaign_id, customer_id, token, product_code)
     VALUES ($1,$2,$3,$4)`,
    [campaign_id, customer_id, token, product_code]
  );
}

export async function listSpinsAdmin({ campaign_id, customer_id }) {
  const params = [campaign_id];
  let where = `WHERE s.campaign_id = $1`;

  if (customer_id) {
    params.push(customer_id);
    where += ` AND s.customer_id = $${params.length}`;
  }

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.campaign_id, s.customer_id, s.token, s.product_code, s.created_at,
              pr.name AS product_name
       FROM ${TB_SPINS} s
       LEFT JOIN public.products pr ON pr.product_code = s.product_code
       ${where}
       ORDER BY s.id DESC
       LIMIT 500`,
      params
    );
    return rows;
  } catch {
    const { rows } = await pool.query(
      `SELECT s.id, s.campaign_id, s.customer_id, s.token, s.product_code, s.created_at
       FROM ${TB_SPINS} s
       ${where}
       ORDER BY s.id DESC
       LIMIT 500`,
      params
    );
    return rows;
  }
}
