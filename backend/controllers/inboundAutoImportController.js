/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ inboundAutoImportController.js — Auto-import NF-e → Inbound      ║
 * ║ Usa inboundInvoicesApi.js e grava CNPJ + Itens + XML + DANFE     ║
 * ║ ✅ Cria Inbound Invoice                                          ║
 * ║ ✅ Importa Itens do XML                                          ║
 * ║ ✅ Cria Parcelas                                                 ║
 * ║ ✅ Cria Accounts Payable automaticamente                         ║
 * ║ ✅ Anexa XML + DANFE no Contas a Pagar                           ║
 * ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { parseStringPromise } from 'xml2js';

import pool from '../config/db.js';
import inboundInvoicesApi from '../repositories/inboundInvoices/inboundInvoices.index.js';
import { createFromSource as createAccountsPayableFromSource } from '../repositories/accountsPayable/accountsPayable.index.js';

// ============================================================================
// GOOGLE CLOUD STORAGE
// ============================================================================

const BUCKET_NAME = process.env.GCS_BUCKET || 'consart-erp';
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const storage = new Storage(PROJECT_ID ? { projectId: PROJECT_ID } : undefined);
const bucket = storage.bucket(BUCKET_NAME);

function buildInboundObjectPath(accessKey, extension) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `taxDocuments/inboundInvoices/${year}/${month}/${day}/${accessKey}.${extension}`;
}

