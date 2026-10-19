// ╔══════════════════════════════════════════════════════════════════════╗
// ║ emailInboxModalReply.js — Modal Reply/ReplyAll (PRODNEX ERP)        ║
// ║ ESM                                                                  ║
// ║ ✅ Popula select de contas                                           ║
// ║ ✅ Evita bind duplicado nos botões                                   ║
// ║ ✅ Fecha no cancelar / ESC / backdrop                                ║
// ║ ✅ Normaliza destinatário                                             ║
// ║ ✅ Pré-seleciona melhor conta para resposta                          ║
// ║ ✅ Mantém editor sincronizado com textarea hidden                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const $ = (sel) => document.querySelector(sel);

const modal = $('#replyModal');
const form = $('#replyComposeForm');

const selAccount = $('#replyAccountId');
const inputTo = $('#replyTo');
const inputSubject = $('#replySubject');

const replyBodyEditor = $('#replyBodyEditor');
const textareaBody = $('#replyBody');

const inputFiles = $('#replyAttachments');
const listFiles = $('#replyAttachmentsList');

const btnSend = $('#btnReplySend');
const btnCancel = $('#btnReplyCancel');

let ROUTES = null;

let state = {
  isOpen: false,
  mode: 'reply',
  selectedMessageData: null,
  cachedAccounts: [],
  defaultSignatureHtml: '',
  selectedFiles: [],
  maxFiles: 10,
  maxFileSize: 10 * 1024 * 1024,
  pickBestAccountIdForReply: null,
};

function ensureModalExists() {
  if (!modal) {
    console.error('[ReplyModal] #replyModal not found.');
    return false;
  }
  return true;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripHtmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  return (tmp.textContent || tmp.innerText || '').trim();
}

function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function normalizeSubjectForReply(subject) {
  const s = String(subject || '').trim();
  if (!s) return 'Re: (no subject)';
  if (/^\s*re\s*:/i.test(s)) return s;
  return `Re: ${s}`;
}

function extractEmailAddress(value) {
  const s = String(value || '').trim();
  if (!s) return '';

  const angleMatch = s.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return angleMatch[1].trim();

  const emailMatch = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (emailMatch?.[0]) return emailMatch[0].trim();

  return s;
}

function normalizeAccountsList(accounts) {
  if (!Array.isArray(accounts)) return [];

  return accounts
    .map((acc) => {
      const account_id = acc?.account_id ?? acc?.id ?? acc?.email_account_id ?? null;
      const name =
        acc?.name ??
        acc?.display_name ??
        acc?.from_name ??
        acc?.account_name ??
        '';
      const email =
        acc?.email ??
        acc?.username ??
        acc?.user ??
        acc?.address ??
        acc?.from_email ??
        '';
      const is_active =
        typeof acc?.is_active === 'boolean'
          ? acc.is_active
          : typeof acc?.active === 'boolean'
            ? acc.active
            : true;

      return {
        ...acc,
        account_id,
        name: String(name || '').trim(),
        email: String(email || '').trim(),
        is_active,
      };
    })
    .filter((acc) => acc.account_id !== null && acc.account_id !== undefined && acc.account_id !== '');
}

