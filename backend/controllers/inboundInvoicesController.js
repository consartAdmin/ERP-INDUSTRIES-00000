// ╔══════════════════════════════════════════════════════════════════╗
// ║ inboundInvoicesController.js — Notas de Entrada (Inbound NF-e)   ║
// ║ Importação XML, auto-import, itens, parcelas, estoque e AP       ║
// ║ CONSART ERP | ESM                                                ║
// ║                                                                  ║
// ║ ✅ Import XML (prévia) com trava anti-duplicidade                ║
// ║ ✅ Auto import por accessKey / XML existente / xmlContent        ║
// ║ ✅ Gera DANFE com chave real e arquivo XML real                  ║
// ║ ✅ CRUD Invoices + Itens + Parcelas                              ║
// ║ ✅ POST: STOCK_SIMPLE ou WITH_LOT + atualiza custo base           ║
// ║ ✅ AUTO-POST respeita PRODUCT_STOCK_MODE                          ║
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

const INBOUND_CONTROLLER_VERSION = 'NAMED_IDS_FISCAL_V6_SYNC_2026-09-13';

import {
  listInvoices,
  getInvoiceById,
  getInvoiceByAccessKey,
  createInvoice,
  updateInvoice,
  listItemsByInvoice,
  createItem,
  updateItem,
  deleteItem,
  listInstallmentsByInvoice,
  createInstallment,
  updateInstallment,
  deleteInstallment,
  ensureColumnsForPosting,
  findProductByLmRef,
} from '../repositories/inboundInvoices/inboundInvoices.index.js';

import { parseStringPromise } from 'xml2js';
import pool from '../config/db.js';
import { createFromSource as createAccountsPayableFromSource } from '../repositories/accountsPayable/accountsPayable.index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDanfeFromXml } from '../services/danfeConsartService.js';

import crypto from 'crypto';

import {
  registerProductMovement,
  MOVEMENT_TYPES,
} from '../repositories/productMovements/productMovements.index.js';
import { queueErrorEmail } from '../errorEmailReporter.js';

function reportInboundError(...args) {
  console.error(...args);

  const caught = args.find((value) => value instanceof Error);
  const structured = args.find(
    (value) => value && typeof value === 'object' && !(value instanceof Error),
  );
  const label = typeof args[0] === 'string'
    ? args[0]
    : structured?.tag || 'Erro no módulo de notas de entrada';

  queueErrorEmail('INBOUND_CONTROLLER_ERROR', {
    module: 'controllers/inboundInvoicesController.js',
    message: caught?.message || structured?.message || label,
    context: label,
    traceId: structured?.traceId,
    invoiceId: structured?.invoiceId,
    err: caught
      ? {
        name: caught.name,
        message: caught.message,
        code: caught.code,
        stack: caught.stack,
      }
      : structured?.message
        ? {
          message: structured.message,
          code: structured.code,
          stack: structured.stack,
        }
        : undefined,
    details: args,
  });
}

