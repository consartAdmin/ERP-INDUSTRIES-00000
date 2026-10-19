// ╔════════════════════════════════════════════════════════════════════╗
// ║ mobilizedUpdate.repository.js — updateMobilized                    ║
// ║ Tabela: public.mobilized                                           ║
// ╚════════════════════════════════════════════════════════════════════╝

import { TB_M } from './mobilized.constants.js';
import { asInt, asNumericStr, safeStr } from './mobilized.sanitizers.js';
import { q } from './mobilized.utils.js';
import { getMobilizedById } from './mobilizedQuery.repository.js';

export async function updateMobilized(mobilized_id, data = {}) {
  const id = asInt(mobilized_id);
  if (!id) throw new Error('invalid mobilized_id');

  const set = [];
  const params = [];

  function add(col, val) {
    params.push(val);
    set.push(`${col} = $${params.length}`);
  }

  if (data.external_ref !== undefined) add('external_ref', safeStr(data.external_ref, 80) || null);
  if (data.source_system !== undefined) add('source_system', safeStr(data.source_system, 60) || null);
  if (data.acquired_at !== undefined) add('acquired_at', data.acquired_at ? new Date(data.acquired_at) : null);

  if (data.title !== undefined) {
    const t = safeStr(data.title, 180);
    if (!t) throw new Error('title cannot be empty');
    add('title', t);
  }
  if (data.notes !== undefined) add('notes', data.notes != null ? String(data.notes) : null);
  if (data.status !== undefined) add('status', safeStr(data.status, 20));

  // PDF metadata
  if (data.pdf_storage !== undefined) add('pdf_storage', safeStr(data.pdf_storage, 30));
  if (data.pdf_path !== undefined) add('pdf_path', data.pdf_path != null ? String(data.pdf_path) : null);
  if (data.pdf_filename !== undefined) add('pdf_filename', safeStr(data.pdf_filename, 255) || null);
  if (data.pdf_mime !== undefined) add('pdf_mime', safeStr(data.pdf_mime, 80) || 'application/pdf');
  if (data.pdf_size_bytes !== undefined) add('pdf_size_bytes', data.pdf_size_bytes === null ? null : asNumericStr(data.pdf_size_bytes));
  if (data.pdf_sha256 !== undefined) add('pdf_sha256', safeStr(data.pdf_sha256, 64) || null);
  if (data.pdf_uploaded_at !== undefined) add('pdf_uploaded_at', data.pdf_uploaded_at ? new Date(data.pdf_uploaded_at) : null);
  if (data.pdf_version !== undefined) add('pdf_version', asInt(data.pdf_version) || 1);

  if (!set.length) return await getMobilizedById(id);

  const sql = `
    UPDATE ${TB_M}
    SET ${set.join(', ')}, updated_at = NOW()
    WHERE mobilized_id = $${params.length + 1}
    RETURNING *;
  `;
  params.push(id);

  const res = await q(sql, params);
  return res.rows[0] || null;
}
