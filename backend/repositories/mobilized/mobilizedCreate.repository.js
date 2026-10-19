// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilizedCreate.repository.js — createMobilized                    ║
// ║ Tabela: public.mobilized                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_M } from './mobilized.constants.js';
import { now, asInt, asNumericStr, safeStr } from './mobilized.sanitizers.js';
import { q } from './mobilized.utils.js';

/* ──────────────────────────────────────────────────────────────
   Mobilized (CRUD)
────────────────────────────────────────────────────────────── */
export async function createMobilized(data = {}) {
  const title = safeStr(data.title, 180);
  if (!title) throw new Error('title is required');

  const external_ref = safeStr(data.external_ref, 80) || null;
  const source_system = safeStr(data.source_system, 60) || null;
  const acquired_at = data.acquired_at ? new Date(data.acquired_at) : now();
  const notes = data.notes != null ? String(data.notes) : null;
  const status = safeStr(data.status || 'ACTIVE', 20);

  const pdf_storage = safeStr(data.pdf_storage || 'local', 30);
  const pdf_path = data.pdf_path != null ? String(data.pdf_path) : null;
  const pdf_filename = safeStr(data.pdf_filename, 255) || null;
  const pdf_mime = safeStr(data.pdf_mime || 'application/pdf', 80);

  // schema: pdf_size_bytes é bigint; passamos como string/number
  const pdf_size_bytes = data.pdf_size_bytes === undefined ? null : asNumericStr(data.pdf_size_bytes);
  const pdf_sha256 = safeStr(data.pdf_sha256, 64) || null; // schema: character(64)
  const pdf_uploaded_at = data.pdf_uploaded_at ? new Date(data.pdf_uploaded_at) : null;
  const pdf_version = asInt(data.pdf_version) || 1;

  const sql = `
    INSERT INTO ${TB_M} (
      external_ref, source_system, acquired_at,
      title, notes, status,
      pdf_storage, pdf_path, pdf_filename, pdf_mime, pdf_size_bytes, pdf_sha256, pdf_uploaded_at, pdf_version,
      created_at, updated_at
    ) VALUES (
      $1,$2,$3,
      $4,$5,$6,
      $7,$8,$9,$10,$11,$12,$13,$14,
      NOW(), NOW()
    )
    RETURNING *;
  `;

  const params = [
    external_ref, source_system, acquired_at,
    title, notes, status,
    pdf_storage, pdf_path, pdf_filename, pdf_mime,
    pdf_size_bytes, pdf_sha256, pdf_uploaded_at, pdf_version,
  ];

  const res = await q(sql, params);
  return res.rows[0];
}
