// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employeesStorage.repository.js — GCS Signed URLs                     ║
// ║ signUpload (PUT) / signDownload (GET) — bucket/prefix fixos          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  toNumOrNull,
  toStrOrNull,
  ensureEmployeesBucket,
  getEmployeesPrefix,
  joinPath,
  safeFileName,
  safeSlug,
  employeeFolderName,
  assertEmployeesObjectPath,
} from './employees.utils.js';
import { getById } from './employeesQuery.repository.js';

async function getEmployeeFolderById(employeeId) {
  const emp = await getById(employeeId);

  if (!emp) {
    const err = new Error('Employee not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return employeeFolderName(emp);
}

async function buildGcsPath({ employee_id, document_type, file_name }) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const doc = safeSlug(document_type || 'DOCUMENTO');
  const prefix = getEmployeesPrefix();
  const employeeFolder = await getEmployeeFolderById(employee_id);

  return joinPath(prefix, employeeFolder, doc, `${ts}_${safeFileName(file_name)}`);
}

// ─────────────────────────────────────────────────────────────
// GCS Signed URLs
// ─────────────────────────────────────────────────────────────
async function getStorageClient() {
  try {
    const mod = await import('@google-cloud/storage');
    const { Storage } = mod;

    const hasCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const inCloudRun = !!process.env.K_SERVICE;
    console.log('[GCS] init Storage | inCloudRun=', inCloudRun, '| hasGOOGLE_APPLICATION_CREDENTIALS=', hasCreds);

    return new Storage();
  } catch (e) {
    console.error('[GCS] failed to load @google-cloud/storage', e);
    const err = new Error(
      'GCS_SIGNING_UNAVAILABLE: instale @google-cloud/storage e configure credenciais (GOOGLE_APPLICATION_CREDENTIALS ou Service Account no Cloud Run).'
    );
    err.code = 'GCS_SIGNING_UNAVAILABLE';
    err.cause = e;
    throw err;
  }
}

export async function signUpload(input = {}, { expiresInSec = 15 * 60 } = {}) {
  const employee_id = toNumOrNull(input.employee_id);
  const document_type = toStrOrNull(input.document_type) || 'DOCUMENTO';
  const file_name = safeFileName(input.file_name);
  const mime_type = toStrOrNull(input.mime_type) || 'application/octet-stream';
  const file_size = toNumOrNull(input.file_size) ?? 0;

  if (!employee_id) {
    const err = new Error('employee_id is required');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!file_name) {
    const err = new Error('file_name is required');
    err.code = 'VALIDATION';
    throw err;
  }

  // ✅ Bucket FIXO do módulo employees
  const gcs_bucket = ensureEmployeesBucket();

  // ✅ Path SEMPRE gerado aqui (ignora gcs_path do client)
  const gcs_path = await buildGcsPath({ employee_id, document_type, file_name });

  const storage = await getStorageClient();
  const file = storage.bucket(gcs_bucket).file(gcs_path);

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresInSec * 1000,
  });

  return {
    ok: true,
    signedUrl,
    method: 'PUT',
    expiresInSec,
    meta: { employee_id, document_type, file_name, mime_type, file_size, gcs_bucket, gcs_path },
  };
}

export async function signDownload(input = {}, { expiresInSec = 10 * 60 } = {}) {
  const gcs_bucket = ensureEmployeesBucket();

  let gcs_path = toStrOrNull(input.gcs_path);
  if (!gcs_path) {
    const err = new Error('Informe gcs_path (object).');
    err.code = 'VALIDATION';
    throw err;
  }

  // ✅ força prefix correto
  const prefix = getEmployeesPrefix();
  gcs_path = String(gcs_path).replace(/^\/+/, '');
  if (!gcs_path.startsWith(prefix + '/')) gcs_path = joinPath(prefix, gcs_path);

  // valida anti anexos
  gcs_path = assertEmployeesObjectPath(gcs_path);

  const storage = await getStorageClient();
  const file = storage.bucket(gcs_bucket).file(gcs_path);

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSec * 1000,
  });

  return { ok: true, signedUrl, method: 'GET', expiresInSec, gcs_bucket, gcs_path };
}
