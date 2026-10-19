// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersSchema.repository.js — ensureTables                            ║
// ║ Cria tabelas auxiliares de pagamento                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { DDL } from './orders.schema.js';

export async function ensureTables() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(DDL.orders_payments);
    await client.query(DDL.orders_payment_installments);
    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, error: String(err.message || err) };
  } finally {
    client.release();
  }
}
