// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersNfeAttempts.index.js — Tentativas de NF-e                      ║
// ║ Mantém a mesma API pública do antigo ordersNfeAttemptsApi.js         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { createAttempt, addItems, replaceItems } from './ordersNfeAttemptsCreate.repository.js';
import { getById, getLatestByOrderId, getLatestTrackableByOrderId, list } from './ordersNfeAttemptsQuery.repository.js';
import { updateAttempt, markAuthorized, markRejected, markChecked, attachInvoice } from './ordersNfeAttemptsUpdate.repository.js';
import { reserveNfeNumberForAttempt, issueOrderNfe } from './ordersNfeAttemptsIssue.repository.js';
import { cancelOrderNfe } from './ordersNfeAttemptsCancel.repository.js';
import { reconcileOrderNfe } from './ordersNfeAttemptsReconcile.repository.js';

export {
  createAttempt,
  addItems,
  replaceItems,
  getById,
  getLatestByOrderId,
  getLatestTrackableByOrderId,
  list,
  updateAttempt,
  markAuthorized,
  markRejected,
  markChecked,
  attachInvoice,
  issueOrderNfe,
  cancelOrderNfe,
  reconcileOrderNfe,
};

export default {
    createAttempt,
    addItems,
    replaceItems,
    getById,
    getLatestByOrderId,
    getLatestTrackableByOrderId,
    list,
    updateAttempt,
    markAuthorized,
    markRejected,
    markChecked,
    attachInvoice,
    reserveNfeNumberForAttempt,
    issueOrderNfe,
    cancelOrderNfe,
    reconcileOrderNfe,
};
