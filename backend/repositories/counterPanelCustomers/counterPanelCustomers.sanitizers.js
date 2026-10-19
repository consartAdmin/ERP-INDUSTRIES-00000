// ╔════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomers.sanitizers.js — Normalização / validação     ║
// ╚════════════════════════════════════════════════════════════════════╝

export function normStr(v) {
  const s = String(v ?? '').trim();
  return s.length ? s : '';
}

export function normNullableStr(v) {
  const s = String(v ?? '').trim();
  return s.length ? s : null;
}

export function validateMonthYear({ competence_month, competence_year }) {
  let m = competence_month;
  let y = competence_year;

  if (m !== null && m !== undefined && String(m) !== '') {
    m = Number(m);
    if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error('Invalid competence_month (1-12)');
  } else {
    m = null;
  }

  if (y !== null && y !== undefined && String(y) !== '') {
    y = Number(y);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) throw new Error('Invalid competence_year (2000-2100)');
  } else {
    y = null;
  }

  return { competence_month: m, competence_year: y };
}

export function validateSize(file_size_bytes) {
  if (file_size_bytes === null || file_size_bytes === undefined || String(file_size_bytes) === '') return null;
  const s = Number(file_size_bytes);
  if (!Number.isFinite(s) || s < 0) throw new Error('Invalid file_size_bytes (>= 0)');
  return Math.trunc(s);
}

export function normalizeCreate(d = {}) {
  const out = {
    customer_id: d.customer_id ?? null,
    customer_name: d.customer_name ?? null,

    doc_type: normStr(d.doc_type),
    title: normStr(d.title),
    description: d.description ?? null,

    competence_month: d.competence_month ?? null,
    competence_year: d.competence_year ?? null,

    file_name: normStr(d.file_name),

    file_url: normNullableStr(d.file_url),

    mime_type: d.mime_type ?? null,
    file_size_bytes: d.file_size_bytes ?? null,

    status: d.status ?? 'AVAILABLE',

    storage_driver: normNullableStr(d.storage_driver),
    gcs_bucket: normNullableStr(d.gcs_bucket),
    gcs_key: normNullableStr(d.gcs_key),
  };

  if (!out.customer_id) throw new Error('Required: customer_id');
  if (!out.doc_type) throw new Error('Required: doc_type');
  if (!out.title) throw new Error('Required: title');
  if (!out.file_name) throw new Error('Required: file_name');

  const { competence_month, competence_year } = validateMonthYear(out);
  out.competence_month = competence_month;
  out.competence_year = competence_year;

  out.file_size_bytes = validateSize(out.file_size_bytes);

  if (!out.file_url && !out.gcs_key) {
    throw new Error('Required: file_url OR gcs_key');
  }

  return out;
}
