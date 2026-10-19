// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailInbox.js — Inbox (DB) + Sent (DB) + Compose — PRODNEX ERP       ║
// ║ Frontend ESM — Compatível com backend seguro por user/account        ║
// ║ ✅ FIX: DOM refs dinâmicas no painel de detalhe                      ║
// ║ ✅ FIX: render seguro para evitar tela travada                       ║
// ║ ✅ FIX: logs de diagnóstico do módulo Inbox                          ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openEmailReplyModal } from '/public/emailInbox/emailInboxModalReply.js';

// ---------------------------------------------------------------------
// API CONFIG
// ---------------------------------------------------------------------
const ROOT_API = (() => {
  if (typeof window === 'undefined') return 'http://localhost:8080';
  if (typeof window.getApiBase === 'function') return window.getApiBase();
  if (window.apiBase) return window.apiBase;
  if (window.API_BASE) return window.API_BASE;
  return window.location.origin;
})();

const EMAIL_API_BASE = `${ROOT_API}/api/email`;

const ROUTES = Object.freeze({
  listInbounds: `${EMAIL_API_BASE}/inbox`,
  getInbound: (id) => `${EMAIL_API_BASE}/inbox/${encodeURIComponent(id)}`,

  listOutbounds: `${EMAIL_API_BASE}/sent`,
  getOutbound: (id) => `${EMAIL_API_BASE}/sent/${encodeURIComponent(id)}`,

  sendOutbound: `${EMAIL_API_BASE}/outbounds`,
  signatureDefault: `${EMAIL_API_BASE}/signatures/default`,

  listAccounts: `${ROOT_API}/api/email/accounts?onlyActive=true&limit=200&offset=0`,
});

// ---------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------
function buildAuthHeaders(extra = {}) {
  try {
    if (window?.CONSART_AUTH?.getAuthHeaders) {
      return window.CONSART_AUTH.getAuthHeaders(extra);
    }
  } catch { }

  return extra;
}

// ---------------------------------------------------------------------
// DOM HELPERS
// ---------------------------------------------------------------------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value = '') {
  const el = byId(id);
  if (el) el.textContent = value ?? '';
  return el;
}

function setHtml(id, value = '') {
  const el = byId(id);
  if (el) el.innerHTML = value ?? '';
  return el;
}

function showEl(el, display = '') {
  if (el) el.style.display = display;
}

function addClass(el, cls) {
  if (el) el.classList.add(cls);
}

function removeClass(el, cls) {
  if (el) el.classList.remove(cls);
}

function toggleClass(el, cls, force) {
  if (el) el.classList.toggle(cls, force);
}

// ---------------------------------------------------------------------
// DOM STATIC REFS
// ---------------------------------------------------------------------
const btnNewEmail = $('#btnNewEmail');
const btnSendEmail = $('#btnSendEmail');
const btnCancelCompose = $('#btnCancelCompose');
const emailSearch = $('#emailSearch');

const folderButtons = $$('.email-folder-item');
const emailListEl = $('#emailList');
const emailListStatusEl = $('#emailListStatus');

const btnReplyEmail = $('#btnReplyEmail');
const btnReplyAllEmail = $('#btnReplyAllEmail');

const composePanel = $('#composePanel');
const composeForm = $('#emailComposeForm');
const composeAccountId = $('#composeAccountId');
const composeTo = $('#composeTo');
const composeSubject = $('#composeSubject');
const composeBody = $('#composeBody');

const composeAttachments = $('#composeAttachments');
const attachmentsList = $('#attachmentsList');

const emailAccountsBarStatus = byId('emailAccountsBarStatus');
const emailAccountsButtons = byId('emailAccountsButtons');

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
let currentFolder = 'inbox';
let messagesByFolder = { inbox: [], sent: [] };
let selectedMessageId = null;
let selectedMessageData = null;
let cachedSignatureText = null;
let selectedFiles = [];
let cachedAccounts = [];

const LS_KEY_LAST_ACCOUNT = 'consart_email_last_account_id';
const LS_KEY_ACTIVE_ACCOUNT_FILTER = 'consart_email_active_account_filter';

let activeAccountFilterId = null;

const MAX_FILES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const URL_PARAM_ACCOUNT = 'account_id';

// ---------------------------------------------------------------------
// URL HELPERS
// ---------------------------------------------------------------------
function getUrlAccountParam() {
  try {
    const u = new URL(window.location.href);
    const v = (u.searchParams.get(URL_PARAM_ACCOUNT) || '').trim();
    return v || null;
  } catch {
    return null;
  }
}

function setUrlAccountParam(valOrNull) {
  try {
    const u = new URL(window.location.href);

    if (valOrNull == null || String(valOrNull).trim() === '') {
      u.searchParams.delete(URL_PARAM_ACCOUNT);
    } else {
      u.searchParams.set(URL_PARAM_ACCOUNT, String(valOrNull));
    }

    window.history.replaceState({}, '', u.toString());
  } catch { }
}

