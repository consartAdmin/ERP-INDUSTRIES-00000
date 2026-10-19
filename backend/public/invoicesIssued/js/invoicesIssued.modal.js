// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.modal.js — Modal NF-e emitida                                       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { $ } from './invoicesIssued.utils.js';
import { toDateInput } from './invoicesIssued.utils.js';
import { createInvoice, updateInvoice } from './invoicesIssued.api.js';
import { getInvoiceFormPayload } from './invoicesIssued.form.js';
import { normalizeNfeStatusCode } from './invoicesIssued.validation.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

// Avisos no padrão CONSART (centerAlertModal); o texto é escapado e \n vira <br>.
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function notify(variant, title, text) {
    return showCenterModal({
        variant,
        title,
        message: escapeHtml(text).replace(/\n/g, '<br>'),
    });
}

let afterSaveCallback = null;

export function setAfterSaveCallback(callback) {
    afterSaveCallback = callback;
}

export function openModal(row = null) {
    const modal = $('invoiceIssuedModal');

    modal.classList.remove('is-hidden');
    modal.setAttribute('aria-hidden', 'false');

    $('modalTitle').textContent = row ? `Editar NF-e #${row.invoice_id}` : 'Nova NF-e';

    $('invoice_id').value = row?.invoice_id || '';
    $('order_id').value = row?.order_id || '';
    $('nfe_number').value = row?.nfe_number || '';
    $('nfe_key').value = row?.nfe_key || '';
    $('nfe_status').value = normalizeNfeStatusCode(row?.nfe_status) || 'PENDENTE';
    $('nfe_environment').value = row?.nfe_environment || '';
    $('nfe_protocol').value = row?.nfe_protocol || '';
    $('issued_date').value = toDateInput(row?.issued_date || row?.issued_at);
    $('total_amount').value = row?.total_amount || '';
    $('xml_url').value = row?.xml_url || '';
    $('danfe_url').value = row?.danfe_url || '';
}

export function closeModal() {
    const modal = $('invoiceIssuedModal');

    modal.classList.add('is-hidden');
    modal.setAttribute('aria-hidden', 'true');

    $('invoiceForm').reset();
    $('invoice_id').value = '';
}

function getFormPayload() {
    const result = getInvoiceFormPayload();

    if (!result.ok) {
        throw new Error(result.errors.join('\\n'));
    }

    return result.payload;
}

export async function saveInvoice(event) {
    event.preventDefault();

    try {
        const id = $('invoice_id').value;
        const payload = getFormPayload();

        if (id) {
            await updateInvoice(id, payload);
        } else {
            await createInvoice(payload);
        }

        closeModal();

        if (typeof afterSaveCallback === 'function') {
            await afterSaveCallback();
        }
    } catch (err) {
        console.error('[modal.saveInvoice]', err);
        notify('error', 'Erro ao salvar', err?.message || 'Falha ao salvar a nota.');
    }
}

// ======================================================================
// E-MAIL MODAL
// ======================================================================

let isSending = false;
let lastFocusedElement = null;

function safe(value) {
    return String(value ?? '').trim();
}

