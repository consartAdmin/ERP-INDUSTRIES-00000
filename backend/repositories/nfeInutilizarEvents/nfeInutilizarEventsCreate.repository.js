// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEventsCreate.repository.js — create                     ║
// ║ Tabela: public."nfeInutilizarEvents"                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './nfeInutilizarEvents.constants.js';
import { RETURNING_FIELDS } from './nfeInutilizarEvents.sql.js';
import {
  normalizeDigits,
  toInt,
  nowYear,
  normalizeStatusValue,
} from './nfeInutilizarEvents.sanitizers.js';
import { mapRow } from './nfeInutilizarEvents.mappers.js';

/* =======================================================================
 * Create
 * ======================================================================= */
export async function create(payload = {}) {
  const companyCnpj = normalizeDigits(payload.companyCnpj);
  const model = String(payload.model || '55').trim();
  const serie = toInt(payload.serie);
  const numberStart = toInt(payload.numberStart);
  const numberEnd = toInt(payload.numberEnd);
  const year = toInt(payload.year || nowYear());
  const justification = String(payload.justification || '').trim();

  const status = normalizeStatusValue(payload.status || 'PENDING');
  const protocol = payload.protocol ? String(payload.protocol).trim() : null;
  const xmlRequest = payload.xmlRequest ? String(payload.xmlRequest) : null;
  const xmlResponse = payload.xmlResponse ? String(payload.xmlResponse) : null;
  const message = payload.message ? String(payload.message) : null;
  const requestPayload = payload.requestPayload ?? null;
  const responsePayload = payload.responsePayload ?? null;
  const locked = Boolean(payload.locked ?? false);

  const sql = `
    INSERT INTO ${TABLE} (
      companycnpj,
      model,
      serie,
      numberstart,
      numberend,
      year,
      justification,
      status,
      protocol,
      xmlrequest,
      xmlresponse,
      message,
      requestpayload,
      responsepayload,
      locked,
      createdat,
      updatedat
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),NOW()
    )
    RETURNING ${RETURNING_FIELDS}
  `;

  const values = [
    companyCnpj,
    model,
    serie,
    numberStart,
    numberEnd,
    year,
    justification,
    status,
    protocol,
    xmlRequest,
    xmlResponse,
    message,
    requestPayload,
    responsePayload,
    locked,
  ];

  const { rows } = await pool.query(sql, values);
  return mapRow(rows[0]);
}