function buildQuotedBlockHtml({ from, to, dateStr, subject, bodyText }) {
  const safeDate = String(dateStr || '').trim();
  const safeFrom = String(from || '').trim();
  const metaLine = safeDate
    ? `Em ${safeDate}, ${safeFrom} escreveu:`
    : `${safeFrom} escreveu:`;

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

/* ───────────────────────────────────────────── */
/* ACCOUNTS                                      */
/* ───────────────────────────────────────────── */

function renderAccountsSelect(accounts = [], preferredAccountId = null) {
  if (!selAccount) return;

  const rows = normalizeAccountsList(accounts);
  selAccount.innerHTML = '';

  if (!rows.length) {
    selAccount.innerHTML = '<option value="">No accounts available</option>';
    selAccount.disabled = true;
    return;
  }

  selAccount.disabled = false;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select an account...';
  selAccount.appendChild(placeholder);

  rows.forEach((acc) => {
    const opt = document.createElement('option');
    opt.value = String(acc.account_id);

    const label = acc.name && acc.email
      ? `"${acc.name}" <${acc.email}>`
      : acc.email || acc.name || `Account ${acc.account_id}`;

    opt.textContent = label;

    if (acc.is_active === false) {
      opt.textContent = `${label} (inactive)`;
    }

    selAccount.appendChild(opt);
  });

  if (preferredAccountId !== null && preferredAccountId !== undefined && preferredAccountId !== '') {
    selAccount.value = String(preferredAccountId);
  }

  if (!selAccount.value) {
    const firstActive = rows.find((acc) => acc.is_active !== false) || rows[0];
    if (firstActive?.account_id !== undefined && firstActive?.account_id !== null) {
      selAccount.value = String(firstActive.account_id);
    }
  }
}

function resolvePreferredAccountId({ selectedMessageData, cachedAccounts, mode }) {
  try {
    if (typeof state.pickBestAccountIdForReply === 'function') {
      const picked = state.pickBestAccountIdForReply({
        selectedMessageData,
        cachedAccounts,
        mode,
      });
      if (picked !== null && picked !== undefined && picked !== '') return picked;
    }
  } catch (err) {
    console.warn('[ReplyModal] pickBestAccountIdForReply failed:', err);
  }

  const rows = normalizeAccountsList(cachedAccounts);
  if (!rows.length) return null;

  const accountIdFromMessage =
    selectedMessageData?.account_id ??
    selectedMessageData?.email_account_id ??
    selectedMessageData?.accountId ??
    null;

  if (accountIdFromMessage !== null && accountIdFromMessage !== undefined && accountIdFromMessage !== '') {
    const found = rows.find((acc) => String(acc.account_id) === String(accountIdFromMessage));
    if (found) return found.account_id;
  }

  const recipientEmail = extractEmailAddress(
    selectedMessageData?.to ||
    selectedMessageData?.original_to ||
    ''
  ).toLowerCase();

  if (recipientEmail) {
    const matchByEmail = rows.find((acc) => String(acc.email || '').toLowerCase() === recipientEmail);
    if (matchByEmail) return matchByEmail.account_id;
  }

  const firstActive = rows.find((acc) => acc.is_active !== false) || rows[0];
  return firstActive?.account_id ?? null;
}

/* ───────────────────────────────────────────── */
/* EDITOR SYNC                                  */
/* ───────────────────────────────────────────── */

function bindEditorSyncOnce() {
  if (!replyBodyEditor || !textareaBody) return;
  if (replyBodyEditor.dataset.bound === '1') return;
  replyBodyEditor.dataset.bound = '1';

  const sync = () => {
    textareaBody.value = replyBodyEditor.innerHTML || '';
  };

  replyBodyEditor.addEventListener('input', sync);
  replyBodyEditor.addEventListener('blur', sync);
}

/* ───────────────────────────────────────────── */
/* FILES                                        */
/* ───────────────────────────────────────────── */

function renderSelectedFiles() {
  if (!listFiles) return;
  listFiles.innerHTML = '';

  if (!state.selectedFiles.length) return;

  state.selectedFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'reply-attachment-item';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.gap = '10px';
    item.style.padding = '6px 8px';
    item.style.border = '1px solid #e5e7eb';
    item.style.borderRadius = '8px';
    item.style.marginBottom = '6px';

    const info = document.createElement('div');
    info.style.minWidth = '0';
    info.innerHTML = `
      <div style="font-weight:600; color:#111827; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${escapeHtml(file.name)}
      </div>
      <div style="font-size:12px; color:#6b7280;">
        ${(file.size / 1024 / 1024).toFixed(2)} MB
      </div>
    `;

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.textContent = 'Remove';
    btnRemove.style.border = '0';
    btnRemove.style.background = '#fee2e2';
    btnRemove.style.color = '#991b1b';
    btnRemove.style.borderRadius = '8px';
    btnRemove.style.padding = '6px 10px';
    btnRemove.style.cursor = 'pointer';
    btnRemove.addEventListener('click', () => {
      state.selectedFiles.splice(index, 1);
      renderSelectedFiles();
      syncFileInputFromState();
    });

    item.appendChild(info);
    item.appendChild(btnRemove);
    listFiles.appendChild(item);
  });
}