function makeInboundTraceId(prefix = 'INB') {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${Date.now()}-${rand}`;
}

function logInbound(level, tag, data = {}) {
  const ts = new Date().toISOString();

  const payload = {
    ts,
    level,
    tag,
    ...data,
  };

  if (level === 'ERROR') {
    reportInboundError(payload);
    return;
  }

  if (level === 'WARN') {
    console.warn(payload);
    return;
  }

  console.log(payload);
}

function getInboundTrace(req, fallbackPrefix = 'INB') {
  return (
    req?.headers?.['x-inbound-trace-id'] ||
    req?.body?.traceId ||
    req?.query?.traceId ||
    makeInboundTraceId(fallbackPrefix)
  );
}

// ====================================================================
// PATHS FIXOS
// ====================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(BACKEND_ROOT, 'public');

const XML_DIR_1 = path.join(PUBLIC_ROOT, 'painelNotasFiscais', 'xml');
const XML_DIR_2 = path.join(PUBLIC_ROOT, 'xml');
const PDF_DIR = path.join(PUBLIC_ROOT, 'pdfs');

// ====================================================================
// Helpers de resposta HTTP
// ====================================================================
function ok(res, data) {
  return res.status(200).json(data);
}

function created(res, data) {
  return res.status(201).json(data);
}

function noContent(res) {
  return res.status(204).end();
}

function bad(res, msg, detail) {
  return res.status(400).json({ ok: false, error: msg, detail });
}

function boom(res, err) {
  reportInboundError('[INBOUND][CTRL]', err);
  return res.status(500).json({
    ok: false,
    error: 'Internal server error',
    detail: err?.message,
  });
}

// ====================================================================
// HELPERS GERAIS
// ====================================================================
function parseNumberBR(value, fallback = 0) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value)
    .trim()
    .replace(',', '.');

  const number = Number(normalized);

  return Number.isFinite(number) ? number : fallback;
}

function normalizeTaxId(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D+/g, '');
}

function normalizeAccessKey(raw) {
  return String(raw || '').replace(/\D+/g, '');
}

function isUniqueViolation(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === '23505' ||
    code === 'INVOICE_ALREADY_EXISTS' ||
    msg.includes('duplicate key') ||
    msg.includes('uq_accountspayable_source') ||
    msg.includes('ux_accountspayable_source')
  );
}

function normalizeDateOnly(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toIntOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;

  const only = s.replace(/[^\d-]/g, '');
  const n = Number(only);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toStrOrNull(value) {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

function toNumOrZero(value) {
  return parseNumberBR(value, 0);
}

function toNumOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseNumberBR(value, null);
}

// ====================================================================
// PRODUCT STOCK MODE
// Current inbound flow is STOCK_SIMPLE. Environment value may override
// this if/when the tenant switches back to lot-controlled stock.
// ====================================================================
function getInboundProductStockMode() {
  const raw = String(process.env.PRODUCT_STOCK_MODE || 'STOCK_SIMPLE')
    .trim()
    .toUpperCase();

  if (raw === 'SIMPLE') return 'STOCK_SIMPLE';
  if (raw === 'WITH_LOT' || raw === 'LOT' || raw === 'STOCK_WITH_LOT') return 'WITH_LOT';

  return raw || 'STOCK_SIMPLE';
}

function isInboundSimpleStockMode() {
  return getInboundProductStockMode() === 'STOCK_SIMPLE';
}

// ====================================================================
// HELPERS: arquivos
// ====================================================================
function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toPublicUrl(absPath) {
  const normalized = path.resolve(absPath);
  if (!normalized.startsWith(PUBLIC_ROOT)) return null;
  return `/public/${path.relative(PUBLIC_ROOT, normalized).replace(/\\/g, '/')}`;
}

function resolveNFeFiles(accessKey) {
  try {
    const key = normalizeAccessKey(accessKey);
    if (!key) {
      return { xmlUrl: null, danfeUrl: null, xmlPath: null, danfePath: null };
    }

    const baseDirs = [XML_DIR_1, XML_DIR_2, PDF_DIR];

    let xmlUrl = null;
    let danfeUrl = null;
    let xmlPath = null;
    let danfePath = null;

    for (const dir of baseDirs) {
      if (!fs.existsSync(dir)) continue;

      const files = fs.readdirSync(dir);

      for (const f of files) {
        const lower = f.toLowerCase();
        if (!f.includes(key)) continue;

        const abs = path.join(dir, f);
        const url = toPublicUrl(abs);

        if (lower.endsWith('.xml') && !xmlUrl) {
          xmlUrl = url;
          xmlPath = abs;
        }

        if (lower.endsWith('.pdf') && !danfeUrl) {
          danfeUrl = url;
          danfePath = abs;
        }
      }
    }

    return { xmlUrl, danfeUrl, xmlPath, danfePath };
  } catch (err) {
    reportInboundError('[INBOUND][FILES][ERROR]', err);
    return { xmlUrl: null, danfeUrl: null, xmlPath: null, danfePath: null };
  }
}

function readXmlTextSafely(absPath) {
  try {
    if (!absPath) return null;
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

function saveXmlByAccessKey(accessKey, xmlContent) {
  const key = normalizeAccessKey(accessKey);
  if (!key) throw new Error('ACCESS_KEY_INVALID_FOR_XML_SAVE');
  if (!xmlContent || !String(xmlContent).trim()) throw new Error('XML_CONTENT_EMPTY');

  ensureDirSync(XML_DIR_2);

  const xmlAbsPath = path.join(XML_DIR_2, `${key}.xml`);
  fs.writeFileSync(xmlAbsPath, String(xmlContent), 'utf8');

  return {
    xmlPath: xmlAbsPath,
    xmlUrl: toPublicUrl(xmlAbsPath),
  };
}

function resolveDanfeUrlFromResult(result) {
  return (
    result?.danfe_url ||
    result?.pdfUrl ||
    result?.url ||
    result?.file_url ||
    result?.publicUrl ||
    null
  );
}

// ====================================================================
// HELPERS: NF-e XML
// ====================================================================
function extractInfNFeRoot(parsed) {
  let nfe =
    parsed?.nfeProc?.NFe?.[0] ||
    parsed?.NFe?.[0] ||
    parsed?.NFe ||
    parsed?.nfeProc?.NFe ||
    parsed?.nfeProc ||
    parsed;

  if (Array.isArray(nfe)) nfe = nfe[0];

  const infNFe =
    nfe?.infNFe?.[0] ||
    nfe?.infNFe ||
    parsed?.nfeProc?.NFe?.[0]?.infNFe?.[0] ||
    null;

  return infNFe || null;
}

function extractHeaderFromInfNFe(infNFe) {
  const ide = infNFe.ide?.[0] || {};
  const emit = infNFe.emit?.[0] || {};
  const dest = infNFe.dest?.[0] || {};
  const total = infNFe.total?.[0] || {};
  const icmsTot = total.ICMSTot?.[0] || {};

  const accessKeyRaw = infNFe.$?.Id || '';
  const accessKey = String(accessKeyRaw).replace(/^NFe/i, '');

  const invoiceNumber = ide.nNF?.[0] || '';
  const series = ide.serie?.[0] || '';

  const issueDate = ide.dhEmi?.[0]
    ? String(ide.dhEmi[0]).slice(0, 10)
    : ide.dEmi?.[0] || null;

  const entryDate = ide.dhSaiEnt?.[0]
    ? String(ide.dhSaiEnt[0]).slice(0, 10)
    : ide.dSaiEnt?.[0] || null;

  const issuerCnpj = emit.CNPJ?.[0] || emit.CPF?.[0] || '';
  const recipientCnpj = dest.CNPJ?.[0] || dest.CPF?.[0] || '';

  const totalAmountStr = icmsTot.vNF?.[0] || '0';
  const totalAmount = parseNumberBR(totalAmountStr, 0);

  return {
    accessKey,
    invoiceNumber,
    series,
    issuerCnpj,
    recipientCnpj,
    issueDate,
    entryDate,
    totalAmount,
  };
}

function findDetList(infNFe) {
  if (!infNFe) return [];
  if (Array.isArray(infNFe.det)) return infNFe.det;
  if (infNFe.det && typeof infNFe.det === 'object') return [infNFe.det];

  const list = [];
  for (const value of Object.values(infNFe)) {
    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child === 'object' && child.prod) list.push(child);
      });
    }
  }
  return list;
}

function extractItemsFromInfNFe(infNFe) {
  const detList = findDetList(infNFe);
  const items = [];

  const nfe_key = String(infNFe?.$?.Id || '')
    .replace(/^NFe/i, '');

  detList.forEach((det, idx) => {
    const prod = det.prod?.[0] || {};
    const imposto = det.imposto?.[0] || {};

    const nf_product_code = prod.cProd?.[0] || '';
    const barcode = prod.cEAN?.[0] && prod.cEAN?.[0] !== 'SEM GTIN'
      ? String(prod.cEAN[0]).trim()
      : null;
    const manufacturer_ref = prod.cProd?.[0] || null;
    const description = prod.xProd?.[0] || '';
    const ncm = prod.NCM?.[0] || '';
    const cest = prod.CEST?.[0] || null;
    const benefit_code = prod.cBenef?.[0] || null;
    const cfop = prod.CFOP?.[0] || '';
    const unit = prod.uCom?.[0] || '';

    const quantity = parseNumberBR(prod.qCom?.[0], 0);
    const unit_price = parseNumberBR(prod.vUnCom?.[0], 0);
    const total_price = parseNumberBR(
      prod.vProd?.[0],
      quantity * unit_price
    );

    const commercial_unit = prod.uCom?.[0] || unit || 'UN';
    const commercial_quantity = parseNumberBR(prod.qCom?.[0], quantity);
    const commercial_unit_price = parseNumberBR(prod.vUnCom?.[0], unit_price);
    const taxable_unit = prod.uTrib?.[0] || commercial_unit;
    const taxable_quantity = parseNumberBR(prod.qTrib?.[0], commercial_quantity);
    const taxable_unit_price = parseNumberBR(prod.vUnTrib?.[0], commercial_unit_price);
    const conversion_factor = commercial_quantity > 0
      ? taxable_quantity / commercial_quantity
      : 1;

    const discount_value = parseNumberBR(prod.vDesc?.[0], 0);
    const freight_value = parseNumberBR(prod.vFrete?.[0], 0);
    const insurance_value = parseNumberBR(prod.vSeg?.[0], 0);
    const other_expenses = parseNumberBR(prod.vOutro?.[0], 0);
    const gross_total = total_price;
    const net_total = Math.max(
      0,
      gross_total - discount_value + freight_value + insurance_value + other_expenses
    );

    // IPI
    const ipiNode = imposto.IPI?.[0] || {};
    const ipiTrib = ipiNode.IPITrib?.[0] || ipiNode.IPINT?.[0] || {};
    const ipi_cst = ipiTrib.CST?.[0] || null;
    const ipi_base = parseNullableNumberBR(ipiTrib.vBC?.[0]);
    const ipi_rate = parseNullableNumberBR(ipiTrib.pIPI?.[0]);
    const ipi = parseNumberBR(ipiTrib.vIPI?.[0], 0);

    // Locate the applicable ICMS group:
    // ICMS00, ICMS10, ICMS20, ICMS60, ICMSSN102, etc.
    const icmsNode = imposto.ICMS?.[0] || {};

    let icmsBlock = {};

    for (const key of Object.keys(icmsNode)) {
      if (key.startsWith('ICMS') && icmsNode[key]?.[0]) {
        icmsBlock = icmsNode[key][0];
        break;
      }
    }

    const icms_cst =
      icmsBlock.CST?.[0] ||
      icmsBlock.CSOSN?.[0] ||
      null;

    const icms_origin = icmsBlock.orig?.[0] || null;
    const icms_modality = icmsBlock.modBC?.[0] || null;
    const icms_reduction_rate = parseNullableNumberBR(icmsBlock.pRedBC?.[0]);
    const icms_st_modality = icmsBlock.modBCST?.[0] || null;
    const icms_st_mva_rate = parseNullableNumberBR(icmsBlock.pMVAST?.[0]);
    const icms_st_reduction_rate = parseNullableNumberBR(icmsBlock.pRedBCST?.[0]);

    const icms_base = parseNullableNumberBR(
      icmsBlock.vBC?.[0]
    );

    const icms_rate = parseNullableNumberBR(
      icmsBlock.pICMS?.[0]
    );

    const icms = parseNumberBR(
      icmsBlock.vICMS?.[0],
      0
    );

    // Normal ICMS-ST or retained ICMS-ST
    const icms_st_base = parseNullableNumberBR(
      icmsBlock.vBCST?.[0] ??
      icmsBlock.vBCSTRet?.[0]
    );

    const icms_st_rate = parseNullableNumberBR(
      icmsBlock.pICMSST?.[0] ??
      icmsBlock.pST?.[0]
    );

    const icms_st_value = parseNullableNumberBR(
      icmsBlock.vICMSST?.[0] ??
      icmsBlock.vICMSSTRet?.[0] ??
      icmsBlock.vICMSSubstituto?.[0]
    );

    const fcp_base = parseNullableNumberBR(icmsBlock.vBCFCP?.[0]);
    const fcp_rate = parseNullableNumberBR(icmsBlock.pFCP?.[0]);
    const fcp_value = parseNullableNumberBR(icmsBlock.vFCP?.[0]);
    const fcp_st_base = parseNullableNumberBR(icmsBlock.vBCFCPST?.[0]);
    const fcp_st_rate = parseNullableNumberBR(icmsBlock.pFCPST?.[0]);
    const fcp_st_value = parseNullableNumberBR(icmsBlock.vFCPST?.[0]);

    const pisNode = imposto.PIS?.[0] || {};
    const pisBlock = Object.values(pisNode).find((value) => Array.isArray(value) && value[0])?.[0] || {};
    const pis_cst = pisBlock.CST?.[0] || null;
    const pis_base = parseNullableNumberBR(pisBlock.vBC?.[0]);
    const pis_rate = parseNullableNumberBR(pisBlock.pPIS?.[0]);
    const pis_value = parseNullableNumberBR(pisBlock.vPIS?.[0]);

    const cofinsNode = imposto.COFINS?.[0] || {};
    const cofinsBlock = Object.values(cofinsNode).find((value) => Array.isArray(value) && value[0])?.[0] || {};
    const cofins_cst = cofinsBlock.CST?.[0] || null;
    const cofins_base = parseNullableNumberBR(cofinsBlock.vBC?.[0]);
    const cofins_rate = parseNullableNumberBR(cofinsBlock.pCOFINS?.[0]);
    const cofins_value = parseNullableNumberBR(cofinsBlock.vCOFINS?.[0]);

    const ibsCbsNode = imposto.IBSCBS?.[0] || {};
    const ibsCbsGroup = ibsCbsNode.gIBSCBS?.[0] || ibsCbsNode;
    const ibsState = ibsCbsGroup.gIBSUF?.[0] || {};
    const ibsCity = ibsCbsGroup.gIBSMun?.[0] || {};
    const cbsGroup = ibsCbsGroup.gCBS?.[0] || {};

    const ibs_cst = ibsCbsNode.CST?.[0] || null;
    const ibs_classification_code = ibsCbsNode.cClassTrib?.[0] || null;
    const ibs_base = parseNullableNumberBR(ibsCbsGroup.vBC?.[0]);
    const ibs_state_rate = parseNullableNumberBR(ibsState.pIBSUF?.[0]);
    const ibs_state_value = parseNullableNumberBR(ibsState.vIBSUF?.[0]);
    const ibs_city_rate = parseNullableNumberBR(ibsCity.pIBSMun?.[0]);
    const ibs_city_value = parseNullableNumberBR(ibsCity.vIBSMun?.[0]);
    const ibs_value = parseNullableNumberBR(ibsCbsGroup.vIBS?.[0]);
    const cbs_cst = ibsCbsNode.CST?.[0] || null;
    const cbs_classification_code = ibsCbsNode.cClassTrib?.[0] || null;
    const cbs_base = parseNullableNumberBR(ibsCbsGroup.vBC?.[0]);
    const cbs_rate = parseNullableNumberBR(cbsGroup.pCBS?.[0]);
    const cbs_value = parseNullableNumberBR(cbsGroup.vCBS?.[0]);

    const nfe_item_seq = Number(
      det?.$?.nItem || idx + 1
    );

    items.push({
      nf_product_code,
      // cProd é a referência do fornecedor. O produto interno será resolvido por productsLmRef.
      product_code: null,
      barcode,
      manufacturer_ref,
      description,
      ncm,
      cest,
      benefit_code,
      cfop,
      unit,
      quantity,
      unit_price,
      total_price,
      commercial_unit,
      commercial_quantity,
      commercial_unit_price,
      taxable_unit,
      taxable_quantity,
      taxable_unit_price,
      conversion_factor,
      gross_total,
      discount_value,
      freight_value,
      insurance_value,
      other_expenses,
      net_total,
      ipi,
      icms,

      icms_origin,
      icms_cst,
      icms_modality,
      icms_base,
      icms_reduction_rate,
      icms_rate,
      icms_value: icms,
      icms_st_modality,
      icms_st_mva_rate,
      icms_st_reduction_rate,
      icms_st_base,
      icms_st_rate,
      icms_st_value,

      fcp_base,
      fcp_rate,
      fcp_value,
      fcp_st_base,
      fcp_st_rate,
      fcp_st_value,

      ipi_cst,
      ipi_base,
      ipi_rate,
      ipi_value: ipi,
      pis_cst,
      pis_base,
      pis_rate,
      pis_value,
      cofins_cst,
      cofins_base,
      cofins_rate,
      cofins_value,
      ibs_cst,
      ibs_classification_code,
      ibs_base,
      ibs_state_rate,
      ibs_state_value,
      ibs_city_rate,
      ibs_city_value,
      ibs_value,
      cbs_cst,
      cbs_classification_code,
      cbs_base,
      cbs_rate,
      cbs_value,

      nfe_key: nfe_key || null,
      nfe_item_seq,
      raw_product_payload: prod,
      raw_tax_payload: imposto,

      product_id: null,
      lot_id: null,
      _index: idx + 1,
    });
  });

  return items;
}

function parseNullableNumberBR(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return parseNumberBR(value, null);
}

function extractInstallmentsFromInfNFe(infNFe) {
  const ide = infNFe.ide?.[0] || {};
  const total = infNFe.total?.[0] || {};
  const icmsTot = total.ICMSTot?.[0] || {};

  const totalAmount = parseNumberBR(icmsTot.vNF?.[0] || '0', 0);

  let issueDate = null;
  if (ide.dhEmi?.[0]) issueDate = String(ide.dhEmi[0]).substring(0, 10);
  else if (ide.dEmi?.[0]) issueDate = ide.dEmi[0];
  else issueDate = new Date().toISOString().slice(0, 10);

  const out = [];
  const cobr = infNFe.cobr?.[0] || {};
  const dupList = cobr.dup || [];

  dupList.forEach((dup, idx) => {
    const code = dup.nDup?.[0] || String(idx + 1);
    const dVenc = dup.dVenc?.[0] || issueDate;
    const vDup = dup.vDup?.[0] || '0';

    out.push({
      installment_code: code,
      due_date: dVenc,
      amount: parseNumberBR(vDup, 0),
      is_paid: false,
    });
  });

  if (!out.length && Array.isArray(infNFe.pag) && infNFe.pag.length) {
    let somaPag = 0;
    infNFe.pag.forEach((pag) => {
      somaPag += parseNumberBR(pag.vPag?.[0], 0);
    });

    out.push({
      installment_code: '1',
      due_date: issueDate,
      amount: somaPag || totalAmount,
      is_paid: false,
    });
  }

  if (!out.length && totalAmount > 0) {
    out.push({
      installment_code: '1',
      due_date: issueDate,
      amount: totalAmount,
      is_paid: false,
    });
  }

  return out;
}

async function parseXmlToInvoicePreview(xmlContent) {
  const parsed = await parseStringPromise(xmlContent, {
    explicitArray: true,
    trim: true,
  });

  const infNFe = extractInfNFeRoot(parsed);
  if (!infNFe) {
    const e = new Error('Estrutura infNFe não encontrada no XML.');
    e.code = 'INFNFE_NOT_FOUND';
    throw e;
  }

  const header = extractHeaderFromInfNFe(infNFe);
  const items = extractItemsFromInfNFe(infNFe);
  const installments = extractInstallmentsFromInfNFe(infNFe);

  return { parsed, infNFe, header, items, installments };
}

// ====================================================================
// HELPERS: Fornecedor / produto
// ====================================================================
async function findSupplierIdByTaxId(taxId) {
  const normalized = normalizeTaxId(taxId);
  if (!normalized) return null;

  try {
    const sql = `
      SELECT supplier_id
        FROM public."suppliers"
       WHERE regexp_replace(tax_id, '\\D', '', 'g') = $1
       LIMIT 1
    `;
    const res = await pool.query(sql, [normalized]);
    return res.rows[0]?.supplier_id ?? null;
  } catch (err) {
    reportInboundError('[INBOUND][CTRL] Erro ao buscar fornecedor por tax_id:', err);
    return null;
  }
}

async function findProductIdByProductCode(productCode) {
  const code = String(productCode || '').trim();
  if (!code) return null;

  const { rows } = await pool.query(
    `SELECT product_id FROM public.products WHERE product_code = $1 LIMIT 1`,
    [code]
  );

  return rows[0]?.product_id ?? null;
}

async function findPrimaryBarcodeUnit({ productId, productCode } = {}) {
  const schemaRes = await pool.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'productsBarCode'
  `);

  const columns = new Map(
    schemaRes.rows.map((row) => [String(row.column_name).toLowerCase(), row.column_name])
  );

  const column = (...candidates) => {
    for (const candidate of candidates) {
      const found = columns.get(String(candidate).toLowerCase());
      if (found) return found;
    }
    return null;
  };

  const barcodeIdCol = column('barcode_id', 'id');
  const productIdCol = column('product_id');
  const productCodeCol = column('product_code');
  const unitCodeCol = column('unit_code', 'unit', 'unidade', 'u_m', 'um');
  const unitIdCol = column('unit_id');
  const primaryCol = column('is_primary', 'primary', 'is_default');
  const activeCol = column('is_active', 'active');
  const conversionCol = column('conversion_factor', 'factor', 'multiplier');

  if ((!productIdCol && !productCodeCol) || (!unitCodeCol && !unitIdCol)) {
    return null;
  }

  const quoteIdent = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const where = [];
  const params = [];

  if (productIdCol && Number(productId) > 0) {
    params.push(Number(productId));
    where.push(`pb.${quoteIdent(productIdCol)} = $${params.length}`);
  } else if (productCodeCol && String(productCode || '').trim()) {
    params.push(String(productCode).trim());
    where.push(`BTRIM(pb.${quoteIdent(productCodeCol)}::text) = $${params.length}`);
  } else {
    return null;
  }

  if (activeCol) {
    where.push(`COALESCE(pb.${quoteIdent(activeCol)}, TRUE) = TRUE`);
  }

  const joins = [];
  let unitExpression = 'NULL::text';

  if (unitCodeCol) {
    unitExpression = `NULLIF(BTRIM(pb.${quoteIdent(unitCodeCol)}::text), '')`;
  } else if (unitIdCol) {
    joins.push(
      `LEFT JOIN public."units" u ON u.unit_id = pb.${quoteIdent(unitIdCol)}`
    );
    unitExpression = `NULLIF(BTRIM(u.unit::text), '')`;
  }

  const order = [];
  if (primaryCol) order.push(`COALESCE(pb.${quoteIdent(primaryCol)}, FALSE) DESC`);
  if (barcodeIdCol) order.push(`pb.${quoteIdent(barcodeIdCol)} ASC`);

  const { rows } = await pool.query(
    `SELECT
       ${barcodeIdCol ? `pb.${quoteIdent(barcodeIdCol)}` : 'NULL::bigint'} AS barcode_id,
       ${unitExpression} AS barcode_unit,
       ${conversionCol ? `pb.${quoteIdent(conversionCol)}` : '1::numeric'} AS conversion_factor
       FROM public."productsBarCode" pb
       ${joins.join('\n')}
      WHERE ${where.join(' AND ')}
        AND ${unitExpression} IS NOT NULL
      ${order.length ? `ORDER BY ${order.join(', ')}` : ''}
      LIMIT 1`,
    params
  );

  return rows[0] || null;
}


