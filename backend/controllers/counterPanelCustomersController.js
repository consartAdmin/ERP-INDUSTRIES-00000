// ╔══════════════════════════════════════════════════════════════════════╗
// ║ counterPanelCustomersController.js — Controller (Cliente)            ║
// ║ CONSART ERP | ESM                                                    ║
// ║ - Lista docs (GCS) por competência (ano/mês)                          ║
// ║ - Sincroniza/UPSERT no PostgreSQL (status/tipo)                       ║
// ║ - Busca (q), filtros (type/status), totals, checklist                 ║
// ║ - Competência FECHADA (close)                                         ║
// ║ - Mantém legacy: byId, viewed, download                               ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import gcs from '../services/googleCloudStorage/googleCloudStorage.js';

/* helpers */
const toInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

const err = (res, msg, code = 400, extra = null) =>
  res.status(code).json({ ok: false, error: msg, ...(extra ? { extra } : {}) });

function onlyDigits(v) {
  return String(v || '').replace(/\D+/g, '');
}

function toMonth2(m) {
  return String(Number(m || 0)).padStart(2, '0');
}

/* --------------------------------------------------------------------- */
/* ENV-driven bucket + prefixes                                           */
/* --------------------------------------------------------------------- */
const BUCKET_NAME =
  process.env.GCS_BUCKET ||
  process.env.GOOGLE_CLOUD_BUCKET ||
  process.env.UPLOAD_BUCKET ||
  '';

const BASE_PREFIX = String(process.env.COUNTER_PANEL_BASE_PREFIX || 'companies').replace(/^\/+|\/+$/g, '');
const MODULE_PREFIX = String(process.env.COUNTER_PANEL_MODULE_PREFIX || 'from_accounting/proLaboreReleases')
  .replace(/^\/+|\/+$/g, '');

function assertBucketOrFail(res) {
  if (!BUCKET_NAME) {
    err(res, 'GCS bucket not configured (GCS_BUCKET/GOOGLE_CLOUD_BUCKET/UPLOAD_BUCKET vazio).', 500);
    return false;
  }
  return true;
}

function buildBasePrefix(customer_id) {
  // companies/consart_<CNPJ>/from_accounting/proLaboreReleases/
  return `${BASE_PREFIX}/consart_${customer_id}/${MODULE_PREFIX}/`;
}

function buildPrefix(customer_id, year, month) {
  const yyyy = String(year);
  const mm = toMonth2(month);
  // ⚠️ seu listByPrefix funciona com prefix sem "/" no fim — mantenho seu padrão
  return `${buildBasePrefix(customer_id)}${yyyy}/${mm}`;
}

function normalizeSignedParams(req) {
  const signed =
    String(req.query.signed || '').toLowerCase() === 'true' ||
    String(req.query.signed || '') === '1';

  const expiresMinutes = toInt(req.query.expiresMinutes) || 15;

  return { signed, expiresMinutes };
}

/**
 * ID estável por arquivo (hash → número)
 */
