// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountReleases.js — Accounting Releases / Document Dispatch        ║
// ║ CONSART Accountant Panel | Frontend ESM                             ║
// ║ API: /api/account-releases                                          ║
// ║                                                                    ║
// ║ Main Features:                                                     ║
// ║  - Customer picker integration                                     ║
// ║  - Release CRUD                                                    ║
// ║  - Send / cancel release                                           ║
// ║  - Customer attachments by year/month/category                     ║
// ║  - Release attachment upload to GCS via signed URL                 ║
// ║  - Generic categories for accounting document workflows            ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';

/* --------------------------------------------------------------------- */
/* API BASE                                                              */
/* --------------------------------------------------------------------- */
const ROOT_API = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8080';
  if (typeof window.getApiBase === 'function') return window.getApiBase();
  if (window.apiBase) return window.apiBase;
  if (window.API_BASE) return window.API_BASE;
  return window.location.origin;
})();

const API = `${ROOT_API}/api/account-releases`;

const $ = (id) => document.getElementById(id);

/* --------------------------------------------------------------------- */
/* CONSTANTS                                                             */
/* --------------------------------------------------------------------- */
const CATEGORY_LABELS = {
  inbound_documents: 'Inbound Documents',
  outbound_documents: 'Outbound Documents',
  accounting_documents: 'Accounting Documents',
  sped: 'SPED',
  payroll: 'Payroll',
  taxes: 'Taxes',
  contracts: 'Contracts',
  other: 'Other',
};

const ATTACHMENT_TYPE_LABELS = {
  xml: 'XML',
  pdf: 'PDF',
  receipt: 'Receipt',
  tax_guide: 'Tax Guide',
  spreadsheet: 'Spreadsheet',
  statement: 'Statement',
  contract: 'Contract',
  sped_file: 'SPED File',
  other: 'Other',
};

/* --------------------------------------------------------------------- */
/* TOAST                                                                 */
/* --------------------------------------------------------------------- */
function showToast(msg) {
  const el = $('toast');
  if (!el) {
    alert(msg);
    return;
  }
  el.textContent = msg;
  el.classList.add('is-show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('is-show'), 3200);
}

/* --------------------------------------------------------------------- */
/* FETCH                                                                 */
/* --------------------------------------------------------------------- */
async function fetchJSON(url, opts = {}) {
  const isForm = opts.body instanceof FormData;

  const options = {
    ...opts,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(opts.headers || {}),
    },
  };

  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg = data?.details || data?.error || data?.message || res.statusText || 'Request failed';
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

/* --------------------------------------------------------------------- */
/* HELPERS                                                               */
/* --------------------------------------------------------------------- */
function monthToCompetence(monthVal) {
  if (!monthVal) return null;
  return `${monthVal}-01`;
}

function competenceToMonth(competence) {
  if (!competence) return '';
  return String(competence).slice(0, 7);
}

function fmtMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'BRL' });
}

function pad2(n) {
  const s = String(n ?? '');
  return s.length === 1 ? `0${s}` : s;
}

function safeUpper(v) {
  return String(v || '').trim().toUpperCase();
}

