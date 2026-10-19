// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ employeesController.js — Controller (Employees + Docs + Signed URLs)     ║
// ║ CONSART ERP | ESM                                                       ║
// ║                                                                           ║
// ║ ✅ Usa UM ÚNICO service: employeesApi.js (DB + GCS Signed URLs)           ║
// ║ ✅ Bucket/prefix corretos (docs.consart-demo-infinity / doc.employees)    ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import employeesApi from '../repositories/employees/employees.index.js';

const ok = (res, body = {}) => res.json({ ok: true, ...body });
const fail = (res, status, error, details) =>
  res.status(status).json({ ok: false, error, details });

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const truthy = (v) =>
  ['true', '1', 't', 'yes', 'y', 'sim'].includes(String(v).toLowerCase());

// ─────────────────────────────────────────────────────────────
// Employees
// ─────────────────────────────────────────────────────────────
export async function listEmployees(req, res) {
  try {
    const q = String(req.query.q || '').trim();
    const activeParam = req.query.active;
    const active = activeParam === '' || activeParam == null ? null : truthy(activeParam);

    const limit = toNum(req.query.limit) ?? 50;
    const offset = toNum(req.query.offset) ?? 0;

    const data = await employeesApi.list({
      q,
      active: active === null ? '' : active,
      limit,
      offset,
    });

    return res.json(data);
  } catch (e) {
    console.error('[employeesController] listEmployees', e);
    return fail(res, 500, 'INTERNAL', e.message);
  }
}

export async function getEmployee(req, res) {
  try {
    const id = toNum(req.params.id);
    if (!id) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const row = await employeesApi.getById(id);
    if (!row) return fail(res, 404, 'NOT_FOUND', 'Colaborador não encontrado.');

    return res.json(row);
  } catch (e) {
    console.error('[employeesController] getEmployee', e);
    return fail(res, 500, 'INTERNAL', e.message);
  }
}

export async function createEmployee(req, res) {
  try {
    const saved = await employeesApi.create(req.body || {});
    return res.json(saved);
  } catch (e) {
    console.error('[employeesController] createEmployee', e);
    if (e?.code === '23505') return fail(res, 409, 'DUPLICATE', 'CPF já cadastrado.');
    return fail(res, 400, 'VALIDATION', e.message);
  }
}

export async function updateEmployee(req, res) {
  try {
    const id = toNum(req.params.id);
    if (!id) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const saved = await employeesApi.update(id, req.body || {});
    if (!saved) return fail(res, 404, 'NOT_FOUND', 'Colaborador não encontrado.');

    return res.json(saved);
  } catch (e) {
    console.error('[employeesController] updateEmployee', e);
    if (e?.code === '23505') return fail(res, 409, 'DUPLICATE', 'CPF já cadastrado.');
    return fail(res, 400, 'VALIDATION', e.message);
  }
}