async function resolveProductsLmRefForItems({ issuerTaxId, items = [] } = {}) {
  const inputItems = Array.isArray(items) ? items : [];
  const supplierId = await findSupplierIdByTaxId(issuerTaxId);

  if (!supplierId) {
    return {
      supplierId: null,
      items: inputItems.map((item) => ({
        ...item,
        product_code: null,
        product_id: null,
        product_lm_ref_id: null,
        lm_ref_found: false,
        lm_ref_status: 'SUPPLIER_NOT_FOUND',
      })),
    };
  }

  const resolvedItems = [];

  for (const item of inputItems) {
    const nfProductCode = String(item?.nf_product_code || '').trim();

    if (!nfProductCode) {
      resolvedItems.push({
        ...item,
        product_code: null,
        product_id: null,
        product_lm_ref_id: null,
        lm_ref_found: false,
        lm_ref_status: 'NF_PRODUCT_CODE_EMPTY',
      });
      continue;
    }

    const mapping = await findProductByLmRef({
      supplierId,
      nfProductCode,
    });

    if (!mapping) {
      resolvedItems.push({
        ...item,
        nf_product_code: nfProductCode,
        product_code: null,
        product_id: null,
        product_lm_ref_id: null,
        lm_ref_found: false,
        lm_ref_status: 'MAPPING_NOT_FOUND',
      });
      continue;
    }

    const productCode = String(
      mapping.canonical_product_code || mapping.product_code || ''
    ).trim() || null;
    const productId = Number(mapping.product_id) || null;
    const barcode = await findPrimaryBarcodeUnit({ productId, productCode });
    const barcodeUnit = String(barcode?.barcode_unit || '').trim().toUpperCase() || null;

    resolvedItems.push({
      ...item,
      nf_product_code: nfProductCode,
      xml_unit: item.unit || null,
      unit: barcodeUnit || item.unit || null,
      barcode_id: barcode?.barcode_id ?? null,
      barcode_unit: barcodeUnit,
      conversion_factor: Number(barcode?.conversion_factor) || 1,
      product_code: productCode,
      product_id: productId,
      product_description: String(
        mapping.canonical_product_description || mapping.description || ''
      ).trim() || null,
      product_lm_ref_id: Number(mapping.product_lm_ref_id) || null,
      lm_ref_found: true,
      lm_ref_status: 'FOUND',
    });
  }

  return { supplierId, items: resolvedItems };
}