function sanitizeGcsFileName(name) {
  const base = String(name || '').trim() || 'file';
  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getCategoryLabel(category) {
  const key = String(category || '').trim().toLowerCase();
  return CATEGORY_LABELS[key] || category || 'Other';
}

function getAttachmentTypeLabel(value) {
  const key = String(value || '').trim().toLowerCase();
  return ATTACHMENT_TYPE_LABELS[key] || value || '';
}

function getStatusChipClass(status) {
  const s = safeUpper(status);
  if (s === 'CONFIRMED') return 'ar-chip ar-chip--ok';
  if (s === 'SENT') return 'ar-chip ar-chip--primary';
  if (s === 'CANCELED') return 'ar-chip ar-chip--danger';
  return 'ar-chip ar-chip--warn';
}

function calcFinalAmountLocal() {
  const amount = Number($('fAmount')?.value || 0);
  const extra = Number($('fExtraCharges')?.value || 0);
  const discounts = Number($('fDiscounts')?.value || 0);
  const taxes = Number($('fTaxesAmount')?.value || 0);

  const total = amount + extra - discounts + taxes;
  return Math.max(0, Number(total.toFixed(2)));
}

function getDisplayFileName(a) {
  const raw =
    (a?.original_file_name && String(a.original_file_name).trim()) ||
    (a?.originalFileName && String(a.originalFileName).trim()) ||
    '';

  const candidate =
    raw ||
    (a?.object_path && String(a.object_path)) ||
    (a?.objectPath && String(a.objectPath)) ||
    (a?.file_name && String(a.file_name)) ||
    (a?.fileName && String(a.fileName)) ||
    '';

  if (!candidate) return '(unnamed)';

  const base = candidate.split('/').pop() || candidate;

  const cleaned = base
    .replace(/^(\d{10,16})([_-]+)?/g, '')
    .replace(/^_+/g, '')
    .trim();

  return cleaned || base || '(unnamed)';
}

function parseAttachmentDate(a) {
  const raw =
    a?.created_at ||
    a?.createdAt ||
    a?.uploaded_at ||
    a?.uploadedAt ||
    a?.updated_at ||
    a?.updatedAt ||
    null;

  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const name =
    (a?.object_path && String(a.object_path).split('/').pop()) ||
    (a?.objectPath && String(a.objectPath).split('/').pop()) ||
    (a?.original_file_name && String(a.original_file_name)) ||
    (a?.file_name && String(a.file_name)) ||
    '';

  const m = String(name).match(/^(\d{13})(?=[_-]|[A-Za-z0-9]|\.|$)/);
  if (m?.[1]) {
    const d = new Date(Number(m[1]));
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function isPdfAttachment(a) {
  const mime = String(a?.mime_type || a?.mime || '').toLowerCase();
  const name = getDisplayFileName(a).toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
}

function openAttachment(a) {
  const url = a?.signed_url || a?.signedUrl || a?.download_url || a?.downloadUrl || '';
  if (!url) {
    showToast('No URL available for this attachment.');
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

function buildTypeChip(label) {
  if (!label) return null;
  const chip = document.createElement('span');
  chip.className = 'ar-docTypeChip';
  chip.textContent = label;
  return chip;
}

function setButtonsBySelection(hasSelection) {
  const hasCustomer = !!state.customer?.id;
  const hasFile = $('fileInput')?.files?.length > 0;

  if ($('btnDelete')) $('btnDelete').disabled = !hasSelection;
  if ($('btnSendRelease')) $('btnSendRelease').disabled = !hasSelection;
  if ($('btnCancelRelease')) $('btnCancelRelease').disabled = !hasSelection;

  if ($('btnAddAttachment')) {
    $('btnAddAttachment').disabled = !(hasCustomer && hasFile);
  }
}

/* --------------------------------------------------------------------- */
/* STATE                                                                 */
/* --------------------------------------------------------------------- */
const state = {
  items: [],
  selectedId: null,
  limit: 20,
  offset: 0,
  page: 1,
  customer: null,
  customerAttachFilter: {
    year: null,
    month: null,
    category: null,
  },
};

/* --------------------------------------------------------------------- */
/* CUSTOMER NORMALIZATION                                                */
/* --------------------------------------------------------------------- */
function normCustomer(c) {
  if (!c) return null;

  const id =
    c.customer_id ??
    c.id ??
    c.customerId ??
    c.customerID ??
    c.partner_id ??
    c.partnerId ??
    null;

  const name =
    c.trade_name ??
    c.nome_fantasia ??
    c.nomeFantasia ??
    c.razao_social ??
    c.razaoSocial ??
    c.nome ??
    c.name ??
    '';

  const doc =
    c.tax_id ??
    c.cnpj_cpf ??
    c.cnpjCpf ??
    c.cnpj ??
    c.cpf ??
    c.document ??
    '';

  const email = c.email ?? c.mail ?? '';
  const phone = c.telefone ?? c.phone ?? c.celular ?? '';

  const companyKey =
    c.company_key ??
    c.companyKey ??
    c.company_slug ??
    c.companySlug ??
    c.company_cnpj ??
    c.companyCnpj ??
    '';

  const cid = Number(id);

  return {
    id: Number.isFinite(cid) && cid > 0 ? cid : null,
    name: String(name || '').trim(),
    doc: String(doc || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    companyKey: String(companyKey || '').trim(),
    raw: c,
  };
}

/* --------------------------------------------------------------------- */
/* BUCKET / PREFIX                                                       */
/* --------------------------------------------------------------------- */
function buildCustomerPrefix(customer, filter = {}) {
  const baseBucket = 'consart_contabilidade';

  let comp = (customer?.companyKey || '').trim();

  if (!comp && customer?.doc) {
    const onlyDigits = String(customer.doc).replace(/\D+/g, '');
    if (onlyDigits.length >= 11) comp = `consart_${onlyDigits}`;
  }

  if (!comp) comp = 'consart';

  const category = String(filter?.category || 'accounting_documents').trim() || 'accounting_documents';
  const year = filter?.year ? String(filter.year) : null;
  const month = filter?.month ? pad2(filter.month) : null;

  let prefix = `companies/${comp}/from_accounting/${category}/`;

  if (year) prefix += `${year}/`;
  if (month) prefix += `${month}/`;

  return { bucket: baseBucket, prefix };
}

/* --------------------------------------------------------------------- */
/* CUSTOMER UI                                                           */
/* --------------------------------------------------------------------- */
function clearCustomerUI() {
  if ($('cId')) $('cId').value = '';
  if ($('cName')) $('cName').value = '';
  if ($('cDoc')) $('cDoc').value = '';
  if ($('cEmail')) $('cEmail').value = '';
  if ($('cPhone')) $('cPhone').value = '';
  if ($('cPrefix')) $('cPrefix').value = '';

  if ($('customerPill')) $('customerPill').textContent = '—';
  if ($('customerHint')) $('customerHint').textContent = 'Select a customer to load data and attachments.';

  if ($('customerAttachmentsList')) $('customerAttachmentsList').innerHTML = '';
  if ($('customerAttachCount')) $('customerAttachCount').textContent = '0 attachments';

  state.customer = null;
  state.customerAttachFilter.year = null;
  state.customerAttachFilter.month = null;
  state.customerAttachFilter.category = null;

  renderCustomerAttachFiltersUI();
  setButtonsBySelection(!!state.selectedId);
}

async function applyCustomer(customerRaw) {
  const c = normCustomer(customerRaw);
  if (!c?.id) {
    showToast('Invalid customer (missing id).');
    return;
  }

  state.customer = c;

  if ($('fCustomerId')) $('fCustomerId').value = String(c.id);

  if ($('cId')) $('cId').value = String(c.id);
  if ($('cName')) $('cName').value = c.name || '—';
  if ($('cDoc')) $('cDoc').value = c.doc || '—';
  if ($('cEmail')) $('cEmail').value = c.email || '—';
  if ($('cPhone')) $('cPhone').value = c.phone || '—';

  const competenceMonth = $('fCompetence')?.value || new Date().toISOString().slice(0, 7);
  const [yy, mm] = competenceMonth.split('-');

  state.customerAttachFilter.year = yy || String(new Date().getFullYear());
  state.customerAttachFilter.month = mm || pad2(new Date().getMonth() + 1);
  state.customerAttachFilter.category = $('fCategory')?.value || $('fltCategory')?.value || 'accounting_documents';

  renderCustomerAttachFiltersUI();

  const { bucket, prefix } = buildCustomerPrefix(c, state.customerAttachFilter);

  if ($('cPrefix')) $('cPrefix').value = `${bucket} / ${prefix}`;
  if ($('customerPill')) $('customerPill').textContent = 'LOADED';
  if ($('customerHint')) $('customerHint').textContent = 'Customer loaded. Attachments listed from backend.';

  setButtonsBySelection(!!state.selectedId);

  await loadCustomerAttachments(c.id, { bucket, prefix, category: state.customerAttachFilter.category });
}

/* --------------------------------------------------------------------- */
/* ATTACHMENT LISTS                                                      */
/* --------------------------------------------------------------------- */
function renderAttachmentRows(wrap, items = [], options = {}) {
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

function renderCustomerAttachments(items = []) {
  if ($('customerAttachCount')) $('customerAttachCount').textContent = `${items.length} attachments`;
  renderAttachmentRows($('customerAttachmentsList'), items, {
    emptyText: 'No attachments found for this customer.',
    mode: 'customer',
  });
}

function renderReleaseAttachments(items = []) {
  if ($('attachCount')) $('attachCount').textContent = `${items.length} attachments`;
  renderAttachmentRows($('attachmentsList'), items, {
    emptyText: 'No attachments registered for this release.',
    mode: 'release',
  });
}

/* --------------------------------------------------------------------- */
/* CUSTOMER ATTACHMENT FILTERS                                           */
/* --------------------------------------------------------------------- */
function setActiveBtn(container, value) {
  if (!container) return;
  [...container.querySelectorAll('.ar-attachBtn')].forEach((b) => {
    b.classList.toggle('is-active', b.dataset.value === String(value));
  });
}

function renderCustomerAttachFiltersUI() {
  const yearsWrap = $('customerYearBtns');
  const monthsWrap = $('customerMonthBtns');
  const categoryWrap = $('customerCategoryBtns');

  if (!yearsWrap || !monthsWrap || !categoryWrap) return;

  yearsWrap.innerHTML = '';
  monthsWrap.innerHTML = '';
  categoryWrap.innerHTML = '';

  const now = new Date();
  const currentYear = now.getFullYear();

  const years = Array.from({ length: 6 }, (_, i) => String(currentYear - i));
  const months = Array.from({ length: 12 }, (_, i) => pad2(i + 1));

  years.forEach((y) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ar-attachBtn';
    btn.textContent = y;
    btn.dataset.value = y;
    btn.addEventListener('click', async () => {
      state.customerAttachFilter.year = y;
      state.customerAttachFilter.month = null;
      setActiveBtn(yearsWrap, y);
      renderCustomerAttachFiltersUI();
      await reloadCustomerAttachmentsWithCurrentFilter();
    });
    yearsWrap.appendChild(btn);
  });

  months.forEach((m) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ar-attachBtn';
    btn.textContent = m;
    btn.dataset.value = m;
    btn.addEventListener('click', async () => {
      state.customerAttachFilter.month = m;
      setActiveBtn(monthsWrap, m);
      await reloadCustomerAttachmentsWithCurrentFilter();
    });
    monthsWrap.appendChild(btn);
  });

  Object.entries(CATEGORY_LABELS).forEach(([value, label]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ar-attachBtn';
    btn.textContent = label;
    btn.dataset.value = value;
    btn.addEventListener('click', async () => {
      state.customerAttachFilter.category = value;
      setActiveBtn(categoryWrap, value);
      await reloadCustomerAttachmentsWithCurrentFilter();
    });
    categoryWrap.appendChild(btn);
  });

  if (state.customerAttachFilter.year) setActiveBtn(yearsWrap, state.customerAttachFilter.year);
  if (state.customerAttachFilter.month) setActiveBtn(monthsWrap, state.customerAttachFilter.month);
  if (state.customerAttachFilter.category) setActiveBtn(categoryWrap, state.customerAttachFilter.category);
}

async function reloadCustomerAttachmentsWithCurrentFilter() {
  if (!state.customer?.id) return;

  const { bucket, prefix } = buildCustomerPrefix(state.customer, state.customerAttachFilter);

  if ($('cPrefix')) $('cPrefix').value = `${bucket} / ${prefix}`;

  await loadCustomerAttachments(state.customer.id, {
    bucket,
    prefix,
    category: state.customerAttachFilter.category,
  });
}

async function loadCustomerAttachments(customerId, { bucket, prefix, category } = {}) {
  try {
    const qs = new URLSearchParams();
    if (bucket) qs.set('bucket', bucket);
    if (prefix) qs.set('prefix', prefix);
    if (category) qs.set('category', category);

    const response = await fetchJSON(
      `${API}/customers/${encodeURIComponent(customerId)}/attachments?${qs.toString()}`
    );

    renderCustomerAttachments(response.items || []);
  } catch (e) {
    renderCustomerAttachments([]);
    showToast(`Failed to load customer attachments: ${e.message}`);
  }
}

/* --------------------------------------------------------------------- */
/* RELEASE LIST                                                          */
/* --------------------------------------------------------------------- */
function renderList() {
  const wrap = $('releasesList');
  if (!wrap) return;

  wrap.innerHTML = '';

  const items = state.items || [];
  if ($('listCount')) $('listCount').textContent = `${items.length} items`;

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'ar-muted';
    empty.style.padding = '12px 14px';
    empty.textContent = 'No releases found.';
    wrap.appendChild(empty);
    return;
  }

  items.forEach((it) => {
    const id = it.account_release_id ?? it.release_id ?? it.id;

    const row = document.createElement('div');
    row.className = `ar-row ${state.selectedId === id ? 'is-active' : ''}`;
    row.dataset.id = String(id);

    const top = document.createElement('div');
    top.className = 'ar-row__top';

    const title = document.createElement('div');
    title.className = 'ar-row__title';
    title.textContent = `#${id} • ${getCategoryLabel(it.category)} • ${competenceToMonth(it.competence)}`;

    const chip = document.createElement('span');
    chip.className = getStatusChipClass(it.status);
    chip.textContent = safeUpper(it.status || 'DRAFT');

    top.appendChild(title);
    top.appendChild(chip);

    const meta = document.createElement('div');
    meta.className = 'ar-row__meta';
    meta.innerHTML = `
      <span class="ar-chip">Amount: ${fmtMoney(it.amount)}</span>
      <span class="ar-chip">Final: ${fmtMoney(it.final_amount)}</span>
      ${it.company_id != null ? `<span class="ar-chip">Company: ${it.company_id}</span>` : ''}
      ${it.customer_id != null ? `<span class="ar-chip">Customer: ${it.customer_id}</span>` : ''}
    `;

    row.appendChild(top);
    row.appendChild(meta);

    row.addEventListener('click', () => selectRelease(id));
    wrap.appendChild(row);
  });
}

function clearForm() {
  if ($('releaseForm')) $('releaseForm').reset();
  if ($('fReleaseId')) $('fReleaseId').value = '';
  if ($('fFinalAmount')) $('fFinalAmount').value = '0.00';
  if ($('detailStatusPill')) $('detailStatusPill').textContent = '—';
  if ($('attachmentsList')) $('attachmentsList').innerHTML = '';
  if ($('attachCount')) $('attachCount').textContent = '0 attachments';
  state.selectedId = null;
  setButtonsBySelection(false);
}

function fillForm(it) {
  const id = it.account_release_id ?? it.release_id ?? it.id;

  if ($('fReleaseId')) $('fReleaseId').value = id ?? '';
  if ($('fCompanyId')) $('fCompanyId').value = it.company_id ?? '';
  if ($('fCustomerId')) $('fCustomerId').value = it.customer_id ?? '';
  if ($('fCompetence')) $('fCompetence').value = competenceToMonth(it.competence);
  if ($('fCategory')) $('fCategory').value = it.category || '';
  if ($('fStatus')) $('fStatus').value = safeUpper(it.status || 'DRAFT');

  if ($('fReleaseDate')) $('fReleaseDate').value = it.release_date ? String(it.release_date).slice(0, 10) : '';
  if ($('fDueDate')) $('fDueDate').value = it.due_date ? String(it.due_date).slice(0, 10) : '';
  if ($('fSentAt')) $('fSentAt').value = it.sent_at ? String(it.sent_at).slice(0, 16) : '';

  if ($('fAmount')) $('fAmount').value = Number(it.amount || 0);
  if ($('fExtraCharges')) $('fExtraCharges').value = Number(it.extra_charges || 0);
  if ($('fDiscounts')) $('fDiscounts').value = Number(it.discounts || 0);
  if ($('fTaxesAmount')) $('fTaxesAmount').value = Number(it.taxes_amount || 0);
  if ($('fFinalAmount')) $('fFinalAmount').value = Number(it.final_amount || 0).toFixed(2);

  if ($('fTitle')) $('fTitle').value = it.title ?? '';
  if ($('fNotes')) $('fNotes').value = it.notes ?? '';

  if ($('detailStatusPill')) $('detailStatusPill').textContent = safeUpper(it.status || '—');

  state.selectedId = id;
  setButtonsBySelection(true);
}

async function search() {
  const competence = monthToCompetence($('fltCompetence')?.value);
  const company_id = $('fltCompanyId')?.value ? Number($('fltCompanyId').value) : null;
  const category = $('fltCategory')?.value || null;
  const status = $('fltStatus')?.value || null;
  const customer_id = state.customer?.id ? Number(state.customer.id) : null;

  const qs = new URLSearchParams();
  if (competence) qs.set('competence', competence);
  if (company_id != null) qs.set('company_id', String(company_id));
  if (customer_id != null) qs.set('customer_id', String(customer_id));
  if (category) qs.set('category', category);
  if (status) qs.set('status', status);
  qs.set('limit', String(state.limit));
  qs.set('offset', String(state.offset));

  const response = await fetchJSON(`${API}?${qs.toString()}`);
  state.items = response.items || [];

  if ($('pageInfo')) $('pageInfo').textContent = `Page ${state.page}`;
  renderList();

  if (state.selectedId && !state.items.some((x) => (x.account_release_id ?? x.release_id ?? x.id) === state.selectedId)) {
    clearForm();
  }

  setButtonsBySelection(!!state.selectedId);
}

async function selectRelease(id) {
  const response = await fetchJSON(`${API}/${encodeURIComponent(id)}`);
  fillForm(response.item);
  renderList();
  await loadReleaseAttachments(id);
}

async function loadReleaseAttachments(releaseId) {
  const response = await fetchJSON(`${API}/${encodeURIComponent(releaseId)}/attachments?onlyActive=true`);
  renderReleaseAttachments(response.items || []);
}

async function ensure() {
  const response = await fetchJSON(`${API}/ensure`);
  if (response.ok) showToast('Tables ensured successfully ✅');
}

async function saveRelease() {
  const id = $('fReleaseId')?.value ? Number($('fReleaseId').value) : null;

  const payload = {
    company_id: $('fCompanyId')?.value ? Number($('fCompanyId').value) : null,
    customer_id: $('fCustomerId')?.value ? Number($('fCustomerId').value) : null,
    competence: monthToCompetence($('fCompetence')?.value),
    category: $('fCategory')?.value || null,
    status: $('fStatus')?.value || 'DRAFT',
    release_date: $('fReleaseDate')?.value || null,
    due_date: $('fDueDate')?.value || null,
    sent_at: $('fSentAt')?.value || null,
    amount: Number($('fAmount')?.value || 0),
    extra_charges: Number($('fExtraCharges')?.value || 0),
    discounts: Number($('fDiscounts')?.value || 0),
    taxes_amount: Number($('fTaxesAmount')?.value || 0),
    final_amount: calcFinalAmountLocal(),
    title: $('fTitle')?.value?.trim() || null,
    notes: $('fNotes')?.value || null,
  };

  if (!payload.customer_id || !payload.competence || !payload.category) {
    showToast('Customer, competence and category are required.');
    return;
  }

  if ($('fFinalAmount')) $('fFinalAmount').value = Number(payload.final_amount || 0).toFixed(2);

  if (!id) {
    const response = await fetchJSON(`${API}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    showToast('Release created ✅');
    state.offset = 0;
    state.page = 1;
    await search();
    await selectRelease(response.item.account_release_id ?? response.item.release_id ?? response.item.id);
  } else {
    const response = await fetchJSON(`${API}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    showToast('Release updated ✅');
    await search();
    await selectRelease(response.item.account_release_id ?? response.item.release_id ?? response.item.id);
  }
}

async function deleteRelease() {
  const id = $('fReleaseId')?.value ? Number($('fReleaseId').value) : null;
  if (!id) return;
  if (!confirm('Delete this release?')) return;

  await fetchJSON(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  showToast('Release deleted ✅');
  await search();
  clearForm();
}

async function sendRelease() {
  const id = $('fReleaseId')?.value ? Number($('fReleaseId').value) : null;
  if (!id) return;

  const response = await fetchJSON(`${API}/${encodeURIComponent(id)}/send`, { method: 'POST' });
  showToast('Release sent ✅');
  await search();
  await selectRelease(response.item.account_release_id ?? response.item.release_id ?? response.item.id);
}

async function cancelRelease() {
  const id = $('fReleaseId')?.value ? Number($('fReleaseId').value) : null;
  if (!id) return;

  const response = await fetchJSON(`${API}/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
  showToast('Release canceled ✅');
  await search();
  await selectRelease(response.item.account_release_id ?? response.item.release_id ?? response.item.id);
}

/* --------------------------------------------------------------------- */
/* ATTACHMENT UPLOAD                                                     */
/* --------------------------------------------------------------------- */
async function addAttachmentConfirm() {
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
    'accounting_documents';

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
    const sign = await fetchJSON(`${API}/attachments/sign`, {
      method: 'POST',
      body: JSON.stringify({
        bucket_name,
        object_path,
        mime_type,
      }),
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

    const confirmUrl = releaseId
      ? `${API}/${encodeURIComponent(releaseId)}/attachments/confirm`
      : `${API}/attachments/confirm`;

    await fetchJSON(confirmUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

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
  } finally {
    setButtonsBySelection(!!state.selectedId);
  }
}

async function deactivateAttachment(id) {
  if (!id) return;
  if (!confirm('Disable this attachment?')) return;

  await fetchJSON(`${API}/attachments/${encodeURIComponent(id)}/deactivate`, { method: 'POST' });
  showToast('Attachment disabled ✅');

  const rid = Number($('fReleaseId')?.value);
  if (rid) await loadReleaseAttachments(rid);

  if (state.customer?.id) {
    await reloadCustomerAttachmentsWithCurrentFilter();
  }
}

/* --------------------------------------------------------------------- */
/* CUSTOMER PICKER                                                       */
/* --------------------------------------------------------------------- */
function openCustomerPicker() {
  return new Promise((resolve) => {
    openCustomersModalSearch({
      apiBase: ROOT_API,
      onPick: (customer) => resolve(customer),
    });
  });
}

/* --------------------------------------------------------------------- */
/* EVENTS                                                                */
/* --------------------------------------------------------------------- */
function bindEvents() {
  $('btnEnsure')?.addEventListener('click', () => ensure().catch((e) => showToast(e.message)));

  $('btnSearch')?.addEventListener('click', () => {
    state.offset = 0;
    state.page = 1;
    search().catch((e) => showToast(e.message));
  });

  $('btnReset')?.addEventListener('click', () => {
    if ($('fltCompetence')) $('fltCompetence').value = '';
    if ($('fltCompanyId')) $('fltCompanyId').value = '';
    if ($('fltCategory')) $('fltCategory').value = '';
    if ($('fltStatus')) $('fltStatus').value = '';

    state.offset = 0;
    state.page = 1;

    clearCustomerUI();
    search().catch((e) => showToast(e.message));
  });

  $('btnPrev')?.addEventListener('click', () => {
    if (state.page <= 1) return;
    state.page -= 1;
    state.offset = Math.max(0, state.offset - state.limit);
    search().catch((e) => showToast(e.message));
  });

  $('btnNext')?.addEventListener('click', () => {
    if ((state.items || []).length < state.limit) return;
    state.page += 1;
    state.offset += state.limit;
    search().catch((e) => showToast(e.message));
  });

  $('btnNewRelease')?.addEventListener('click', () => {
    clearForm();
    if ($('fStatus')) $('fStatus').value = 'DRAFT';
    if ($('fReleaseDate')) $('fReleaseDate').value = new Date().toISOString().slice(0, 10);
    if ($('fCategory')) $('fCategory').value = $('fltCategory')?.value || 'accounting_documents';
    if (state.customer?.id && $('fCustomerId')) $('fCustomerId').value = String(state.customer.id);
    showToast('Fill required fields and save the release.');
  });

  $('btnCalc')?.addEventListener('click', () => {
    if ($('fFinalAmount')) $('fFinalAmount').value = calcFinalAmountLocal().toFixed(2);
    showToast('Final amount recalculated.');
  });

  ['fAmount', 'fExtraCharges', 'fDiscounts', 'fTaxesAmount'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      if ($('fFinalAmount')) $('fFinalAmount').value = calcFinalAmountLocal().toFixed(2);
    });
  });

  $('btnSave')?.addEventListener('click', () => saveRelease().catch((e) => showToast(e.message)));
  $('btnDelete')?.addEventListener('click', () => deleteRelease().catch((e) => showToast(e.message)));
  $('btnSendRelease')?.addEventListener('click', () => sendRelease().catch((e) => showToast(e.message)));
  $('btnCancelRelease')?.addEventListener('click', () => cancelRelease().catch((e) => showToast(e.message)));
  $('btnAddAttachment')?.addEventListener('click', () => addAttachmentConfirm().catch((e) => showToast(e.message)));

  $('btnPickCustomer')?.addEventListener('click', async () => {
    try {
      const picked = await openCustomerPicker();
      if (!picked) return;
      await applyCustomer(picked);
      await search();
      showToast('Customer selected ✅');
    } catch (e) {
      showToast(e.message);
    }
  });

  $('btnCustomerAttachAll')?.addEventListener('click', async () => {
    if (!state.customer?.id) return;

    state.customerAttachFilter.year = null;
    state.customerAttachFilter.month = null;
    state.customerAttachFilter.category = null;
    renderCustomerAttachFiltersUI();

    const { bucket, prefix } = buildCustomerPrefix(state.customer, { category: 'accounting_documents' });

    if ($('cPrefix')) $('cPrefix').value = `${bucket} / ${prefix}`;

    await loadCustomerAttachments(state.customer.id, { bucket, prefix });
    showToast('Showing all customer attachments.');
  });

  $('fileInput')?.addEventListener('change', () => {
    setButtonsBySelection(!!state.selectedId);
  });

  $('attachCustomName')?.addEventListener('input', () => {
    setButtonsBySelection(!!state.selectedId);
  });

  $('attachType')?.addEventListener('change', () => {
    setButtonsBySelection(!!state.selectedId);
  });

  $('fCategory')?.addEventListener('change', async () => {
    if (!state.customer?.id) return;
    state.customerAttachFilter.category = $('fCategory')?.value || null;
    renderCustomerAttachFiltersUI();
    await reloadCustomerAttachmentsWithCurrentFilter();
  });
}

/* --------------------------------------------------------------------- */
/* INIT                                                                  */
/* --------------------------------------------------------------------- */
async function init() {
  bindEvents();
  clearForm();
  clearCustomerUI();
  renderCustomerAttachFiltersUI();
  setButtonsBySelection(false);
  await search();
}

init().catch((e) => showToast(e.message || 'Failed to initialize page.'));