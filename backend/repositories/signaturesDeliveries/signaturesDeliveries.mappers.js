// ╔════════════════════════════════════════════════════════════════════╗
// ║ signaturesDeliveries.mappers.js — rowToModel (normaliza saída)     ║
// ╚════════════════════════════════════════════════════════════════════╝

export function rowToModel(r) {
  if (!r) return null;
  return {
    id:              r.id,
    order_id:        r.order_id,
    nfe_key:         r.nfe_key,
    signed_name:     r.signed_name,
    signature_image: r.signature_image,
    created_at:      r.created_at,
    updated_at:      r.updated_at,
  };
}
