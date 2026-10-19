// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersIbge.mappers.js — Linha do banco → objeto da API          ║
// ╚════════════════════════════════════════════════════════════════════╝

export function rowToCustomersIbge(row) {
  if (!row) return null;
  return {
    customer_id: Number(row.customer_id),
    uf: row.uf?.trim?.() ?? row.uf,
    city: row.city,
    codigo_ibge: row.codigo_ibge?.trim?.() ?? row.codigo_ibge ?? null,
    source: row.source ?? 'manual',
    confidence: Number(row.confidence ?? 100),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
