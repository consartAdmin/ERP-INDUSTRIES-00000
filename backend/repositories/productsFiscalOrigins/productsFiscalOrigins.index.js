// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsFiscalOrigins.index.js — Origem fiscal do produto            ║
// ║ Mantém a mesma API pública do antigo productsFiscalOriginsApi.js     ║
// ╚══════════════════════════════════════════════════════════════════════╝
//
// Persiste os valores fiscais calculados pela regra fiscal do produto para
// que a emissão de NF-e não dependa de "inboundInvoiceItems".
//
// A única fonte de cálculo é calculateForProduct(), que resolve a hierarquia
// "productsFiscalV2" -> "fiscalClassificationV2" -> "fiscalProfileV2" e
// nunca consulta NF-e de entrada.

import { ensureProductsFiscalOriginsTable } from './productsFiscalOriginsSchema.repository.js';
import { getById, getByProduct } from './productsFiscalOriginsQuery.repository.js';
import { resolveForItem } from './productsFiscalOriginsResolve.repository.js';
import { upsertFromFiscalRule } from './productsFiscalOriginsUpsert.repository.js';
import { remove } from './productsFiscalOriginsRemove.repository.js';

export {
  ensureProductsFiscalOriginsTable,
  getById,
  getByProduct,
  resolveForItem,
  upsertFromFiscalRule,
  remove,
};

export default {
  ensureProductsFiscalOriginsTable,
  getById,
  getByProduct,
  resolveForItem,
  upsertFromFiscalRule,
  remove,
};
