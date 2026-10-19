// ╔════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.utils.js — Helpers de query, transação e números   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';

export async function q(text, params = []) {
  const res = await pool.query(text, params);
  return res;
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}