function syncFileInputFromState() {
  if (!inputFiles || typeof DataTransfer === 'undefined') return;

  const dt = new DataTransfer();
  state.selectedFiles.forEach((file) => dt.items.add(file));
  inputFiles.files = dt.files;
}

function handleFilesSelected(fileList) {
  const incoming = Array.from(fileList || []);
  if (!incoming.length) return;

  const existingKeys = new Set(
    state.selectedFiles.map((f) => `${f.name}__${f.size}__${f.lastModified}`)
  );

  for (const file of incoming) {
    if (state.selectedFiles.length >= state.maxFiles) {
      showCenterModal({
        variant: 'warning',
        title: 'Limit reached',
        message: `Maximum of ${state.maxFiles} files allowed.`,
      });
      break;
    }

    if (file.size > state.maxFileSize) {
      showCenterModal({
        variant: 'warning',
        title: 'File too large',
        message: `${file.name} exceeds ${(state.maxFileSize / 1024 / 1024).toFixed(0)} MB.`,
      });
      continue;
    }

    const key = `${file.name}__${file.size}__${file.lastModified}`;
    if (existingKeys.has(key)) continue;

    state.selectedFiles.push(file);
    existingKeys.add(key);
  }

  renderSelectedFiles();
  syncFileInputFromState();
}

function clearFiles() {
  state.selectedFiles = [];
  if (inputFiles) inputFiles.value = '';
  if (listFiles) listFiles.innerHTML = '';
}

/* ───────────────────────────────────────────── */
/* MODAL                                        */
/* ───────────────────────────────────────────── */

function closeModal() {
  state.isOpen = false;

  if (modal) {
    modal.hidden = true;
    modal.classList.remove('is-open');
  }

  document.body.classList.remove('modal-open');

  form?.reset();
  clearFiles();

  if (replyBodyEditor) replyBodyEditor.innerHTML = '';
  if (textareaBody) textareaBody.value = '';
}

function openModal() {
  state.isOpen = true;

  if (modal) {
    modal.hidden = false;
    modal.classList.add('is-open');
  }

  document.body.classList.add('modal-open');

  setTimeout(() => {
    replyBodyEditor?.focus();
  }, 50);
}

/* ───────────────────────────────────────────── */
/* ACTIONS                                      */
/* ───────────────────────────────────────────── */

