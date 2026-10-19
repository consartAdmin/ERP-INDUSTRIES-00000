// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEventsUpdate.repository.js — updateStatus + mark*       ║
// ║ Tabela: public."nfeInutilizarEvents"                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TABLE } from './nfeInutilizarEvents.constants.js';
import { RETURNING_FIELDS } from './nfeInutilizarEvents.sql.js';
import { toInt, normalizeStatusValue } from './nfeInutilizarEvents.sanitizers.js';
import { mapRow } from './nfeInutilizarEvents.mappers.js';
import { findById } from './nfeInutilizarEventsQuery.repository.js';

/* =======================================================================
 * Update
 * ======================================================================= */
export async function updateStatus(id, payload = {}) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (payload.status !== undefined) {
    fields.push(`status = $${idx++}`);
    values.push(normalizeStatusValue(payload.status));
  }

  if (payload.protocol !== undefined) {
    fields.push(`protocol = $${idx++}`);
    values.push(payload.protocol ? String(payload.protocol).trim() : null);
  }

  if (payload.xmlRequest !== undefined) {
    fields.push(`xmlrequest = $${idx++}`);
    values.push(payload.xmlRequest ? String(payload.xmlRequest) : null);
  }

  if (payload.xmlResponse !== undefined) {
    fields.push(`xmlresponse = $${idx++}`);
    values.push(payload.xmlResponse ? String(payload.xmlResponse) : null);
  }

  if (payload.message !== undefined) {
    fields.push(`message = $${idx++}`);
    values.push(payload.message ? String(payload.message) : null);
  }

  if (payload.requestPayload !== undefined) {
    fields.push(`requestpayload = $${idx++}`);
    values.push(payload.requestPayload ?? null);
  }

  if (payload.responsePayload !== undefined) {
    fields.push(`responsepayload = $${idx++}`);
    values.push(payload.responsePayload ?? null);
  }

  if (payload.locked !== undefined) {
    fields.push(`locked = $${idx++}`);
    values.push(Boolean(payload.locked));
  }

  if (fields.length === 0) {
    return findById(id);
  }

  fields.push(`updatedat = NOW()`);

  const sql = `
    UPDATE ${TABLE}
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING ${RETURNING_FIELDS}
  `;

  values.push(toInt(id));

  const { rows } = await pool.query(sql, values);
  return mapRow(rows[0]);
}

/* =======================================================================
 * Shortcuts
 * ======================================================================= */
export async function markSent(id, payload = {}) {
  return updateStatus(id, { ...payload, status: 'SENT', locked: false });
}

export async function markAuthorized(id, payload = {}) {
  return updateStatus(id, { ...payload, status: 'AUTHORIZED', locked: false });
}

export async function markRejected(id, payload = {}) {
  return updateStatus(id, { ...payload, status: 'REJECTED', locked: false });
}

export async function markError(id, payload = {}) {
  return updateStatus(id, { ...payload, status: 'ERROR', locked: false });
}
