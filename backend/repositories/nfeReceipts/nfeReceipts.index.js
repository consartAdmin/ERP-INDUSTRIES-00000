// ╔════════════════════════════════════════════════════════════════════════╗
// ║ repositories/nfeReceipts — ponto de entrada único                      ║
// ║ Mantém a mesma API pública do antigo services/apis/nfeReceiptsApi.js   ║
// ╚════════════════════════════════════════════════════════════════════════╝

import { ensureTable } from './nfeReceiptsSchema.repository.js';
import {
  createPendingReceiptByNfeId,
  createPendingReceiptByNfeNumber,
} from './nfeReceiptsCreate.repository.js';
import {
  getByAccessKey,
  getByNfeNumber,
  getByNfeId,
} from './nfeReceiptsGet.repository.js';
import {
  signReceiptByAccessKey,
  signReceiptByNfeNumber,
} from './nfeReceiptsSign.repository.js';
import {
  refuseReceiptByAccessKey,
  refuseReceiptByNfeNumber,
} from './nfeReceiptsRefuse.repository.js';
import { listReceipts } from './nfeReceiptsQuery.repository.js';
import {
  getSignaturePngByAccessKey,
  getSignaturePngByNfeNumber,
} from './nfeReceiptsSignature.repository.js';

export {
  ensureTable,
  createPendingReceiptByNfeId,
  createPendingReceiptByNfeNumber,
  getByAccessKey,
  getByNfeNumber,
  getByNfeId,
  signReceiptByAccessKey,
  signReceiptByNfeNumber,
  refuseReceiptByAccessKey,
  refuseReceiptByNfeNumber,
  listReceipts,
  getSignaturePngByAccessKey,
  getSignaturePngByNfeNumber,
};

export default {
  ensureTable,
  createPendingReceiptByNfeId,
  createPendingReceiptByNfeNumber,
  getByAccessKey,
  getByNfeNumber,
  getByNfeId,
  signReceiptByAccessKey,
  signReceiptByNfeNumber,
  refuseReceiptByAccessKey,
  refuseReceiptByNfeNumber,
  listReceipts,
  getSignaturePngByAccessKey,
  getSignaturePngByNfeNumber,
};