// ====================================================================
// HELPERS: estoque / lotes automáticos
// ====================================================================
async function getProductsStockLotsSchema(client) {
  const r = await client.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'productsStockLots'
  `);

  const set = new Set(r.rows.map((x) => String(x.column_name).toLowerCase()));

  return {
    has_product_stock_id: set.has('product_stock_id'),
    has_lot_code: set.has('lot_code'),
    has_code: set.has('code'),
    has_lot: set.has('lot'),
    has_description: set.has('description'),
    has_qty_on_hand: set.has('qty_on_hand'),
    has_qty_reserved: set.has('qty_reserved'),
    has_cost_unit: set.has('cost_unit'),
    has_nfe_key: set.has('nfe_key'),
    has_nfe_item_seq: set.has('nfe_item_seq'),
    has_created_at: set.has('created_at'),
    has_updated_at: set.has('updated_at'),
  };
}

async function getProductStockRow(client, productId, productCode) {
  if (productId) {
    const r = await client.query(
      `SELECT product_id, product_stock_id, product_code
         FROM public.products
        WHERE product_id = $1
        LIMIT 1`,
      [productId]
    );
    return r.rows[0] || null;
  }

  if (productCode) {
    const r = await client.query(
      `SELECT product_id, product_stock_id, product_code
         FROM public.products
        WHERE product_code = $1
        LIMIT 1`,
      [String(productCode).trim()]
    );
    return r.rows[0] || null;
  }

  return null;
}

function buildAutoLotCode(accessKey, itemIndex) {
  const key = String(accessKey || '').replace(/\D+/g, '').slice(-12) || 'AUTO';
  const idx = String(itemIndex || 1).padStart(3, '0');
  return `NF${key}-${idx}`;
}

async function findExistingAutoLot(client, productStockId, lotCode, schema) {
  if (!schema.has_product_stock_id) return null;

  const candidates = [];
  if (schema.has_lot_code) candidates.push('lot_code');
  if (schema.has_code) candidates.push('code');
  if (schema.has_lot) candidates.push('lot');

  for (const col of candidates) {
    const r = await client.query(
      `SELECT lot_id
         FROM public."productsStockLots"
        WHERE product_stock_id = $1
          AND ${col} = $2
        LIMIT 1`,
      [productStockId, lotCode]
    );
    if (r.rows[0]?.lot_id) return Number(r.rows[0].lot_id);
  }

  return null;
}

async function createAutoLotForItem(client, {
  productStockId,
  accessKey,
  itemIndex,
  unitPrice,
  schema,
}) {
  const lotCode = buildAutoLotCode(accessKey, itemIndex);

  const existingLotId = await findExistingAutoLot(client, productStockId, lotCode, schema);
  if (existingLotId) {
    return { lot_id: existingLotId, lot_code: lotCode, created: false };
  }

  const cols = [];
  const vals = [];
  const params = [];
  let i = 1;

  if (schema.has_product_stock_id) {
    cols.push('product_stock_id');
    vals.push(`$${i++}`);
    params.push(productStockId);
  }

  if (schema.has_lot_code) {
    cols.push('lot_code');
    vals.push(`$${i++}`);
    params.push(lotCode);
  } else if (schema.has_code) {
    cols.push('code');
    vals.push(`$${i++}`);
    params.push(lotCode);
  } else if (schema.has_lot) {
    cols.push('lot');
    vals.push(`$${i++}`);
    params.push(lotCode);
  }

  if (schema.has_description) {
    cols.push('description');
    vals.push(`$${i++}`);
    params.push(`Lote automático NF-e ${lotCode}`);
  }

  if (schema.has_qty_on_hand) {
    cols.push('qty_on_hand');
    vals.push(`$${i++}`);
    params.push(0);
  }

  if (schema.has_qty_reserved) {
    cols.push('qty_reserved');
    vals.push(`$${i++}`);
    params.push(0);
  }

  if (schema.has_cost_unit) {
    cols.push('cost_unit');
    vals.push(`$${i++}`);
    params.push(Number(unitPrice || 0));
  }

  if (schema.has_nfe_key) {
    cols.push('nfe_key');
    vals.push(`$${i++}`);
    params.push(accessKey || null);
  }

  if (schema.has_nfe_item_seq) {
    cols.push('nfe_item_seq');
    vals.push(`$${i++}`);
    params.push(Number(itemIndex) || null);
  }

  if (schema.has_created_at) {
    cols.push('created_at');
    vals.push('NOW()');
  }

  if (schema.has_updated_at) {
    cols.push('updated_at');
    vals.push('NOW()');
  }

  if (!cols.length) {
    throw new Error('PRODUCTS_STOCK_LOTS_SCHEMA_NOT_SUPPORTED');
  }

  const r = await client.query(
    `
    INSERT INTO public."productsStockLots" (${cols.join(', ')})
    VALUES (${vals.join(', ')})
    RETURNING lot_id
    `,
    params
  );

  return {
    lot_id: Number(r.rows[0].lot_id),
    lot_code: lotCode,
    created: true,
  };
}

// ====================================================================
// HELPERS: sync itens do PUT
// ====================================================================
function normalizeInboundItemPayload(raw) {
  return {
    inbound_item_id: toIntOrNull(
      raw?.inbound_item_id ?? raw?.id ?? raw?.item_id
    ),

    nf_product_code: toStrOrNull(raw?.nf_product_code),
    product_code: toStrOrNull(
      raw?.product_code ??
      raw?.product_sku ??
      raw?.sku
    ),

    product_id: toIntOrNull(raw?.product_id),
    product_grade_id: toIntOrNull(raw?.product_grade_id),
    lot_id: toIntOrNull(raw?.lot_id),

    description: toStrOrNull(raw?.description),
    ncm: toStrOrNull(raw?.ncm),
    barcode: toStrOrNull(raw?.barcode),
    manufacturer_ref: toStrOrNull(raw?.manufacturer_ref),
    cest: toStrOrNull(raw?.cest),
    benefit_code: toStrOrNull(raw?.benefit_code),
    cfop: toStrOrNull(raw?.cfop),
    unit: toStrOrNull(raw?.unit),

    quantity: toNumOrZero(raw?.quantity),
    unit_price: toNumOrZero(raw?.unit_price),
    total_price: toNumOrZero(
      raw?.total_price ?? raw?.total
    ),

    ipi: toNumOrZero(raw?.ipi),
    icms: toNumOrZero(raw?.icms),

    commercial_unit: toStrOrNull(raw?.commercial_unit ?? raw?.unit),
    commercial_quantity: toNumOrNull(raw?.commercial_quantity ?? raw?.quantity),
    commercial_unit_price: toNumOrNull(raw?.commercial_unit_price ?? raw?.unit_price),
    taxable_unit: toStrOrNull(raw?.taxable_unit ?? raw?.unit),
    taxable_quantity: toNumOrNull(raw?.taxable_quantity ?? raw?.quantity),
    taxable_unit_price: toNumOrNull(raw?.taxable_unit_price ?? raw?.unit_price),
    conversion_factor: toNumOrNull(raw?.conversion_factor) ?? 1,
    gross_total: toNumOrNull(raw?.gross_total ?? raw?.total_price),
    discount_value: toNumOrZero(raw?.discount_value),
    freight_value: toNumOrZero(raw?.freight_value),
    insurance_value: toNumOrZero(raw?.insurance_value),
    other_expenses: toNumOrZero(raw?.other_expenses),
    net_total: toNumOrNull(raw?.net_total ?? raw?.total_price),

    icms_origin: toStrOrNull(raw?.icms_origin),
    icms_cst: toStrOrNull(raw?.icms_cst),
    icms_modality: toStrOrNull(raw?.icms_modality),
    icms_base: toNumOrNull(raw?.icms_base),
    icms_reduction_rate: toNumOrNull(raw?.icms_reduction_rate),
    icms_rate: toNumOrNull(raw?.icms_rate),
    icms_value: toNumOrNull(raw?.icms_value ?? raw?.icms),
    icms_st_modality: toStrOrNull(raw?.icms_st_modality),
    icms_st_mva_rate: toNumOrNull(raw?.icms_st_mva_rate),
    icms_st_reduction_rate: toNumOrNull(raw?.icms_st_reduction_rate),
    icms_st_base: toNumOrNull(raw?.icms_st_base),
    icms_st_rate: toNumOrNull(raw?.icms_st_rate),
    icms_st_value: toNumOrNull(raw?.icms_st_value),

    fcp_base: toNumOrNull(raw?.fcp_base),
    fcp_rate: toNumOrNull(raw?.fcp_rate),
    fcp_value: toNumOrNull(raw?.fcp_value),
    fcp_st_base: toNumOrNull(raw?.fcp_st_base),
    fcp_st_rate: toNumOrNull(raw?.fcp_st_rate),
    fcp_st_value: toNumOrNull(raw?.fcp_st_value),
    ipi_cst: toStrOrNull(raw?.ipi_cst),
    ipi_base: toNumOrNull(raw?.ipi_base),
    ipi_rate: toNumOrNull(raw?.ipi_rate),
    ipi_value: toNumOrNull(raw?.ipi_value ?? raw?.ipi),
    pis_cst: toStrOrNull(raw?.pis_cst),
    pis_base: toNumOrNull(raw?.pis_base),
    pis_rate: toNumOrNull(raw?.pis_rate),
    pis_value: toNumOrNull(raw?.pis_value),
    cofins_cst: toStrOrNull(raw?.cofins_cst),
    cofins_base: toNumOrNull(raw?.cofins_base),
    cofins_rate: toNumOrNull(raw?.cofins_rate),
    cofins_value: toNumOrNull(raw?.cofins_value),
    ibs_cst: toStrOrNull(raw?.ibs_cst),
    ibs_classification_code: toStrOrNull(raw?.ibs_classification_code),
    ibs_base: toNumOrNull(raw?.ibs_base),
    ibs_state_rate: toNumOrNull(raw?.ibs_state_rate),
    ibs_state_value: toNumOrNull(raw?.ibs_state_value),
    ibs_city_rate: toNumOrNull(raw?.ibs_city_rate),
    ibs_city_value: toNumOrNull(raw?.ibs_city_value),
    ibs_value: toNumOrNull(raw?.ibs_value),
    cbs_cst: toStrOrNull(raw?.cbs_cst),
    cbs_classification_code: toStrOrNull(raw?.cbs_classification_code),
    cbs_base: toNumOrNull(raw?.cbs_base),
    cbs_rate: toNumOrNull(raw?.cbs_rate),
    cbs_value: toNumOrNull(raw?.cbs_value),
    raw_product_payload: raw?.raw_product_payload ?? null,
    raw_tax_payload: raw?.raw_tax_payload ?? null,

    nfe_key: normalizeAccessKey(raw?.nfe_key) || null,
    nfe_item_seq: toIntOrNull(
      raw?.nfe_item_seq ?? raw?._index
    ),
  };
}

async function syncInvoiceItems(
  invoiceId,
  rawItems = [],
  invoiceAccessKey = null,
  userCtx = {}
) {
  const itemsIncoming = Array.isArray(rawItems)
    ? rawItems
    : [];

  const normalizedInvoiceKey =
    normalizeAccessKey(invoiceAccessKey) || null;

  const currentRows = await listItemsByInvoice(invoiceId);

  const currentById = new Map(
    (Array.isArray(currentRows) ? currentRows : [])
      .map((row) => [
        Number(row.inbound_item_id ?? row.id),
        row,
      ])
      .filter(([rowId]) => Number.isInteger(rowId) && rowId > 0)
  );

  const currentBySequence = new Map(
    (Array.isArray(currentRows) ? currentRows : [])
      .map((row) => [Number(row.nfe_item_seq), row])
      .filter(([sequence]) => (
        Number.isInteger(sequence) && sequence > 0
      ))
  );

  const incomingIds = new Set();
  const incomingSequences = new Set();

  const out = {
    created: [],
    updated: [],
    deleted: [],
  };

  for (let index = 0; index < itemsIncoming.length; index++) {
    const raw = itemsIncoming[index];
    const item = normalizeInboundItemPayload(raw);

    if (!item.product_id && item.product_code) {
      item.product_id =
        await findProductIdByProductCode(item.product_code);
    }

    // product_id identifica o cadastro; nunca grave o código formatado pela tela.
    // Usa sempre o product_code canônico salvo em public.products.
    if (item.product_id) {
      const canonicalProduct = await getProductStockRow(
        pool,
        item.product_id,
        null,
      );

      if (canonicalProduct?.product_code) {
        item.product_code = String(canonicalProduct.product_code).trim();
      }
    }

    const requestedSequence = Number(
      item.nfe_item_seq ??
      raw?.nfe_item_seq ??
      index + 1
    );

    const itemSequence =
      Number.isInteger(requestedSequence) && requestedSequence > 0
        ? requestedSequence
        : index + 1;

    if (incomingSequences.has(itemSequence)) {
      const error = new Error(
        `A sequência ${itemSequence} está repetida nos itens da NF-e.`
      );
      error.status = 400;
      error.code = 'DUPLICATED_NFE_ITEM_SEQUENCE';
      throw error;
    }

    incomingSequences.add(itemSequence);

    const payload = {
      ...item,
      inbound_id: Number(invoiceId),
      nfe_key:
        item.nfe_key ??
        normalizedInvoiceKey,
      nfe_item_seq: itemSequence,
    };

    logInbound('INFO', '[INBOUND][SYNC][ITEM_PAYLOAD]', {
      invoiceId,
      index,
      payload,
    });

    const incomingItemId = Number(
      item.inbound_item_id ??
      raw?.inbound_item_id ??
      raw?.id ??
      raw?.item_id
    );

    // nfe_item_seq is the official item identity inside an NF-e. Matching it
    // first also prevents a stale/missing frontend ID from causing INSERT and
    // violating (inbound_id, nfe_item_seq).
    const currentItem =
      currentBySequence.get(itemSequence) ??
      (
        Number.isInteger(incomingItemId) && incomingItemId > 0
          ? currentById.get(incomingItemId)
          : null
      ) ??
      null;

    let savedRow;

    if (currentItem) {
      const currentItemId = Number(
        currentItem.inbound_item_id ?? currentItem.id
      );

      incomingIds.add(currentItemId);

      savedRow = await updateItem(currentItemId, payload, {
        userCtx,
      });

      out.updated.push(savedRow);
    } else {
      savedRow = await createItem(payload);
      out.created.push(savedRow);

      const createdItemId = Number(
        savedRow?.inbound_item_id ?? savedRow?.id
      );

      if (Number.isInteger(createdItemId) && createdItemId > 0) {
        incomingIds.add(createdItemId);
      }
    }

    // The top fields in the lot modal come from productsStockLots.
    if (payload.lot_id && payload.nfe_key) {
      await pool.query(
        `
          UPDATE public."productsStockLots"
          SET
            nfe_key = $2,
            nfe_item_seq = $3
          WHERE lot_id = $1
        `,
        [
          payload.lot_id,
          payload.nfe_key,
          payload.nfe_item_seq,
        ]
      );
    }
  }

  for (const row of currentRows) {
    const rowId = Number(row.inbound_item_id ?? row.id);

    if (!incomingIds.has(rowId)) {
      await deleteItem(rowId);
      out.deleted.push(rowId);
    }
  }

  return out;
}

// ====================================================================
// HELPERS: auto-import
// ====================================================================
async function resolveXmlForAutoImport(req) {
  const accessKeyFromQuery = normalizeAccessKey(req.query?.accessKey);
  const accessKeyFromBody = normalizeAccessKey(req.body?.access_key || req.body?.accessKey);
  const preferredAccessKey = accessKeyFromQuery || accessKeyFromBody;

  const xmlContentFromBody =
    req.body?.xmlContent ||
    req.body?.xml_content ||
    req.body?.xml ||
    null;

  if (xmlContentFromBody && String(xmlContentFromBody).trim()) {
    return {
      accessKeyHint: preferredAccessKey || null,
      xmlContent: String(xmlContentFromBody),
      source: 'body.xmlContent',
    };
  }

  if (preferredAccessKey) {
    const resolved = resolveNFeFiles(preferredAccessKey);
    const xmlText = readXmlTextSafely(resolved.xmlPath);
    if (xmlText) {
      return {
        accessKeyHint: preferredAccessKey,
        xmlContent: xmlText,
        xmlPath: resolved.xmlPath,
        xmlUrl: resolved.xmlUrl,
        source: 'disk.by.accessKey',
      };
    }
  }

  return {
    accessKeyHint: preferredAccessKey || null,
    xmlContent: null,
    source: 'not-found',
  };
}

async function generateDanfeSafe({ numero, serie, chave, xmlFile, xmlContent }) {
  try {
    console.log('🧩 generateDanfeFromXml params:', {
      numero,
      serie,
      hasXmlContent: !!xmlContent,
      chave,
      xmlFile,
    });

    const result = await generateDanfeFromXml({
      numero,
      serie,
      chave,
      xmlFile,
      xmlContent,
    });

    const danfeUrl = resolveDanfeUrlFromResult(result);

    return {
      ok: true,
      result,
      danfeUrl,
    };
  } catch (err) {
    console.warn('[AUTO_IMPORT][DANFE][TRY_WARN]', err?.message || err);
    return {
      ok: false,
      error: err,
      danfeUrl: null,
    };
  }
}

async function postInvoiceInternal(
  client,
  invoiceId,
  traceId = null,
  req = null
) {
  const debug = [];
  const stockMode = getInboundProductStockMode();
  const isSimpleStock = isInboundSimpleStockMode();

  logInbound('INFO', '[INBOUND][POST_INTERNAL][STOCK_MODE]', {
    traceId,
    invoiceId,
    stockMode,
    isSimpleStock,
  });

  const invRes = await client.query(
    `SELECT inbound_id, status, stock_applied, access_key, invoice_number, series
       FROM public."inboundInvoices"
      WHERE inbound_id = $1
      FOR UPDATE`,
    [invoiceId]
  );

  const invoice = invRes.rows[0];
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');

  logInbound('INFO', '[INBOUND][POST_INTERNAL][LOCKED_INVOICE]', {
    traceId,
    invoiceId,
    invoice,
  });

  if (invoice.stock_applied) {
    return { ok: true, alreadyPosted: true, stockMode, debug: [] };
  }

  const itemsRes = await client.query(
    `SELECT inbound_item_id, product_id, product_code, lot_id, quantity, unit, unit_price
       FROM public."inboundInvoiceItems"
      WHERE inbound_id = $1
      ORDER BY inbound_item_id`,
    [invoiceId]
  );

  const items = itemsRes.rows;
  if (!items.length) throw new Error('NO_ITEMS_TO_POST');

  logInbound('INFO', '[INBOUND][POST_INTERNAL][ITEMS_LOADED]', {
    traceId,
    invoiceId,
    itemsCount: items.length,
    items: items.map((it) => ({
      id: it.inbound_item_id,
      product_id: it.product_id,
      product_code: it.product_code,
      lot_id: it.lot_id,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.unit_price,
    })),
  });

  async function getProductsStockLotsCols() {
    const r = await client.query(`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name='productsStockLots'
    `);

    const set = new Set(r.rows.map((x) => String(x.column_name).toLowerCase()));
    return {
      has_qty_on_hand: set.has('qty_on_hand'),
      has_qty_reserved: set.has('qty_reserved'),
      has_cost_unit: set.has('cost_unit'),
      has_updated_at: set.has('updated_at'),
      has_product_stock_id: set.has('product_stock_id'),
    };
  }

  async function getUnitsFactorCol() {
    const r = await client.query(`
      SELECT column_name
        FROM information_schema.columns
       WHERE table_schema='public'
         AND table_name='units'
    `);

    const set = new Set(r.rows.map((x) => String(x.column_name).toLowerCase()));
    const candidates = [
      'factor',
      'multiplier',
      'multiplicador',
      'conversion_factor',
      'fator',
      'fator_conversao',
      'qtde_base',
      'qtd_base',
      'quantidade_base',
    ];

    return candidates.find((c) => set.has(c)) || null;
  }

  const lotCols = isSimpleStock ? null : await getProductsStockLotsCols();
  const unitsFactorCol = await getUnitsFactorCol();

  async function getProductRow(pid, sku) {
    if (pid) {
      const r = await client.query(
        `SELECT product_id, product_stock_id, product_code
           FROM public.products
          WHERE product_id = $1
          LIMIT 1`,
        [pid]
      );
      return r.rows[0] || null;
    }

    if (sku) {
      const r = await client.query(
        `SELECT product_id, product_stock_id, product_code
           FROM public.products
          WHERE product_code = $1
          LIMIT 1`,
        [String(sku).trim()]
      );
      return r.rows[0] || null;
    }

    return null;
  }

  async function getUnitFactor(unitCode) {
    const u = String(unitCode || '').trim().toUpperCase();
    if (!u || !unitsFactorCol) return 1;

    const r = await client.query(
      `SELECT ${unitsFactorCol} AS factor_value
         FROM public."units"
        WHERE UPPER(unit) = $1
        LIMIT 1`,
      [u]
    );

    const f = Number(r.rows?.[0]?.factor_value ?? 1);
    return Number.isFinite(f) && f > 0 ? f : 1;
  }

  async function assertLotBelongsToStock(lotId, productStockId) {
    const selectParts = ['lot_id'];
    if (lotCols?.has_product_stock_id) selectParts.push('product_stock_id');

    const r = await client.query(
      `SELECT ${selectParts.join(', ')}
         FROM public."productsStockLots"
        WHERE lot_id = $1
        LIMIT 1`,
      [lotId]
    );

    const lot = r.rows[0];
    if (!lot) {
      const e = new Error('LOT_NOT_FOUND');
      e.details = { lot_id: lotId };
      throw e;
    }

    if (
      lotCols?.has_product_stock_id &&
      Number(lot.product_stock_id) !== Number(productStockId)
    ) {
      const e = new Error('LOT_DOES_NOT_MATCH_PRODUCT');
      e.details = {
        lot_id: lotId,
        lot_product_stock_id: lot.product_stock_id,
        product_stock_id: productStockId,
      };
      throw e;
    }

    return lot;
  }

  async function applyLotIn(lotId, qtyBase, costUnitMaybe) {
    if (!lotCols?.has_qty_on_hand) {
      const e = new Error('LOT_SCHEMA_MISSING_QTY_ON_HAND');
      e.details = { lot_id: lotId };
      throw e;
    }

    const sets = [`qty_on_hand = qty_on_hand + $2`];
    const params = [lotId, qtyBase];
    let p = 3;

    if (lotCols.has_cost_unit) {
      sets.push(`cost_unit = COALESCE($${p}, cost_unit)`);
      params.push(costUnitMaybe ?? null);
      p++;
    }

    if (lotCols.has_updated_at) sets.push('updated_at = NOW()');

    return client.query(
      `UPDATE public."productsStockLots"
          SET ${sets.join(', ')}
        WHERE lot_id = $1
        RETURNING lot_id, qty_on_hand`,
      params
    );
  }

  async function applySimpleStockIn(productStockId, qtyBase) {
    const locked = await client.query(
      `SELECT product_stock_id, stock_qty
         FROM public."productsStock"
        WHERE product_stock_id = $1
        FOR UPDATE`,
      [productStockId]
    );

    if (!locked.rowCount) {
      const e = new Error('PRODUCT_STOCK_ROW_NOT_FOUND');
      e.details = { product_stock_id: productStockId };
      throw e;
    }

    const previousStock = Number(locked.rows[0]?.stock_qty || 0);

    const updated = await client.query(
      `UPDATE public."productsStock"
          SET stock_qty = COALESCE(stock_qty, 0) + $2,
              updated_at = NOW()
        WHERE product_stock_id = $1
        RETURNING product_stock_id, stock_qty`,
      [productStockId, qtyBase]
    );

    if (!updated.rowCount) {
      const e = new Error('PRODUCT_STOCK_UPDATE_FAILED');
      e.details = { product_stock_id: productStockId, qtyBase };
      throw e;
    }

    return {
      previousStock,
      newStock: Number(updated.rows[0]?.stock_qty || 0),
    };
  }

  for (const it of items) {
    const itemDbg = { item_id: it.inbound_item_id, ok: false, step: 'start', stockMode };

    logInbound('INFO', '[INBOUND][POST_INTERNAL][ITEM_START]', {
      traceId,
      invoiceId,
      item_id: it.inbound_item_id,
      product_id: it.product_id,
      product_code: it.product_code,
      lot_id: it.lot_id,
      quantity: it.quantity,
      unit: it.unit,
      stockMode,
    });

    if (!isSimpleStock && !it.lot_id) {
      const err = new Error('LOT_REQUIRED');
      err.details = { invoiceId, item_id: it.inbound_item_id };
      throw err;
    }

    const prod = await getProductRow(it.product_id, it.product_code);
    if (!prod) {
      const e = new Error('PRODUCT_NOT_FOUND');
      e.details = { invoiceId, item_id: it.inbound_item_id };
      throw e;
    }

    if (!prod.product_stock_id) {
      const e = new Error('PRODUCT_WITHOUT_STOCK_ID');
      e.details = { invoiceId, item_id: it.inbound_item_id, product_id: prod.product_id };
      throw e;
    }

    const factor = await getUnitFactor(it.unit);
    const qty = Number(it.quantity || 0);

    if (!(qty > 0)) {
      const e = new Error('INVALID_QTY');
      e.details = { invoiceId, item_id: it.inbound_item_id, quantity: it.quantity };
      throw e;
    }

    const qtyBase = qty * factor;
    const priceRaw = Number(it.unit_price || 0);
    const costUnit =
      priceRaw > 0 && Number.isFinite(factor) && factor > 0
        ? priceRaw / factor
        : null;

    logInbound('INFO', '[INBOUND][POST_INTERNAL][ITEM_RESOLVED]', {
      traceId,
      invoiceId,
      item_id: it.inbound_item_id,
      product_id: prod.product_id,
      product_code: prod.product_code,
      product_stock_id: prod.product_stock_id,
      factor,
      qty,
      qtyBase,
      stockMode,
    });

    let previousStock = null;
    let newStock = null;

    if (isSimpleStock) {
      const stockResult = await applySimpleStockIn(
        Number(prod.product_stock_id),
        qtyBase
      );

      previousStock = stockResult.previousStock;
      newStock = stockResult.newStock;

      logInbound('INFO', '[INBOUND][POST_INTERNAL][STOCK_SIMPLE_APPLIED]', {
        traceId,
        invoiceId,
        item_id: it.inbound_item_id,
        product_id: prod.product_id,
        product_code: prod.product_code,
        product_stock_id: prod.product_stock_id,
        qtyBase,
        previous_stock: previousStock,
        new_stock: newStock,
      });
    } else {
      await assertLotBelongsToStock(
        Number(it.lot_id),
        Number(prod.product_stock_id)
      );

      const upd = await applyLotIn(Number(it.lot_id), qtyBase, costUnit);
      if (!upd.rowCount) {
        const e = new Error('LOT_UPDATE_FAILED');
        e.details = { invoiceId, item_id: it.inbound_item_id, lot_id: it.lot_id };
        throw e;
      }

      logInbound('INFO', '[INBOUND][POST_INTERNAL][LOT_APPLIED]', {
        traceId,
        invoiceId,
        item_id: it.inbound_item_id,
        lot_id: it.lot_id,
        qtyBase,
        costUnit,
      });
    }

    await registerProductMovement({
        client,
        product_code: String(prod.product_code || it.product_code || '').trim(),
        movement_type: MOVEMENT_TYPES.ENTRADA,
        origin_module: 'INBOUND_INVOICE',
        origin_table: 'inboundInvoiceItems',
        origin_id: it.inbound_item_id,
        quantity: qtyBase,
        previous_stock: previousStock,
        new_stock: newStock,
        unit: it.unit || 'UN.',
        lot_code: isSimpleStock ? null : String(it.lot_id || ''),
        nfe_key: invoice.access_key || null,
        nfe_number: invoice.invoice_number || null,
        notes: `Entrada por NF-e de compra #${invoice.invoice_number || invoiceId}`,
        user_id: req?.user?.id || req?.user?.user_id || null,
        metadata: {
          inbound_invoice_id: invoiceId,
          invoice_number: invoice.invoice_number || null,
          series: invoice.series || null,
          inbound_item_id: it.inbound_item_id,
          product_id: prod.product_id,
          product_stock_id: prod.product_stock_id,
          lot_id: isSimpleStock ? null : it.lot_id,
          stock_mode: stockMode,
          factor,
          qty_original: qty,
          qty_base: qtyBase,
          cost_unit: costUnit,
          previous_stock: previousStock,
          new_stock: newStock,
        },
    });

    logInbound('INFO', '[INBOUND][POST_INTERNAL][MOVEMENT_REGISTERED]', {
        traceId,
        invoiceId,
        item_id: it.inbound_item_id,
        product_code: prod.product_code,
        qtyBase,
        previous_stock: previousStock,
        new_stock: newStock,
        stockMode,
    });

    if (priceRaw > 0) {
      const costBase = priceRaw / factor;
      await client.query(
        `UPDATE public.products
            SET cost_price = $1,
                updated_at = NOW()
          WHERE product_id = $2`,
        [costBase, prod.product_id]
      );
    }

    itemDbg.ok = true;
    itemDbg.step = 'done';
    itemDbg.factor = factor;
    itemDbg.qtyBase = qtyBase;
    itemDbg.product_id = prod.product_id;
    itemDbg.product_stock_id = prod.product_stock_id;
    itemDbg.previous_stock = previousStock;
    itemDbg.new_stock = newStock;
    debug.push(itemDbg);
  }

  await client.query(
    `UPDATE public."inboundInvoices"
        SET status = 'POSTED',
            stock_applied = TRUE,
            stock_applied_at = NOW()
      WHERE inbound_id = $1`,
    [invoiceId]
  );

  logInbound('INFO', '[INBOUND][POST_INTERNAL][INVOICE_MARKED_POSTED]', {
    traceId,
    invoiceId,
    stockMode,
  });

  return { ok: true, alreadyPosted: false, stockMode, debug };
}

