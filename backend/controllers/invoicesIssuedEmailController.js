// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssuedEmailController.js — NF-e/DANFE/Boletos por e-mail    ║
// ║ CONSART ERP | ESM                                                    ║
// ║ - Anexa XML e DANFE                                                  ║
// ║ - Localiza todas as parcelas Asaas da NF-e                           ║
// ║ - Resolve boleto local ou baixa novamente do Asaas                   ║
// ║ - Não envia e-mail incompleto quando um boleto esperado falha        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { readFile } from 'node:fs/promises';
import archiver from 'archiver';

import pool from '../config/db.js';
import * as asaasApi from '../repositories/asaas/asaas.index.js';
import { sendMailByAccount } from '../services/email/sendMailByAccount.js';

function safe(value) {
  return String(value ?? '').trim();
}

function parseEmailRecipients(value) {
  const rawRecipients = Array.isArray(value) ? value : [value];

  const recipients = rawRecipients
    .flatMap((item) => safe(item).split(/[;,\n]+/))
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(recipients)];
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseRaw(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function sanitizeFilename(value, fallback = 'arquivo') {
  const cleaned = safe(value || fallback)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_');

  return cleaned || fallback;
}

function getInternalApiBase(req) {
  const configured = safe(process.env.INTERNAL_API_BASE_URL);
  if (configured) return configured.replace(/\/$/, '');

  const protocol = safe(req.protocol) || 'http';
  const host = safe(req.get?.('host')) || 'localhost:8080';
  return `${protocol}://${host}`;
}

async function fetchAttachment(url, { filename, contentType }) {
  const response = await fetch(url, {
    headers: { Accept: contentType },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Falha ao obter ${filename}: HTTP ${response.status}` +
      (body ? ` — ${body.slice(0, 300)}` : ''),
    );
  }

  const content = Buffer.from(await response.arrayBuffer());
  if (!content.length) throw new Error(`${filename} retornou vazio.`);

  return { filename, content, contentType };
}

async function loadInvoice(invoiceId) {
  const { rows } = await pool.query(
    `
      SELECT
        ii.*,

        COALESCE(o.order_id, NULL) AS final_order_id,
        b.budget_id AS final_budget_id,

        COALESCE(
          o.order_id::text,
          b.budget_id::text
        ) AS order_number,

        COALESCE(
          o.customer_id,
          b.customer_id
        ) AS customer_id,

        COALESCE(
          NULLIF(TRIM(o.customer_name), ''),
          NULLIF(TRIM(b.customer_name), ''),
          NULLIF(TRIM(ii.customer_name), '')
        ) AS customer_name,

        COALESCE(
          NULLIF(TRIM(o.customer_tax_id), ''),
          NULLIF(TRIM(b.customer_tax_id), ''),
          NULLIF(TRIM(ii.customer_tax_id), '')
        ) AS customer_tax_id,

        ii.xml_url AS final_xml_url,
        ii.danfe_url AS final_danfe_url,

        o.customer_email AS order_email,
        b.customer_email AS budget_email,
        COALESCE(
          NULLIF(TRIM(c.invoice_email), ''),
          NULLIF(TRIM(c.email), '')
        ) AS customer_email,

        COALESCE(
          NULLIF(TRIM(o.customer_email), ''),
          NULLIF(TRIM(b.customer_email), ''),
          NULLIF(TRIM(c.invoice_email), ''),
          NULLIF(TRIM(c.email), '')
        ) AS final_email

      FROM public."invoicesIssued" ii

      LEFT JOIN public."orders" o
        ON o.order_id = ii.order_id

      LEFT JOIN public.budgets b
        ON b.budget_id = ii.budget_id

      LEFT JOIN public."customers" c
        ON c.customer_id = COALESCE(
          o.customer_id,
          b.customer_id
        )

      WHERE ii.invoice_id = $1
      LIMIT 1
    `,
    [invoiceId],
  );

  const invoice = rows[0] || null;

  if (!invoice) {
    return null;
  }

  /*
   * Mantém os campos esperados pelas demais funções.
   * Para NF-e originada de orçamento, order_id continuará nulo.
   */
  invoice.order_id = invoice.final_order_id || null;
  invoice.budget_id =
    invoice.final_budget_id ||
    invoice.budget_id ||
    null;

  return invoice;
}

async function loadInvoiceBoletos(invoice) {
  const customerId = Number(invoice.customer_id);
  const orderId = Number(invoice.order_id);
  const budgetId = Number(invoice.budget_id);
  const nfeNumber = safe(invoice.nfe_number);

  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    throw new Error(
      `Cliente não identificado para a NF-e ${invoice.nfe_number || invoice.invoice_id
      }.`,
    );
  }

  const orderReference =
    Number.isSafeInteger(orderId) && orderId > 0
      ? `%-ORD-${orderId}-%`
      : '';

  const budgetReference =
    Number.isSafeInteger(budgetId) && budgetId > 0
      ? `%-BUD-${budgetId}-%`
      : '';

  const invoiceReference = nfeNumber
    ? `${nfeNumber}/%`
    : '';

  const { rows } = await pool.query(
    `
      SELECT
        ar.id,
        ar.customer_id,
        ar.description,
        ar.invoice_number,
        ar.document_number,
        ar.due_date,
        ar.value,
        ar.boleto_url,
        ar.collection_provider,

        ara.asaas_payment_id,
        ara.last_status,
        ara.raw

      FROM public."accountsReceivable" ar

      INNER JOIN public."accountsReceivableAsaas" ara
        ON ara.accounts_receivable_id = ar.id

      WHERE ar.customer_id = $1
        AND (
          (
            NULLIF($2::text, '') IS NOT NULL
            AND ar.document_number LIKE $2
          )
          OR
          (
            NULLIF($3::text, '') IS NOT NULL
            AND ar.document_number LIKE $3
          )
          OR
          (
            NULLIF($4::text, '') IS NOT NULL
            AND ar.invoice_number LIKE $4
          )
        )

      ORDER BY
        ar.due_date ASC NULLS LAST,
        ar.id ASC
    `,
    [
      customerId,
      budgetReference,
      orderReference,
      invoiceReference,
    ],
  );

  return rows;
}

async function buildBoletoAttachment(row, invoice, index) {
  const raw = parseRaw(row.raw);
  const paymentId = safe(row.asaas_payment_id || raw.id);

  if (!paymentId) {
    throw new Error(
      `Parcela ${index + 1}: registro sem asaas_payment_id.`,
    );
  }

  const pdf = await asaasApi.getBoletoPdf({
    paymentId,
    boleto_pdf_url_local:
      raw.boleto_pdf_url_local ||
      raw.boletoPdfUrlLocal ||
      null,
    boleto_pdf_abs_path:
      raw.boleto_pdf_abs_path ||
      raw.boletoPdfAbsPath ||
      null,
    logger: console,
  });

  if (!pdf?.ok || !pdf?.absPath) {
    throw new Error(
      `Parcela ${index + 1}: ${pdf?.error || 'PDF do boleto não localizado.'}`,
    );
  }

  const content = await readFile(pdf.absPath);
  if (!content.length) {
    throw new Error(`Parcela ${index + 1}: PDF do boleto está vazio.`);
  }

  const sequence = safe(row.invoice_number).split('/').pop() ||
    String(index + 1).padStart(3, '0');

  return {
    filename: sanitizeFilename(
      `BOLETO-NFe-${invoice.nfe_number || invoice.invoice_id}-${sequence}.pdf`,
    ),
    content,
    contentType: 'application/pdf',
  };
}

async function buildInvoiceDocumentAttachments(req, invoice) {
  const attachments = [];
  const attachmentWarnings = [];
  const apiBase = getInternalApiBase(req);
  const nfeNumber = safe(invoice.nfe_number);
  const invoiceId = Number(invoice.invoice_id);

  try {
    attachments.push(await fetchAttachment(
      `${apiBase}/api/invoices-issued/${encodeURIComponent(invoiceId)}/xml`,
      {
        filename: sanitizeFilename(`NFe-${nfeNumber || invoiceId}.xml`),
        contentType: 'application/xml',
      },
    ));
  } catch (error) {
    attachmentWarnings.push(error?.message || String(error));
    console.error('[DOCUMENT XML ERROR]', error);
  }

  try {
    attachments.push(await fetchAttachment(
      `${apiBase}/api/invoices-issued/${encodeURIComponent(invoiceId)}/danfe`,
      {
        filename: sanitizeFilename(`DANFE-${nfeNumber || invoiceId}.pdf`),
        contentType: 'application/pdf',
      },
    ));
  } catch (error) {
    attachmentWarnings.push(error?.message || String(error));
    console.error('[DOCUMENT DANFE ERROR]', error);
  }

  const boletoRows = await loadInvoiceBoletos(invoice);
  const boletoAttachments = [];
  const boletoErrors = [];

  for (const [index, row] of boletoRows.entries()) {
    try {
      boletoAttachments.push(
        await buildBoletoAttachment(row, invoice, index),
      );
    } catch (error) {
      boletoErrors.push({
        accounts_receivable_id: row.id,
        asaas_payment_id: row.asaas_payment_id || null,
        due_date: row.due_date || null,
        error: error?.message || String(error),
      });
    }
  }

  attachments.push(...boletoAttachments);

  return {
    attachments,
    attachmentWarnings,
    boletoAttachments,
    boletoErrors,
    expectedBoletos: boletoRows.length,
  };
}

export async function downloadInvoiceIssuedDocuments(req, res) {
  try {
    const invoiceId = Number(req.params.id);

    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'invoice_id inválido.',
      });
    }

    const invoice = await loadInvoice(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: 'NF-e não encontrada.',
      });
    }

    const documents = await buildInvoiceDocumentAttachments(req, invoice);

    if (documents.attachmentWarnings.length) {
      return res.status(502).json({
        ok: false,
        error: 'Não foi possível preparar o XML e/ou o DANFE.',
        details: documents.attachmentWarnings,
      });
    }

    if (
      documents.expectedBoletos &&
      documents.boletoAttachments.length !== documents.expectedBoletos
    ) {
      return res.status(502).json({
        ok: false,
        error: 'Não foi possível preparar todos os boletos.',
        expectedBoletos: documents.expectedBoletos,
        attachedBoletos: documents.boletoAttachments.length,
        boletoErrors: documents.boletoErrors,
      });
    }

    if (!documents.attachments.length) {
      return res.status(422).json({
        ok: false,
        error: 'Nenhum documento disponível para esta NF-e.',
      });
    }

    const documentLabel = sanitizeFilename(
      `NFe-${invoice.nfe_number || invoice.invoice_id}`,
    );
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('warning', (error) => {
      console.warn('[downloadInvoiceIssuedDocuments][ZIP_WARNING]', error);
    });

    archive.on('error', (error) => {
      console.error('[downloadInvoiceIssuedDocuments][ZIP_ERROR]', error);
      if (!res.headersSent) {
        res.status(500).json({
          ok: false,
          error: 'Erro ao gerar o arquivo ZIP.',
        });
      } else {
        res.destroy(error);
      }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${documentLabel}-documentos.zip"`,
    );

    archive.pipe(res);

    for (const attachment of documents.attachments) {
      const isBoleto = attachment.filename.toUpperCase().startsWith('BOLETO-');
      archive.append(attachment.content, {
        name: isBoleto
          ? `${documentLabel}/boletos/${attachment.filename}`
          : `${documentLabel}/${attachment.filename}`,
      });
    }

    await archive.finalize();
    return undefined;
  } catch (error) {
    console.error(
      '[invoicesIssuedEmailController.downloadInvoiceIssuedDocuments] erro:',
      error,
    );

    if (res.headersSent) {
      res.destroy(error);
      return undefined;
    }

    return res.status(500).json({
      ok: false,
      error: 'Erro ao preparar os documentos da NF-e.',
      details: error?.message || String(error),
    });
  }
}

export async function sendInvoiceIssuedEmail(req, res) {
  try {
    const invoiceId = Number(req.params.id);
    const accountId = Number(
      req.body?.account_id ||
      process.env.DEFAULT_EMAIL_ACCOUNT_ID ||
      1,
    );

    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'invoice_id inválido.',
      });
    }

    const invoice = await loadInvoice(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        ok: false,
        error: 'NF-e não encontrada.',
      });
    }

    const recipients = parseEmailRecipients(
      req.body?.to || invoice.final_email,
    );

    if (!recipients.length) {
      return res.status(400).json({
        ok: false,
        error: 'Cliente não possui e-mail cadastrado.',
        debug: {
          invoice_id: invoiceId,
          order_id: invoice.order_id,
          customer_id: invoice.customer_id,
          order_email: invoice.order_email || null,
          customer_email: invoice.customer_email || null,
        },
      });
    }

    if (recipients.length > 20) {
      return res.status(400).json({
        ok: false,
        error: 'Informe no máximo 20 e-mails destinatários.',
      });
    }

    const invalidRecipients = recipients.filter(
      (email) => !isValidEmail(email),
    );

    if (invalidRecipients.length) {
      return res.status(400).json({
        ok: false,
        error: 'Um ou mais e-mails destinatários são inválidos.',
        invalidRecipients,
      });
    }

    const to = recipients.join(', ');

    const nfeNumber = safe(invoice.nfe_number);
    const customerName = safe(invoice.customer_name) || 'Cliente';
    const orderLabel = safe(invoice.order_number || invoice.order_id) || '-';

    const defaultSubject = `NF-e ${nfeNumber || invoiceId} - BH3 SUPPLY`;
    const subject = safe(req.body?.subject) || defaultSubject;

    const defaultText = `
Olá, ${customerName}.

Segue a NF-e, o DANFE e os boletos referentes ao seu pedido.

NF-e: ${nfeNumber || '-'}
Chave: ${safe(invoice.nfe_key) || '-'}
Pedido: ${orderLabel}

Atenciosamente,
CONSART ERP
    `.trim();

    const text = safe(req.body?.message) || defaultText;
    const html = `
      <p>Olá, <strong>${customerName}</strong>.</p>
      <p>Segue a NF-e, o DANFE e os boletos referentes ao seu pedido.</p>
      <ul>
        <li><strong>NF-e:</strong> ${nfeNumber || '-'}</li>
        <li><strong>Chave:</strong> ${safe(invoice.nfe_key) || '-'}</li>
        <li><strong>Pedido:</strong> ${orderLabel}</li>
      </ul>
      <p>Atenciosamente,<br/>CONSART ERP</p>
    `;

    const {
      attachments,
      attachmentWarnings,
      boletoAttachments,
      boletoErrors,
      expectedBoletos,
    } = await buildInvoiceDocumentAttachments(req, invoice);

    // If this invoice has boleto records, never send a misleading/incomplete
    // email. Return details so the operator can retry after correcting access.
    if (expectedBoletos && boletoAttachments.length !== expectedBoletos) {
      console.error('[EMAIL BOLETOS INCOMPLETOS]', boletoErrors);

      return res.status(502).json({
        ok: false,
        error: 'Não foi possível anexar todos os boletos. E-mail não enviado.',
        expectedBoletos,
        attachedBoletos: boletoAttachments.length,
        boletoErrors,
      });
    }

    console.log('[sendInvoiceIssuedEmail] attachments:', attachments.map(
      (attachment) => ({
        filename: attachment.filename,
        size: attachment.content?.length || 0,
        type: attachment.contentType,
      }),
    ));

    const info = await sendMailByAccount(
      {
        account_id: accountId,
        to,
        subject,
        text,
        html,
        attachments,
      },
      { pgPool: pool },
    );

    return res.json({
      ok: true,
      message: 'E-mail enviado com sucesso.',
      invoice_id: invoiceId,
      to,
      messageId: info?.messageId || null,
      attachments: attachments.map((attachment) => attachment.filename),
      boletoCount: boletoAttachments.length,
      warnings: attachmentWarnings,
    });
  } catch (error) {
    console.error(
      '[invoicesIssuedEmailController.sendInvoiceIssuedEmail] erro:',
      error,
    );

    return res.status(500).json({
      ok: false,
      error: 'Erro ao enviar NF-e por e-mail.',
      details: error?.message || String(error),
    });
  }
}

export default {
  sendInvoiceIssuedEmail,
  downloadInvoiceIssuedDocuments,
};