function stableNumericIdFromKey(key) {
  const s = String(key || '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1000000000;
}

/**
 * Tags automáticas por nome (pode evoluir depois)
 */
function docTypeFromName(name = '') {
  const s = String(name).toLowerCase();

  if (s.includes('pro-labore') || s.includes('prolabore')) return 'PROLABORE';
  if (s.includes('fgts')) return 'FGTS';
  if (s.includes('inss') || s.includes('gps')) return 'INSS';
  if (s.includes('irrf') || (s.includes('ir') && s.includes('rf'))) return 'IRRF';

  return 'OUTROS';
}

const REQUIRED_TYPES = ['PROLABORE', 'INSS', 'FGTS', 'IRRF'];

/* --------------------------------------------------------------------- */
/* DB helpers                                                            */
/* --------------------------------------------------------------------- */

async function getCompetenceClosed(customer_id, competence_year, competence_month) {
  try {
    const r = await pool.query(
      `
      select is_closed, closed_at
      from public."counterPanelCompetences"
      where customer_id=$1 and competence_year=$2 and competence_month=$3
      `,
      [customer_id, competence_year, competence_month]
    );
    return {
      isClosed: !!r.rows[0]?.is_closed,
      closedAt: r.rows[0]?.closed_at || null,
    };
  } catch (e) {
    // fail-safe: se tabela ainda não existir / migração incompleta, não derruba o endpoint
    console.warn('[COUNTER_PANEL][DB][COMPETENCE_CLOSED] warn:', e?.message || e);
    return { isClosed: false, closedAt: null };
  }
}

async function upsertFileRow({
  customer_id,
  competence_year,
  competence_month,
  file,
  prefix,
}) {
  const key = file.name;
  const baseName = file.baseName || String(file.name || '').split('/').pop() || 'Arquivo';

  const doc_type = docTypeFromName(baseName);

  // ✅ garante file_url NOT NULL
  let fileUrl = file.url || null;
  if (!fileUrl) {
    try {
      fileUrl = await gcs.getSignedURL({
        bucket: BUCKET_NAME,
        key,
        action: 'read',
        expiresMinutes: 15,
      });
    } catch (e) {
      // fallback final (ainda NOT NULL)
      fileUrl = `/api/counter-panel/customers/${stableNumericIdFromKey(key)}/download` +
        `?customer_id=${encodeURIComponent(customer_id)}` +
        `&competence_year=${encodeURIComponent(competence_year)}` +
        `&competence_month=${encodeURIComponent(competence_month)}`;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `
      select id, doc_type
      from public."counterPanelCustomers"
      where customer_id=$1 and competence_year=$2 and competence_month=$3 and gcs_key = $4
      limit 1
      `,
      [customer_id, competence_year, competence_month, key]
    );

    if (existing.rows.length) {
      const id = existing.rows[0].id;

      const currentType = String(existing.rows[0].doc_type || 'OUTROS').toUpperCase();
      const nextType = currentType === 'OUTROS' ? doc_type : currentType;

      await client.query(
        `
        update public."counterPanelCustomers"
        set
          title = $1,
          file_name = $2,
          file_url = $3,
          mime_type = $4,
          file_size_bytes = $5,
          storage_driver = $6,
          gcs_bucket = $7,
          gcs_key = $8,
          doc_type = $9,
          updated_at = now()
        where id = $10
        `,
        [
          baseName,
          baseName,
          fileUrl, // ✅ nunca null
          file.contentType || 'application/pdf',
          file.size || null,
          'gcs',
          BUCKET_NAME,
          key,
          nextType,
          id,
        ]
      );

      await client.query('COMMIT');
      return;
    }

    await client.query(
      `
      insert into public."counterPanelCustomers"
      (customer_id, customer_name, doc_type, title, description,
       competence_month, competence_year,
       file_name, file_url, mime_type, file_size_bytes,
       status, is_viewed, viewed_at,
       storage_driver, gcs_bucket, gcs_key,
       created_at, updated_at)
      values
      ($1, null, $2, $3, null,
       $4, $5,
       $6, $7, $8, $9,
       'AVAILABLE', false, null,
       'gcs', $10, $11,
       now(), now())
      `,
      [
        customer_id,
        doc_type,
        baseName,
        competence_month,
        competence_year,
        baseName,
        fileUrl, // ✅ nunca null
        file.contentType || 'application/pdf',
        file.size || null,
        BUCKET_NAME,
        key,
      ]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.warn('[COUNTER_PANEL][DB][UPSERT] warn:', e?.message || e);
  } finally {
    client.release();
  }
}

async function listRowsFromDb({ customer_id, competence_year, competence_month, q, type, status }) {
  const where = ['customer_id=$1', 'competence_year=$2', 'competence_month=$3'];
  const args = [customer_id, competence_year, competence_month];
  let i = args.length;

  if (q) {
    i++;
    where.push(`(lower(title) like $${i} or lower(file_name) like $${i})`);
    args.push(`%${q.toLowerCase()}%`);
  }

  if (type) {
    i++;
    where.push(`upper(doc_type) = $${i}`);
    args.push(String(type).toUpperCase());
  }

  // status "visual" baseado em flags (NEW/VIEWED/DOWNLOADED)
  // filtro status:
  // NEW        => is_viewed=false AND is_downloaded=false
  // VIEWED     => is_viewed=true  AND is_downloaded=false
  // DOWNLOADED => is_downloaded=true
  if (status) {
    const s = String(status).toUpperCase();
    if (s === 'NEW') where.push(`is_viewed=false and is_downloaded=false`);
    else if (s === 'VIEWED') where.push(`is_viewed=true and is_downloaded=false`);
    else if (s === 'DOWNLOADED') where.push(`is_downloaded=true`);
  }

  const sql = `
    select
      id,
      customer_id,
      doc_type,
      title,
      file_name,
      file_url,
      mime_type,
      file_size_bytes,
      status,
      is_viewed,
      viewed_at,
      is_downloaded,
      downloaded_at,
      gcs_bucket,
      gcs_key,
      created_at,
      updated_at
    from public."counterPanelCustomers"
    where ${where.join(' and ')}
    order by updated_at desc nulls last, id desc
  `;

  const r = await pool.query(sql, args);
  return r.rows;
}

function statusFromRow(row) {
  if (row.is_downloaded) return 'DOWNLOADED';
  if (row.is_viewed) return 'VIEWED';
  return 'NEW';
}

function buildChecklist(rows) {
  const present = new Set(rows.map(r => String(r.doc_type || '').toUpperCase()));
  return REQUIRED_TYPES.map(t => ({ type: t, ok: present.has(t) }));
}

/* --------------------------------------------------------------------- */
/* GET /api/counter-panel/customers/competences?customer_id=...           */
/* (mantido: lista anos/meses no bucket)                                  */
/* --------------------------------------------------------------------- */
export async function getCustomerCompetences(req, res) {
  if (!assertBucketOrFail(res)) return;

  const customer_id = onlyDigits(req.query.customer_id);
  if (!customer_id) return err(res, 'Required: customer_id');

  const basePrefix = buildBasePrefix(customer_id);

  try {
    const years = await gcs.listPrefixes(basePrefix, { bucketName: BUCKET_NAME });

    const out = [];
    for (const y of years) {
      if (!/^\d{4}$/.test(y)) continue;

      const months = await gcs.listPrefixes(`${basePrefix}${y}/`, { bucketName: BUCKET_NAME });
      const cleanMonths = months
        .filter((m) => /^\d{2}$/.test(m))
        .sort((a, b) => a.localeCompare(b))
        .map((m) => Number(m));

      if (cleanMonths.length) out.push({ year: Number(y), months: cleanMonths });
    }

    out.sort((a, b) => a.year - b.year);

    return res.json({ ok: true, customer_id, basePrefix, bucket: BUCKET_NAME, competences: out });
  } catch (e) {
    console.error('[COUNTER_PANEL][GCS][COMPETENCES]', e);
    return err(res, e.message || 'FAILED_TO_LIST_COMPETENCES', 500);
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/counter-panel/customers                                       */
/* Required: customer_id, competence_month, competence_year               */
/* Optional: signed=true&expiresMinutes=15&q=...&type=...&status=...       */
/* --------------------------------------------------------------------- */
export async function searchCounterPanelCustomers(req, res) {
  if (!assertBucketOrFail(res)) return;

  const customer_id = onlyDigits(req.query.customer_id);
  const competence_month = toInt(req.query.competence_month);
  const competence_year = toInt(req.query.competence_year);

  if (!customer_id || !competence_month || !competence_year) {
    return err(res, 'Required: customer_id, competence_month, competence_year');
  }

  const q = String(req.query.q || '').trim();
  const type = String(req.query.type || '').trim();
  const status = String(req.query.status || '').trim();

  const { signed, expiresMinutes } = normalizeSignedParams(req);
  const prefix = buildPrefix(customer_id, competence_year, competence_month);

  try {
    // 1) lista do GCS
    const files = await gcs.listByPrefix(prefix, {
      signed,
      expiresMinutes,
      bucketName: BUCKET_NAME,
    });

    // 2) sincroniza no DB (upsert por gcs_key)
    //    (não trava resposta se um item falhar)
    for (const f of files) {
      await upsertFileRow({
        customer_id,
        competence_year,
        competence_month,
        file: f,
        prefix,
      });
    }

    // 3) agora a lista “oficial” vem do DB (com status/tipo/flags)
    const dbRows = await listRowsFromDb({
      customer_id,
      competence_year,
      competence_month,
      q,
      type,
      status,
    });

    // 4) totals + checklist + closed
    const totals = {
      total: dbRows.length,
      new: dbRows.filter(r => statusFromRow(r) === 'NEW').length,
      viewed: dbRows.filter(r => statusFromRow(r) === 'VIEWED').length,
      downloaded: dbRows.filter(r => statusFromRow(r) === 'DOWNLOADED').length,
    };

    const checklist = buildChecklist(dbRows);
    const { isClosed, closedAt } = await getCompetenceClosed(customer_id, competence_year, competence_month);

    // 5) response
    const rows = dbRows.map(r => ({
      id: r.id,
      customer_id: r.customer_id,
      doc_type: String(r.doc_type || 'OUTROS').toUpperCase(),
      title: r.title || r.file_name,
      description: null,
      competence_month,
      competence_year,
      file_name: r.file_name,
      file_url: r.file_url,
      mime_type: r.mime_type || 'application/pdf',
      file_size_bytes: r.file_size_bytes || null,
      status_visual: statusFromRow(r),        // NEW|VIEWED|DOWNLOADED (para badges)
      is_viewed: !!r.is_viewed,
      viewed_at: r.viewed_at || null,
      is_downloaded: !!r.is_downloaded,
      downloaded_at: r.downloaded_at || null,
      gcs_bucket: r.gcs_bucket || BUCKET_NAME,
      gcs_key: r.gcs_key || null,
      updated_at: r.updated_at || null,
    }));

    return res.json({
      ok: true,
      bucket: BUCKET_NAME,
      prefix,
      competence: { year: competence_year, month: competence_month, isClosed, closedAt },
      totals,
      checklist,
      rows,
    });
  } catch (e) {
    console.error('[COUNTER_PANEL][GCS+DB][LIST]', e);
    return err(res, e.message || 'FAILED_TO_LIST', 500);
  }
}

/* --------------------------------------------------------------------- */
/* Checklist endpoint (opcional)                                          */
/* GET /api/counter-panel/customers/checklist?customer_id&year&month      */
/* --------------------------------------------------------------------- */
export async function getCustomerCompetenceChecklist(req, res) {
  try {
    const customer_id = onlyDigits(req.query.customer_id);
    const competence_month = toInt(req.query.competence_month);
    const competence_year = toInt(req.query.competence_year);

    if (!customer_id || !competence_month || !competence_year) {
      return err(res, 'Required: customer_id, competence_month, competence_year');
    }

    const rows = await listRowsFromDb({
      customer_id,
      competence_year,
      competence_month,
      q: '',
      type: '',
      status: '',
    });

    const checklist = buildChecklist(rows);
    const { isClosed, closedAt } = await getCompetenceClosed(customer_id, competence_year, competence_month);

    return res.json({ ok: true, customer_id, competence_year, competence_month, isClosed, closedAt, checklist });
  } catch (e) {
    console.error('[COUNTER_PANEL][CHECKLIST]', e);
    return err(res, e.message || 'FAILED_TO_CHECKLIST', 500);
  }
}

/* --------------------------------------------------------------------- */
/* Competência FECHADA                                                   */
/* POST /api/counter-panel/customers/competence/close                     */
/* body: { customer_id, competence_year, competence_month }               */
/* --------------------------------------------------------------------- */
export async function closeCustomerCompetence(req, res) {
  try {
    const customer_id = onlyDigits(req.body.customer_id);
    const competence_year = toInt(req.body.competence_year);
    const competence_month = toInt(req.body.competence_month);

    if (!customer_id || !competence_month || !competence_year) {
      return err(res, 'Required: customer_id, competence_month, competence_year');
    }

    const r = await pool.query(
      `
      insert into public."counterPanelCompetences"
      (customer_id, competence_year, competence_month, is_closed, closed_at, updated_at)
      values ($1,$2,$3,true,now(),now())
      on conflict (customer_id, competence_year, competence_month)
      do update set is_closed=true, closed_at=now(), updated_at=now()
      returning customer_id, competence_year, competence_month, is_closed, closed_at
      `,
      [customer_id, competence_year, competence_month]
    );

    return res.json({ ok: true, competence: r.rows[0] });
  } catch (e) {
    console.error('[COUNTER_PANEL][CLOSE_COMP]', e);
    return err(res, e.message || 'FAILED_TO_CLOSE_COMPETENCE', 500);
  }
}

/* --------------------------------------------------------------------- */
/* Legacy: resolver by :id (agora resolve por DB primeiro)                */
/* --------------------------------------------------------------------- */
async function resolveRowById(req) {
  if (!BUCKET_NAME) {
    return { ok: false, error: 'GCS bucket not configured' };
  }

  const customer_id = onlyDigits(req.query.customer_id);
  const competence_month = toInt(req.query.competence_month);
  const competence_year = toInt(req.query.competence_year);
  const id = toInt(req.params.id);

  if (!customer_id || !competence_month || !competence_year || !id) {
    return { ok: false, error: 'Required: customer_id, competence_month, competence_year, :id' };
  }

  // 1) tenta DB (id real)
  const db = await pool.query(
    `
    select *
    from public."counterPanelCustomers"
    where id=$1 and customer_id=$2 and competence_year=$3 and competence_month=$4
    limit 1
    `,
    [id, customer_id, competence_year, competence_month]
  );

  const prefix = buildPrefix(customer_id, competence_year, competence_month);
  const { signed, expiresMinutes } = normalizeSignedParams(req);

  // 2) lista GCS pra localizar o file atual
  const files = await gcs.listByPrefix(prefix, { signed, expiresMinutes, bucketName: BUCKET_NAME });

  let file = null;

  if (db.rows[0]?.gcs_key) {
    file = files.find((f) => f.name === db.rows[0].gcs_key) || null;
  }

  // fallback legacy antigo: achar pelo hash
  if (!file) {
    file = files.find((f) => stableNumericIdFromKey(f.name) === id) || null;
  }

  if (!file) return { ok: false, error: 'Document not found for this competence/id' };

  return {
    ok: true,
    customer_id,
    competence_month,
    competence_year,
    prefix,
    file,
    id,
    signed,
    expiresMinutes,
    dbRow: db.rows[0] || null,
  };
}

export async function getCounterPanelCustomerById(req, res) {
  try {
    const r = await resolveRowById(req);
    if (!r.ok) return err(res, r.error, 404);

    const title = r.file.baseName || String(r.file.name || '').split('/').pop() || 'Arquivo';

    return res.json({
      ok: true,
      id: r.dbRow?.id || r.id,
      customer_id: r.customer_id,
      competence_month: r.competence_month,
      competence_year: r.competence_year,
      bucket: BUCKET_NAME,
      key: r.file.name,
      file_name: title,
      mime_type: r.file.contentType || 'application/pdf',
      file_size_bytes: Number(r.file.size || 0) || null,
      updated_at: r.file.updated || null,
      doc_type: String(r.dbRow?.doc_type || docTypeFromName(title)).toUpperCase(),
      status_visual: r.dbRow ? statusFromRow(r.dbRow) : 'NEW',
    });
  } catch (e) {
    console.error('[COUNTER_PANEL][BY_ID]', e);
    return err(res, e.message || 'FAILED_TO_GET_DOC', 500);
  }
}

export async function markCounterPanelCustomerViewed(req, res) {
  try {
    const r = await resolveRowById(req);
    if (!r.ok) return err(res, r.error, 404);

    // grava no DB se existir id real
    if (r.dbRow?.id) {
      const u = await pool.query(
        `
        update public."counterPanelCustomers"
        set is_viewed=true,
            viewed_at=coalesce(viewed_at, now()),
            updated_at=now()
        where id=$1
        returning id, is_viewed, viewed_at
        `,
        [r.dbRow.id]
      );

      return res.json({
        ok: true,
        id: u.rows[0].id,
        customer_id: r.customer_id,
        competence_month: r.competence_month,
        competence_year: r.competence_year,
        viewed: true,
        viewed_at: u.rows[0].viewed_at,
      });
    }

    // fallback no-op
    return res.json({
      ok: true,
      id: r.id,
      customer_id: r.customer_id,
      competence_month: r.competence_month,
      competence_year: r.competence_year,
      viewed: true,
      viewed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[COUNTER_PANEL][VIEWED]', e);
    return err(res, e.message || 'FAILED_TO_MARK_VIEWED', 500);
  }
}

/**
 * Endpoint separado (se você quiser):
 * PATCH /api/counter-panel/customers/:id/downloaded
 */
export async function markCounterPanelCustomerDownloaded(req, res) {
  try {
    const r = await resolveRowById(req);
    if (!r.ok) return err(res, r.error, 404);

    if (r.dbRow?.id) {
      const u = await pool.query(
        `
        update public."counterPanelCustomers"
        set is_downloaded=true,
            downloaded_at=coalesce(downloaded_at, now()),
            updated_at=now()
        where id=$1
        returning id, is_downloaded, downloaded_at
        `,
        [r.dbRow.id]
      );

      return res.json({
        ok: true,
        id: u.rows[0].id,
        downloaded: true,
        downloaded_at: u.rows[0].downloaded_at,
      });
    }

    return res.json({ ok: true, id: r.id, downloaded: true, downloaded_at: new Date().toISOString() });
  } catch (e) {
    console.error('[COUNTER_PANEL][DOWNLOADED]', e);
    return err(res, e.message || 'FAILED_TO_MARK_DOWNLOADED', 500);
  }
}

/* --------------------------------------------------------------------- */
/* GET /api/counter-panel/customers/:id/download                          */
/* - Mantém retorno legacy (json com url) quando conseguir assinar         */
/* - Marca como baixado (DB)                                              */
/* - Fallback: STREAM do GCS                                              */
/* --------------------------------------------------------------------- */
export async function downloadCounterPanelCustomer(req, res) {
  try {
    req.query.signed = 'true';

    const r = await resolveRowById(req);
    if (!r.ok) return err(res, r.error, 404);

    // marca como baixado (best-effort)
    if (r.dbRow?.id) {
      pool.query(
        `
        update public."counterPanelCustomers"
        set is_downloaded=true,
            downloaded_at=coalesce(downloaded_at, now()),
            updated_at=now()
        where id=$1
        `,
        [r.dbRow.id]
      ).catch(() => {});
    }

    const baseName = r.file.baseName || String(r.file.name || '').split('/').pop() || 'Arquivo';

    let url = r.file.url || null;

    if (!url) {
      try {
        url = await gcs.getSignedURL({
          bucket: BUCKET_NAME,
          key: r.file.name,
          action: 'read',
          expiresMinutes: 15,
          responseDisposition: `attachment; filename="${encodeURIComponent(baseName)}"`,
        });
      } catch (signErr) {
        console.warn('[COUNTER_PANEL][DOWNLOAD] signed url failed, fallback to stream', signErr?.message || signErr);
        url = null;
      }
    }

    if (url) {
      return res.json({
        ok: true,
        id: r.dbRow?.id || r.id,
        customer_id: r.customer_id,
        competence_month: r.competence_month,
        competence_year: r.competence_year,
        url,
      });
    }

    const stream = gcs.createReadStream({ bucket: BUCKET_NAME, key: r.file.name });

    if (!stream) {
      return err(
        res,
        'GCS_STREAM_NOT_AVAILABLE_IN_SERVICE',
        501,
        {
          hint:
            'Service googleCloudStorage.js não retornou stream. Verifique getFile()/createReadStream() e permissões do bucket.',
          bucket: BUCKET_NAME,
          key: r.file.name,
        }
      );
    }

    const safeName = encodeURIComponent(baseName).replace(/%20/g, ' ');
    const contentType = r.file.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);

    return stream
      .on('error', (streamErr) => {
        console.error('[COUNTER_PANEL][DOWNLOAD][STREAM_ERROR]', streamErr);
        if (!res.headersSent) return res.status(500).end('DOWNLOAD_STREAM_FAILED');
        try { res.end(); } catch (_) {}
      })
      .pipe(res);
  } catch (e) {
    console.error('[COUNTER_PANEL][DOWNLOAD]', e);
    return err(res, e.message || 'FAILED_TO_DOWNLOAD', 500);
  }
}