async function createInvoiceWithChildren({
  header,
  items,
  installments,
  xmlUrl,
  danfeUrl,
  autoPost = true,
  traceId = null,
}) {
  const existing = await getInvoiceByAccessKey(header.accessKey);
  if (existing) {
    const err = new Error('INVOICE_ALREADY_EXISTS');
    err.code = 'INVOICE_ALREADY_EXISTS';
    err.invoice = existing;
    throw err;
  }

  const client = await pool.connect();

  try {
    logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][START]', {
      traceId,
      accessKey: header.accessKey,
      invoiceNumber: header.invoiceNumber,
      itemsCount: Array.isArray(items) ? items.length : 0,
      installmentsCount: Array.isArray(installments) ? installments.length : 0,
      autoPost,
    });

    await client.query('BEGIN');

    const invoiceRow = await createInvoice({
      access_key: header.accessKey,
      invoice_number: header.invoiceNumber,
      series: header.series,
      issuer: header.issuerCnpj,
      recipient: header.recipientCnpj,
      issue_date: header.issueDate,
      entry_date: header.entryDate,
      total_amount: header.totalAmount,
      status: 'PENDING',
      stock_applied: false,
      stock_applied_at: null,
      xml_url: xmlUrl,
      danfe_url: danfeUrl,
    });

    logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][INVOICE_CREATED]', {
      traceId,
      invoiceId: invoiceRow.inbound_id,
      accessKey: header.accessKey,
    });

    const stockMode = getInboundProductStockMode();
    const isSimpleStock = isInboundSimpleStockMode();
    const lotSchema = isSimpleStock
      ? null
      : await getProductsStockLotsSchema(client);

    logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][STOCK_MODE]', {
      traceId,
      invoiceId: invoiceRow.inbound_id,
      stockMode,
      isSimpleStock,
    });

    const createdItems = [];
    for (const item of items || []) {
      let productId = item.product_id ?? null;
      let productCode = item.product_code ?? null;

      if (!productId && productCode) {
        productId = await findProductIdByProductCode(productCode);
      }

      const prod = await getProductStockRow(client, productId, productCode);

      if (prod?.product_code) {
        productCode = String(prod.product_code).trim();
      }

      let lotId = item.lot_id ?? null;
      let autoLotInfo = null;

      if (!isSimpleStock && prod?.product_stock_id && !lotId) {
        autoLotInfo = await createAutoLotForItem(client, {
          productStockId: Number(prod.product_stock_id),
          accessKey: header.accessKey,
          itemIndex: item._index || 1,
          unitPrice: item.unit_price ?? 0,
          schema: lotSchema,
        });
        lotId = autoLotInfo.lot_id;
      }

      if (isSimpleStock) {
        lotId = null;
      }

      const row = await createItem({
        ...item,
        inbound_id: invoiceRow.inbound_id,

        nf_product_code: item.nf_product_code ?? null,
        product_code: productCode ?? null,
        product_id: prod?.product_id ?? productId ?? null,
        product_grade_id: item.product_grade_id ?? null,
        lot_id: lotId,

        description: item.description ?? null,
        ncm: item.ncm ?? null,
        cfop: item.cfop ?? null,
        unit: item.unit ?? null,

        quantity: item.quantity ?? 0,
        unit_price: item.unit_price ?? 0,
        total_price: item.total_price ?? 0,
        ipi: item.ipi ?? 0,
        icms: item.icms ?? 0,

        icms_cst: item.icms_cst ?? null,
        icms_base: item.icms_base ?? null,
        icms_rate: item.icms_rate ?? null,
        icms_st_base: item.icms_st_base ?? null,
        icms_st_rate: item.icms_st_rate ?? null,
        icms_st_value: item.icms_st_value ?? null,

        nfe_key:
          item.nfe_key ??
          header.accessKey ??
          null,

        nfe_item_seq:
          item.nfe_item_seq ??
          item._index ??
          1,
      });

      createdItems.push(row);

      logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][ITEM_CREATED]', {
        traceId,
        invoiceId: invoiceRow.inbound_id,
        item_id: row.inbound_item_id,
        xml_item_index: item._index || null,
        nf_product_code: item.nf_product_code ?? null,
        product_code: productCode ?? null,
        product_id: row.product_id ?? null,
        product_stock_id: prod?.product_stock_id ?? null,
        lot_id: row.lot_id ?? null,
        autoLotCreated: !!autoLotInfo?.created,
        autoLotCode: autoLotInfo?.lot_code ?? null,
      });
    }

    const createdInstallments = [];
    for (let installmentIndex = 0; installmentIndex < (installments || []).length; installmentIndex++) {
      const inst = installments[installmentIndex];
      const row = await createInstallment({
        inbound_id: invoiceRow.inbound_id,
        installment_number: installmentIndex + 1,
        installment_code: inst.installment_code,
        due_date: inst.due_date,
        original_due_date: inst.due_date,
        amount: inst.amount,
        paid_amount: inst.is_paid ? inst.amount : 0,
        status: inst.is_paid ? 'PAID' : 'PENDING',
        is_paid: inst.is_paid ?? false,
      });

      createdInstallments.push(row);

      // ==================================================================
      // GENERATE ACCOUNTS PAYABLE FOR AUTO-IMPORTED INSTALLMENTS
      // ==================================================================
      const supplierId = await findSupplierIdByTaxId(invoiceRow.issuer);

      if (!supplierId) {
        logInbound('WARN', '[INBOUND][AP][SUPPLIER_NOT_FOUND]', {
          traceId,
          invoiceId: invoiceRow.inbound_id,
          issuer: invoiceRow.issuer,
        });
      } else {
        const issueDate = normalizeDateOnly(
          invoiceRow.issue_date || invoiceRow.created_at || new Date()
        );

        const baseName =
          invoiceRow.access_key ||
          invoiceRow.invoice_number ||
          `invoice_${invoiceRow.inbound_id}`;

        const attachments = [
          ...(xmlUrl
            ? [{
              file_type: 'XML',
              file_name: `${baseName}.xml`,
              file_url: xmlUrl,
            }]
            : []),

          ...(danfeUrl
            ? [{
              file_type: 'DANFE',
              file_name: `${baseName}.pdf`,
              file_url: danfeUrl,
            }]
            : []),
        ];

        for (const installment of [row]) {
          const apPayload = {
            supplier_id: supplierId,

            invoice_number:
              invoiceRow.invoice_number,

            issue_date:
              issueDate,

            due_date:
              normalizeDateOnly(installment.due_date),

            payment_method_id:
              null,

            description:
              `NF ${invoiceRow.invoice_number} - Parcela ${installment.installment_code}`,

            category_id:
              null,

            subcategory_id:
              null,

            document_number:
              invoiceRow.access_key,

            total_value:
              Number(installment.amount || 0),

            amount_paid:
              installment.is_paid
                ? Number(installment.amount || 0)
                : 0,

            status:
              installment.is_paid
                ? 'PAID'
                : 'PENDING',

            notes:
              'Gerado automaticamente a partir da nota de entrada.',

            attachment_url:
              null,

            source_type:
              'INBOUND_INSTALLMENT',

            source_id:
              installment.inbound_installment_id,

            attachments,
          };

          try {
            const apResult =
              await createAccountsPayableFromSource(apPayload);

            const payableId =
              apResult?.payable?.id ??
              apResult?.payable?.accounts_payable_id ??
              null;

            if (payableId) {
              await updateInstallment(installment.inbound_installment_id, {
                accounts_payable_id: Number(payableId),
              });
            }

            logInbound('INFO', '[INBOUND][AP][CREATED]', {
              traceId,
              invoiceId: invoiceRow.inbound_id,
              installmentId: installment.inbound_installment_id,
              payableId,
              created: apResult?.created ?? null,
            });
          } catch (apError) {
            if (isUniqueViolation(apError)) {
              logInbound('WARN', '[INBOUND][AP][ALREADY_EXISTS]', {
                traceId,
                invoiceId: invoiceRow.inbound_id,
                installmentId: installment.inbound_installment_id,
                sourceType: apPayload.source_type,
                sourceId: apPayload.source_id,
              });
            } else {
              logInbound('ERROR', '[INBOUND][AP][ERROR]', {
                traceId,
                invoiceId: invoiceRow.inbound_id,
                installmentId: installment.inbound_installment_id,
                message: apError?.message,
                code: apError?.code,
              });

              throw apError;
            }
          }
        }
      }

      logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][INSTALLMENT_CREATED]', {
        traceId,
        invoiceId: invoiceRow.inbound_id,
        installmentId: row.inbound_installment_id,
        installment_code: row.installment_code,
        due_date: row.due_date,
        amount: row.amount,
      });
    }

    let postResult = null;
    if (autoPost) {
      const missingLot = isSimpleStock
        ? null
        : createdItems.find((x) => !x.lot_id);

      if (missingLot) {
        logInbound('WARN', '[INBOUND][CREATE_WITH_CHILDREN][AUTO_POST_SKIPPED_MISSING_LOT]', {
          traceId,
          invoiceId: invoiceRow.inbound_id,
          item_id: missingLot.inbound_item_id,
          stockMode,
        });
      } else {
        logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][AUTO_POST_START]', {
          traceId,
          invoiceId: invoiceRow.inbound_id,
          stockMode,
        });

        postResult = await postInvoiceInternal(client, invoiceRow.inbound_id, traceId, null);

        logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][AUTO_POST_DONE]', {
          traceId,
          invoiceId: invoiceRow.inbound_id,
          stockMode,
          alreadyPosted: !!postResult?.alreadyPosted,
          debugCount: Array.isArray(postResult?.debug) ? postResult.debug.length : 0,
        });
      }
    }

    await client.query('COMMIT');

    const finalInvoice = await getInvoiceById(invoiceRow.inbound_id);

    logInbound('INFO', '[INBOUND][CREATE_WITH_CHILDREN][DONE]', {
      traceId,
      invoiceId: invoiceRow.inbound_id,
      stock_applied: finalInvoice?.stock_applied ?? null,
      status: finalInvoice?.status ?? null,
    });

    return {
      invoice: finalInvoice || invoiceRow,
      items: createdItems,
      installments: createdInstallments,
      postResult,
    };
  } catch (err) {
    await client.query('ROLLBACK');

    logInbound('ERROR', '[INBOUND][CREATE_WITH_CHILDREN][ERROR]', {
      traceId,
      accessKey: header?.accessKey || null,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
    });

    throw err;
  } finally {
    client.release();
  }
}

