// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveriesCreate.repository.js — create (upsert por      ║
// ║ order_id + nfe_key)                                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './signaturesDeliveries.constants.js';
import { normalizePayload } from './signaturesDeliveries.sanitizers.js';
import { rowToModel } from './signaturesDeliveries.mappers.js';

export async function create(data = {}) {
  const normalized = normalizePayload(data);

  if (!normalized.order_id) {
    throw new Error('order_id é obrigatório para a assinatura de entrega.');
  }
  if (!normalized.nfe_key) {
    throw new Error('nfe_key (chave da NF-e) é obrigatória.');
  }
  if (!normalized.signed_name) {
    throw new Error('signed_name (nome de quem recebeu) é obrigatório.');
  }
  if (!normalized.signature_image) {
    throw new Error('signature_image (imagem base64 da assinatura) é obrigatório.');
  }

  const cols = [];
  const vals = [];
  const placeholders = [];
  let i = 1;

  for (const [k, v] of Object.entries(normalized)) {
    if (v === undefined) continue;
    cols.push(k);
    vals.push(v);
    placeholders.push(`$${i}`);
    i++;
  }

  const sql = `
    INSERT INTO ${TB} (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (order_id, nfe_key)
    DO UPDATE SET
      signed_name     = EXCLUDED.signed_name,
      signature_image = EXCLUDED.signature_image,
      updated_at      = NOW()
    RETURNING *;
  `;

  const { rows } = await pool.query(sql, vals);
  return rowToModel(rows[0]);
}
