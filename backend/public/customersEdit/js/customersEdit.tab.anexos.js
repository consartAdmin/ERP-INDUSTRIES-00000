// ╔══════════════════════════════════════════════════════════════╗
// ║ customersEdit.tab.anexos.js — Aba Anexos do Cliente         ║
// ║ PRODNEX ERP | ESM                                           ║
// ║ API: /api/customers/:id/attachments                         ║
// ║ Os anexos são gravados na hora (independem do "Salvar").    ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { CUSTOMERS_EDIT_ROUTES } from './customersEdit.config.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

const $ = (selector) => document.querySelector(selector);

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_EXTENSIONS = Object.freeze([
    'pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif',
    'doc', 'docx', 'xls', 'xlsx', 'odt', 'ods',
    'csv', 'txt', 'xml', 'zip', 'rar',
]);
const INLINE_EXTENSIONS = Object.freeze(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt']);
const CATEGORY_LABELS = Object.freeze({
    documento: 'Documento',
    contrato: 'Contrato',
    comprovante: 'Comprovante',
    outros: 'Outros',
});

const state = {
    pending: [],
    rows: [],
    uploading: false,
    loadPromise: null,
};

// ---------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getCustomerId() {
    const hiddenId = $('#customer_id')?.value;
    const params = new URLSearchParams(window.location.search);
    return String(hiddenId || params.get('id') || '').trim();
}

function getExtension(fileName) {
    const match = /\.([a-z0-9]{1,10})$/i.exec(String(fileName || ''));
    return match ? match[1].toLowerCase() : '';
}

function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function fileIcon(fileName) {
    const ext = getExtension(fileName);
    if (ext === 'pdf') return '📕';
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return '🖼️';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) return '📊';
    if (['doc', 'docx', 'odt', 'txt'].includes(ext)) return '📄';
    if (['zip', 'rar'].includes(ext)) return '🗜️';
    if (ext === 'xml') return '🧾';
    return '📎';
}

async function readJson(response) {
    return response.json().catch(() => ({}));
}