function buildAuthHeaders(extra = {}) {
  const token =
    localStorage.getItem('token') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    sessionStorage.getItem('authToken');

  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function sendReplyNow(event) {
  event?.preventDefault?.();

  if (!ROUTES?.sendOutbound) {
    showCenterModal({
      variant: 'error',
      title: 'Config error',
      message: 'ROUTES.sendOutbound not configured.',
    });
    return;
  }

  const account_id = Number(selAccount?.value || 0) || null;
  const toRaw = (inputTo?.value || '').trim();
  const to = extractEmailAddress(toRaw);
  const subject = (inputSubject?.value || '').trim();
  const body = (replyBodyEditor?.innerHTML || '').trim();

  if (textareaBody) textareaBody.value = body;

  if (!account_id || !to || !subject) {
    showCenterModal({
      variant: 'warning',
      title: 'Missing required fields',
      message: 'Please fill all required fields.',
    });
    return;
  }

  try {
    if (btnSend) btnSend.disabled = true;

    const payload = {
      account_id,
      to,
      subject,
      html: body,
      text: stripHtmlToText(body),
    };

    let res;

    if (state.selectedFiles.length) {
      const fd = new FormData();
      fd.append('account_id', String(account_id));
      fd.append('to', to);
      fd.append('subject', subject);
      fd.append('html', body);
      fd.append('text', stripHtmlToText(body));

      state.selectedFiles.forEach((file) => {
        fd.append('attachments', file, file.name);
      });

      res = await fetch(ROUTES.sendOutbound, {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: fd,
        credentials: 'include',
      });
    } else {
      res = await fetch(ROUTES.sendOutbound, {
        method: 'POST',
        headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
        credentials: 'include',
      });
    }

    if (!res.ok) {
      let errorText = `HTTP ${res.status}`;
      try {
        const json = await res.json();
        errorText = json?.message || json?.error || errorText;
      } catch {}
      throw new Error(errorText);
    }

    showCenterModal({
      variant: 'success',
      title: 'E-mail sent',
      message: 'Reply sent successfully.',
      timeoutMs: 2500,
    });

    closeModal();
  } catch (err) {
    console.error('[ReplyModal] sendReplyNow:', err);
    showCenterModal({
      variant: 'error',
      title: 'Error sending',
      message: err?.message || 'Unknown error while sending e-mail.',
    });
  } finally {
    if (btnSend) btnSend.disabled = false;
  }
}

function fillModalForReply({ mode, selectedMessageData }) {
  const from = selectedMessageData?.from || '';
  const toOriginal = selectedMessageData?.to || '';
  const subjectOriginal = selectedMessageData?.subject || '(no subject)';
  const html = selectedMessageData?.html || '';
  const text = selectedMessageData?.text || stripHtmlToText(html);

  const quotedHtml = buildQuotedBlockHtml({
    from,
    to: toOriginal,
    dateStr:
      selectedMessageData?.date_formatted ||
      selectedMessageData?.date ||
      selectedMessageData?.sent_at ||
      '',
    subject: subjectOriginal,
    bodyText: text,
  });

  const finalHtml = `${state.defaultSignatureHtml || ''}${quotedHtml}`;

  if (mode === 'replyAll') {
    inputTo.value = String(toOriginal || from || '').trim();
  } else {
    inputTo.value = String(from || '').trim();
  }

  inputSubject.value = normalizeSubjectForReply(subjectOriginal);

  if (replyBodyEditor) replyBodyEditor.innerHTML = finalHtml;
  if (textareaBody) textareaBody.value = finalHtml;
}

function bindActionsOnce() {
  if (btnSend && btnSend.dataset.bound !== '1') {
    btnSend.dataset.bound = '1';
    btnSend.addEventListener('click', sendReplyNow);
  }

  if (btnCancel && btnCancel.dataset.bound !== '1') {
    btnCancel.dataset.bound = '1';
    btnCancel.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal();
    });
  }

  if (form && form.dataset.bound !== '1') {
    form.dataset.bound = '1';
    form.addEventListener('submit', sendReplyNow);
  }

  if (inputFiles && inputFiles.dataset.bound !== '1') {
    inputFiles.dataset.bound = '1';
    inputFiles.addEventListener('change', (event) => {
      handleFilesSelected(event.target.files);
    });
  }

  if (modal && modal.dataset.boundEsc !== '1') {
    modal.dataset.boundEsc = '1';
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });
  }

  if (document.body && document.body.dataset.replyModalEscBound !== '1') {
    document.body.dataset.replyModalEscBound = '1';
    document.addEventListener('keydown', (event) => {
      if (!state.isOpen) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    });
  }
}

/* ───────────────────────────────────────────── */
/* PUBLIC API                                   */
/* ───────────────────────────────────────────── */

export async function openEmailReplyModal({
  mode = 'reply',
  selectedMessageData,
  cachedAccounts = [],
  routes,
  signatureHtml = '',
  pickBestAccountIdForReply,
} = {}) {
  if (!ensureModalExists()) return;

  ROUTES = routes || null;
  state.mode = mode;
  state.selectedMessageData = selectedMessageData || null;
  state.cachedAccounts = normalizeAccountsList(cachedAccounts);
  state.defaultSignatureHtml = signatureHtml || '';
  state.pickBestAccountIdForReply = pickBestAccountIdForReply || null;

  bindEditorSyncOnce();
  bindActionsOnce();

  const preferredAccountId = resolvePreferredAccountId({
    selectedMessageData: state.selectedMessageData,
    cachedAccounts: state.cachedAccounts,
    mode: state.mode,
  });

  renderAccountsSelect(state.cachedAccounts, preferredAccountId);
  fillModalForReply({
    mode: state.mode,
    selectedMessageData: state.selectedMessageData,
  });

  openModal();
}