function parseEmailRecipients(value) {
    const recipients = safe(value)
        .split(/[;,\n]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

    return [...new Set(recipients)];
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setModalVisibility(modal, visible) {
    if (!modal) return;

    modal.classList.toggle('is-hidden', !visible);
    modal.classList.toggle('is-open', visible);
    modal.setAttribute('aria-hidden', visible ? 'false' : 'true');

    document.body.classList.toggle('modal-open', visible);
}

function getDefaultSubject(invoice = {}) {
    const nfeNumber = safe(invoice.nfe_number);
    return `NF-e ${nfeNumber || safe(invoice.invoice_id)} — BH3 SUPPLY`;
}

function getDefaultMessage(invoice = {}) {
    const customerName = safe(invoice.customer_name);
    const nfeNumber = safe(invoice.nfe_number);
    const orderId = safe(invoice.order_id);
    const nfeKey = safe(invoice.nfe_key);

    return `
Olá${customerName ? ` ${customerName}` : ''},

Segue em anexo sua NF-e, DANFE e os boletos referentes ao pedido.

──────────────────────────────

NF-e: ${nfeNumber || '-'}

Pedido: ${orderId || '-'}

Chave:
${nfeKey || '-'}

──────────────────────────────

Atenciosamente,
PRODNEX ERP
  `.trim();
}

function getApiErrorMessage(response, data) {
    const messages = [];

    const rootMessage =
        data?.message ||
        data?.error ||
        data?.details ||
        null;

    if (rootMessage) messages.push(safe(rootMessage));

    if (Array.isArray(data?.boletoErrors)) {
        for (const item of data.boletoErrors) {
            const installment =
                item?.installment ||
                item?.accounts_receivable_id ||
                item?.asaas_payment_id ||
                '?';

            const itemMessage = safe(item?.error || item?.message);

            if (itemMessage) {
                messages.push(`Boleto ${installment}: ${itemMessage}`);
            }
        }
    }

    if (!messages.length) {
        messages.push(`Erro ao enviar e-mail (HTTP ${response.status}).`);
    }

    return [...new Set(messages.filter(Boolean))].join('\n');
}

// ======================================================================
// OPEN
// ======================================================================

export function openEmailModal(invoice = {}) {
    const modal = $('emailModal');

    if (!modal) {
        console.error('[emailModal] #emailModal não encontrado.');
        return;
    }

    const elInvoiceId = $('emailInvoiceId');
    const elCustomerName = $('emailCustomerName');
    const elEmailTo = $('emailTo');
    const elSubject = $('emailSubject');
    const elMessage = $('emailMessage');

    if (!elInvoiceId || !elEmailTo || !elSubject || !elMessage) {
        console.error('[emailModal] Estrutura incompleta do modal.', {
            elInvoiceId,
            elCustomerName,
            elEmailTo,
            elSubject,
            elMessage,
        });
        return;
    }

    lastFocusedElement = document.activeElement;

    elInvoiceId.value = safe(invoice.invoice_id);

    if (elCustomerName) {
        elCustomerName.value = safe(invoice.customer_name);
    }

    elEmailTo.value =
        safe(invoice.final_email) ||
        safe(invoice.customer_email) ||
        safe(invoice.order_email);

    elSubject.value = getDefaultSubject(invoice);
    elMessage.value = getDefaultMessage(invoice);

    setModalVisibility(modal, true);

    window.requestAnimationFrame(() => {
        if (elEmailTo.value) {
            elSubject.focus();
            elSubject.select();
        } else {
            elEmailTo.focus();
        }
    });

    console.log('[emailModal.open]', {
        invoiceId: elInvoiceId.value,
        customer: elCustomerName?.value || '',
        to: elEmailTo.value,
    });
}

// ======================================================================
// CLOSE
// ======================================================================

export function closeEmailModal() {
    const modal = $('emailModal');
    if (!modal || isSending) return;

    setModalVisibility(modal, false);

    if (
        lastFocusedElement &&
        typeof lastFocusedElement.focus === 'function' &&
        document.contains(lastFocusedElement)
    ) {
        lastFocusedElement.focus();
    }

    lastFocusedElement = null;
}

// ======================================================================
// SEND EMAIL
// ======================================================================

export async function sendInvoiceEmail() {
    if (isSending) return;

    const form = $('emailInvoiceForm');
    const elInvoiceId = $('emailInvoiceId');
    const elEmailTo = $('emailTo');
    const elSubject = $('emailSubject');
    const elMessage = $('emailMessage');
    const button = $('btnSendInvoiceEmail');

    const invoiceId = safe(elInvoiceId?.value);
    const recipients = parseEmailRecipients(elEmailTo?.value);
    const invalidRecipients = recipients.filter((email) => !isValidEmail(email));
    const to = recipients.join(', ');
    const subject = safe(elSubject?.value);
    const message = safe(elMessage?.value);

    if (!invoiceId) {
        notify('error', 'Enviar NF-e por e-mail', 'invoice_id não encontrado.');
        return;
    }

    if (!recipients.length) {
        elEmailTo?.focus();
        notify('warning', 'Enviar NF-e por e-mail', 'Informe pelo menos um e-mail destinatário.');
        return;
    }

    if (invalidRecipients.length) {
        elEmailTo?.focus();
        notify(
            'warning',
            'Enviar NF-e por e-mail',
            `Corrija os seguintes e-mails:\n${invalidRecipients.join('\n')}`,
        );
        return;
    }

    elEmailTo.value = to;

    if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
    }

    if (!subject) {
        elSubject?.focus();
        notify('warning', 'Enviar NF-e por e-mail', 'Informe o assunto do e-mail.');
        return;
    }

    if (!message) {
        elMessage?.focus();
        notify('warning', 'Enviar NF-e por e-mail', 'Informe a mensagem do e-mail.');
        return;
    }

    const originalButtonHtml = button?.innerHTML || '📧 Enviar E-mail';

    try {
        isSending = true;

        if (button) {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = '⏳ Preparando anexos e enviando...';
        }

        console.log('[sendInvoiceEmail.request]', {
            invoiceId,
            to,
            subject,
        });

        const response = await fetch(
            `/api/invoices-issued/${encodeURIComponent(invoiceId)}/send-email`,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                cache: 'no-store',
                body: JSON.stringify({
                    account_id: 1,
                    to,
                    subject,
                    message,
                }),
            },
        );

        const rawText = await response.text();
        let data = {};

        try {
            data = rawText ? JSON.parse(rawText) : {};
        } catch {
            data = rawText ? { message: rawText } : {};
        }

        console.log('[sendInvoiceEmail.response]', {
            status: response.status,
            data,
        });

        if (!response.ok || data?.ok === false) {
            throw new Error(getApiErrorMessage(response, data));
        }

        const boletoCount = Number(data?.boletoCount || 0);
        const attachmentCount = Array.isArray(data?.attachments)
            ? data.attachments.length
            : null;

        const details = [];

        if (attachmentCount !== null) {
            details.push(`${attachmentCount} anexo(s)`);
        }

        if (boletoCount > 0) {
            details.push(`${boletoCount} boleto(s)`);
        }

        notify(
            'success',
            'E-mail enviado',
            details.length
                ? `E-mail enviado com sucesso.\n${details.join(' · ')}`
                : 'E-mail enviado com sucesso.',
        );

        isSending = false;
        closeEmailModal();
    } catch (error) {
        console.error('[sendInvoiceEmail.error]', error);

        notify(
            'error',
            'Erro ao enviar e-mail',
            error?.message ||
            'Erro ao enviar NF-e por e-mail.',
        );
    } finally {
        isSending = false;

        if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            button.innerHTML = originalButtonHtml;
        }
    }
}
