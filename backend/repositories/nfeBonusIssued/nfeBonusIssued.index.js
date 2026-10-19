// ╔═══════════════════════════════════════════════════════════════════════╗
// ║ nfeBonusIssued.index.js — API Service de NF-e Bonificação             ║
// ║ Mantém a mesma API pública do antigo nfeBonusIssuedApi.js             ║
// ║ CONSART ERP | PostgreSQL | ESM                                        ║
// ║ ✅ CRUD do cabeçalho e dos itens da bonificação                        ║
// ║ ✅ Integração com produtos / grades / lotes                            ║
// ║ ✅ Operação fiscal BONUS via nfeOperationTypes                         ║
// ║ ✅ Não movimenta estoque enquanto estiver em DRAFT                     ║
// ╚═══════════════════════════════════════════════════════════════════════╝

import { ensureTables } from './nfeBonusIssuedSchema.repository.js';
import { getBonusOperation } from './nfeBonusIssuedLookup.repository.js';
import { create } from './nfeBonusIssuedCreate.repository.js';
import { getById } from './nfeBonusIssuedGetById.repository.js';
import { search } from './nfeBonusIssuedQuery.repository.js';
import { update } from './nfeBonusIssuedUpdate.repository.js';
import { remove } from './nfeBonusIssuedRemove.repository.js';
import { addItem } from './nfeBonusIssuedItemsCreate.repository.js';
import { listItems } from './nfeBonusIssuedItemsQuery.repository.js';
import { updateItem } from './nfeBonusIssuedItemsUpdate.repository.js';
import { removeItem } from './nfeBonusIssuedItemsRemove.repository.js';
import { recalculateBonusTotal } from './nfeBonusIssuedTotal.repository.js';
import { markReady } from './nfeBonusIssuedMarkReady.repository.js';
import { getBonusNfePreparedData, issueBonusNfe, reconcileBonusNfe, getBonusNfeXml, getBonusNfeDanfe } from './nfeBonusIssuedNfe.repository.js';

export {
  ensureTables,
  getBonusOperation,
  create,
  getById,
  search,
  update,
  remove,
  addItem,
  listItems,
  updateItem,
  removeItem,
  recalculateBonusTotal,
  markReady,
  getBonusNfePreparedData,
  issueBonusNfe,
  reconcileBonusNfe,
  getBonusNfeXml,
  getBonusNfeDanfe,
};

export default {
  ensureTables,

  getBonusOperation,

  create,
  getById,
  search,
  update,
  remove,

  addItem,
  listItems,
  updateItem,
  removeItem,

  recalculateBonusTotal,

  markReady,

  getBonusNfePreparedData,
  issueBonusNfe,
  reconcileBonusNfe,
  getBonusNfeXml,
  getBonusNfeDanfe,
};
