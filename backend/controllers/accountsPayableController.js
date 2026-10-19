// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountsPayableController.js — REST Controller                      ║
// ║ CONSART ERP — handlers /api/accounts-payable                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  ensureTable,
  list,
  getById,
  create,
  update,
  remove,
  pay,
  listAttachments,
  getAttachmentById,
  addAttachment,
  removeAttachment,
  signAttachmentUpload,
  signAttachmentDownload,
  createFromSource
} from '../repositories/accountsPayable/accountsPayable.index.js';

import { generateAccountsPayablePdf }
  from '../generationPdf/generationAccountsPayablePdf.js';

import { generateAccountsPayableExcel }
  from '../generationExcel/generationAccountsPayableExcel.js';

ensureTable()
  .then(() => {
    console.log('[accountsPayableController] Tabelas accountsPayable/accessories verificadas.');
  })
  .catch((err) => {
    console.error('[accountsPayableController] Erro ao garantir tabelas:', err);
  });

function toInt(v, def = undefined) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

function getExportFilters(query = {}) {
  const {
    search,
    status,
    supplierId,
    fromDueDate,
    toDueDate,
    month,
    year,
    orderBy
  } = query;

  return {
    search: search || undefined,
    status: status || undefined,
    supplierId: supplierId ? toInt(supplierId) : undefined,
    fromDueDate: fromDueDate || undefined,
    toDueDate: toDueDate || undefined,
    month: month ? toInt(month) : undefined,
    year: year ? toInt(year) : undefined,
    orderBy: orderBy || undefined
  };
}

/** GET /api/accounts-payable */
export async function listAccountsPayable(req, res) {
  try {
    const {
      page,
      pageSize,
      search,
      status,
      supplierId,
      fromDueDate,
      toDueDate,
      month,
      year,
      orderBy
    } = req.query;

    const result = await list({
      page: toInt(page, 1),
      pageSize: toInt(pageSize, 20),
      search: search || undefined,
      status: status || undefined,
      supplierId: supplierId ? toInt(supplierId) : undefined,
      fromDueDate: fromDueDate || undefined,
      toDueDate: toDueDate || undefined,
      month: month ? toInt(month) : undefined,
      year: year ? toInt(year) : undefined,
      orderBy: orderBy || undefined
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[accountsPayableController] listAccountsPayable erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to list accounts payable' });
  }
}

/** GET /api/accounts-payable/export/pdf */
export async function exportAccountsPayablePdf(req, res) {
  try {
    const result = await generateAccountsPayablePdf(getExportFilters(req.query));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
    );
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(result.buffer);
  } catch (err) {
    console.error('[accountsPayableController] exportAccountsPayablePdf erro:', err);
    return res.status(500).json({ ok: false, error: 'Failed to export accounts payable PDF' });
  }
}

/** GET /api/accounts-payable/export/excel */
export async function exportAccountsPayableExcel(req, res) {
  try {
    const result = await generateAccountsPayableExcel(getExportFilters(req.query));

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Length', result.buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`
    );
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).send(result.buffer);
  } catch (err) {
    console.error('[accountsPayableController] exportAccountsPayableExcel erro:', err);
    return res.status(500).json({ ok: false, error: 'Failed to export accounts payable Excel' });
  }
}

/** GET /api/accounts-payable/:id */
export async function getAccountsPayable(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });

    const row = await getById(id);
    if (!row) return res.status(404).json({ ok: false, error: 'Accounts payable not found' });

    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[accountsPayableController] getAccountsPayable erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch accounts payable' });
  }
}

/** POST /api/accounts-payable */
export async function createAccountsPayable(req, res) {
  try {
    const payload = req.body || {};

    if (payload.total_value == null && payload.amount != null) payload.total_value = payload.amount;
    if (payload.supplier_id === '') payload.supplier_id = null;
    if (!payload.issue_date) payload.issue_date = new Date().toISOString().slice(0, 10);

    if (!payload.due_date) return res.status(400).json({ ok: false, error: 'due_date is required' });
    if (payload.total_value == null) return res.status(400).json({ ok: false, error: 'total_value is required' });
    if (!payload.status) payload.status = 'PENDING';

    const createdRow = await create(payload);
    res.status(201).json({ ok: true, data: createdRow });
  } catch (err) {
    console.error('[accountsPayableController] createAccountsPayable erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to create accounts payable' });
  }
}

/** PUT /api/accounts-payable/:id */
export async function updateAccountsPayable(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });

    const updated = await update(id, req.body || {});
    if (!updated) return res.status(404).json({ ok: false, error: 'Accounts payable not found' });

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('[accountsPayableController] updateAccountsPayable erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to update accounts payable' });
  }
}

/** DELETE /api/accounts-payable/:id */
export async function deleteAccountsPayable(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });

    const ok = await remove(id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Accounts payable not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('[accountsPayableController] deleteAccountsPayable erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete accounts payable' });
  }
}

