// ╔════════════════════════════════════════════════════════════════════╗
// ║ roletaTokens.repository.js — Tokens da Roleta                      ║
// ║ createToken / getTokenData / getTokenDataForUpdate / listTokensAdmin║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_CAMPAIGNS, TB_TOKENS } from './roleta.constants.js';
import { generateToken } from './roleta.utils.js';

/**
 * Create token for a customer + campaign
 * - Always generates a new unique token
 */
export async function createToken({ campaign_id, customer_id, expires_at }) {
  if (!campaign_id || !customer_id) {
    const err = new Error('campaign_id e customer_id são obrigatórios');
    err.status = 400;
    throw err;
  }

  const token = generateToken();

  await pool.query(
    `INSERT INTO ${TB_TOKENS} (campaign_id, customer_id, token, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [campaign_id, customer_id, token, expires_at || null]
  );

  return token;
}

/**
 * Returns token + campaign info
 */
export async function getTokenData(token) {
  const { rows } = await pool.query(
    `SELECT
        t.id              AS token_id,
        t.campaign_id,
        t.customer_id,
        t.token,
        t.expires_at,
        t.is_active       AS token_is_active,
        t.created_at      AS token_created_at,

        c.id              AS campaign_id2,
        c.name            AS campaign_name,
        c.max_spins_per_customer,
        c.starts_at,
        c.ends_at,
        c.is_active       AS campaign_is_active
     FROM ${TB_TOKENS} t
     JOIN ${TB_CAMPAIGNS} c ON c.id = t.campaign_id
     WHERE t.token = $1
     LIMIT 1`,
    [token]
  );

  return rows[0] || null;
}

/**
 * Locks token row for safe spin concurrency
 * IMPORTANT: must be called inside a transaction (client)
 */
export async function getTokenDataForUpdate(client, token) {
  const { rows } = await client.query(
    `SELECT
        t.id              AS token_id,
        t.campaign_id,
        t.customer_id,
        t.token,
        t.expires_at,
        t.is_active       AS token_is_active,
        t.created_at      AS token_created_at,

        c.name            AS campaign_name,
        c.max_spins_per_customer,
        c.starts_at,
        c.ends_at,
        c.is_active       AS campaign_is_active
     FROM ${TB_TOKENS} t
     JOIN ${TB_CAMPAIGNS} c ON c.id = t.campaign_id
     WHERE t.token = $1
     FOR UPDATE
     LIMIT 1`,
    [token]
  );

  return rows[0] || null;
}

export async function listTokensAdmin({ campaign_id, q }) {
  const params = [campaign_id];
  let where = `WHERE campaign_id = $1`;

  if (q) {
    params.push(`%${q}%`);
    where += ` AND (customer_id ILIKE $${params.length} OR token ILIKE $${params.length})`;
  }

  const { rows } = await pool.query(
    `SELECT id, campaign_id, customer_id, token, expires_at, is_active, created_at
     FROM ${TB_TOKENS}
     ${where}
     ORDER BY id DESC
     LIMIT 300`,
    params
  );
  return rows;
}