function applyAccountFilterFromUrlOrStorage() {
  const fromUrl = getUrlAccountParam();

  if (fromUrl) {
    if (String(fromUrl).toUpperCase() === 'ALL') {
      activeAccountFilterId = null;
      return { source: 'url', value: null };
    }

    const n = Number(fromUrl);
    if (Number.isFinite(n) && n > 0) {
      activeAccountFilterId = n;
      return { source: 'url', value: n };
    }
  }

  const saved = (localStorage.getItem(LS_KEY_ACTIVE_ACCOUNT_FILTER) || '').trim();
  const ns = Number(saved);
  activeAccountFilterId = Number.isFinite(ns) && ns > 0 ? ns : null;

  return { source: 'storage', value: activeAccountFilterId };
}

function persistAccountFilterToStorage() {
  if (activeAccountFilterId === null) {
    localStorage.removeItem(LS_KEY_ACTIVE_ACCOUNT_FILTER);
  } else {
    localStorage.setItem(LS_KEY_ACTIVE_ACCOUNT_FILTER, String(activeAccountFilterId));
  }
}

// ---------------------------------------------------------------------
// FORMAT HELPERS
// ---------------------------------------------------------------------
function toPositiveIntOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function formatShortDate(date) {
  try {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatLongDate(date) {
  try {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);

  if (n < 1024) return `${n} B`;

  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function stripHtmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  return (tmp.textContent || tmp.innerText || '').trim();
}

function normalizeSubjectForReply(subject) {
  const s = String(subject || '').trim();

  if (!s) return 'Re: (no subject)';
  if (/^\s*re\s*:/i.test(s)) return s;

  return `Re: ${s}`;
}

function buildQuotedBlockHtml({ from, to, dateStr, subject, bodyText }) {
  const metaLine = `Em ${dateStr || ''}, ${from || ''} escreveu:`;

  return `
    <br>
    <div style="border-top:1px solid #e5e7eb; margin:12px 0;"></div>
    <blockquote style="
      border-left: 3px solid #d1d5db;
      margin: 0;
      padding: 8px 0 8px 12px;
      color: #374151;
      font-size: 13px;
      line-height: 1.45;
    ">
      <div><strong>${escapeHtml(metaLine)}</strong></div>
      <div><strong>Assunto:</strong> ${escapeHtml(subject || '')}</div>
      ${to ? `<div><strong>Para:</strong> ${escapeHtml(to)}</div>` : ''}
      <br>
      <div>${textToHtml(bodyText || '(sem conteúdo)')}</div>
    </blockquote>
  `.trim();
}

// ---------------------------------------------------------------------
// ACCOUNTS TOP BAR
// ---------------------------------------------------------------------
function setActiveAccountFilter(accountIdOrNull, { fromUrl = false } = {}) {
  activeAccountFilterId = accountIdOrNull === null ? null : Number(accountIdOrNull);

  if (!Number.isFinite(activeAccountFilterId) || activeAccountFilterId <= 0) {
    activeAccountFilterId = null;
  }

  if (!fromUrl) {
    persistAccountFilterToStorage();
    setUrlAccountParam(activeAccountFilterId === null ? 'ALL' : activeAccountFilterId);
  }

  renderAccountsTopButtons(true);
  hideComposePanel();
  clearDetail();
  loadFolder(currentFolder);
}

function renderAccountsTopButtons(onlyUpdateActiveState = false) {
  if (!emailAccountsButtons) return;

  if (onlyUpdateActiveState) {
    Array.from(emailAccountsButtons.querySelectorAll('button') || []).forEach((btn) => {
      const bid = (btn.dataset.accountId || '').trim();
      const isAll = bid === '';

      const isActive =
        (activeAccountFilterId === null && isAll) ||
        (activeAccountFilterId !== null && bid === String(activeAccountFilterId));

      btn.classList.toggle('is-active', isActive);
    });

    return;
  }

  const accounts = Array.isArray(cachedAccounts) ? cachedAccounts : [];
  emailAccountsButtons.innerHTML = '';

  if (emailAccountsBarStatus) {
    const name = activeAccountFilterId === null ? 'Todas' : `Conta #${activeAccountFilterId}`;

    emailAccountsBarStatus.textContent = accounts.length
      ? `${accounts.length} conta(s) • Filtro: ${name}`
      : 'Nenhuma conta';
  }

  const btnAll = document.createElement('button');
  btnAll.type = 'button';
  btnAll.className = 'btn btn-flat';
  btnAll.textContent = '📬 Todas';
  btnAll.dataset.accountId = '';

  if (activeAccountFilterId === null) {
    btnAll.classList.add('is-active');
  }

  btnAll.addEventListener('click', () => setActiveAccountFilter(null, { fromUrl: false }));
  emailAccountsButtons.appendChild(btnAll);

  for (const a of accounts) {
    const id = Number(a?.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const label = (a.label || a.email_address || a.email || `Conta #${id}`).trim();
    const email = (a.email_address || a.email || '').trim();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-flat';
    btn.dataset.accountId = String(id);
    btn.title = email || label;
    btn.textContent = `✉️ ${label}`;

    if (activeAccountFilterId === id) {
      btn.classList.add('is-active');
    }

    btn.addEventListener('click', () => setActiveAccountFilter(id, { fromUrl: false }));
    emailAccountsButtons.appendChild(btn);
  }
}

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  try {
    bindFolderButtons();
    bindSearch();
    bindComposeButtons();

    await loadAccountsIntoSelect();

    const applied = applyAccountFilterFromUrlOrStorage();
    renderAccountsTopButtons(false);

    setUrlAccountParam(activeAccountFilterId === null ? 'ALL' : activeAccountFilterId);

    await loadFolder('inbox');

    if (composePanel && !composePanel.classList.contains('is-hidden')) {
      await initComposeWithSignature();
    }

    console.log('[EmailInbox] Module initialized', {
      appliedAccountFilter: applied,
      activeAccountFilterId,
      currentFolder,
    });
  } catch (err) {
    console.error('[EmailInbox] Initialization error:', err);

    showCenterModal({
      variant: 'error',
      title: 'Erro ao iniciar Inbox',
      message: String(err?.message || err),
    });
  }
});

// ---------------------------------------------------------------------
// BINDINGS
// ---------------------------------------------------------------------
function bindFolderButtons() {
  folderButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const folder = btn.dataset.folder === 'sent' ? 'sent' : 'inbox';

      if (folder === currentFolder) return;

      currentFolder = folder;

      folderButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      hideComposePanel();
      clearDetail();

      await loadFolder(folder);
    });
  });
}

