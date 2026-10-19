// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomerCreate.repository.js — createSellerForCustomer    ║
// ║ Tabela: public."SellerForCustomer"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { tbl } from './sellerForCustomer.constants.js';
import { toInt } from './sellerForCustomer.sanitizers.js';
import { q } from './sellerForCustomer.utils.js';

export async function createSellerForCustomer(payload = {}) {
  const sid = toInt(payload.seller_id);
  const cid = toInt(payload.customer_id);

  if (!sid || !cid) throw new Error('seller_id and customer_id are required');

  const active = payload.active === undefined || payload.active === null ? true : !!payload.active;

  const sql = `
    INSERT INTO ${tbl()} (seller_id, customer_id, active)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  try {
    const res = await q(sql, [sid, cid, active]);
    return res.rows[0];
  } catch (err) {
    if (err?.code === '23505') {
      const e = new Error('This seller is already linked to this customer.');
      e.code = 'DUPLICATE_RELATION';
      throw e;
    }
    throw err;
  }
}
