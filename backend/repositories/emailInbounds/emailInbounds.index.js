// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailInbounds.index.js — ponto de entrada do módulo emailInbounds  ║
// ║ Mantém a mesma API pública do antigo emailInboundsApi.js           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_INBOUNDS_TABLE } from './emailInbounds.constants.js';
import { saveInboundEmail } from './emailInboundsCreate.repository.js';
import { listInbounds, getInboundById, countUnreadInbounds } from './emailInboundsQuery.repository.js';
import { markInboundAsRead } from './emailInboundsUpdate.repository.js';
import { clearInbounds } from './emailInboundsRemove.repository.js';

export {
  EMAIL_INBOUNDS_TABLE,
  saveInboundEmail,
  listInbounds,
  getInboundById,
  countUnreadInbounds,
  markInboundAsRead,
  clearInbounds,
};

const emailInboundsApi = {
  EMAIL_INBOUNDS_TABLE,

  saveInboundEmail,
  listInbounds,
  getInboundById,
  countUnreadInbounds,
  markInboundAsRead,
  clearInbounds,
};

export default emailInboundsApi;