function notify(variant, message) {
    return showCenterModal({ variant, title: 'Anexos do Cliente', message });
}

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------
async function fetchAttachments(customerId) {
    const response = await fetch(CUSTOMERS_EDIT_ROUTES.customerAttachments(customerId), {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return Array.isArray(payload?.rows) ? payload.rows : [];
}

async function postAttachments(customerId, files, category, description) {
    const form = new FormData();
    files.forEach((file) => form.append('files', file, file.name));
    form.append('category', category);
    if (description) form.append('description', description);

    const response = await fetch(CUSTOMERS_EDIT_ROUTES.customerAttachments(customerId), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        body: form,
    });
    const payload = await readJson(response);

    if (!response.ok && !payload?.uploaded?.length) {
        throw new Error(payload?.failed?.[0]?.error || payload?.error || `HTTP ${response.status}`);
    }

    return payload;
}

async function deleteAttachment(customerId, attachmentId) {
    const response = await fetch(CUSTOMERS_EDIT_ROUTES.customerAttachmentById(customerId, attachmentId), {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
}

// ---------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------
function renderMessage(message) {
    const tbody = $('#customerAttachmentsTbody');
    if (!tbody) return;

    tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center">${escapeHtml(message)}</td>
    </tr>
  `;
}

function renderCount() {
    const el = $('#customerAttachmentsCount');
    if (el) el.textContent = state.rows.length ? `(${state.rows.length})` : '';
}

function renderRows() {
    const tbody = $('#customerAttachmentsTbody');
    const customerId = getCustomerId();
    if (!tbody) return;

    renderCount();

    if (!state.rows.length) {
        renderMessage('Nenhum anexo para este cliente.');
        return;
    }

    tbody.innerHTML = state.rows.map((row) => {
        const name = row.original_name || 'arquivo';
        const category = CATEGORY_LABELS[row.category] || row.category || '-';
        const description = row.description || '-';
        const canView = INLINE_EXTENSIONS.includes(getExtension(name));
        const viewUrl = CUSTOMERS_EDIT_ROUTES.customerAttachmentDownload(customerId, row.attachment_id, { inline: true });
        const downloadUrl = CUSTOMERS_EDIT_ROUTES.customerAttachmentDownload(customerId, row.attachment_id);

        return `
      <tr>
        <td title="${escapeHtml(name)}">${fileIcon(name)} ${escapeHtml(name)}</td>
        <td title="${escapeHtml(category)}">
          <span class="ca-badge ca-badge--${escapeHtml(row.category)}">${escapeHtml(category)}</span>
        </td>
        <td title="${escapeHtml(description)}">${escapeHtml(description)}</td>
        <td>${escapeHtml(formatBytes(row.size_bytes))}</td>
        <td>${escapeHtml(formatDateTime(row.created_at))}</td>
        <td>
          ${canView ? `
            <a class="ca-link" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener"
              title="Abrir em nova aba">Visualizar</a>
          ` : ''}
          <a class="ca-link" href="${escapeHtml(downloadUrl)}" download title="Baixar arquivo">Baixar</a>
          <button class="ca-link ca-link--danger" type="button"
            data-delete-attachment="${escapeHtml(row.attachment_id)}" title="Excluir anexo">Excluir</button>
        </td>
      </tr>
    `;
    }).join('');
}

function renderPending() {
    const list = $('#customerAttachmentsPending');
    const button = $('#btnSendCustomerAttachments');

    if (list) {
        list.innerHTML = state.pending.map((file, index) => `
      <li>
        <span class="ca-file-name" title="${escapeHtml(file.name)}">${fileIcon(file.name)} ${escapeHtml(file.name)}</span>
        <span class="ca-muted">${escapeHtml(formatBytes(file.size))}</span>
        <button class="ca-link ca-link--danger" type="button" data-remove-pending="${index}"
          aria-label="Remover ${escapeHtml(file.name)}" title="Remover">✕</button>
      </li>
    `).join('');
    }

    if (button) {
        button.disabled = state.uploading || !state.pending.length;
        button.textContent = state.uploading
            ? 'Enviando…'
            : state.pending.length
                ? `⬆ Enviar Anexos (${state.pending.length})`
                : '⬆ Enviar Anexos';
    }
}

// ---------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------
async function loadCustomerAttachments({ force = false } = {}) {
    const customerId = getCustomerId();

    if (!customerId) {
        renderMessage('Salve o cliente antes de anexar arquivos.');
        return;
    }

    if (state.loadPromise && !force) return state.loadPromise;

    renderMessage('Carregando anexos...');

    const promise = (async () => {
        try {
            state.rows = await fetchAttachments(customerId);
            renderRows();
        } catch (error) {
            console.error('[customersEdit.tab.anexos] loadCustomerAttachments error:', error);
            renderMessage(error.message || 'Erro ao carregar anexos do cliente.');
        }
    })();

    state.loadPromise = promise;

    try {
        await promise;
    } finally {
        if (state.loadPromise === promise) state.loadPromise = null;
    }
}

function addFiles(fileList) {
    const errors = [];

    for (const file of Array.from(fileList || [])) {
        if (state.pending.length >= MAX_FILES) {
            errors.push(`Máximo de ${MAX_FILES} arquivos por envio.`);
            break;
        }
        if (!ALLOWED_EXTENSIONS.includes(getExtension(file.name))) {
            errors.push(`${file.name}: formato não permitido.`);
            continue;
        }
        if (file.size > MAX_FILE_BYTES) {
            errors.push(`${file.name}: maior que 20 MB.`);
            continue;
        }
        if (file.size === 0) {
            errors.push(`${file.name}: arquivo vazio.`);
            continue;
        }
        state.pending.push(file);
    }

    renderPending();

    if (errors.length) notify('warning', errors.join('\n'));
}

async function sendPendingAttachments() {
    const customerId = getCustomerId();
    if (!customerId || !state.pending.length || state.uploading) return;

    state.uploading = true;
    renderPending();

    try {
        const category = $('#customerAttachmentCategory')?.value || 'documento';
        const description = $('#customerAttachmentDescription')?.value?.trim() || '';
        const result = await postAttachments(customerId, state.pending, category, description);

        state.pending = [];
        const descriptionInput = $('#customerAttachmentDescription');
        if (descriptionInput) descriptionInput.value = '';

        const uploadedCount = result?.uploaded?.length || 0;
        const failed = result?.failed || [];

        await loadCustomerAttachments({ force: true });

        if (failed.length) {
            notify(
                'warning',
                `${uploadedCount} anexo(s) enviado(s). Falharam:\n` +
                failed.map((f) => `• ${f.name}: ${f.error}`).join('\n')
            );
        } else {
            notify('success', `${uploadedCount} anexo(s) enviado(s) com sucesso.`);
        }
    } catch (error) {
        console.error('[customersEdit.tab.anexos] upload error:', error);
        notify('error', error.message || 'Erro ao enviar anexos.');
    } finally {
        state.uploading = false;
        renderPending();
    }
}

async function removeAttachment(attachmentId) {
    const customerId = getCustomerId();
    const row = state.rows.find((r) => String(r.attachment_id) === String(attachmentId));
    if (!customerId || !row) return;

    const confirmed = await showCenterModal({
        variant: 'warning',
        title: 'Confirmar exclusão',
        message: `Deseja realmente excluir o anexo "${row.original_name}"?`,
        okText: 'Sim, excluir',
        closeText: 'Cancelar',
    });

    if (confirmed !== true) return;

    try {
        await deleteAttachment(customerId, attachmentId);
        await loadCustomerAttachments({ force: true });
        notify('success', 'Anexo excluído.');
    } catch (error) {
        console.error('[customersEdit.tab.anexos] delete error:', error);
        notify('error', error.message || 'Erro ao excluir anexo.');
    }
}

// ---------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------
function setupAnexosTab() {
    const input = $('#customerAttachmentsInput');
    const dropzone = $('#customerAttachmentsDropzone');
    const panel = $('#tab-anexos');
    if (!panel) return;

    input?.addEventListener('change', (event) => {
        addFiles(event.target.files);
        event.target.value = '';
    });

    dropzone?.addEventListener('click', () => input?.click());
    dropzone?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input?.click();
        }
    });

    ['dragenter', 'dragover'].forEach((type) =>
        dropzone?.addEventListener(type, (event) => {
            event.preventDefault();
            dropzone.classList.add('is-over');
        })
    );

    ['dragleave', 'drop'].forEach((type) =>
        dropzone?.addEventListener(type, (event) => {
            event.preventDefault();
            dropzone.classList.remove('is-over');
        })
    );

    dropzone?.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files));

    $('#btnSendCustomerAttachments')?.addEventListener('click', sendPendingAttachments);

    // Enter na descrição NÃO pode submeter o #formCliente (salvaria o cliente)
    $('#customerAttachmentDescription')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendPendingAttachments();
        }
    });

    $('#btnReloadCustomerAttachments')?.addEventListener('click', () => {
        loadCustomerAttachments({ force: true });
    });

    panel.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        if (button.dataset.removePending != null) {
            state.pending.splice(Number(button.dataset.removePending), 1);
            renderPending();
        } else if (button.dataset.deleteAttachment) {
            removeAttachment(button.dataset.deleteAttachment);
        }
    });

    document.querySelectorAll('.tab[data-tab], .customer-tab-btn[data-tab]').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.tab === 'tab-anexos') loadCustomerAttachments();
        });
    });

    const activeAnexosTab = document.querySelector(
        '.tab.is-active[data-tab="tab-anexos"], ' +
        '.customer-tab-btn.active[data-tab="tab-anexos"]'
    );

    if (activeAnexosTab) loadCustomerAttachments();

    renderPending();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAnexosTab, { once: true });
} else {
    setupAnexosTab();
}

export { loadCustomerAttachments };
