// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomers.mappers.js — Linha do banco → documento      ║
// ║ (inclui status_visual NEW|VIEWED|DOWNLOADED)                       ║
// ╚════════════════════════════════════════════════════════════════════╝

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------
export const isFiniteNum = (v) => Number.isFinite(Number(v));

export function statusVisualFromRow(row) {
  if (row?.is_downloaded) return 'DOWNLOADED';
  if (row?.is_viewed) return 'VIEWED';
  return 'NEW';
}

export function rowToDoc(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    customer_id: Number(row.customer_id),
    customer_name: row.customer_name ?? null,

    doc_type: row.doc_type,
    title: row.title,
    description: row.description ?? null,

    competence_month: row.competence_month ?? null,
    competence_year: row.competence_year ?? null,

    file_name: row.file_name,
    file_url: row.file_url ?? null,
    mime_type: row.mime_type ?? null,
    file_size_bytes: isFiniteNum(row.file_size_bytes) ? Number(row.file_size_bytes) : null,

    storage_driver: row.storage_driver ?? null,
    gcs_bucket: row.gcs_bucket ?? null,
    gcs_key: row.gcs_key ?? null,

    status: row.status,

    // ✅ flags
    is_viewed: !!row.is_viewed,
    viewed_at: row.viewed_at ?? null,

    is_downloaded: !!row.is_downloaded,
    downloaded_at: row.downloaded_at ?? null,

    // ✅ derivado (UI)
    status_visual: statusVisualFromRow(row),

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
