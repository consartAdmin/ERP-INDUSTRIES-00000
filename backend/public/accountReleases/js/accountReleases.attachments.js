// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.attachments.js                                      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './accountReleases.state.js';
import { CATEGORY_LABELS, ATTACHMENT_TYPE_LABELS, DEFAULT_CATEGORY } from './accountReleases.constants.js';
import {
  $,
  showToast,
  pad2,
  monthToCompetence,
  sanitizeGcsFileName,
  getDisplayFileName,
  parseAttachmentDate,
  isPdfAttachment,
  openAttachment,
} from './accountReleases.helpers.js';
import {
  releaseAttachmentsRequest,
  signAttachmentRequest,
  confirmAttachmentRequest,
  confirmReleaseAttachmentRequest,
  deactivateAttachmentRequest,
} from './accountReleases.api.js';
import { buildCustomerPrefix, reloadCustomerAttachmentsWithCurrentFilter } from './accountReleases.customer.js';

export function getCategoryLabel(category) {
  const key = String(category || '').trim().toLowerCase();
  return CATEGORY_LABELS[key] || category || 'Other';
}

export function getAttachmentTypeLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return ATTACHMENT_TYPE_LABELS[key] || value || '';
}

export function buildTypeChip(label) {
  if (!label) return null;
  const chip = document.createElement('span');
  chip.className = 'ar-docTypeChip';
  chip.textContent = label;
  return chip;
}