function publicUrl(objectName) {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${objectName}`;
}

// ============================================================================
// GENERAL HELPERS
// ============================================================================

function onlyDigits(value = '') {
  return String(value || '').replace(/\D/g, '');
}

function parseNum(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;

  const raw = String(value).trim();
  if (!raw) return fallback;

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDateOnly(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function safeTrim(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function invoiceIdOf(invoice) {
  const id = Number(invoice?.inbound_id ?? invoice?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function installmentIdOf(installment) {
  const id = Number(installment?.inbound_installment_id ?? installment?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function ensureDir(directory) {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

function resolveBackendPublicRoot() {
  const cwd = process.cwd();
  const candidates = [path.resolve(cwd, 'public'), path.resolve(cwd, 'backend/public')];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return path.resolve(cwd, 'public');
}

function publicPath(...parts) {
  return path.join(resolveBackendPublicRoot(), ...parts);
}

function toPublicUrl(absolutePath) {
  const publicRoot = resolveBackendPublicRoot();
  const normalized = path.resolve(absolutePath);
  const relative = path.relative(publicRoot, normalized);

  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return `/public/${relative.replace(/\\/g, '/')}`;
}

function isUniqueViolation(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const constraint = String(error?.constraint || '');

  return (
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('uq_accountspayable_source') ||
    message.includes('ux_accountspayable_source') ||
    constraint.includes('accountspayable') ||
    constraint.includes('accountsPayable')
  );
}

function normalizeInstallments(rows, { issueDate, totalAmount } = {}) {
  const source = Array.isArray(rows) && rows.length
    ? rows
    : totalAmount > 0
      ? [{ installment_code: '1', due_date: issueDate, amount: totalAmount, is_paid: false }]
      : [];

  return source.map((installment, index) => {
    const installmentNumber = index + 1;
    const amount = parseNum(installment?.amount, 0);
    const isPaid = installment?.is_paid === true;

    return {
      installment_number: installmentNumber,
      installment_code: String(
        safeTrim(installment?.installment_code) || installmentNumber
      ).padStart(3, '0'),
      due_date: normalizeDateOnly(installment?.due_date || issueDate),
      original_due_date: normalizeDateOnly(
        installment?.original_due_date || installment?.due_date || issueDate
      ),
      amount,
      paid_amount: isPaid ? amount : parseNum(installment?.paid_amount, 0),
      status: safeTrim(installment?.status) || (isPaid ? 'PAID' : 'PENDING'),
      is_paid: isPaid,
      paid_at: installment?.paid_at || null,
      accounts_payable_id: installment?.accounts_payable_id || null,
    };
  });
}

// ============================================================================
// XML AND DANFE FILES
// ============================================================================

function resolveExistingNFeFiles(accessKey) {
  try {
    const key = String(accessKey || '').trim();
    if (!key) return { xmlUrl: null, danfeUrl: null };

    const baseDirectories = [
      publicPath('painelNotasFiscais', 'xml'),
      publicPath('xml'),
      publicPath('pdfs'),
    ];

    let xmlUrl = null;
    let danfeUrl = null;

    for (const directory of baseDirectories) {
      if (!fs.existsSync(directory)) continue;

      for (const filename of fs.readdirSync(directory)) {
        if (!filename.includes(key)) continue;

        const url = toPublicUrl(path.join(directory, filename));
        if (!url) continue;

        const lower = filename.toLowerCase();
        if (lower.endsWith('.xml') && !xmlUrl) xmlUrl = url;
        if (lower.endsWith('.pdf') && !danfeUrl) danfeUrl = url;
      }
    }

    return { xmlUrl, danfeUrl };
  } catch (error) {
    console.error('[AUTO_IMPORT][FILES][RESOLVE_ERROR]', error);
    return { xmlUrl: null, danfeUrl: null };
  }
}

async function loadInboxXmlByAccessKey(accessKey) {
  const { rows } = await pool.query(
    `SELECT xml_completo, xml_resumido
       FROM public."nfeInbox"
      WHERE chave_nfe = $1
      ORDER BY id DESC
      LIMIT 1`,
    [accessKey]
  );

  return rows[0]?.xml_completo || rows[0]?.xml_resumido || null;
}

async function saveXmlToGcs(accessKey, xmlString) {
  try {
    if (!xmlString) return null;

    const objectName = buildInboundObjectPath(accessKey, 'xml');
    await bucket.file(objectName).save(Buffer.from(xmlString, 'utf8'), {
      resumable: false,
      contentType: 'application/xml',
    });

    return publicUrl(objectName);
  } catch (error) {
    console.error('[AUTO_IMPORT][SAVE_XML_GCS][ERROR]', error);
    return null;
  }
}

async function tryGenerateDanfeBuffer(xmlString, accessKey) {
  try {
    const module = await import('../services/danfeConsartService.js');
    const generateDanfe = module.generateDanfeFromXml || module.default;

    if (typeof generateDanfe !== 'function') {
      console.warn('[AUTO_IMPORT][DANFE][FUNCTION_NOT_FOUND]');
      return null;
    }

    const temporaryDirectory = publicPath('xml');
    ensureDir(temporaryDirectory);

    const temporaryPath = path.join(temporaryDirectory, `${accessKey}.xml`);
    fs.writeFileSync(temporaryPath, xmlString, 'utf8');

    const result = await generateDanfe({
      chave: accessKey,
      xmlFile: temporaryPath,
      xmlContent: xmlString,
      numero: null,
      serie: null,
    });

    if (Buffer.isBuffer(result)) return result;
    if (Buffer.isBuffer(result?.buffer)) return result.buffer;
    return null;
  } catch (error) {
    console.warn('[AUTO_IMPORT][DANFE][ERROR]', error?.message || error);
    return null;
  }
}

async function saveDanfeToGcs(accessKey, xmlString) {
  try {
    if (!xmlString) return null;

    const pdfBuffer = await tryGenerateDanfeBuffer(xmlString, accessKey);
    if (!pdfBuffer) return null;

    const objectName = buildInboundObjectPath(accessKey, 'pdf');
    await bucket.file(objectName).save(pdfBuffer, {
      resumable: false,
      contentType: 'application/pdf',
    });

    return publicUrl(objectName);
  } catch (error) {
    console.error('[AUTO_IMPORT][SAVE_DANFE_GCS][ERROR]', error);
    return null;
  }
}

// ============================================================================
// NF-e XML PARSING
// ============================================================================

function findInfNFe(object) {
  return (
    object?.nfeProc?.NFe?.infNFe ||
    object?.NFe?.infNFe ||
    object?.procNFe?.NFe?.infNFe ||
    null
  );
}

async function parseNfeHeaderFromXml(xmlString) {
  if (!xmlString) return null;

  try {
    const object = await parseStringPromise(xmlString, {
      explicitArray: false,
      trim: true,
    });

    const infNFe = findInfNFe(object);
    if (!infNFe) return null;

    const ide = infNFe.ide || {};
    const emit = infNFe.emit || {};
    const dest = infNFe.dest || {};
    const total = infNFe.total?.ICMSTot || {};
    const issueDate = ide.dhEmi
      ? String(ide.dhEmi).slice(0, 10)
      : ide.dEmi
        ? String(ide.dEmi).slice(0, 10)
        : null;
    const totalAmount = parseNum(total.vNF, 0);
    const duplicates = infNFe.cobr?.dup
      ? Array.isArray(infNFe.cobr.dup)
        ? infNFe.cobr.dup
        : [infNFe.cobr.dup]
      : [];

    const installments = duplicates.map((duplicate, index) => ({
      installment_number: index + 1,
      installment_code: duplicate.nDup || String(index + 1),
      due_date: normalizeDateOnly(duplicate.dVenc || issueDate),
      original_due_date: normalizeDateOnly(duplicate.dVenc || issueDate),
      amount: parseNum(duplicate.vDup, 0),
      paid_amount: 0,
      status: 'PENDING',
      is_paid: false,
      paid_at: null,
    }));

    return {
      accessKey: String(infNFe?.$?.Id || '').replace(/^NFe/i, '') || null,
      invoiceNumber: ide.nNF || null,
      series: ide.serie || null,
      issuerTaxId: onlyDigits(emit.CNPJ || emit.CPF || ''),
      recipientTaxId: onlyDigits(dest.CNPJ || dest.CPF || ''),
      issueDate,
      totalAmount,
      installments: normalizeInstallments(installments, { issueDate, totalAmount }),
    };
  } catch (error) {
    console.error('[AUTO_IMPORT][XML][HEADER_PARSE_ERROR]', error);
    return null;
  }
}

async function parseNfeItemsFromXml(xmlString) {
  if (!xmlString) return [];

  try {
    const object = await parseStringPromise(xmlString, {
      explicitArray: false,
      trim: true,
    });
    const infNFe = findInfNFe(object);
    if (!infNFe?.det) return [];

    const details = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];

    return details.map((detail, index) => {
      const product = detail.prod || {};
      const taxes = detail.imposto || {};
      const icmsValues = taxes.ICMS ? Object.values(taxes.ICMS) : [];
      const icms = icmsValues[0] || null;
      const ipi = taxes.IPI?.IPITrib || taxes.IPI?.IPINT || null;

      return {
        nf_product_code: product.cProd || null,
        product_code: null,
        product_id: null,
        description: product.xProd || null,
        ncm: product.NCM || null,
        cfop: product.CFOP || null,
        unit: product.uCom || null,
        quantity: parseNum(product.qCom),
        unit_price: parseNum(product.vUnCom),
        total_price: parseNum(product.vProd),
        ipi: ipi ? parseNum(ipi.vIPI) : 0,
        icms: icms ? parseNum(icms.vICMS) : 0,
        icms_cst: icms?.CST || icms?.CSOSN || null,
        icms_base: icms ? parseNum(icms.vBC, null) : null,
        icms_rate: icms ? parseNum(icms.pICMS, null) : null,
        icms_st_base: icms ? parseNum(icms.vBCST, null) : null,
        icms_st_rate: icms ? parseNum(icms.pICMSST, null) : null,
        icms_st_value: icms ? parseNum(icms.vICMSST, null) : null,
        nfe_item_seq: Number(detail?.$?.nItem) || index + 1,
      };
    });
  } catch (error) {
    console.error('[AUTO_IMPORT][XML][ITEMS_PARSE_ERROR]', error);
    return [];
  }
}

// ============================================================================
// SUPPLIER AND PRODUCT MAPPING
// ============================================================================

async function findSupplierIdByTaxId(taxId) {
  const normalized = onlyDigits(taxId);
  if (!normalized) return null;

  try {
    const { rows } = await pool.query(
      `SELECT supplier_id
         FROM public."suppliers"
        WHERE regexp_replace(tax_id, '\\D', '', 'g') = $1
        LIMIT 1`,
      [normalized]
    );

    return rows[0]?.supplier_id ?? null;
  } catch (error) {
    console.error('[AUTO_IMPORT][SUPPLIER][ERROR]', {
      taxId,
      normalized,
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return null;
  }
}

async function resolveItemsWithLmRef({ issuerTaxId, items = [] } = {}) {
  const supplierId = await findSupplierIdByTaxId(issuerTaxId);
  const input = Array.isArray(items) ? items : [];

  if (!supplierId) {
    console.warn('[AUTO_IMPORT][LM_REF][SUPPLIER_NOT_FOUND]', { issuerTaxId });
    return input.map((item) => ({
      ...item,
      product_code: null,
      product_id: null,
      product_lm_ref_id: null,
      lm_ref_found: false,
      lm_ref_status: 'SUPPLIER_NOT_FOUND',
    }));
  }

  const resolved = [];

  for (const item of input) {
    const nfProductCode = String(item?.nf_product_code || '').trim();

    if (!nfProductCode) {
      resolved.push({
        ...item,
        product_code: null,
        product_id: null,
        product_lm_ref_id: null,
        lm_ref_found: false,
        lm_ref_status: 'NF_PRODUCT_CODE_EMPTY',
      });
      continue;
    }

    const mapping = await inboundInvoicesApi.findProductByLmRef({
      supplierId,
      nfProductCode,
    });

    if (!mapping) {
      resolved.push({
        ...item,
        product_code: null,
        product_id: null,
        product_lm_ref_id: null,
        lm_ref_found: false,
        lm_ref_status: 'MAPPING_NOT_FOUND',
      });
      continue;
    }

    resolved.push({
      ...item,
      product_code: String(
        mapping.canonical_product_code || mapping.product_code || ''
      ).trim() || null,
      product_id: Number(mapping.product_id) || null,
      product_lm_ref_id: Number(mapping.product_lm_ref_id) || null,
      lm_ref_found: true,
      lm_ref_status: 'FOUND',
    });
  }

  console.log('[AUTO_IMPORT][LM_REF][RESOLVED]', {
    issuerTaxId,
    supplierId,
    total: resolved.length,
    mapped: resolved.filter((item) => item.lm_ref_found).length,
    unmapped: resolved.filter((item) => !item.lm_ref_found).length,
  });

  return resolved;
}

// ============================================================================
// INSTALLMENTS
// ============================================================================

async function createMissingInstallments({ inboundId, source, issueDate, totalAmount }) {
  if (!Number.isInteger(Number(inboundId)) || Number(inboundId) <= 0) {
    const error = new Error('inbound_id inválido ao criar parcelas.');
    error.code = 'INVALID_INBOUND_ID';
    throw error;
  }

  const installments = normalizeInstallments(source, { issueDate, totalAmount });
  const created = [];

  for (const installment of installments) {
    const row = await inboundInvoicesApi.createInstallment({
      inbound_id: Number(inboundId),
      installment_number: installment.installment_number,
      installment_code: installment.installment_code,
      due_date: installment.due_date,
      original_due_date: installment.original_due_date,
      amount: installment.amount,
      paid_amount: installment.paid_amount,
      status: installment.status,
      is_paid: installment.is_paid,
      paid_at: installment.paid_at,
      accounts_payable_id: installment.accounts_payable_id,
    });

    created.push(row);
  }

  return created;
}

// ============================================================================
// ACCOUNTS PAYABLE
// ============================================================================

async function createAccountsPayableForInstallment({ invoice, installment, xmlUrl, danfeUrl }) {
  const inboundId = invoiceIdOf(invoice);
  const inboundInstallmentId = installmentIdOf(installment);
  const supplierId = await findSupplierIdByTaxId(invoice?.issuer);

  if (!supplierId) {
    console.warn('[AUTO_IMPORT][AP][SUPPLIER_NOT_FOUND]', {
      inboundId,
      issuer: invoice?.issuer,
      accessKey: invoice?.access_key,
    });
    return { ok: false, skipped: true, reason: 'SUPPLIER_NOT_FOUND' };
  }

  if (!inboundInstallmentId) {
    return { ok: false, skipped: true, reason: 'INVALID_INSTALLMENT_ID' };
  }

  const baseName = invoice.access_key || invoice.invoice_number || `invoice_${inboundId}`;
  const attachments = [
    ...(xmlUrl ? [{ file_type: 'XML', file_name: `${baseName}.xml`, file_url: xmlUrl }] : []),
    ...(danfeUrl ? [{ file_type: 'DANFE', file_name: `${baseName}.pdf`, file_url: danfeUrl }] : []),
  ];
  const installmentCode = installment.installment_code ||
    String(installment.installment_number || 1).padStart(3, '0');

  const payload = {
    supplier_id: supplierId,
    invoice_number: invoice.invoice_number,
    issue_date: normalizeDateOnly(invoice.issue_date),
    due_date: normalizeDateOnly(installment.due_date),
    payment_method_id: null,
    description: `NF ${invoice.invoice_number} - Parcela ${installmentCode}`,
    category_id: null,
    subcategory_id: null,
    document_number: invoice.access_key,
    total_value: Number(installment.amount || 0),
    amount_paid: Number(installment.paid_amount || 0),
    status: installment.status || 'PENDING',
    notes: 'Gerado automaticamente a partir da NF-e de entrada.',
    attachment_url: null,
    source_type: 'INBOUND_INSTALLMENT',
    source_id: inboundInstallmentId,
    inbound_invoice_id: inboundId,
    attachments,
  };

  try {
    const result = await createAccountsPayableFromSource(payload);
    console.log('[AUTO_IMPORT][AP][CREATED]', {
      inboundId,
      inboundInstallmentId,
      payableId: result?.payable?.accounts_payable_id ?? result?.payable?.id ?? null,
      created: result?.created ?? null,
      attachmentsCount: result?.attachments?.length || 0,
    });
    return { ok: true, result };
  } catch (error) {
    if (isUniqueViolation(error)) {
      console.warn('[AUTO_IMPORT][AP][ALREADY_EXISTS]', {
        inboundId,
        inboundInstallmentId,
      });
      return { ok: true, duplicated: true };
    }

    console.error('[AUTO_IMPORT][AP][ERROR]', {
      inboundId,
      inboundInstallmentId,
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      constraint: error?.constraint,
    });
    return { ok: false, error: error?.message || 'AP_CREATE_FAILED' };
  }
}

async function ensureAccountsPayableForInvoice({ invoice, installments, xmlUrl, danfeUrl }) {
  const results = [];

  for (const installment of installments || []) {
    results.push({
      inboundInstallmentId: installmentIdOf(installment),
      result: await createAccountsPayableForInstallment({
        invoice,
        installment,
        xmlUrl,
        danfeUrl,
      }),
    });
  }

  return results;
}

// ============================================================================
// MAIN CONTROLLER
// ============================================================================

export async function autoImportFromDfe(req, res) {
  try {
    const query = req.query || {};
    const body = req.body || {};
    const accessKey = String(
      query.accessKey || query.chave || body.accessKey || body.chave || ''
    ).trim();

    if (!accessKey) {
      return res.status(400).json({
        success: false,
        message: 'accessKey (chave de acesso) é obrigatória.',
      });
    }

    const xmlString = await loadInboxXmlByAccessKey(accessKey);
    const parsedHeader = await parseNfeHeaderFromXml(xmlString);

    let xmlUrl = body.xml_url || body.xmlUrl || null;
    let danfeUrl = body.danfe_url || body.danfeUrl || null;

    if (!xmlUrl || !danfeUrl) {
      const existingFiles = resolveExistingNFeFiles(accessKey);
      xmlUrl ||= existingFiles.xmlUrl;
      danfeUrl ||= existingFiles.danfeUrl;
    }

    if (!xmlUrl && xmlString) xmlUrl = await saveXmlToGcs(accessKey, xmlString);
    if (!danfeUrl && xmlString) danfeUrl = await saveDanfeToGcs(accessKey, xmlString);

    const issuerTaxId = onlyDigits(
      body.issuerTaxId || body.issuerCnpj || body.issuer_cnpj ||
      body.emitente_cnpj || parsedHeader?.issuerTaxId || ''
    );
    const recipientTaxId = onlyDigits(
      body.recipientTaxId || body.recipientCnpj || body.recipient_cnpj ||
      body.destinatario_cnpj || parsedHeader?.recipientTaxId || ''
    );
    const issuer = (issuerTaxId || '000000000000000000').slice(0, 18);
    const recipient = (recipientTaxId || '000000000000000000').slice(0, 18);

    let invoiceNumber = body.invoiceNumber || body.numero || parsedHeader?.invoiceNumber || null;
    let series = body.series || body.serie || parsedHeader?.series || null;

    if (accessKey.length === 44 && (!invoiceNumber || !series)) {
      const seriesFromKey = accessKey.slice(22, 25);
      const numberFromKeyRaw = accessKey.slice(25, 34);
      if (!series) series = seriesFromKey;
      if (!invoiceNumber) invoiceNumber = numberFromKeyRaw.replace(/^0+/, '') || numberFromKeyRaw;
    }

    invoiceNumber = String(invoiceNumber || '0').slice(0, 20);
    series = String(series || '0').slice(0, 5);

    const totalRaw = body.total ?? body.total_amount ?? body.valorTotal ??
      parsedHeader?.totalAmount ?? null;
    const totalAmount = totalRaw === null || totalRaw === '' ? 0 : parseNum(totalRaw, 0);
    const issueDate = body.issue_date || body.issueDate || parsedHeader?.issueDate ||
      new Date().toISOString().slice(0, 10);

    const existing = await inboundInvoicesApi.getInvoiceByAccessKey(accessKey);

    if (existing) {
      const inboundId = invoiceIdOf(existing);
      let installments = await inboundInvoicesApi.listInstallmentsByInvoice(inboundId);

      if (!installments.length) {
        await createMissingInstallments({
          inboundId,
          source: parsedHeader?.installments,
          issueDate,
          totalAmount,
        });
        installments = await inboundInvoicesApi.listInstallmentsByInvoice(inboundId);
      }

      const accountsPayable = await ensureAccountsPayableForInvoice({
        invoice: existing,
        installments,
        xmlUrl: existing.xml_url || xmlUrl || null,
        danfeUrl: existing.danfe_url || danfeUrl || null,
      });

      return res.json({
        success: true,
        alreadyExists: true,
        invoiceId: inboundId,
        invoice: existing,
        installments,
        accountsPayable,
        xml: xmlString || null,
        xml_url: existing.xml_url || xmlUrl || null,
        danfe_url: existing.danfe_url || danfeUrl || null,
      });
    }

    const invoicePayload = {
      access_key: accessKey,
      invoice_number: invoiceNumber,
      series,
      issuer,
      recipient,
      total_amount: totalAmount,
      issue_date: normalizeDateOnly(issueDate),
      entry_date: normalizeDateOnly(body.entry_date || body.entryDate || issueDate),
      status: 'PENDING',
      stock_applied: false,
      stock_applied_at: null,
      xml_url: xmlUrl,
      danfe_url: danfeUrl,
    };

    console.log('[AUTO_IMPORT][CREATE][PAYLOAD]', invoicePayload);
    const created = await inboundInvoicesApi.createInvoice(invoicePayload);
    const inboundId = invoiceIdOf(created);

    try {
      const parsedItems = await parseNfeItemsFromXml(xmlString);
      const items = await resolveItemsWithLmRef({ issuerTaxId, items: parsedItems });

      for (const item of items) {
        await inboundInvoicesApi.createItem({
          ...item,
          inbound_id: inboundId,
          nfe_key: accessKey,
        });
      }

      if (!items.length) {
        console.warn('[AUTO_IMPORT][ITEMS][EMPTY]', { accessKey, inboundId });
      }
    } catch (error) {
      console.error('[AUTO_IMPORT][ITEMS][ERROR]', {
        accessKey,
        inboundId,
        message: error?.message,
        code: error?.code,
      });
    }

    let installments = await inboundInvoicesApi.listInstallmentsByInvoice(inboundId);

    if (!installments.length) {
      await createMissingInstallments({
        inboundId,
        source: parsedHeader?.installments,
        issueDate,
        totalAmount,
      });
      installments = await inboundInvoicesApi.listInstallmentsByInvoice(inboundId);
    }

    const accountsPayable = await ensureAccountsPayableForInvoice({
      invoice: created,
      installments,
      xmlUrl: created.xml_url || xmlUrl || null,
      danfeUrl: created.danfe_url || danfeUrl || null,
    });

    return res.status(201).json({
      success: true,
      alreadyExists: false,
      invoiceId: inboundId,
      invoice: created,
      installments,
      accountsPayable,
      xml: xmlString || null,
      xml_url: created.xml_url || xmlUrl || null,
      danfe_url: created.danfe_url || danfeUrl || null,
    });
  } catch (error) {
    console.error('[AUTO_IMPORT][ERROR]', error);

    return res.status(Number(error?.status) || 500).json({
      success: false,
      message: error?.message || 'Erro ao importar NF-e para módulo de entrada.',
      detail: error?.detail || error?.message || null,
      code: error?.code || null,
      constraint: error?.constraint || null,
    });
  }
}

export default {
  autoImportFromDfe,
};
