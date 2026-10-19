// ╔══════════════════════════════════════════════════════════════════════╗
// ║ employees.utils.js — Conversores e helpers de path GCS               ║
// ╚══════════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────────
export const isFiniteNum = (v) => Number.isFinite(Number(v));
export const toNumOrNull = (v) => (v === '' || v == null ? null : (isFiniteNum(v) ? Number(v) : null));
export const toStrOrNull = (v) => (v === '' || v == null ? null : String(v));

export const toDateOrNull = (v) => {
  if (v === '' || v == null) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const toBoolOrNull = (v) => {
  if (v === '' || v == null) return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase().trim();
  if (['1', 'true', 't', 'yes', 'y', 'sim'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n', 'nao', 'não'].includes(s)) return false;
  return null;
};

// ─────────────────────────────────────────────────────────────
// Helpers GCS (bucket / prefix / nomes)
// ─────────────────────────────────────────────────────────────
export function ensureEmployeesBucket() {
  const b =
    toStrOrNull(process.env.GCS_EMPLOYEES_BUCKET) ||
    toStrOrNull(process.env.EMPLOYEES_GCS_BUCKET) ||
    'erp-infinity-00000';

  const out = String(b).trim();

  if (!out) {
    const err = new Error('GCS_EMPLOYEES_BUCKET is required');
    err.code = 'VALIDATION';
    throw err;
  }

  return out;
}

export function getEmployeesPrefix() {
  const base =
    toStrOrNull(process.env.GCS_EMPLOYEES_BASE_PREFIX) ||
    'accounting/from_customer';

  const modulePrefix =
    toStrOrNull(process.env.GCS_EMPLOYEES_PREFIX) ||
    toStrOrNull(process.env.EMPLOYEES_GCS_PREFIX) ||
    'employees';

  return joinPath(base, modulePrefix);
}

export function joinPath(...parts) {
  return parts
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

export function safeFileName(name) {
  const n = String(name || 'file').trim();
  const base = n.split('/').pop().split('\\').pop();
  return base
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || 'file';
}

export function safeSlug(s) {
  return String(s || 'DOC')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'DOC';
}

export function employeeFolderName(employee = {}) {
  const name = safeSlug(employee.full_name || employee.name || 'EMPLOYEE');
  const id = Number(employee.employee_id || employee.id || employee.employeeId);

  return id ? `${name}-${id}` : name;
}

export function assertEmployeesObjectPath(gcs_path) {
  const prefix = getEmployeesPrefix();
  const p = String(gcs_path || '').replace(/^\/+/, '');
  if (!p.startsWith(prefix + '/')) {
    const err = new Error(`gcs_path inválido: deve começar com "${prefix}/"`);
    err.code = 'VALIDATION';
    throw err;
  }
  if (p.toLowerCase().includes('/anexos/')) {
    const err = new Error('gcs_path inválido: não pode conter "/anexos/".');
    err.code = 'VALIDATION';
    throw err;
  }
  return p;
}
