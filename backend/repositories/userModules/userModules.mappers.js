// ╔════════════════════════════════════════════════════════════════════╗
// ║ userModules.mappers.js — Linha do banco → objeto de domínio        ║
// ╚════════════════════════════════════════════════════════════════════╝

/** Mapeia a linha crua do banco para objeto de domínio */
export function mapRow(r = {}) {
  return {
    id: r.id,
    usuario_id: r.usuario_id,
    modulo_id: r.modulo_id,
    pode_acessar: r.pode_acessar,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
