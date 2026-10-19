// ╔════════════════════════════════════════════════════════════════════╗
// ║ sellerByUser.mappers.js — Linha do banco → objeto                  ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normalizeRow(r) {
  if (!r) return null;

  // base
  const row = {
    id: Number(r.id),
    user_id: Number(r.user_id),
    seller_id: Number(r.seller_id),
    is_primary: !!r.is_primary,
    active: !!r.active,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };

  // extras (JOIN) — opcionais
  if (r.user_name !== undefined) row.user_name = r.user_name ?? null;
  if (r.user_email !== undefined) row.user_email = r.user_email ?? null;
  if (r.user_is_active !== undefined) row.user_is_active = r.user_is_active ?? null;

  if (r.seller_name !== undefined) row.seller_name = r.seller_name ?? null;
  if (r.seller_nickname !== undefined) row.seller_nickname = r.seller_nickname ?? null;
  if (r.seller_document !== undefined) row.seller_document = r.seller_document ?? null;
  if (r.seller_active !== undefined) row.seller_active = r.seller_active ?? null;

  return row;
}