// ====================================================================
// IMPORT XML (prévia)
// ====================================================================
export async function importXmlInvoiceCtrl(req, res) {
  try {
    console.log('[INBOUND][IMPORT_XML][CONTROLLER_VERSION]', {
      version: INBOUND_CONTROLLER_VERSION,
      method: req?.method || null,
      originalUrl: req?.originalUrl || req?.url || null,
      dbHost: process.env.DB_HOST || process.env.PGHOST || null,
      dbName: process.env.DB_NAME || process.env.PGDATABASE || null,
      ts: new Date().toISOString(),
    });
    const file = req.file;
    if (!file) {
      return bad(res, 'Arquivo XML não enviado (campo "xml" ausente).');
    }

    const xmlContent = file.buffer.toString('utf8');
    const {
      header,
      items: parsedItems,
      installments,
    } = await parseXmlToInvoicePreview(xmlContent);

    const resolvedProducts = await resolveProductsLmRefForItems({
      issuerTaxId: header.issuerCnpj,
      items: parsedItems,
    });

    const items = resolvedProducts.items;

    console.log('[INBOUND][IMPORT_XML][RESOLVED_ITEMS]', {
      version: INBOUND_CONTROLLER_VERSION,
      issuerCnpj: header.issuerCnpj,
      supplierId: resolvedProducts.supplierId,
      items: items.map((item) => ({
        nf_product_code: item.nf_product_code,
        product_code: item.product_code,
        product_id: item.product_id,
        product_lm_ref_id: item.product_lm_ref_id,
        lm_ref_found: item.lm_ref_found,
        lm_ref_status: item.lm_ref_status,
      })),
    });

    const accessKey = header.accessKey;
    if (accessKey) {
      const existing = await getInvoiceByAccessKey(accessKey);
      if (existing) {
        return bad(res, 'Esta Nota Fiscal de entrada já foi importada anteriormente.', {
          code: 'DUPLICATE_INBOUND_INVOICE',
          access_key: accessKey,
          inbound_id: existing.inbound_id,
        });
      }
    }

    const mappedCount = items.filter((item) => item.lm_ref_found === true).length;
    const unmappedCount = items.length - mappedCount;

    logInbound('INFO', '[INBOUND][XML][PRODUCTS_LM_REF]', {
      issuerCnpj: header.issuerCnpj,
      supplierId: resolvedProducts.supplierId,
      mappedCount,
      unmappedCount,
      items: items.map((item) => ({
        nf_product_code: item.nf_product_code,
        product_code: item.product_code,
        product_id: item.product_id,
        product_lm_ref_id: item.product_lm_ref_id,
        mapped: item.lm_ref_found,
        status: item.lm_ref_status,
      })),
    });

    return ok(res, {
      ok: true,
      data: {
        ...header,
        controllerVersion: INBOUND_CONTROLLER_VERSION,
        supplierId: resolvedProducts.supplierId,
        items,
        installments,
        productMapping: {
          total: items.length,
          mapped: mappedCount,
          unmapped: unmappedCount,
        },
      },
    });
  } catch (err) {
    reportInboundError('[INBOUND][CTRL][XML]', err);
    return res.status(500).json({
      ok: false,
      error: 'Falha ao processar o XML da NF-e. Verifique se o arquivo é válido.',
      detail: err?.message,
    });
  }
}

// ====================================================================
// AUTO IMPORT FROM DFE / ACCESS KEY / XML EXISTENTE
// ====================================================================
export async function autoImportFromDfeCtrl(req, res) {
  const traceId = getInboundTrace(req, 'AUTO');

  try {
    logInbound('INFO', '[AUTO_IMPORT][START]', {
      traceId,
      query: req.query || {},
      hasBody: !!req.body,
    });

    await ensureColumnsForPosting();

    const resolvedXml = await resolveXmlForAutoImport(req);

    logInbound('INFO', '[AUTO_IMPORT][XML_RESOLVED]', {
      traceId,
      source: resolvedXml.source,
      accessKeyHint: resolvedXml.accessKeyHint || null,
      hasXmlContent: !!resolvedXml.xmlContent,
      xmlPath: resolvedXml.xmlPath || null,
      xmlUrl: resolvedXml.xmlUrl || null,
    });

    if (!resolvedXml.xmlContent) {
      logInbound('WARN', '[AUTO_IMPORT][XML_NOT_FOUND]', {
        traceId,
        accessKeyHint: resolvedXml.accessKeyHint || null,
        source: resolvedXml.source,
      });

      return bad(res, 'Arquivo XML não encontrado para a chave/arquivo informado.', {
        accessKey: resolvedXml.accessKeyHint || null,
        source: resolvedXml.source,
        traceId,
      });
    }

    const preview = await parseXmlToInvoicePreview(resolvedXml.xmlContent);
    const header = preview.header;
    const installments = preview.installments;

    const resolvedProducts = await resolveProductsLmRefForItems({
      issuerTaxId: header.issuerCnpj,
      items: preview.items,
    });

    const items = resolvedProducts.items;

    const accessKey = normalizeAccessKey(header.accessKey || resolvedXml.accessKeyHint);

    logInbound('INFO', '[AUTO_IMPORT][PREVIEW_OK]', {
      traceId,
      accessKey,
      invoiceNumber: header.invoiceNumber,
      series: header.series,
      issuer: header.issuerCnpj,
      recipient: header.recipientCnpj,
      totalAmount: header.totalAmount,
      itemsCount: items.length,
      installmentsCount: installments.length,
    });

    if (!accessKey) {
      logInbound('WARN', '[AUTO_IMPORT][ACCESS_KEY_MISSING]', { traceId });
      return bad(res, 'Não foi possível determinar a chave de acesso da NF-e.', { traceId });
    }

    const existing = await getInvoiceByAccessKey(accessKey);
    if (existing) {
      logInbound('INFO', '[AUTO_IMPORT][DUPLICATED]', {
        traceId,
        accessKey,
        invoiceId: existing.inbound_id,
      });

      return ok(res, {
        ok: true,
        duplicated: true,
        message: 'Nota já importada anteriormente.',
        invoice: existing,
        traceId,
      });
    }

    const saved = saveXmlByAccessKey(accessKey, resolvedXml.xmlContent);
    const xmlPath = saved.xmlPath;
    const xmlUrl = saved.xmlUrl;

    logInbound('INFO', '[AUTO_IMPORT][XML_SAVED]', {
      traceId,
      accessKey,
      xmlPath,
      xmlUrl,
    });

    const danfeGen = await generateDanfeSafe({
      numero: String(header.invoiceNumber || ''),
      serie: String(header.series || '1'),
      chave: accessKey,
      xmlFile: xmlPath,
      xmlContent: resolvedXml.xmlContent,
    });

    let danfeUrl = danfeGen.danfeUrl;

    if (!danfeUrl) {
      const filesAfter = resolveNFeFiles(accessKey);
      danfeUrl = filesAfter.danfeUrl || null;
    }

    logInbound('INFO', '[AUTO_IMPORT][DANFE_RESULT]', {
      traceId,
      accessKey,
      danfeGenerated: !!danfeUrl,
      danfeUrl: danfeUrl || null,
    });

    const payloadLog = {
      access_key: accessKey,
      invoice_number: header.invoiceNumber,
      series: header.series,
      issuer: header.issuerCnpj,
      recipient: header.recipientCnpj,
      issue_date: header.issueDate,
      entry_date: header.entryDate,
      total_amount: header.totalAmount,
      status: 'PENDING',
      stock_applied: false,
      stock_applied_at: null,
      xml_url: xmlUrl,
      danfe_url: danfeUrl,
    };

    logInbound('INFO', '[AUTO_IMPORT][CREATE][PAYLOAD]', {
      traceId,
      payload: payloadLog,
    });

    const createdData = await createInvoiceWithChildren({
      header: {
        ...header,
        accessKey,
      },
      items,
      installments,
      xmlUrl,
      danfeUrl,
      autoPost: true,
      traceId,
    });

    logInbound('INFO', '[AUTO_IMPORT][DONE]', {
      traceId,
      accessKey,
      invoiceId: createdData?.invoice?.inbound_id || null,
      itemsCount: createdData?.items?.length || 0,
      installmentsCount: createdData?.installments?.length || 0,
      autoPosted: !!createdData?.postResult?.ok,
      alreadyPosted: !!createdData?.postResult?.alreadyPosted,
    });

    return created(res, {
      ok: true,
      invoice: createdData.invoice,
      items: createdData.items,
      installments: createdData.installments,
      danfe: {
        generated: !!danfeUrl,
        danfe_url: danfeUrl,
      },
      xml: {
        xml_url: xmlUrl,
        access_key: accessKey,
      },
      stock: {
        auto_posted: !!createdData.postResult?.ok,
        already_posted: !!createdData.postResult?.alreadyPosted,
        debug: createdData.postResult?.debug || [],
      },
      traceId,
    });
  } catch (err) {
    if (err?.code === 'INVOICE_ALREADY_EXISTS') {
      logInbound('INFO', '[AUTO_IMPORT][ALREADY_EXISTS]', {
        traceId,
        invoiceId: err?.invoice?.inbound_id || null,
      });

      return ok(res, {
        ok: true,
        duplicated: true,
        message: 'Nota já importada anteriormente.',
        invoice: err.invoice || null,
        traceId,
      });
    }

    logInbound('ERROR', '[AUTO_IMPORT][ERROR]', {
      traceId,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      stack: err?.stack,
    });

    return res.status(500).json({
      ok: false,
      error: 'Falha ao importar nota automaticamente.',
      detail: err?.message,
      traceId,
    });
  }
}

// ====================================================================
// INVOICES
// ====================================================================
export async function listInvoicesCtrl(req, res) {
  try {
    const search =
      req.query.search ??
      req.query.q ??
      undefined;

    const dateFrom = String(req.query.dateFrom ?? '').trim() || null;
    const dateTo = String(req.query.dateTo ?? '').trim() || null;

    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const orderBy =
      req.query.orderBy ?? 'created_at DESC';

    const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFrom && !ISO_DATE.test(dateFrom)) return bad(res, 'Data inicial inválida.');
    if (dateTo && !ISO_DATE.test(dateTo)) return bad(res, 'Data final inválida.');
    if (dateFrom && dateTo && dateTo < dateFrom) {
      return bad(res, 'A data final deve ser igual ou posterior à data inicial.');
    }

    const out = await listInvoices({
      search,
      dateFrom,
      dateTo,
      limit,
      offset,
      orderBy,
    });

    return ok(res, out);
  } catch (err) {
    return boom(res, err);
  }
}

