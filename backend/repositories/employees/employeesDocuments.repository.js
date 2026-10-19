// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesDocuments.repository.js — CRUD de documentos (DB)           ║
// ║ Tabela: public."employeesDocuments"                                  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { TB_DOCS, PK_DOCS } from './employees.constants.js';
import { ensureTable } from './employeesSchema.repository.js';
import { normalizeDocPayload } from './employees.sanitizers.js';
import {
  toNumOrNull,
  toStrOrNull,
  ensureEmployeesBucket,
  assertEmployeesObjectPath,
} from './employees.utils.js';

// ─────────────────────────────────────────────────────────────
// Documents CRUD (DB)
// ─────────────────────────────────────────────────────────────
export async function listDocuments(employeeId, { active = true, limit = 50, offset = 0 } = {}) {
  await ensureTable();

  const params = [Number(employeeId)];
  let where = `WHERE employee_id = $1`;

  if (active !== undefined && active !== null && active !== '') {
    params.push(!!active);
    where += ` AND is_active = $${params.length}`;
  }

  const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM ${TB_DOCS} ${where}`, params);
  const total = countRes.rows?.[0]?.total || 0;

  const { rows } = await pool.query(
    `
      SELECT *
      FROM ${TB_DOCS}
      ${where}
      ORDER BY created_at DESC, ${PK_DOCS} DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `,
    params
  );

  return { rows, total, limit: Number(limit), offset: Number(offset) };
}

export async function getDocumentById(documentId) {
  await ensureTable();
  const { rows } = await pool.query(`SELECT * FROM ${TB_DOCS} WHERE ${PK_DOCS} = $1 LIMIT 1`, [Number(documentId)]);
  return rows[0] || null;
}

export async function createDocument(employeeId, input = {}) {
  await ensureTable();

  const data = normalizeDocPayload({ ...input, employee_id: employeeId });

  if (!data.employee_id) throw new Error('employee_id is required');
  if (!data.document_type) throw new Error('document_type is required');
  if (!data.file_name) throw new Error('file_name is required');

  // ✅ trava bucket/prefix corretos
  data.gcs_bucket = ensureEmployeesBucket();
  data.gcs_path = assertEmployeesObjectPath(data.gcs_path);

  if (!data.mime_type) data.mime_type = 'application/octet-stream';
  if (data.file_size == null) data.file_size = 0;
  if (data.is_active == null) data.is_active = true;

  const cols = Object.keys(data);
  const vals = Object.values(data);
  const params = vals.map((_, i) => `$${i + 1}`);

  const { rows } = await pool.query(
    `INSERT INTO ${TB_DOCS} (${cols.join(', ')}) VALUES (${params.join(', ')}) RETURNING *;`,
    vals
  );

  return rows[0];
}

export async function updateDocument(documentId, input = {}) {
  await ensureTable();

  const data = {};
  if (input.document_type !== undefined) data.document_type = toStrOrNull(input.document_type);
  if (input.file_name !== undefined) data.file_name = toStrOrNull(input.file_name);
  if (input.notes !== undefined) data.notes = toStrOrNull(input.notes);

  // ✅ troca de arquivo (novo upload já feito via signUpload)
  if (toStrOrNull(input.gcs_path)) {
    data.gcs_bucket = ensureEmployeesBucket();
    data.gcs_path = assertEmployeesObjectPath(input.gcs_path);
    data.mime_type = toStrOrNull(input.mime_type) || 'application/octet-stream';
    data.file_size = toNumOrNull(input.file_size) ?? 0;
  }

  if (data.document_type === null || data.file_name === null) {
    const err = new Error('document_type e file_name não podem ser vazios.');
    err.code = 'VALIDATION';
    throw err;
  }

  if (!Object.keys(data).length) return getDocumentById(documentId);

  const sets = [];
  const vals = [];

  Object.entries(data).forEach(([col, val]) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  });

  sets.push(`updated_at = NOW()::timestamp`);

  const { rows } = await pool.query(
    `UPDATE ${TB_DOCS} SET ${sets.join(', ')} WHERE ${PK_DOCS} = $${vals.length + 1} RETURNING *;`,
    [...vals, Number(documentId)]
  );

  return rows[0] || null;
}

export async function deleteDocument(documentId, { hard = false } = {}) {
  await ensureTable();

  if (hard) {
    await pool.query(`DELETE FROM ${TB_DOCS} WHERE ${PK_DOCS} = $1`, [Number(documentId)]);
    return { ok: true, hard: true };
  }

  await pool.query(`UPDATE ${TB_DOCS} SET is_active = FALSE, updated_at = NOW()::timestamp WHERE ${PK_DOCS} = $1`, [Number(documentId)]);
  return { ok: true, hard: false };
}
