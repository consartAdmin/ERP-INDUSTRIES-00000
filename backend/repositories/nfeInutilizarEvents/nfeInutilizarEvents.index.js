// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.index.js — ponto de entrada (inutilização NF-e)  ║
// ║ Mantém a mesma API pública do antigo nfeInutilizarEventsApi.js       ║
// ║ (somente export default, como no original)                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { create } from './nfeInutilizarEventsCreate.repository.js';
import {
  findById,
  findDuplicate,
  findOverlappingRange,
  findAuthorizedByNumberRange,
  list,
} from './nfeInutilizarEventsQuery.repository.js';
import {
  updateStatus,
  markSent,
  markAuthorized,
  markRejected,
  markError,
} from './nfeInutilizarEventsUpdate.repository.js';

/* =======================================================================
 * Export
 * ======================================================================= */
export default {
  create,
  findById,
  findDuplicate,
  findOverlappingRange, // 🔥 NOVO
  findAuthorizedByNumberRange,
  list,
  updateStatus,
  markSent,
  markAuthorized,
  markRejected,
  markError,
};