function bindSearch() {
  if (!emailSearch) return;

  emailSearch.addEventListener('input', () => renderList());
}

function bindComposeButtons() {
  btnNewEmail?.addEventListener('click', () => openComposePanel());
  btnCancelCompose?.addEventListener('click', () => hideComposePanel());
  btnSendEmail?.addEventListener('click', () => handleSendEmail());

  btnReplyEmail?.addEventListener('click', () => openReplyInModal('reply'));
  btnReplyAllEmail?.addEventListener('click', () => openReplyInModal('replyAll'));

  composeAccountId?.addEventListener('change', () => {
    const v = (composeAccountId.value || '').trim();

    if (v) {
      localStorage.setItem(LS_KEY_LAST_ACCOUNT, v);
    }
  });

  if (composeAttachments) {
    composeAttachments.addEventListener('change', () => {
      const picked = Array.from(composeAttachments.files || []);

      if (!picked.length) return;

      const accepted = [];
      const rejected = [];

      for (const f of picked) {
        if ((selectedFiles.length + accepted.length) >= MAX_FILES) {
          rejected.push({ file: f, reason: `máximo ${MAX_FILES} arquivos` });
          continue;
        }

        if (f.size > MAX_FILE_SIZE) {
          rejected.push({ file: f, reason: `maior que ${formatBytes(MAX_FILE_SIZE)}` });
          continue;
        }

        accepted.push(f);
      }

      selectedFiles = [...selectedFiles, ...accepted];
      composeAttachments.value = '';

      renderAttachments();

      if (rejected.length) {
        const lines = rejected
          .slice(0, 4)
          .map((r) => `• ${r.file.name} (${formatBytes(r.file.size)}) — ${r.reason}`)
          .join('\n');

        showCenterModal({
          variant: 'warning',
          title: 'Alguns arquivos não foram adicionados',
          message:
            `Alguns arquivos foram rejeitados:\n${lines}` +
            (rejected.length > 4 ? `\n… e mais ${rejected.length - 4}.` : ''),
        });
      }
    });
  }
}

// ---------------------------------------------------------------------
// ACCOUNTS
// ---------------------------------------------------------------------
async function loadAccountsIntoSelect() {
  if (composeAccountId) {
    composeAccountId.innerHTML = `<option value="">Loading accounts...</option>`;
  }

  try {
    const res = await fetch(ROUTES.listAccounts, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);

    const accounts =
      Array.isArray(data?.accounts) ? data.accounts :
        Array.isArray(data?.rows) ? data.rows :
          Array.isArray(data?.data) ? data.data :
            Array.isArray(data) ? data : [];

    cachedAccounts = accounts;
    renderAccountsTopButtons(false);

    if (!composeAccountId) return;

    if (!accounts.length) {
      composeAccountId.innerHTML = `<option value="">No accounts found</option>`;
      return;
    }

    const last = (localStorage.getItem(LS_KEY_LAST_ACCOUNT) || '').trim();

    composeAccountId.innerHTML = `<option value="">Select an account...</option>`;

    for (const a of accounts) {
      const id = String(a.id);
      const label = (a.label || a.email_address || a.email || `Account #${id}`).trim();
      const email = (a.email_address || a.email || '').trim();
      const text = email ? `${label} — ${email}` : label;

      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = text;

      composeAccountId.appendChild(opt);
    }

    if (last && accounts.some((a) => String(a.id) === last)) {
      composeAccountId.value = last;
    } else if (accounts.length === 1) {
      composeAccountId.value = String(accounts[0].id);
      localStorage.setItem(LS_KEY_LAST_ACCOUNT, composeAccountId.value);
    }
  } catch (err) {
    console.error('[EmailInbox] Error loading accounts:', err);

    if (composeAccountId) {
      composeAccountId.innerHTML = `<option value="">Error loading accounts</option>`;
    }

    showCenterModal({
      variant: 'error',
      title: 'Error loading accounts',
      message: String(err.message || err),
    });
  }
}

