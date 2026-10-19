// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomerRemove.repository.js — deleteSellerForCustomer    ║
// ║ Tabela: public."SellerForCustomer"                                 ║
// ╚════════════════════════════════════════════════════════════════════╝

import { tbl } from './sellerForCustomer.constants.js';
import { toInt } from './sellerForCustomer.sanitizers.js';
import { q } from './sellerForCustomer.utils.js';

export async function deleteSellerForCustomer(id) {
  const iid = toInt(id);
  if (!iid) return false;

  const res = await q(`DELETE FROM ${tbl()} WHERE id = $1 RETURNING id`, [iid]);
  return res.rowCount > 0;
}