export async function deleteEmployee(req, res) {
  try {
    const id = toNum(req.params.id);
    if (!id) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    const out = await employeesApi.remove(id, { hard });
    return ok(res, out);
  } catch (e) {
    console.error('[employeesController] deleteEmployee', e);
    return fail(res, 500, 'INTERNAL', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Documents (DB)
// ─────────────────────────────────────────────────────────────
export async function listEmployeeDocuments(req, res) {
  try {
    const employeeId = toNum(req.params.id);
    if (!employeeId) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const activeParam = req.query.active;
    const active = activeParam === '' || activeParam == null ? true : truthy(activeParam);

    const limit = toNum(req.query.limit) ?? 200;
    const offset = toNum(req.query.offset) ?? 0;

    const data = await employeesApi.listDocuments(employeeId, { active, limit, offset });
    return ok(res, data);
  } catch (e) {
    console.error('[employeesController] listEmployeeDocuments', e);
    return fail(res, 500, 'INTERNAL', e.message);
  }
}

export async function createEmployeeDocument(req, res) {
  try {
    const employeeId = toNum(req.params.id);
    if (!employeeId) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const b = req.body || {};
    const document_type = String(b.document_type || b.docType || '').trim();
    const file_name = String(b.file_name || b.filename || '').trim();
    const mime_type = String(b.mime_type || b.mimeType || b.contentType || 'application/octet-stream').trim();
    const file_size = Number(b.file_size || b.sizeBytes || 0);
    const gcs_path = String(b.gcs_path || b.object || '').trim();
    const notes = b.notes == null ? null : String(b.notes);

    if (!document_type || !file_name || !gcs_path) {
      return fail(res, 400, 'VALIDATION', 'document_type, file_name e gcs_path são obrigatórios.');
    }

    // ✅ bucket correto é travado no service (EMPLOYEES_GCS_BUCKET)
    const saved = await employeesApi.createDocument(employeeId, {
      document_type,
      file_name,
      mime_type,
      file_size,
      gcs_path,
      notes,
      is_active: true,
    });

    return ok(res, { document: saved });
  } catch (e) {
    console.error('[employeesController] createEmployeeDocument', e);
    return fail(res, e?.code === 'VALIDATION' ? 400 : 500, e?.code || 'INTERNAL', e.message);
  }
}

export async function getEmployeeDocument(req, res) {
  try {
    const documentId = toNum(req.params.documentId);
    if (!documentId) return fail(res, 400, 'VALIDATION', 'documentId inválido.');

    const row = await employeesApi.getDocumentById(documentId);
    if (!row) return fail(res, 404, 'NOT_FOUND', 'Documento não encontrado.');

    return res.json(row);
  } catch (e) {
    console.error('[employeesController] getEmployeeDocument', e);
    return fail(res, 500, 'INTERNAL', e.message);
  }
}

export async function updateEmployeeDocument(req, res) {
  try {
    const documentId = toNum(req.params.documentId);
    if (!documentId) return fail(res, 400, 'VALIDATION', 'documentId inválido.');

    const b = req.body || {};
    const saved = await employeesApi.updateDocument(documentId, {
      document_type: b.document_type,
      file_name: b.file_name,
      notes: b.notes,
      gcs_path: b.gcs_path || b.object,
      mime_type: b.mime_type,
      file_size: b.file_size,
    });
    if (!saved) return fail(res, 404, 'NOT_FOUND', 'Documento não encontrado.');

    return ok(res, { document: saved });
  } catch (e) {
    console.error('[employeesController] updateEmployeeDocument', e);
    return fail(res, e?.code === 'VALIDATION' ? 400 : 500, e?.code || 'INTERNAL', e.message);
  }
}

export async function deleteEmployeeDocument(req, res) {
  try {
    const documentId = toNum(req.params.documentId);
    if (!documentId) return fail(res, 400, 'VALIDATION', 'documentId inválido.');

    const hard = String(req.query.hard || '').toLowerCase() === 'true';
    const out = await employeesApi.deleteDocument(documentId, { hard });
    return ok(res, out);
  } catch (e) {
    console.error('[employeesController] deleteEmployeeDocument', e);
    return fail(res, 500, 'INTERNAL', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Signed URLs + confirm
// ─────────────────────────────────────────────────────────────
export async function signUploadForEmployee(req, res) {
  try {
    const employeeId = toNum(req.params.id);
    if (!employeeId) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const b = req.body || {};

    const filename = String(b.filename || b.file_name || 'file').trim();
    const document_type = String(b.document_type || b.docType || 'DOCUMENTO').trim();
    const mime_type = String(b.mime_type || b.mimeType || b.contentType || 'application/octet-stream').trim();
    const file_size = Number(b.file_size || b.sizeBytes || 0);

    // ✅ service TRAVA bucket/prefix e gera path correto
    const out = await employeesApi.signUpload(
      {
        employee_id: employeeId,
        document_type,
        file_name: filename,
        mime_type,
        file_size,
        gcs_path: null, // ignorado
        gcs_bucket: null, // ignorado (usa EMPLOYEES_GCS_BUCKET)
      },
      { expiresInSec: 15 * 60 }
    );

    return res.json({
      ok: true,
      url: out.signedUrl,
      method: out.method,
      bucket: out.meta.gcs_bucket,
      object: out.meta.gcs_path,
      gcs_path: out.meta.gcs_path,
      expiresInSec: out.expiresInSec,
      meta: out.meta,
    });
  } catch (e) {
    console.error('[employeesController] signUploadForEmployee', e);
    const status = e?.code === 'VALIDATION' ? 400 : 500;
    return fail(res, status, e?.code || 'INTERNAL', e.message);
  }
}

export async function confirmUploadForEmployee(req, res) {
  try {
    const employeeId = toNum(req.params.id);
    if (!employeeId) return fail(res, 400, 'VALIDATION', 'employee id inválido.');

    const b = req.body || {};

    const document_type = String(b.document_type || b.docType || 'DOCUMENTO').trim();
    const file_name = String(b.file_name || b.filename || 'file').trim();
    const mime_type = String(b.mime_type || b.mimeType || b.contentType || 'application/octet-stream').trim();
    const file_size = Number(b.file_size || b.sizeBytes || 0);
    const gcs_path = String(b.gcs_path || b.object || '').trim();
    const notes = b.notes == null ? null : String(b.notes);

    if (!gcs_path) return fail(res, 400, 'VALIDATION', 'gcs_path é obrigatório.');

    const saved = await employeesApi.createDocument(employeeId, {
      document_type,
      file_name,
      mime_type,
      file_size,
      gcs_path, // ✅ será validado no service (prefix doc.employees)
      notes,
      is_active: true,
    });

    return ok(res, { document: saved });
  } catch (e) {
    console.error('[employeesController] confirmUploadForEmployee', e);
    const status = e?.code === 'VALIDATION' ? 400 : 500;
    return fail(res, status, e?.code || 'INTERNAL', e.message);
  }
}

export async function signReadByObject(req, res) {
  try {
    const object = String(req.query.object || '').trim();
    if (!object) return fail(res, 400, 'VALIDATION', 'object (gcs_path) é obrigatório.');

    const out = await employeesApi.signDownload(
      { gcs_path: object, gcs_bucket: null },
      { expiresInSec: 10 * 60 }
    );

    return res.json({
      ok: true,
      url: out.signedUrl,
      expiresInSec: out.expiresInSec,
      bucket: out.gcs_bucket,
      object: out.gcs_path,
    });
  } catch (e) {
    console.error('[employeesController] signReadByObject', e);
    return fail(res, e?.code === 'VALIDATION' ? 400 : 500, e?.code || 'INTERNAL', e.message);
  }
}