function getSelectedAccountIdOrNull() {
  const raw = (composeAccountId?.value || '').trim();
  return toPositiveIntOrNull(raw);
}

// ---------------------------------------------------------------------
// SIGNATURE
// ---------------------------------------------------------------------
async function ensureSignatureLoaded() {
  if (cachedSignatureText !== null) {
    return cachedSignatureText;
  }

  try {
    const res = await fetch(ROUTES.signatureDefault, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    const text =
      data?.text ||
      data?.textSignature ||
      data?.signatureText ||
      '';

    cachedSignatureText = text || '';

    return cachedSignatureText;
  } catch (err) {
    console.error('[EmailInbox] Error loading default signature:', err);

    cachedSignatureText = '';

    return '';
  }
}

async function initComposeWithSignature() {
  composeForm?.reset();

  const keepAccount = (localStorage.getItem(LS_KEY_LAST_ACCOUNT) || '').trim();

  if (composeAccountId && keepAccount) {
    composeAccountId.value = keepAccount;
  }

  selectedFiles = [];

  if (attachmentsList) {
    attachmentsList.innerHTML = '';
  }

  const sig = await ensureSignatureLoaded();

  if (composeBody) {
    composeBody.value = sig ? `<div>${textToHtml(sig)}</div><br>` : '';
    composeBody.focus();

    try {
      composeBody.setSelectionRange(0, 0);
    } catch { }
  }
}

// ---------------------------------------------------------------------
// REPLY
// ---------------------------------------------------------------------
function pickBestAccountIdForReply() {
  const inboundAccountId =
    selectedMessageData?.account_id ??
    selectedMessageData?.accountId ??
    null;

  const n = Number(inboundAccountId);

  if (Number.isFinite(n) && n > 0) {
    return n;
  }

  const last = (localStorage.getItem(LS_KEY_LAST_ACCOUNT) || '').trim();
  const ln = Number(last);

  if (Number.isFinite(ln) && ln > 0) {
    return ln;
  }

  return null;
}

async function openReplyInModal(mode = 'reply') {
  if (currentFolder === 'sent') return;

  if (!selectedMessageData) {
    showCenterModal({
      variant: 'warning',
      title: 'Select an e-mail',
      message: 'Please select an inbound e-mail to reply.',
    });
    return;
  }

  if (!Array.isArray(cachedAccounts) || cachedAccounts.length === 0) {
    await loadAccountsIntoSelect();
  }

  const sig = await ensureSignatureLoaded();
  const signatureHtml = sig ? `<div>${textToHtml(sig)}</div>` : '';

  await openEmailReplyModal({
    mode,
    selectedMessageData,
    cachedAccounts,
    routes: { sendOutbound: ROUTES.sendOutbound },
    signatureHtml,
    pickBestAccountIdForReply,
    maxFiles: MAX_FILES,
    maxFileSize: MAX_FILE_SIZE,
  });
}

async function openReplyCompose({ mode = 'reply' } = {}) {
  if (currentFolder === 'sent') return;

  if (!selectedMessageData) {
    showCenterModal({
      variant: 'warning',
      title: 'Select an e-mail',
      message: 'Please select an inbound e-mail to reply.',
    });
    return;
  }

  const from = (selectedMessageData?.from_address || selectedMessageData?.from || '').trim();
  const toOriginal = (selectedMessageData?.to_address || selectedMessageData?.to || '').trim();
  const subjectOriginal = (selectedMessageData?.subject || '(no subject)').trim();

  let replyTo = from;

  if (mode === 'replyAll') {
    const tokens = []
      .concat(from ? [from] : [])
      .concat(toOriginal ? toOriginal.split(',') : [])
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set();

    const dedup = tokens.filter((t) => {
      const k = t.toLowerCase();

      if (seen.has(k)) return false;

      seen.add(k);
      return true;
    });

    replyTo = dedup.join(', ');
  }

  const html = selectedMessageData?.body_html || selectedMessageData?.html || '';
  const text = (selectedMessageData?.body_text || selectedMessageData?.text || '').trim();
  const bodyText = text || (html ? stripHtmlToText(html) : '');

  const dateValue =
    selectedMessageData?.received_at ||
    selectedMessageData?.sent_at ||
    selectedMessageData?.created_at ||
    selectedMessageData?.date ||
    null;

  const date = dateValue ? new Date(dateValue) : null;
  const dateStr = date ? formatLongDate(date) : '';

  const sig = await ensureSignatureLoaded();

  const quotedHtml = buildQuotedBlockHtml({
    from,
    to: toOriginal,
    dateStr,
    subject: subjectOriginal,
    bodyText,
  });

  clearDetail();
  showDetailPlaceholder(false);

  removeClass(composePanel, 'is-hidden');

  if (!cachedAccounts.length) {
    await loadAccountsIntoSelect();
  }

  const accountId = pickBestAccountIdForReply();

  if (composeAccountId && accountId) {
    composeAccountId.value = String(accountId);
    localStorage.setItem(LS_KEY_LAST_ACCOUNT, String(accountId));
  }

  if (composeTo) composeTo.value = replyTo || '';
  if (composeSubject) composeSubject.value = normalizeSubjectForReply(subjectOriginal);

  if (composeBody) {
    const sigHtml = sig ? `<div>${textToHtml(sig)}</div><br>` : '';
    const finalHtml = `${sigHtml}${quotedHtml}`.trim();

    composeBody.value = finalHtml;
    composeBody.focus();

    try {
      composeBody.setSelectionRange(0, 0);
    } catch { }
  }

  selectedFiles = [];

  if (attachmentsList) {
    attachmentsList.innerHTML = '';
  }
}

function inboxLog(step, payload = {}) {
  console.log(`[EmailInbox][${step}]`, {
    time: new Date().toISOString(),
    currentFolder,
    selectedMessageId,
    activeAccountFilterId,
    ...payload,
  });
}

function inboxWarn(step, payload = {}) {
  console.warn(`[EmailInbox][${step}]`, {
    time: new Date().toISOString(),
    currentFolder,
    selectedMessageId,
    activeAccountFilterId,
    ...payload,
  });
}

function inboxError(step, err, payload = {}) {
  console.error(`[EmailInbox][${step}]`, {
    time: new Date().toISOString(),
    message: err?.message,
    stack: err?.stack,
    currentFolder,
    selectedMessageId,
    activeAccountFilterId,
    ...payload,
  });
}

// ---------------------------------------------------------------------
// LOAD / RENDER LIST
// ---------------------------------------------------------------------
async function loadFolder(folder) {
  const isInbox = folder !== 'sent';

  if (emailListStatusEl) {
    emailListStatusEl.textContent = 'Loading e-mails...';
  }

  if (emailListEl) {
    emailListEl.innerHTML = '';
  }

  try {
    const url = isInbox ? ROUTES.listInbounds : ROUTES.listOutbounds;

    const qs = new URLSearchParams();

    if (activeAccountFilterId) {
      qs.set('account_id', String(activeAccountFilterId));
    }

    const finalUrl = qs.toString() ? `${url}?${qs.toString()}` : url;

    console.log('[EmailInbox] Loading folder:', {
      folder,
      finalUrl,
      activeAccountFilterId,
    });

    const res = await fetch(finalUrl, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();

    if (Array.isArray(data?.accounts)) {
      cachedAccounts = data.accounts;
      renderAccountsTopButtons(false);
    }

    const selectedBackendId = toPositiveIntOrNull(data?.selectedAccount?.id);

    if (selectedBackendId) {
      activeAccountFilterId = selectedBackendId;
      renderAccountsTopButtons(true);
      setUrlAccountParam(selectedBackendId);
      persistAccountFilterToStorage();
    }

    const list = Array.isArray(data?.items) ? data.items : [];

    messagesByFolder[folder] = list.map((raw) => normalizeListMessage(raw, folder));

    if (!messagesByFolder[folder].length) {
      if (emailListStatusEl) {
        emailListStatusEl.textContent = 'No e-mails found.';
      }

      return;
    }

    if (emailListStatusEl) {
      emailListStatusEl.textContent = `${messagesByFolder[folder].length} e-mails loaded`;
    }

    renderList();
  } catch (err) {
    console.error('[EmailInbox] Error loading folder', folder, err);

    if (emailListStatusEl) {
      emailListStatusEl.textContent = 'Error loading e-mails.';
    }

    showCenterModal({
      variant: 'error',
      title: 'Error loading e-mails',
      message: String(err.message || err),
    });
  }
}

function normalizeListMessage(raw, folder) {
  const id = raw?.id ?? String(Math.random());
  const subject = raw?.subject || '(no subject)';

  const from = raw?.from_address || raw?.from || raw?.sender || '';
  const to = raw?.to_address || raw?.to || '';

  const dateValue =
    raw?.received_at ||
    raw?.sent_at ||
    raw?.created_at ||
    raw?.date ||
    null;

  const date = dateValue ? new Date(dateValue) : null;

  const preview =
    raw?.preview ||
    raw?.snippet ||
    raw?.textPreview ||
    (raw?.body_text || raw?.text || '').slice(0, 120) ||
    '';

  const unread = folder === 'inbox'
    ? (raw?.is_read === true || raw?.unread === false ? false : true)
    : false;

  const attCount =
    raw?.attachments_count ??
    raw?.attachmentsCount ??
    (Array.isArray(raw?.attachments_meta) ? raw.attachments_meta.length : null);

  const hasAttachments = typeof attCount === 'number' ? attCount > 0 : !!attCount;
  const accountId = raw?.account_id ?? raw?.accountId ?? null;

  return {
    id,
    subject,
    from,
    to,
    date,
    preview,
    unread,
    hasAttachments,
    folder,
    account_id: accountId,
  };
}

function renderList() {
  if (!emailListEl) return;

  const folder = currentFolder;
  const all = messagesByFolder[folder] || [];
  const term = emailSearch?.value?.trim().toLowerCase() || '';

  const filtered = term
    ? all.filter((item) => (
      (item.subject || '').toLowerCase().includes(term) ||
      (item.from || '').toLowerCase().includes(term)
    ))
    : all;

  emailListEl.innerHTML = '';

  if (!filtered.length) {
    if (emailListStatusEl) {
      emailListStatusEl.textContent = 'No e-mails found with this filter.';
    }

    return;
  }

  if (emailListStatusEl) {
    emailListStatusEl.textContent = `${filtered.length} e-mails visible`;
  }

  filtered.forEach((msg) => {
    const li = document.createElement('li');
    li.className = 'email-list-item';
    li.dataset.id = String(msg.id);

    if (msg.unread) {
      li.classList.add('is-unread');
    }

    if (selectedMessageId && String(msg.id) === String(selectedMessageId)) {
      li.classList.add('is-active');
    }

    li.innerHTML = `
      <div class="email-item-row-top">
        <div class="email-item-main">
          <div class="email-item-from-line">
            <span class="email-item-from">${escapeHtml(msg.from || '')}</span>
            ${msg.hasAttachments ? `<span title="Has attachment">📎</span>` : ``}
          </div>

          <div class="email-item-subject-line">
            <span class="email-item-dot"></span>
            <span class="email-item-subject">${escapeHtml(msg.subject || '')}</span>
          </div>
        </div>

        <span class="email-item-date">
          ${msg.date ? formatShortDate(msg.date) : ''}
        </span>
      </div>

      <div class="email-item-preview">${escapeHtml(msg.preview || '')}</div>
    `;

    li.addEventListener('click', () => selectMessage(msg.id));
    emailListEl.appendChild(li);
  });
}

// ---------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------
function getDetailDom() {
  return {
    placeholder: byId('emailDetailPlaceholder'),
    panel: byId('emailDetail'),
    subject: byId('emailSubject'),
    from: byId('emailFrom'),
    to: byId('emailTo'),
    date: byId('emailDate'),
    bodyHtml: byId('emailBodyHtml'),
    bodyText: byId('emailBodyText'),
    attachmentsWrap: byId('emailAttachmentsWrap'),
    attachmentsEl: byId('emailAttachments'),
  };
}

function logMissingDetailDom(dom) {
  const missing = Object.entries(dom)
    .filter(([, el]) => !el)
    .map(([key]) => key);

  if (missing.length) {
    console.warn('[EmailInbox] Missing detail DOM elements:', missing);
  }
}

function markListItemAsReadUI(messageId) {
  const idStr = String(messageId);

  const li = document.querySelector(
    `#emailList .email-list-item[data-id="${CSS.escape(idStr)}"]`
  );

  if (!li) return;

  li.classList.remove('is-unread');
}

function markStateAsRead(messageId) {
  const idStr = String(messageId);
  const list = messagesByFolder?.inbox || [];
  const idx = list.findIndex((m) => String(m.id) === idStr);

  if (idx >= 0) {
    list[idx].unread = false;
  }
}

async function selectMessage(messageId) {
  selectedMessageId = messageId;

  $$('#emailList .email-list-item').forEach((li) => {
    li.classList.toggle('is-active', li.dataset.id === String(messageId));
  });

  showDetailPlaceholder(false);
  hideComposePanel();
  renderDetailAttachments([]);

  try {
    const isInbox = currentFolder !== 'sent';

    const url = isInbox
      ? ROUTES.getInbound(messageId)
      : ROUTES.getOutbound(messageId);

    console.log('[EmailInbox] Loading message:', {
      messageId,
      currentFolder,
      url,
    });

    const res = await fetch(url, {
      credentials: 'include',
      headers: buildAuthHeaders(),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    selectedMessageData = data;

    console.log('[EmailInbox] Message loaded:', data);

    const subject = data?.subject || '(no subject)';
    const from = data?.from_address || data?.from || '';
    const to = data?.to_address || data?.to || '';

    const dateValue =
      data?.received_at ||
      data?.sent_at ||
      data?.created_at ||
      data?.date ||
      null;

    const date = dateValue ? new Date(dateValue) : null;

    const html = data?.body_html || data?.html || '';
    const text = data?.body_text || data?.text || '';

    const dom = getDetailDom();
    logMissingDetailDom(dom);

    if (dom.subject) dom.subject.textContent = subject;
    if (dom.from) dom.from.textContent = from;
    if (dom.to) dom.to.textContent = to;
    if (dom.date) dom.date.textContent = date ? formatLongDate(date) : '';

    if (html) {
      if (dom.bodyHtml) dom.bodyHtml.innerHTML = html;

      if (dom.bodyText) {
        dom.bodyText.textContent = '';
        dom.bodyText.style.display = 'none';
      }
    } else {
      if (dom.bodyHtml) dom.bodyHtml.innerHTML = '';

      if (dom.bodyText) {
        dom.bodyText.textContent = text || '(no content)';
        dom.bodyText.style.display = 'block';
      }
    }

    const atts = extractAttachmentsFromDb(data);
    renderDetailAttachments(atts);

    removeClass(dom.panel, 'is-hidden');

    const showReply = isInbox === true;

    btnReplyEmail?.classList.toggle('is-hidden', !showReply);
    btnReplyAllEmail?.classList.toggle('is-hidden', !showReply);

    if (isInbox) {
      try {
        // UI immediate feedback
        markStateAsRead(messageId);
        markListItemAsReadUI(messageId);

        // BACKEND UPDATE
        await fetch(
          `${EMAIL_API_BASE}/inbounds/${encodeURIComponent(messageId)}/read`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: buildAuthHeaders(),
          }
        );

        console.log('[EmailInbox] Message marked as read:', messageId);

        localStorage.setItem(
          'consart_email_alert_refresh',
          String(Date.now())
        );

        // OPTIONAL:
        // refresh dashboard/home counters
        window.dispatchEvent(
          new CustomEvent('email:updated', {
            detail: {
              type: 'read',
              id: messageId,
            },
          })
        );

      } catch (err) {
        console.error('[EmailInbox] Error marking message as read:', err);
      }
    }
  } catch (err) {
    console.error('[EmailInbox] Error loading message', err);

    showCenterModal({
      variant: 'error',
      title: 'Error loading e-mail',
      message: String(err.message || err),
    });
  }
}

function clearDetail() {
  selectedMessageId = null;
  selectedMessageData = null;

  const dom = getDetailDom();

  if (dom.subject) dom.subject.textContent = '';
  if (dom.from) dom.from.textContent = '';
  if (dom.to) dom.to.textContent = '';
  if (dom.date) dom.date.textContent = '';
  if (dom.bodyHtml) dom.bodyHtml.innerHTML = '';

  if (dom.bodyText) {
    dom.bodyText.textContent = '';
    dom.bodyText.style.display = 'block';
  }

  btnReplyEmail?.classList.add('is-hidden');
  btnReplyAllEmail?.classList.add('is-hidden');

  addClass(dom.panel, 'is-hidden');

  renderDetailAttachments([]);
  showDetailPlaceholder(true);
}

function showDetailPlaceholder(show) {
  const placeholder = byId('emailDetailPlaceholder');

  if (!placeholder) return;

  placeholder.style.display = show ? 'flex' : 'none';
}

// ---------------------------------------------------------------------
// ATTACHMENTS READ MODE
// ---------------------------------------------------------------------
function extractAttachmentsFromDb(data) {
  const meta = data?.attachments_meta ?? data?.attachmentsMeta ?? null;
  const arr = Array.isArray(meta) ? meta : [];

  return arr.map((a) => ({
    name: a?.filename || a?.name || 'attachment',
    size: Number(a?.size || 0) || 0,
    mime: a?.contentType || a?.mime || a?.mimeType || '',
    url: a?.url || a?.downloadUrl || a?.signedUrl || '',
    id: a?.id || '',
    raw: a,
  }));
}

function renderDetailAttachments(attachments) {
  const dom = getDetailDom();

  if (!dom.attachmentsWrap || !dom.attachmentsEl) return;

  dom.attachmentsEl.innerHTML = '';

  const list = Array.isArray(attachments) ? attachments : [];

  if (!list.length) {
    dom.attachmentsWrap.classList.add('is-hidden');
    return;
  }

  dom.attachmentsWrap.classList.remove('is-hidden');

  for (const att of list) {
    const row = document.createElement('div');
    row.className = 'email-attach-item';

    const safeName = escapeHtml(att.name || 'attachment');

    const meta = [
      att.mime ? escapeHtml(att.mime) : '',
      att.size ? formatBytes(att.size) : '',
    ].filter(Boolean).join(' • ');

    row.innerHTML = `
      <div class="email-attach-left">
        <div>
          <div class="email-attach-name">📎 ${safeName}</div>
          <div class="email-attach-meta">${escapeHtml(meta || '')}</div>
        </div>
      </div>

      <div class="email-attach-actions"></div>
    `;

    const actions = row.querySelector('.email-attach-actions');

    if (att.url) {
      const a = document.createElement('a');
      a.className = 'btn btn-flat';
      a.href = att.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open';

      actions.appendChild(a);

      const dl = document.createElement('a');
      dl.className = 'btn btn-primary';
      dl.href = att.url;
      dl.download = att.name || 'attachment';
      dl.textContent = 'Download';

      actions.appendChild(dl);
    } else {
      const hint = document.createElement('span');
      hint.style.fontSize = '12px';
      hint.style.color = 'var(--muted)';
      hint.textContent = 'No download URL';

      actions.appendChild(hint);
    }

    dom.attachmentsEl.appendChild(row);
  }
}

// ---------------------------------------------------------------------
// COMPOSE
// ---------------------------------------------------------------------
async function openComposePanel() {
  clearDetail();
  showDetailPlaceholder(false);

  removeClass(composePanel, 'is-hidden');

  if (!cachedAccounts.length) {
    await loadAccountsIntoSelect();
  }

  await initComposeWithSignature();
}

function hideComposePanel() {
  addClass(composePanel, 'is-hidden');

  selectedFiles = [];

  if (attachmentsList) {
    attachmentsList.innerHTML = '';
  }

  if (!selectedMessageId) {
    showDetailPlaceholder(true);
  }
}

function renderAttachments() {
  if (!attachmentsList) return;

  attachmentsList.innerHTML = '';

  if (!selectedFiles.length) return;

  selectedFiles.forEach((file, idx) => {
    const chip = document.createElement('div');
    chip.className = 'email-attach-chip';

    chip.innerHTML = `
      📎 <strong>${escapeHtml(file.name)}</strong>
      <span>(${formatBytes(file.size)})</span>
      <button type="button" class="email-attach-remove" title="Remove">✖</button>
    `;

    chip.querySelector('.email-attach-remove')?.addEventListener('click', () => {
      selectedFiles.splice(idx, 1);
      renderAttachments();
    });

    attachmentsList.appendChild(chip);
  });
}

// ---------------------------------------------------------------------
// SEND
// ---------------------------------------------------------------------
async function handleSendEmail() {
  const account_id = getSelectedAccountIdOrNull();
  const to = (composeTo?.value || '').trim();
  const subject = (composeSubject?.value || '').trim();
  const body = (composeBody?.value || '').trim();

  if (!account_id) {
    showCenterModal({
      variant: 'warning',
      title: 'Select an account',
      message: 'Please select the sender account (account_id).',
    });

    composeAccountId?.focus();
    return;
  }

  if (!to) {
    showCenterModal({
      variant: 'warning',
      title: 'Missing recipient',
      message: 'Please fill the "To" field.',
    });

    composeTo?.focus();
    return;
  }

  if (!subject) {
    showCenterModal({
      variant: 'warning',
      title: 'Missing subject',
      message: 'Please fill the "Subject" field.',
    });

    composeSubject?.focus();
    return;
  }

  async function parseBackendError(res) {
    const ct = (res.headers.get('content-type') || '').toLowerCase();

    if (ct.includes('application/json')) {
      const j = await res.json().catch(() => null);

      const msg =
        (j?.details ? `${j.details}` : '') ||
        (j?.error ? `${j.error}` : '') ||
        (j?.message ? `${j.message}` : '') ||
        '';

      return { json: j, message: msg || `HTTP ${res.status}` };
    }

    const text = await res.text().catch(() => '');

    return { json: null, message: text || `HTTP ${res.status}` };
  }

  try {
    if (btnSendEmail) {
      btnSendEmail.disabled = true;
    }

    let res;

    if (selectedFiles.length > 0) {
      const fd = new FormData();

      fd.append('account_id', String(account_id));
      fd.append('to', to);
      fd.append('subject', subject);
      fd.append('html', body);
      fd.append('body_html', body);

      const textFallback = stripHtmlToText(body);

      fd.append('text', textFallback);
      fd.append('body_text', textFallback);

      for (const f of selectedFiles) {
        fd.append('attachments', f, f.name);
      }

      res = await fetch(ROUTES.sendOutbound, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: buildAuthHeaders(),
      });
    } else {
      const textFallback = stripHtmlToText(body);

      const payload = {
        account_id,
        to,
        subject,
        html: body,
        body_html: body,
        text: textFallback,
        body_text: textFallback,
      };

      res = await fetch(ROUTES.sendOutbound, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        credentials: 'include',
      });
    }

    if (!res.ok) {
      const err = await parseBackendError(res);
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    showCenterModal({
      variant: 'success',
      title: 'E-mail sent',
      message: selectedFiles.length
        ? `Sent successfully with ${selectedFiles.length} attachment(s).`
        : 'Sent successfully.',
      timeoutMs: 3200,
    });

    hideComposePanel();

    currentFolder = 'sent';

    folderButtons.forEach((btn) => {
      const isSent = btn.dataset.folder === 'sent';
      btn.classList.toggle('is-active', isSent);
    });

    await loadFolder('sent');
  } catch (err) {
    console.error('[EmailInbox] Error sending e-mail', err);

    showCenterModal({
      variant: 'error',
      title: 'Error sending e-mail',
      message: String(err.message || err),
    });
  } finally {
    if (btnSendEmail) {
      btnSendEmail.disabled = false;
    }
  }
}