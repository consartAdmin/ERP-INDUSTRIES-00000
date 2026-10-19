// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomerUpdate.repository.js — updateSellerForCustomer    ║
// ║ Tabela: public."SellerForCustomer"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { tbl } from './sellerForCustomer.constants.js';
import { toInt } from './sellerForCustomer.sanitizers.js';
import { q } from './sellerForCustomer.utils.js';
import { getSellerForCustomerById } from './sellerForCustomerQuery.repository.js';

export async function updateSellerForCustomer(id, payload = {}) {
  const iid = toInt(id);
  if (!iid) throw new Error('invalid id');

  const sets = [];
  const params = [];
  let i = 1;

  if (payload.seller_id !== undefined) {
    const sid = payload.seller_id === null ? null : toInt(payload.seller_id);
    sets.push(`seller_id = $${i++}`);
    params.push(sid);
  }

  if (payload.customer_id !== undefined) {
    const cid = payload.customer_id === null ? null : toInt(payload.customer_id);
    sets.push(`customer_id = $${i++}`);
    params.push(cid);
  }

  if (payload.active !== undefined) {
    sets.push(`active = $${i++}`);
    params.push(payload.active === null ? null : !!payload.active);
  }

  if (!sets.length) return getSellerForCustomerById(iid);

  sets.push(`updated_at = NOW()`);

  const sql = `
    UPDATE ${tbl()}
       SET ${sets.join(', ')}
     WHERE id = $${i}
     RETURNING *;
  `;

  try {
    const res = await q(sql, [...params, iid]);
    return res.rows[0] || null;
  } catch (err) {
    if (err?.code === '23505') {
      const e = new Error('This seller is already linked to this customer.');
      e.code = 'DUPLICATE_RELATION';
      throw e;
    }
    throw err;
  }
}
