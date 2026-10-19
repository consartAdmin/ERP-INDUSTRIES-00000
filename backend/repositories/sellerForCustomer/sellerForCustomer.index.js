// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerForCustomer.index.js — ponto de entrada Vendedor ↔ Cliente   ║
// ║ Mantém a mesma API pública do antigo sellerForCustomerApi.js       ║
// ╚════════════════════════════════════════════════════════════════════╝

import {
  listSellerForCustomer,
  listByCustomerIds,
  getSellerForCustomerById,
  listCustomersBySeller,
  listSellersByCustomer,
  ping,
} from './sellerForCustomerQuery.repository.js';
import { createSellerForCustomer } from './sellerForCustomerCreate.repository.js';
import { updateSellerForCustomer } from './sellerForCustomerUpdate.repository.js';
import { deleteSellerForCustomer } from './sellerForCustomerRemove.repository.js';

export {
  listSellerForCustomer,
  listByCustomerIds,
  getSellerForCustomerById,
  createSellerForCustomer,
  updateSellerForCustomer,
  deleteSellerForCustomer,
  listCustomersBySeller,
  listSellersByCustomer,
  ping,
};

export default {
  listSellerForCustomer,
  listByCustomerIds,
  getSellerForCustomerById,
  createSellerForCustomer,
  updateSellerForCustomer,
  deleteSellerForCustomer,
  listCustomersBySeller,
  listSellersByCustomer,
  ping,
};
