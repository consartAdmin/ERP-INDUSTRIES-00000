// ╔════════════════════════════════════════════════════════════════════╗
// ║ ibgeLocations.mappers.js — Linha do banco → objeto (rowToModel)    ║
// ╚════════════════════════════════════════════════════════════════════╝

/* =======================================================================
 * rowToModel — normaliza saída
 * ======================================================================= */
export function rowToModel(r) {
  if (!r) return null;
  return {
    ibge_location_id: r.ibge_location_id,
    state: r.state,
    city: r.city,
    ibge_code: r.ibge_code,
    status: r.status !== false,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
