// Backend/repositories/sessionConfigRepo.js
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
      console.log('[sessionConfigRepo] DB via require:', p);
      return mod; // deve exportar o Pool
    } catch (e) { /* tenta o fallback */ }
  }

  // 🔁 Fallback: cria um Pool novo com envs
  console.warn('[sessionConfigRepo] db.js não encontrado. Usando Pool próprio (fallback).');
  const { Pool } = require('pg');
  const sslFlag = String(process.env.DB_SSL || 'false').trim().toLowerCase();
  const ssl = ['1','true','yes','y','on'].includes(sslFlag) ? { rejectUnauthorized: false } : false;

  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    ssl,
  });

  return pool;
}

const pool = loadPool();
const TABLE = '"sessionTimeOutConfig"'; // camelCase em PG precisa de aspas

async function getConfig() {
  const sql = `
    SELECT id, enabled, idle_minutes, warn_seconds, silent, redirect_url, updated_by, updated_at
    FROM ${TABLE}
    WHERE id = 1
  `;
  const { rows } = await pool.query(sql);
  return rows[0] || null;
}

async function upsertConfig(cfg, updatedBy) {
  const sql = `
    INSERT INTO ${TABLE}
      (id, enabled, idle_minutes, warn_seconds, silent, redirect_url, updated_by, updated_at)
    VALUES
      (1, $1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      enabled      = EXCLUDED.enabled,
      idle_minutes = EXCLUDED.idle_minutes,
      warn_seconds = EXCLUDED.warn_seconds,
      silent       = EXCLUDED.silent,
      redirect_url = EXCLUDED.redirect_url,
      updated_by   = EXCLUDED.updated_by,
      updated_at   = NOW()
    RETURNING id, enabled, idle_minutes, warn_seconds, silent, redirect_url, updated_by, updated_at
  `;
  const params = [
    !!cfg.enabled,
    Math.max(1, Number(cfg.idle_minutes)),
    Math.max(0, Number(cfg.warn_seconds)),
    !!cfg.silent,
    cfg.redirect_url,
    updatedBy || null,
  ];
  const { rows } = await pool.query(sql, params);
  return rows[0];
}

module.exports = { getConfig, upsertConfig };