/** POST /api/accounts-payable/:id/pay */
export async function payAccountsPayable(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });

    const body = req.body || {};
    const updated = await pay(id, {
      payment_date: body.payment_date,
      paid_increment: body.paid_increment,
      multa: body.multa,
      juros: body.juros,
      encargos: body.encargos,
      observacao: body.observacao
    });

    if (!updated) return res.status(404).json({ ok: false, error: 'Accounts payable not found' });
    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('[accountsPayableController] payAccountsPayable erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to pay accounts payable' });
  }
}

/** GET /api/accounts-payable/:id/attachments */
/**
 * GET /api/accounts-payable/:id/anexos
 * GET /api/accounts-payable/:id/attachments
 */
export async function getAccountsPayableAttachments(req, res) {
  try {
    const id = toInt(req.params.id);

    if (!id) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid id'
      });
    }

    const account = await getById(id);

    if (!account) {
      return res.status(404).json({
        ok: false,
        error: 'Accounts payable not found'
      });
    }

    const attachments = await listAttachments(id);

    // The current frontend expects a raw array.
    return res.json(attachments);
  } catch (err) {
    console.error(
      '[accountsPayableController] getAccountsPayableAttachments erro:',
      err
    );

    return res.status(500).json({
      ok: false,
      error: 'Failed to list attachments'
    });
  }
}

/** POST /api/upload/accounts-payable/anexo/sign */
export async function signAccountsPayableAttachmentUpload(req, res) {
  try {
    const body = req.body || {};
    const accountPayableId = toInt(body.accountPayableId ?? body.account_payable_id);

    if (!accountPayableId) {
      return res.status(400).json({ ok: false, error: 'accountPayableId invalido' });
    }

    const result = await signAttachmentUpload({
      account_payable_id: accountPayableId,
      file_name: body.filename ?? body.file_name,
      mime_type: body.mimeType ?? body.mime_type,
      file_type: body.fileType ?? body.file_type,
      file_size: body.fileSize ?? body.file_size
    });

    return res.json({
      ok: true,
      method: result.method,
      signedUrl: result.signedUrl,
      url: result.signedUrl,
      headers: result.headers,
      expiresInSec: result.expiresInSec,
      bucket: result.meta.gcs_bucket,
      object: result.meta.gcs_path,
      fileType: result.meta.file_type,
      meta: result.meta
    });
  } catch (err) {
    console.error('[accountsPayableController] sign upload erro:', err);
    const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({ ok: false, error: err?.message || 'Failed to sign upload' });
  }
}

/** POST /api/upload/accounts-payable/anexo/confirm */
export async function confirmAccountsPayableAttachmentUpload(req, res) {
  try {
    const body = req.body || {};
    const accountPayableId = toInt(body.accountPayableId ?? body.account_payable_id);
    const meta = body.meta || {};

    if (!accountPayableId) {
      return res.status(400).json({ ok: false, error: 'accountPayableId invalido' });
    }

    const attachment = await addAttachment(accountPayableId, {
      file_type: body.fileType ?? body.file_type ?? meta.file_type,
      file_name: body.filename ?? body.file_name ?? meta.file_name,
      mime_type: body.mimeType ?? body.mime_type ?? meta.mime_type,
      file_size: body.fileSize ?? body.file_size ?? meta.file_size,
      gcs_bucket: body.bucket ?? body.gcs_bucket ?? meta.gcs_bucket,
      gcs_path: body.object ?? body.gcs_path ?? meta.gcs_path
    });

    return res.status(201).json({
      ok: true,
      saved: true,
      anexo: attachment,
      attachment,
      bucket: attachment?.gcs_bucket || null,
      object: attachment?.gcs_path || null
    });
  } catch (err) {
    console.error('[accountsPayableController] confirm upload erro:', err);
    const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({ ok: false, error: err?.message || 'Failed to confirm upload' });
  }
}

/** GET /api/accounts-payable/:id/anexos/:attachmentId/download */
export async function downloadAccountsPayableAttachment(req, res) {
  try {
    const accountId = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId ?? req.query.attachmentId);

    if (!accountId || !attachmentId) {
      return res.status(400).json({ ok: false, error: 'Invalid account or attachment id' });
    }

    const attachment = await getAttachmentById(attachmentId);
    if (!attachment || Number(attachment.account_payable_id) !== accountId) {
      return res.status(404).json({ ok: false, error: 'Attachment not found' });
    }

    const result = await signAttachmentDownload(attachmentId);
    return res.json({ ok: true, url: result.signedUrl, ...result });
  } catch (err) {
    console.error('[accountsPayableController] download attachment erro:', err);
    const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({ ok: false, error: err?.message || 'Failed to sign download' });
  }
}

/** GET /api/upload/accounts-payable/anexo/sign-read?attachmentId=123 */
export async function signReadAccountsPayableAttachment(req, res) {
  try {
    const attachmentId = toInt(req.query.attachmentId ?? req.query.id);
    if (!attachmentId) {
      return res.status(400).json({ ok: false, error: 'attachmentId is required' });
    }

    const attachment = await getAttachmentById(attachmentId);
    if (!attachment) return res.status(404).json({ ok: false, error: 'Attachment not found' });

    const result = await signAttachmentDownload(attachmentId);
    return res.json({ ok: true, url: result.signedUrl, ...result });
  } catch (err) {
    console.error('[accountsPayableController] sign read erro:', err);
    const status = err?.code === 'NOT_FOUND' ? 404 : err?.code === 'VALIDATION' ? 400 : 500;
    return res.status(status).json({ ok: false, error: err?.message || 'Failed to sign download' });
  }
}

