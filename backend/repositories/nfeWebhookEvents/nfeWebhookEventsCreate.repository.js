// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeWebhookEventsCreate.repository.js — insertWebhookEvent            ║
// ║ NÃO cria pool: sempre receber pgPool como argumento                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { TB } from './nfeWebhookEvents.constants.js';

/**
 * Insere um evento de webhook.
 * @param {import('pg').Pool} pgPool
 * @param {object} eventData
 * @returns {Promise<object>} linha inserida
 */
export async function insertWebhookEvent(pgPool, eventData) {
  const {
    emitter_cnpj,
    integration_id = null,
    plugnotas_uuid = null,
    chave_acesso = null,
    numero_nfe = null,
    serie = null,
    status = null,
    cstat = null,
    motivo = null,
    tipo_evento = null,
    raw_payload
  } = eventData;

  if (!emitter_cnpj) {
    throw new Error('emitter_cnpj é obrigatório');
  }
  if (!raw_payload) {
    throw new Error('raw_payload (JSON) é obrigatório');
  }

  const result = await pgPool.query(
    `
    INSERT INTO ${TB} (
      emitter_cnpj, integration_id, plugnotas_uuid, chave_acesso,
      numero_nfe, serie, status, cstat, motivo, tipo_evento, raw_payload
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
    )
    RETURNING *;
    `,
    [
      emitter_cnpj,
      integration_id,
      plugnotas_uuid,
      chave_acesso,
      numero_nfe,
      serie,
      status,
      cstat,
      motivo,
      tipo_evento,
      raw_payload
    ]
  );

  return result.rows[0];
}
