// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByOrdersUpsert.repository.js — upsertForOrder / patchSeller  ║
// ║ Tabela: public."sellerByOrders"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './sellerByOrders.constants.js';
import { ok, bad } from './sellerByOrders.utils.js';

export async function upsertForOrder(orderId, payload = {}) {
  const id = Number(orderId);
  if (!Number.isFinite(id) || id <= 0) return bad('orderId inválido');

  const sellerId = Number(payload.seller_id);
  if (!Number.isFinite(sellerId) || sellerId <= 0) return bad('seller_id inválido');

  const role = (payload.role || 'PRINCIPAL').toString().trim().toUpperCase();

  const commissionPct = Number(payload.commission_pct || 0);
  const commissionValue = Number(payload.commission_value || 0);

  const sellerName = payload.seller_name ?? null;
  const sellerEmail = payload.seller_email ?? null;
  const sellerPhone = payload.seller_phone ?? null;
  const notes = payload.notes ?? null;

  const { rows } = await pool.query(
    `
    INSERT INTO ${TB}
      (order_id, seller_id, seller_name, seller_email, seller_phone, role, commission_pct, commission_value, notes)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT (order_id, seller_id)
    DO UPDATE SET
      seller_name = EXCLUDED.seller_name,
      seller_email = EXCLUDED.seller_email,
      seller_phone = EXCLUDED.seller_phone,
      role = EXCLUDED.role,
      commission_pct = EXCLUDED.commission_pct,
      commission_value = EXCLUDED.commission_value,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING *
    `,
    [id, sellerId, sellerName, sellerEmail, sellerPhone, role, commissionPct, commissionValue, notes]
  );

  return ok({ row: rows[0] });
}

export async function patchSeller(orderId, sellerId, patch = {}) {
  const oid = Number(orderId);
  const sid = Number(sellerId);
  if (!Number.isFinite(oid) || oid <= 0) return bad('orderId inválido');
  if (!Number.isFinite(sid) || sid <= 0) return bad('sellerId inválido');

  const sets = [];
  const args = [];
  let i = 1;

  const add = (col, val) => {
    sets.push(`${col} = $${i++}`);
    args.push(val);
  };

  if (patch.seller_name !== undefined) add('seller_name', patch.seller_name ?? null);
  if (patch.seller_email !== undefined) add('seller_email', patch.seller_email ?? null);
  if (patch.seller_phone !== undefined) add('seller_phone', patch.seller_phone ?? null);
  if (patch.role !== undefined) add('role', String(patch.role || 'PRINCIPAL').toUpperCase());
  if (patch.commission_pct !== undefined) add('commission_pct', Number(patch.commission_pct || 0));
  if (patch.commission_value !== undefined) add('commission_value', Number(patch.commission_value || 0));
  if (patch.notes !== undefined) add('notes', patch.notes ?? null);

  if (!sets.length) return bad('patch vazio');

  args.push(oid, sid);

  const { rows } = await pool.query(
    `
    UPDATE ${TB}
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE order_id = $${i++} AND seller_id = $${i++}
    RETURNING *
    `,
    args
  );

  if (!rows?.length) return bad('NOT_FOUND');
  return ok({ row: rows[0] });
}