/** GET /api/accounts-payable/:id/anexos/count */
export async function countAccountsPayableAttachments(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid id' });
    const attachments = await listAttachments(id);
    return res.json({ ok: true, count: attachments.length });
  } catch (err) {
    console.error('[accountsPayableController] count attachments erro:', err);
    return res.status(500).json({ ok: false, error: 'Failed to count attachments' });
  }
}

/** DELETE /api/accounts-payable/:id/anexos/:attachmentId */
export async function deleteAccountsPayableAttachment(req, res) {
  try {
    const accountId = toInt(req.params.id);
    const attachmentId = toInt(req.params.attachmentId ?? req.params.anexoId);
    if (!accountId || !attachmentId) {
      return res.status(400).json({ ok: false, error: 'Invalid account or attachment id' });
    }

    const attachment = await getAttachmentById(attachmentId);
    if (!attachment || Number(attachment.account_payable_id) !== accountId) {
      return res.status(404).json({ ok: false, error: 'Attachment not found' });
    }

    const removed = await removeAttachment(attachmentId);
    return res.json({ ok: removed });
  } catch (err) {
    console.error('[accountsPayableController] delete attachment erro:', err);
    return res.status(500).json({ ok: false, error: 'Failed to delete attachment' });
  }
}

/** GET /api/upload/accounts-payable/diag */
export async function diagAccountsPayableUpload(req, res) {
  return res.json({
    ok: true,
    bucket: process.env.ACCOUNTS_PAYABLE_GCS_BUCKET || null,
    prefix: process.env.ACCOUNTS_PAYABLE_GCS_PREFIX || 'accountsPayable',
    signedUrlTtl: Number(process.env.ACCOUNTS_PAYABLE_GCS_SIGNED_URL_TTL || 900)
  });
}

/** POST /api/accounts-payable/from-nfe-entry */
export async function createAccountsPayableFromNfeEntry(req, res) {
  try {
    const body = req.body || {};

    if (!body.supplier_id) return res.status(400).json({ ok: false, error: 'supplier_id is required' });
    if (!body.issue_date) return res.status(400).json({ ok: false, error: 'issue_date is required' });
    if (!body.due_date) return res.status(400).json({ ok: false, error: 'due_date is required' });
    if (body.total_value == null) return res.status(400).json({ ok: false, error: 'total_value is required' });
    if (body.source_id == null) return res.status(400).json({ ok: false, error: 'source_id is required' });

    const source_type = body.source_type || 'NFE_ENTRY';

    const attachments = Array.isArray(body.attachments)
      ? body.attachments
        .filter(Boolean)
        .map((a) => ({
          file_type: a.file_type || 'OUTRO',
          file_name: a.file_name || a.filename || 'arquivo',
          file_url: a.file_url || null,
          mime_type: a.mime_type || 'application/octet-stream',
          file_size: Number(a.file_size || 0),
          gcs_bucket: a.gcs_bucket || null,
          gcs_path: a.gcs_path || null,
          is_active: a.is_active !== false
        }))
        .filter((a) => a.file_url || (a.gcs_bucket && a.gcs_path))
      : [];

    const hasXml = attachments.some((a) => String(a.file_type).toUpperCase() === 'XML');
    const hasDanfe = attachments.some((a) => String(a.file_type).toUpperCase() === 'DANFE');

    if (body.xml_url && !hasXml) {
      attachments.push({
        file_type: 'XML',
        file_name: body.xml_name || `NF-e ${body.invoice_number || body.source_id}.xml`,
        file_url: body.xml_url
      });
    }

    if (body.danfe_url && !hasDanfe) {
      attachments.push({
        file_type: 'DANFE',
        file_name: body.danfe_name || `DANFE ${body.invoice_number || body.source_id}.pdf`,
        file_url: body.danfe_url
      });
    }

    const result = await createFromSource({
      supplier_id: body.supplier_id,
      invoice_number: body.invoice_number || null,
      issue_date: body.issue_date,
      due_date: body.due_date,
      payment_method_id: body.payment_method_id || null,
      description: body.description || `NF-e ${body.invoice_number || ''}`.trim(),
      category_id: body.category_id || null,
      subcategory_id: body.subcategory_id || null,
      document_number: body.document_number || null,
      total_value: body.total_value,
      amount_paid: body.amount_paid || 0,
      status: body.status || 'PENDING',
      notes: body.notes || null,
      source_type,
      source_id: body.source_id,
      attachment_url: body.attachment_url || null,
      attachments
    });

    res.status(result.created ? 201 : 200).json({
      ok: true,
      created: result.created,
      data: result.payable,
      attachments: result.attachments
    });
  } catch (err) {
    console.error('[accountsPayableController] createAccountsPayableFromNfeEntry erro:', err);
    res.status(500).json({ ok: false, error: 'Failed to create accounts payable from NF-e entry' });
  }
}
