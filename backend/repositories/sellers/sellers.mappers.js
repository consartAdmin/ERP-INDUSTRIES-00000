// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellers.mappers.js — rowToModel (normaliza saída)                  ║
// ╚════════════════════════════════════════════════════════════════════╝

import { toNumOrNull } from './sellers.sanitizers.js';

export function rowToModel(r) {
  if (!r) return null;
  return {
    id:               r.id,
    name:             r.name,
    nickname:         r.nickname,
    document:         r.document,
    email:            r.email,
    phone:            r.phone,
    mobile:           r.mobile,
    active:           r.active !== false, // default true
    commission_type:  r.commission_type || 'PERCENT',
    commission_value: toNumOrNull(r.commission_value) ?? 0,
    observations:     r.observations,
    created_at:       r.created_at,
    updated_at:       r.updated_at,
  };
}
