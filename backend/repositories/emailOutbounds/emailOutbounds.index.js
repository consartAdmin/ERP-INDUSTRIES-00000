// ╔════════════════════════════════════════════════════════════════════╗
// ║ emailOutbounds.index.js — ponto de entrada do módulo emailOutbounds║
// ║ Mantém a mesma API pública do antigo emailOutboundsApi.js          ║
// ╚════════════════════════════════════════════════════════════════════╝

import { EMAIL_OUTBOUNDS_TABLE } from './emailOutbounds.constants.js';
import { insertOutbound } from './emailOutboundsCreate.repository.js';
import { updateStatus } from './emailOutboundsUpdate.repository.js';
import { listOutbounds, getOutboundById } from './emailOutboundsQuery.repository.js';
import { clearOutbounds } from './emailOutboundsRemove.repository.js';

export { EMAIL_OUTBOUNDS_TABLE };

const emailOutboundsApi = {
  insertOutbound,
  updateStatus,
  listOutbounds,
  getOutboundById,
  clearOutbounds,

  async saveOutboundEmail(pgPool, emailPayload) {
    return emailOutboundsApi.insertOutbound(pgPool, emailPayload);
  },
};

export default emailOutboundsApi;
