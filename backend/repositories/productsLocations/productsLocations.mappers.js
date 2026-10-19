// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productsLocations.mappers.js — Linha do banco → objeto da API        ║
// ╚══════════════════════════════════════════════════════════════════════╝

/* ────────────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────────── */
export function normalizeRow(r = {}) {
  return {
    id: r.id != null ? Number(r.id) : null,
    product_code: r.product_code ?? null,

    // ✅ descrição do produto (join)
    product_description: r.product_description ?? null,

    // ✅ barcode (join) — se você não quiser retornar, pode ignorar no frontend
    barcode: r.barcode ?? null,

    store_id: r.store_id != null ? Number(r.store_id) : null,
    corredor: r.corredor ?? null,
    prateleira: r.prateleira ?? null,
    bandeja: r.bandeja ?? null,
    box: r.box ?? null,
    observacao: r.observacao ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    is_active: !!r.is_active,

    // ✅ é a localização principal do produto (products.product_location_id)
    is_primary: !!r.is_primary,
  };
}
