// ╔════════════════════════════════════════════════════════════════════╗
// ║ ordersDeliveryUpsert.repository.js — upsertByOrderId               ║
// ║ Tabela: public."ordersDelivery"                                    ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB } from './ordersDelivery.constants.js';
import { toInt, normalizePayload } from './ordersDelivery.sanitizers.js';

export async function upsertByOrderId(orderId, payload = {}, db = pool) {
  const id = toInt(orderId);
  if (!id || id <= 0) throw new Error('order_id inválido');

  const p = normalizePayload(payload);

  const sql = `
      INSERT INTO ${TB} (
        order_id,
        freight_mode, freight_value,
        carrier_name, carrier_cnpj_cpf, carrier_ie, carrier_address, carrier_city, carrier_uf,
        antt_code, vehicle_plate, vehicle_uf,
        volume_quantity, volume_species, volume_brand, volume_numbering,
        gross_weight, net_weight
      ) VALUES (
        $1,
        $2,$3,
        $4,$5,$6,$7,$8,$9,
        $10,$11,$12,
        $13,$14,$15,$16,
        $17,$18
      )
      ON CONFLICT (order_id)
DO UPDATE SET
  freight_mode     = EXCLUDED.freight_mode,
  freight_value    = EXCLUDED.freight_value,

  carrier_name     = COALESCE(EXCLUDED.carrier_name, ${TB}.carrier_name),
  carrier_cnpj_cpf = COALESCE(EXCLUDED.carrier_cnpj_cpf, ${TB}.carrier_cnpj_cpf),
  carrier_ie       = COALESCE(EXCLUDED.carrier_ie, ${TB}.carrier_ie),
  carrier_address  = COALESCE(EXCLUDED.carrier_address, ${TB}.carrier_address),
  carrier_city     = COALESCE(EXCLUDED.carrier_city, ${TB}.carrier_city),
  carrier_uf       = COALESCE(EXCLUDED.carrier_uf, ${TB}.carrier_uf),

  antt_code        = COALESCE(EXCLUDED.antt_code, ${TB}.antt_code),
  vehicle_plate    = COALESCE(EXCLUDED.vehicle_plate, ${TB}.vehicle_plate),
  vehicle_uf       = COALESCE(EXCLUDED.vehicle_uf, ${TB}.vehicle_uf),

  volume_quantity  = COALESCE(EXCLUDED.volume_quantity, ${TB}.volume_quantity),
  volume_species   = COALESCE(EXCLUDED.volume_species, ${TB}.volume_species),
  volume_brand     = COALESCE(EXCLUDED.volume_brand, ${TB}.volume_brand),
  volume_numbering = COALESCE(EXCLUDED.volume_numbering, ${TB}.volume_numbering),

  gross_weight     = COALESCE(EXCLUDED.gross_weight, ${TB}.gross_weight),
  net_weight       = COALESCE(EXCLUDED.net_weight, ${TB}.net_weight),

  updated_at       = NOW()
      RETURNING *;
    `;

  const values = [
    id,
    p.freight_mode, p.freight_value,
    p.carrier_name, p.carrier_cnpj_cpf, p.carrier_ie, p.carrier_address, p.carrier_city, p.carrier_uf,
    p.antt_code, p.vehicle_plate, p.vehicle_uf,
    p.volume_quantity, p.volume_species, p.volume_brand, p.volume_numbering,
    p.gross_weight, p.net_weight,
  ];

  const r = await db.query(sql, values);
  return r.rows[0];
}
