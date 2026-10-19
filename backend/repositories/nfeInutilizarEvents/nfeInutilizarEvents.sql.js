// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.sql.js — Colunas de retorno e SELECT base        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TABLE } from './nfeInutilizarEvents.constants.js';

/* =======================================================================
 * SQL BASE
 * ======================================================================= */
export const RETURNING_FIELDS = `
  id,
  companycnpj AS "companyCnpj",
  model AS "model",
  serie AS "serie",
  numberstart AS "numberStart",
  numberend AS "numberEnd",
  year AS "year",
  justification AS "justification",
  status AS "status",
  protocol AS "protocol",
  xmlrequest AS "xmlRequest",
  xmlresponse AS "xmlResponse",
  message AS "message",
  requestpayload AS "requestPayload",
  responsepayload AS "responsePayload",
  locked AS "locked",
  createdat AS "createdAt",
  updatedat AS "updatedAt"
`;

export const BASE_SELECT = `
  SELECT
    ${RETURNING_FIELDS}
  FROM ${TABLE}
`;
