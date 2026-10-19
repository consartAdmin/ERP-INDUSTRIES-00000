// Backend/repositories/sessionsRepo.js
const path = require('path');

function loadPool() {
  const tries = [
    path.join(__dirname, '..', 'db.js'),
    path.join(process.cwd(), 'backend', 'db.js'),
    path.join(process.cwd(), 'db.js'),
  ];
  for (const p of tries) {
    try {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      const mod = require(p);
      console.log('[sessionsRepo] DB via require:', p);
      return mod;
    } catch (e) { /* tenta o fallback */ }
  }
  console.warn('[sessionsRepo] db.js não encontrado. Usando Pool próprio (fallback).');
  const { Pool } = require('pg');
  const sslFlag = String(process.env.DB_SSL || 'false').trim().toLowerCase();
  const ssl = ['1','true','yes','y','on'].includes(sslFlag) ? { rejectUnauthorized: false } : false;

  return new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    ssl,
  });
}

const pool = loadPool();
const TABLE = 'sessions';

async function create({ session_id, user_id, user_agent, ip }) {
  const sql = `
    INSERT INTO ${TABLE} (session_id, user_id, user_agent, ip)
    VALUES ($1, $2, $3, $4)
    RETURNING session_id, user_id, created_at, last_activity, user_agent, ip, revoked
  `;
  const { rows } = await pool.query(sql, [session_id, user_id, user_agent || null, ip || null]);
  return rows[0];
}

async function getById(session_id) {
  const { rows } = await pool.query(
    `SELECT * FROM ${TABLE} WHERE session_id = $1 LIMIT 1`,
    [session_id]
  );
  return rows[0] || null;
}

async function updateLastActivity(session_id) {
  await pool.query(`UPDATE ${TABLE} SET last_activity = NOW() WHERE session_id = $1`, [session_id]);
}

async function revoke(session_id) {
  await pool.query(`UPDATE ${TABLE} SET revoked = TRUE WHERE session_id = $1`, [session_id]);
}

async function remove(session_id) {
  await pool.query(`DELETE FROM ${TABLE} WHERE session_id = $1`, [session_id]);
}

async function purgeIdleOlderThan(minutes = 30) {
  await pool.query(
    `DELETE FROM ${TABLE}
     WHERE revoked = FALSE
       AND last_activity < NOW() - ($1 || ' minutes')::interval`,
    [Math.max(1, Number(minutes))]
  );
}

module.exports = { create, getById, updateLastActivity, revoke, remove, purgeIdleOlderThan };