export function renderAttachmentRows(wrap, items = [], options = {}) {
  if (!wrap) return;

  wrap.innerHTML = '';

  const emptyText = options.emptyText || 'No attachments found.';
  const mode = options.mode || 'customer';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'ar-muted';
    empty.textContent = emptyText;
    wrap.appendChild(empty);
    return;
  }

  items.forEach((a) => {
    const row = document.createElement('div');
    row.className = 'ar-attachRow';

    const left = document.createElement('div');

    const topLine = document.createElement('div');
    topLine.className = 'ar-attachTopLine';

    const strong = document.createElement('strong');
    strong.textContent = getDisplayFileName(a);

    const categoryLabel = getCategoryLabel(a.category || a.release_category || a.releaseCategory);
    const typeLabel = getAttachmentTypeLabel(
      a.doc_type ||
      a.docType ||
      a.attachment_type ||
      a.attachmentType ||
      a.type
    );

    const categoryChip = buildTypeChip(categoryLabel);
    const typeChip = buildTypeChip(typeLabel);

    topLine.appendChild(strong);
    if (categoryChip) topLine.appendChild(categoryChip);
    if (typeChip) topLine.appendChild(typeChip);

    const span = document.createElement('span');
    const size = Number(a.file_size || a.size || 0);
    const mime = String(a.mime_type || a.mime || '').toLowerCase();
    const dt = parseAttachmentDate(a);

    const when = dt
      ? ` • Uploaded: ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
      : '';

    span.textContent = `${size} bytes • ${mime}${when}`;

    left.appendChild(topLine);
    left.appendChild(span);

    const right = document.createElement('div');
    right.className = 'ar-attachActions';

    const chip = document.createElement('span');
    chip.className = a.is_active === false ? 'ar-chip ar-chip--danger' : 'ar-chip ar-chip--ok';
    chip.textContent = a.is_active === false ? 'INACTIVE' : 'ACTIVE';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn-pastel-primary';
    openBtn.textContent = isPdfAttachment(a) ? 'PDF' : 'Open';
    openBtn.addEventListener('click', () => openAttachment(a));

    right.appendChild(chip);
    right.appendChild(openBtn);

    if (mode === 'release' && a.is_active !== false) {
      const disableBtn = document.createElement('button');
      disableBtn.className = 'btn btn-pastel-neutral';
      disableBtn.textContent = 'Disable';
      disableBtn.addEventListener('click', () => deactivateAttachment(a.account_release_attachment_id || a.attachment_id || a.id));
      right.appendChild(disableBtn);
    }

    row.appendChild(left);
    row.appendChild(right);
    wrap.appendChild(row);
  });
}

export function renderCustomerAttachments(items = []) {
  if ($('customerAttachCount')) $('customerAttachCount').textContent = `${items.length} attachments`;
  renderAttachmentRows($('customerAttachmentsList'), items, {
    emptyText: 'No attachments found for this customer.',
    mode: 'customer',
  });
}

export function renderReleaseAttachments(items = []) {
  if ($('attachCount')) $('attachCount').textContent = `${items.length} attachments`;
  renderAttachmentRows($('attachmentsList'), items, {
    emptyText: 'No attachments registered for this release.',
    mode: 'release',
  });
}

export async function loadReleaseAttachments(releaseId) {
  const response = await releaseAttachmentsRequest(releaseId);
  renderReleaseAttachments(response.items || []);
}

export async function addAttachmentConfirm() {
  const releaseIdRaw = $('fReleaseId')?.value;
  const releaseId = releaseIdRaw ? Number(releaseIdRaw) : null;

  const customerId =
    $('fCustomerId')?.value
      ? Number($('fCustomerId').value)
      : (state.customer?.id ? Number(state.customer.id) : null);

  if (!customerId) {
    showToast('Select a customer before attaching files.');
    return;
  }

  const file = $('fileInput')?.files?.[0];
  if (!file) {
    showToast('Select a file first.');
    return;
  }

  const category =
    $('fCategory')?.value ||
    state.customerAttachFilter.category ||
    $('fltCategory')?.value ||
    DEFAULT_CATEGORY;

  const competenceMonth = $('fCompetence')?.value || new Date().toISOString().slice(0, 7);
  const [yyyy, mm] = competenceMonth.split('-');

  const yearPart = state.customerAttachFilter?.year || yyyy || new Date().toISOString().slice(0, 4);
  const monthPart = state.customerAttachFilter?.month || mm || pad2(new Date().getMonth() + 1);

  const customRaw = ($('attachCustomName')?.value || '').trim();
  let baseName = customRaw || file.name;

  const originalExt = (String(file.name).split('.').pop() || '').toLowerCase();
  const hasExt = /\.[a-z0-9]{1,10}$/i.test(baseName);

  if (!hasExt && originalExt) {
    baseName = `${baseName}.${originalExt}`;
  }

  const safeName = sanitizeGcsFileName(baseName);
  const { bucket, prefix } = buildCustomerPrefix(state.customer || { doc: '', companyKey: '' }, {
    category,
    year: yearPart,
    month: monthPart,
  });

  const bucket_name = bucket;
  const object_path = `${prefix}${Date.now()}_${safeName}`;
  const mime_type = file.type || 'application/octet-stream';
  const attachmentType = $('attachType')?.value ? String($('attachType').value).trim() : '';

  try {
    const sign = await signAttachmentRequest({
      bucket_name,
      object_path,
      mime_type,
    });

    if (!sign?.url) throw new Error('Signed URL not returned by server.');

    const uploadRes = await fetch(sign.url, {
      method: 'PUT',
      headers: { 'Content-Type': mime_type },
      body: file,
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => '');
      throw new Error(`File upload failed (${uploadRes.status}) ${String(text).slice(0, 160)}`);
    }

    const payload = {
      storage_provider: 'GCS',
      bucket_name,
      object_path,
      original_file_name: customRaw || file.name,
      mime_type,
      file_size: file.size || 0,
      notes: null,
      uploaded_by_user_id: null,
      attachment_type: attachmentType || null,
      category,
      customer_id: customerId,
      company_id: $('fCompanyId')?.value ? Number($('fCompanyId').value) : null,
      year: Number(yearPart),
      month: Number(monthPart),
      competence: monthToCompetence($('fCompetence')?.value) || null,
    };

    if (releaseId) {
      await confirmReleaseAttachmentRequest(releaseId, payload);
    } else {
      await confirmAttachmentRequest(payload);
    }

    showToast(releaseId ? 'Attachment linked to release ✅' : 'Customer attachment registered ✅');

    if ($('fileInput')) $('fileInput').value = '';
    if ($('attachCustomName')) $('attachCustomName').value = '';
    if ($('attachType')) $('attachType').value = '';

    if (releaseId) {
      await loadReleaseAttachments(releaseId);
    }

    if (state.customer?.id) {
      await reloadCustomerAttachmentsWithCurrentFilter();
    }
  } catch (err) {
    console.error('[ACCOUNT RELEASE UPLOAD ERROR]', err);
    showToast(err.message || 'Error uploading attachment.');
  }
}

export async function deactivateAttachment(id) {
  if (!id) return;
  if (!confirm('Disable this attachment?')) return;

  await deactivateAttachmentRequest(id);
  showToast('Attachment disabled ✅');

  const rid = Number($('fReleaseId')?.value);
  if (rid) await loadReleaseAttachments(rid);

  if (state.customer?.id) {
    await reloadCustomerAttachmentsWithCurrentFilter();
  }
}