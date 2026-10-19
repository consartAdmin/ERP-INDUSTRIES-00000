// ╔════════════════════════════════════════════════════════════════════╗
// ║ nfeStatusMap.mappers.js — Linha do banco → objeto de status NF-e   ║
// ╚════════════════════════════════════════════════════════════════════╝

export function mapRow(row) {
    if (!row) return null;

    return {
        nfe_status_id: Number(row.nfe_status_id),
        code: row.code,
        name: row.name,
        description: row.description,
        is_final: row.is_final,
        is_authorized: row.is_authorized,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