export async function getInvoiceCtrl(req, res) {
  try {
    const id = Number(req.params.inboundId ?? req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return bad(res, 'Invalid inbound_id');
    }

    const row = await getInvoiceById(id);
    if (!row) return bad(res, 'Invoice not found');
    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function createInvoiceCtrl(req, res) {
  try {
    const body = req.body || {};

    let xmlUrl = body.xml_url ?? null;
    let danfeUrl = body.danfe_url ?? null;

    if ((!xmlUrl || !danfeUrl) && body.access_key) {
      const resolved = resolveNFeFiles(body.access_key);
      xmlUrl = xmlUrl || resolved.xmlUrl;
      danfeUrl = danfeUrl || resolved.danfeUrl;
    }

    const payload = {
      access_key: body.access_key,
      invoice_number: body.invoice_number,
      series: body.series,
      issuer: body.issuer,
      recipient: body.recipient,
      issue_date: body.issue_date,
      entry_date: body.entry_date,
      total_amount: body.total_amount,
      status: body.status,
      stock_applied: body.stock_applied,
      stock_applied_at: body.stock_applied_at,
      xml_url: xmlUrl,
      danfe_url: danfeUrl,
    };

    console.log('[INBOUND][CREATE][PAYLOAD]', payload);

    const row = await createInvoice(payload);
    return created(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function updateInvoiceCtrl(req, res) {
  const id = Number(req.params.inboundId ?? req.params.id);
  const traceId = getInboundTrace(req, 'SAVE');

  if (!id) {
    logInbound('WARN', '[INBOUND][UPDATE][INVALID_ID]', {
      traceId,
      params: req.params,
    });
    return bad(res, 'Invalid invoice id');
  }

  try {
    const body = req.body || {};

    logInbound('INFO', '[INBOUND][UPDATE][START]', {
      traceId,
      invoiceId: id,
      hasItems: Array.isArray(body.items),
      itemsCount: Array.isArray(body.items) ? body.items.length : 0,
      access_key: body.access_key || null,
      invoice_number: body.invoice_number || null,
    });

    const existing = await getInvoiceById(id);
    if (!existing) {
      logInbound('WARN', '[INBOUND][UPDATE][PARENT_NOT_FOUND]', {
        traceId,
        invoiceId: id,
      });

      return bad(res, 'INVOICE_NOT_FOUND_IN_PARENT_TABLE', {
        invoiceId: id,
        table: 'public."inboundInvoices"',
      });
    }

    const payload = {
      access_key: body.access_key,
      invoice_number: body.invoice_number,
      series: body.series,
      issuer: body.issuer,
      recipient: body.recipient,
      issue_date: body.issue_date,
      entry_date: body.entry_date,
      total_amount: body.total_amount,
      status: body.status,
      stock_applied: body.stock_applied,
      stock_applied_at: body.stock_applied_at,
      xml_url: body.xml_url,
      danfe_url: body.danfe_url,
    };

    logInbound('INFO', '[INBOUND][UPDATE][HEADER_PAYLOAD]', {
      traceId,
      invoiceId: id,
      payload,
    });

    const invoiceRow = await updateInvoice(id, payload);

    let itemsSync = null;

    if (Array.isArray(body.items)) {
      logInbound('INFO', '[INBOUND][UPDATE][ITEMS_IN]', {
        traceId,
        invoiceId: id,
        count: body.items.length,
        items: body.items.map((it, idx) => ({
          idx,
          id: it?.id ?? it?.item_id ?? null,
          product_id: it?.product_id ?? null,
          product_code: it?.product_code ?? null,
          lot_id: it?.lot_id ?? null,
          quantity: it?.quantity ?? null,
          unit: it?.unit ?? null,
        })),
      });

      itemsSync = await syncInvoiceItems(
        id,
        body.items,
        body.access_key ?? existing.access_key,
        req.user || {}
      );

      logInbound('INFO', '[INBOUND][UPDATE][ITEMS_SYNC]', {
        traceId,
        invoiceId: id,
        created: itemsSync.created.length,
        updated: itemsSync.updated.length,
        deleted: itemsSync.deleted.length,
      });
    }

    logInbound('INFO', '[INBOUND][UPDATE][DONE]', {
      traceId,
      invoiceId: id,
      status: invoiceRow?.status ?? null,
      stock_applied: invoiceRow?.stock_applied ?? null,
    });

    return ok(res, {
      ...invoiceRow,
      itemsSync,
      traceId,
    });
  } catch (err) {
    logInbound('ERROR', '[INBOUND][UPDATE][ERROR]', {
      traceId,
      invoiceId: id,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      table: err?.table,
      constraint: err?.constraint,
      stack: err?.stack,
    });

    return boom(res, err);
  }
}

// ====================================================================
// DELETE INVOICE
// ====================================================================
export async function deleteInvoiceCtrl(req, res) {
  const invoiceId = Number(req.params.inboundId ?? req.params.id);
  if (!invoiceId) return bad(res, 'Invalid invoice id');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const invRes = await client.query(
      `SELECT inbound_id, access_key, stock_applied, invoice_number
         FROM public."inboundInvoices"
        WHERE inbound_id = $1
        FOR UPDATE`,
      [invoiceId]
    );

    const invoice = invRes.rows[0];
    if (!invoice) {
      await client.query('ROLLBACK');
      return bad(res, 'Invoice not found');
    }

    const instRes = await client.query(
      `SELECT inbound_installment_id
         FROM public."inboundInvoiceInstallments"
        WHERE inbound_id = $1`,
      [invoiceId]
    );

    const instIds = instRes.rows
      .map((r) => Number(r.inbound_installment_id))
      .filter(Boolean);

    const stockMode = getInboundProductStockMode();
    const isSimpleStock = isInboundSimpleStockMode();

    logInbound('INFO', '[INBOUND][DELETE][STOCK_MODE]', {
      invoiceId,
      stockMode,
      isSimpleStock,
    });

    async function getProductsStockLotsCols() {
      const r = await client.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='productsStockLots'
      `);

      const set = new Set(r.rows.map((x) => String(x.column_name).toLowerCase()));
      return {
        has_qty_on_hand: set.has('qty_on_hand'),
        has_qty_reserved: set.has('qty_reserved'),
        has_cost_unit: set.has('cost_unit'),
        has_updated_at: set.has('updated_at'),
        has_product_stock_id: set.has('product_stock_id'),
      };
    }

    async function getUnitsFactorCol() {
      const r = await client.query(`
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='units'
      `);

      const set = new Set(r.rows.map((x) => String(x.column_name).toLowerCase()));
      const candidates = [
        'factor',
        'multiplier',
        'multiplicador',
        'conversion_factor',
        'fator',
        'fator_conversao',
        'qtde_base',
        'qtd_base',
        'quantidade_base',
      ];

      const col = candidates.find((c) => set.has(c));
      return col || null;
    }

    async function getUnitFactor(unitCode, unitsFactorCol) {
      const u = String(unitCode || '').trim().toUpperCase();
      if (!u) return 1;
      if (!unitsFactorCol) return 1;

      const r = await client.query(
        `SELECT ${unitsFactorCol} AS factor_value
           FROM public."units"
          WHERE UPPER(unit) = $1
          LIMIT 1`,
        [u]
      );

      const f = Number(r.rows?.[0]?.factor_value ?? 1);
      return Number.isFinite(f) && f > 0 ? f : 1;
    }

    async function getProductRow(pid, sku) {
      if (pid) {
        const r = await client.query(
          `SELECT product_id, product_stock_id
             FROM public.products
            WHERE product_id = $1
            LIMIT 1`,
          [pid]
        );
        return r.rows[0] || null;
      }

      if (sku) {
        const r = await client.query(
          `SELECT product_id, product_stock_id
             FROM public.products
            WHERE product_code = $1
            LIMIT 1`,
          [String(sku).trim()]
        );
        return r.rows[0] || null;
      }

      return null;
    }

    async function assertLotBelongsToStock(lotId, productStockId, lotCols) {
      const selectParts = ['lot_id'];
      if (lotCols.has_product_stock_id) selectParts.push('product_stock_id');
      if (lotCols.has_qty_on_hand) selectParts.push('qty_on_hand');
      if (lotCols.has_qty_reserved) selectParts.push('qty_reserved');

      const r = await client.query(
        `SELECT ${selectParts.join(', ')}
           FROM public."productsStockLots"
          WHERE lot_id = $1
          LIMIT 1`,
        [lotId]
      );

      const lot = r.rows[0];
      if (!lot) {
        const e = new Error('LOT_NOT_FOUND');
        e.details = { lot_id: lotId };
        throw e;
      }

      if (lotCols.has_product_stock_id) {
        if (Number(lot.product_stock_id) !== Number(productStockId)) {
          const e = new Error('LOT_DOES_NOT_MATCH_PRODUCT');
          e.details = {
            lot_id: lotId,
            lot_product_stock_id: lot.product_stock_id,
            product_stock_id: productStockId,
          };
          throw e;
        }
      }

      return lot;
    }

    const lotCols = isSimpleStock
      ? null
      : await getProductsStockLotsCols();
    const unitsFactorCol = await getUnitsFactorCol();

    if (invoice.stock_applied) {
      const itemsRes = await client.query(
        `SELECT inbound_item_id, product_id, product_code, lot_id, quantity, unit
           FROM public."inboundInvoiceItems"
          WHERE inbound_id = $1
          ORDER BY inbound_item_id`,
        [invoiceId]
      );

      for (const it of itemsRes.rows) {
        const prod = await getProductRow(it.product_id, it.product_code);
        if (!prod) {
          await client.query('ROLLBACK');
          return bad(res, 'PRODUCT_NOT_FOUND_TO_REVERT', {
            invoiceId,
            item_id: it.inbound_item_id,
            product_id: it.product_id,
            product_code: it.product_code,
          });
        }

        if (!prod.product_stock_id) {
          await client.query('ROLLBACK');
          return bad(res, 'PRODUCT_WITHOUT_STOCK_ID_TO_REVERT', {
            invoiceId,
            item_id: it.inbound_item_id,
            product_id: prod.product_id,
          });
        }

        const factor = await getUnitFactor(it.unit, unitsFactorCol);
        const qty = Number(it.quantity || 0);

        if (!(qty > 0)) {
          await client.query('ROLLBACK');
          return bad(res, 'INVALID_QTY_TO_REVERT', {
            invoiceId,
            item_id: it.inbound_item_id,
            quantity: it.quantity,
          });
        }

        const qtyBase = qty * factor;

        if (isSimpleStock) {
          const locked = await client.query(
            `SELECT product_stock_id, stock_qty
               FROM public."productsStock"
              WHERE product_stock_id = $1
              FOR UPDATE`,
            [Number(prod.product_stock_id)]
          );

          if (!locked.rowCount) {
            await client.query('ROLLBACK');
            return bad(res, 'PRODUCT_STOCK_ROW_NOT_FOUND_TO_REVERT', {
              invoiceId,
              item_id: it.inbound_item_id,
              product_stock_id: prod.product_stock_id,
            });
          }

          const previousStock = Number(locked.rows[0]?.stock_qty || 0);
          if (previousStock < qtyBase) {
            await client.query('ROLLBACK');
            return bad(res, 'SIMPLE_STOCK_REVERT_FAILED_INSUFFICIENT_QTY', {
              invoiceId,
              item_id: it.inbound_item_id,
              product_stock_id: prod.product_stock_id,
              previous_stock: previousStock,
              qtyBase,
            });
          }

          const up = await client.query(
            `UPDATE public."productsStock"
                SET stock_qty = COALESCE(stock_qty, 0) - $2,
                    updated_at = NOW()
              WHERE product_stock_id = $1
              RETURNING product_stock_id, stock_qty`,
            [Number(prod.product_stock_id), qtyBase]
          );

          logInbound('INFO', '[INBOUND][DELETE][STOCK_SIMPLE_REVERTED]', {
            invoiceId,
            item_id: it.inbound_item_id,
            product_stock_id: prod.product_stock_id,
            qtyBase,
            previous_stock: previousStock,
            new_stock: Number(up.rows[0]?.stock_qty || 0),
          });

          continue;
        }

        if (!it.lot_id) {
          await client.query('ROLLBACK');
          return bad(res, 'LOT_REQUIRED_TO_REVERT', {
            invoiceId,
            item_id: it.inbound_item_id,
          });
        }

        await assertLotBelongsToStock(
          Number(it.lot_id),
          Number(prod.product_stock_id),
          lotCols
        );

        const up = await client.query(
          `UPDATE public."productsStockLots"
              SET qty_on_hand = qty_on_hand - $2
            WHERE lot_id = $1
              AND qty_on_hand >= $2
            RETURNING lot_id, qty_on_hand`,
          [Number(it.lot_id), qtyBase]
        );

        if (!up.rowCount) {
          await client.query('ROLLBACK');
          return bad(res, 'LOT_REVERT_FAILED_INSUFFICIENT_QTY', {
            invoiceId,
            item_id: it.inbound_item_id,
            lot_id: it.lot_id,
            qty,
            factor,
            qtyBase,
          });
        }
      }
    }

    if (instIds.length) {
      await client.query(
        `DELETE FROM public."accountsPayable"
          WHERE source_type = 'INBOUND_INSTALLMENT'
            AND source_id = ANY($1::bigint[])`,
        [instIds]
      );
    }

    if (invoice.access_key) {
      await client.query(
        `DELETE FROM public."accountsPayable"
          WHERE (source_type IS NULL OR source_type = '')
            AND document_number = $1`,
        [invoice.access_key]
      );
    }

    // Remove somente os movimentos pertencentes a esta NF-e de entrada.
    // Abrange o formato atual e os registros históricos/backfill.
    const deletedMovements = await client.query(
      `DELETE FROM public."productMovements" pm
        WHERE UPPER(BTRIM(COALESCE(pm.origin_module, ''))) IN (
                'INBOUND_INVOICE',
                'INBOUND'
              )
          AND (
            pm.metadata->>'inbound_invoice_id' = $1::text
            OR pm.metadata->>'invoice_id' = $1::text
            OR (
              BTRIM(COALESCE(pm.origin_table, '')) = 'inboundInvoiceItems'
              AND pm.origin_id::text IN (
                SELECT iii.inbound_item_id::text
                  FROM public."inboundInvoiceItems" iii
                 WHERE iii.inbound_id = $1::bigint
              )
            )
            OR (
              NULLIF(BTRIM($2::text), '') IS NOT NULL
              AND BTRIM(COALESCE(pm.nfe_key, '')) = BTRIM($2::text)
            )
          )`,
      [invoiceId, invoice.access_key || null]
    );

    logInbound('INFO', '[INBOUND][DELETE][MOVEMENTS_REMOVED]', {
      invoiceId,
      nfe_number: invoice.invoice_number,
      movements_removed: deletedMovements.rowCount,
    });

    await client.query(
      `DELETE FROM public."inboundInvoiceItems"
        WHERE inbound_id = $1`,
      [invoiceId]
    );

    await client.query(
      `DELETE FROM public."inboundInvoiceInstallments"
        WHERE inbound_id = $1`,
      [invoiceId]
    );

    await client.query(
      `DELETE FROM public."inboundInvoices"
        WHERE inbound_id = $1`,
      [invoiceId]
    );

    await client.query('COMMIT');
    return ok(res, {
      ok: true,
      deleted: true,
      invoiceId,
      movementsRemoved: deletedMovements.rowCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    reportInboundError('[INBOUND][DELETE][ERROR]', {
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      table: err?.table,
      constraint: err?.constraint,
      stack: err?.stack,
      details: err?.details,
    });

    return boom(res, err);
  } finally {
    client.release();
  }
}

// ====================================================================
// INSTALLMENTS
// ====================================================================
export async function listInstallmentsCtrl(req, res) {
  try {
    const invoiceId = Number(req.params.inboundId ?? req.params.invoiceId);
    const rows = await listInstallmentsByInvoice(invoiceId);
    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

export async function createInstallmentCtrl(req, res) {
  try {
    const invoiceId = Number(
      req.params.inboundId ??
      req.params.invoiceId ??
      req.body.inbound_id ??
      req.body.invoice_id
    );
    if (!invoiceId) return bad(res, 'inbound_id is required');

    const body = req.body || {};

    const currentInstallments = await listInstallmentsByInvoice(invoiceId);
    const fallbackNumber = currentInstallments.reduce(
      (max, item) => Math.max(max, Number(item.installment_number) || 0),
      0
    ) + 1;
    // Idempotência: a nota importada via DF-e já tem a parcela (código "001");
    // um novo POST com "1" e o mesmo vencimento não pode gerar outra conta a pagar.
    const normalizeCode = (code) => String(code ?? '').trim().replace(/^0+(?=.)/, '');
    const requestedCode = normalizeCode(body.installment_code);
    const requestedDue = body.due_date ? normalizeDateOnly(body.due_date) : '';

    if (requestedCode && requestedDue) {
      const duplicate = currentInstallments.find((item) =>
        normalizeCode(item.installment_code) === requestedCode &&
        normalizeDateOnly(item.due_date) === requestedDue
      );

      if (duplicate) {
        console.warn('[INBOUND][INSTALLMENT][ALREADY_EXISTS]', {
          invoiceId,
          installmentId: duplicate.inbound_installment_id ?? duplicate.id ?? null,
          installmentCode: duplicate.installment_code,
          dueDate: requestedDue,
        });
        return ok(res, duplicate);
      }
    }

    const installmentNumber = toIntOrNull(body.installment_number) ?? fallbackNumber;
    const isPaid = body.is_paid === true || String(body.status || '').toUpperCase() === 'PAID';

    const payload = {
      inbound_id: invoiceId,
      installment_number: installmentNumber,
      installment_code: body.installment_code,
      due_date: body.due_date,
      original_due_date: body.original_due_date ?? body.due_date,
      amount: body.amount,
      paid_amount: body.paid_amount ?? (isPaid ? body.amount : 0),
      status: body.status ?? (isPaid ? 'PAID' : 'PENDING'),
      is_paid: isPaid,
      paid_at: body.paid_at ?? null,
      accounts_payable_id: body.accounts_payable_id ?? null,
    };

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return bad(res, 'Invoice not found');

    const supplierId = await findSupplierIdByTaxId(invoice.issuer);
    if (!supplierId) {
      return bad(
        res,
        'Fornecedor não encontrado para o CNPJ/CPF do emitente.',
        { code: 'SUPPLIER_NOT_FOUND', taxId: invoice.issuer, invoiceId }
      );
    }

    const installment = await createInstallment(payload);

    const issueDate = normalizeDateOnly(invoice.issue_date || invoice.created_at);
    const dueDateStr = normalizeDateOnly(installment.due_date);
    const totalValue = Number(installment.amount ?? 0);
    const descricaoBase = `NF ${invoice.invoice_number} - Parcela ${installment.installment_code}`;

    let xmlUrl = invoice.xml_url || null;
    let danfeUrl = invoice.danfe_url || null;

    if (!xmlUrl || !danfeUrl) {
      const resolved = resolveNFeFiles(invoice.access_key);
      xmlUrl = xmlUrl || resolved.xmlUrl;
      danfeUrl = danfeUrl || resolved.danfeUrl;
    }

    const baseName =
      invoice.access_key ||
      invoice.invoice_number ||
      `invoice_${invoiceId}`;

    const attachments = [
      ...(xmlUrl
        ? [{
          file_type: 'XML',
          file_name: `${baseName}.xml`,
          file_url: xmlUrl,
        }]
        : []),
      ...(danfeUrl
        ? [{
          file_type: 'DANFE',
          file_name: `${baseName}.pdf`,
          file_url: danfeUrl,
        }]
        : []),
    ];

    console.log('[INBOUND][FILES][RESOLVED]', {
      invoiceId,
      access_key: invoice.access_key,
      xmlUrl,
      danfeUrl,
      attachmentsCount: attachments.length,
    });

    const apPayload = {
      supplier_id: supplierId,
      invoice_number: invoice.invoice_number,
      issue_date: issueDate,
      due_date: dueDateStr,
      payment_method_id: null,
      description: descricaoBase,
      category_id: null,
      subcategory_id: null,
      document_number: invoice.access_key,
      total_value: totalValue,
      amount_paid: 0,
      status: 'PENDING',
      notes: 'Gerado automaticamente a partir da nota de entrada.',
      attachment_url: null,
      source_type: 'INBOUND_INSTALLMENT',
      source_id: installment.inbound_installment_id,
      attachments,
    };

    try {
      const apResult = await createAccountsPayableFromSource(apPayload);

      console.log('[INBOUND→AP] criado/obtido:', {
        invoiceId,
        installmentId: installment.inbound_installment_id,
        payableId:
          apResult?.payable?.id ??
          apResult?.payable?.accounts_payable_id ??
          null,
        created: apResult?.created,
        attachmentsCount: apResult?.attachments?.length || 0,
      });

      const payableId =
        apResult?.payable?.id ??
        apResult?.payable?.accounts_payable_id ??
        null;

      if (payableId) {
        await updateInstallment(installment.inbound_installment_id, {
          accounts_payable_id: Number(payableId),
        });
      }
    } catch (err) {
      if (isUniqueViolation(err)) {
        console.warn('[INBOUND→AP] já existe:', {
          source_type: apPayload.source_type,
          source_id: apPayload.source_id,
        });
      } else {
        reportInboundError('[INBOUND→AP] erro:', err);
      }
    }

    return created(res, installment);
  } catch (err) {
    return boom(res, err);
  }
}

export async function updateInstallmentCtrl(req, res) {
  try {
    const id = Number(req.params.inboundInstallmentId ?? req.params.id);
    const body = req.body || {};
    const payload = {
      installment_code: body.installment_code,
      installment_number: body.installment_number,
      due_date: body.due_date,
      original_due_date: body.original_due_date,
      amount: body.amount,
      paid_amount: body.paid_amount,
      status: body.status,
      is_paid: body.is_paid,
      paid_at: body.paid_at,
      accounts_payable_id: body.accounts_payable_id,
    };

    const row = await updateInstallment(id, payload);
    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function deleteInstallmentCtrl(req, res) {
  try {
    const id = Number(req.params.inboundInstallmentId ?? req.params.id);

    try {
      await pool.query(
        `DELETE FROM public."accountsPayable"
          WHERE source_type = $1 AND source_id = $2`,
        ['INBOUND_INSTALLMENT', BigInt(id)]
      );
    } catch (errAP) {
      reportInboundError('[INBOUND][INSTALLMENT][AP] erro ao remover AP:', errAP);
    }

    const okDel = await deleteInstallment(id);
    return okDel ? noContent(res) : bad(res, 'Installment not found');
  } catch (err) {
    return boom(res, err);
  }
}

// ====================================================================
// ITEMS
// ====================================================================
export async function listItemsCtrl(req, res) {
  try {
    const invoiceId = Number(req.params.inboundId ?? req.params.invoiceId);
    const rows = await listItemsByInvoice(invoiceId);
    return ok(res, rows);
  } catch (err) {
    return boom(res, err);
  }
}

export async function createItemCtrl(req, res) {
  try {
    const invoiceId = Number(
      req.params.inboundId ??
      req.params.invoiceId ??
      req.body.inbound_id ??
      req.body.invoice_id
    );
    if (!invoiceId) return bad(res, 'inbound_id is required');

    const body = req.body || {};

    let productId = body.product_id ? Number(body.product_id) : null;
    if (!productId && body.product_code) {
      productId = await findProductIdByProductCode(body.product_code);
    }

    let productCode = body.product_code ?? null;

    if (productId) {
      const canonicalProduct = await getProductStockRow(pool, productId, null);
      if (canonicalProduct?.product_code) {
        productCode = String(canonicalProduct.product_code).trim();
      }
    }

    const normalizedBody = normalizeInboundItemPayload(body);
    const currentItems = await listItemsByInvoice(invoiceId);
    const nextSequence = currentItems.reduce(
      (max, item) => Math.max(max, Number(item.nfe_item_seq) || 0),
      0
    ) + 1;

    const payload = {
      ...normalizedBody,
      inbound_id: invoiceId,
      product_code: productCode,
      product_id: productId ?? null,
      nfe_item_seq: normalizedBody.nfe_item_seq ?? nextSequence,
    };

    const row = await createItem(payload);

    if (!row.product_id && productId) {
      const updated = await updateItem(
        row.inbound_item_id,
        {
          product_id: productId,
        },
        {
          userCtx: req.user || {},
        }
      );

      return created(res, updated);
    }

    return created(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function updateItemCtrl(req, res) {
  try {
    const id = Number(req.params.inboundItemId ?? req.params.id);
    const body = req.body || {};

    const payload = {};
    const keys = [
      'nf_product_code',
      'product_code',
      'product_id',
      'lot_id',
      'barcode',
      'manufacturer_ref',
      'description',
      'ncm',
      'cest',
      'benefit_code',
      'cfop',
      'unit',
      'quantity',
      'unit_price',
      'total_price',
      'commercial_unit',
      'commercial_quantity',
      'commercial_unit_price',
      'taxable_unit',
      'taxable_quantity',
      'taxable_unit_price',
      'conversion_factor',
      'gross_total',
      'discount_value',
      'freight_value',
      'insurance_value',
      'other_expenses',
      'net_total',
      'ipi',
      'icms',
      'product_grade_id',
      'icms_origin',
      'icms_cst',
      'icms_modality',
      'icms_base',
      'icms_reduction_rate',
      'icms_rate',
      'icms_value',
      'icms_st_modality',
      'icms_st_mva_rate',
      'icms_st_reduction_rate',
      'icms_st_base',
      'icms_st_rate',
      'icms_st_value',
      'fcp_base',
      'fcp_rate',
      'fcp_value',
      'fcp_st_base',
      'fcp_st_rate',
      'fcp_st_value',
      'ipi_cst',
      'ipi_base',
      'ipi_rate',
      'ipi_value',
      'pis_cst',
      'pis_base',
      'pis_rate',
      'pis_value',
      'cofins_cst',
      'cofins_base',
      'cofins_rate',
      'cofins_value',
      'ibs_cst',
      'ibs_classification_code',
      'ibs_base',
      'ibs_state_rate',
      'ibs_state_value',
      'ibs_city_rate',
      'ibs_city_value',
      'ibs_value',
      'cbs_cst',
      'cbs_classification_code',
      'cbs_base',
      'cbs_rate',
      'cbs_value',
      'nfe_key',
      'nfe_item_seq',
      'raw_product_payload',
      'raw_tax_payload',
    ];

    for (const k of keys) {
      if (body[k] !== undefined) payload[k] = body[k];
    }

    const row = await updateItem(id, payload, {
      userCtx: req.user || {},
    });

    return ok(res, row);
  } catch (err) {
    return boom(res, err);
  }
}

export async function deleteItemCtrl(req, res) {
  try {
    const id = Number(req.params.inboundItemId ?? req.params.id);
    const okDel = await deleteItem(id);
    return okDel ? noContent(res) : bad(res, 'Item not found');
  } catch (err) {
    return boom(res, err);
  }
}

// ====================================================================
// POST (APLICA ESTOQUE CONFORME PRODUCT_STOCK_MODE + ATUALIZA CUSTO)
// ====================================================================
export async function postInvoiceCtrl(req, res) {
  const invoiceId = Number(req.params.inboundId ?? req.params.id);
  const traceId = getInboundTrace(req, 'POST');

  if (!invoiceId) {
    logInbound('WARN', '[INBOUND][POST][INVALID_ID]', { traceId, params: req.params });
    return bad(res, 'Invalid invoice id');
  }

  const client = await pool.connect();

  try {
    logInbound('INFO', '[INBOUND][POST][START]', {
      traceId,
      invoiceId,
    });

    await client.query('BEGIN');
    await ensureColumnsForPosting();

    const result = await postInvoiceInternal(
      client,
      invoiceId,
      traceId,
      req
    );

    await client.query('COMMIT');

    logInbound('INFO', '[INBOUND][POST][DONE]', {
      traceId,
      invoiceId,
      alreadyPosted: result.alreadyPosted,
      debugCount: Array.isArray(result.debug) ? result.debug.length : 0,
      debug: result.debug || [],
    });

    return ok(res, {
      ok: true,
      message: result.alreadyPosted ? 'Invoice already posted' : `Invoice posted (${result.stockMode || getInboundProductStockMode()})`,
      invoiceId,
      debug: result.debug || [],
      traceId,
    });
  } catch (err) {
    await client.query('ROLLBACK');

    logInbound('ERROR', '[INBOUND][POST][ERROR]', {
      traceId,
      invoiceId,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      where: err?.where,
      schema: err?.schema,
      table: err?.table,
      column: err?.column,
      constraint: err?.constraint,
      stack: err?.stack,
      details: err?.details,
    });

    return bad(res, err.message || 'POST_FAILED', err.details || {
      invoiceId,
      pg: {
        code: err?.code,
        detail: err?.detail,
        where: err?.where,
        table: err?.table,
        constraint: err?.constraint,
      },
      traceId,
    });
  } finally {
    client.release();
  }
}
