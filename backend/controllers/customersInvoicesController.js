// ╔══════════════════════════════════════════════════════════════╗
// ║ customersInvoicesController.js                              ║
// ║ CONSART ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import fs from 'node:fs';

import pool from '../config/db.js';

import {
  listAllXmlItems,
  publicPathToAbsolute,
} from '../repositories/painelNotasFiscais/painelNotasFiscais.index.js';

import {
  generateDanfeFromXml,
} from '../services/danfeConsartService.js';

function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

function normalizeCnpjCpf(v) {
  const digits = onlyDigits(v);

  if (!digits) return '';

  if (digits.length === 13) {
    return digits.padStart(14, '0');
  }

  if (digits.length > 0 && digits.length < 11) {
    return digits.padStart(11, '0');
  }

  return digits;
}

function sanitizeFileName(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function listCustomerInvoices(req, res) {
  try {
    const customerId = Number(req.params.customer_id);

    if (!customerId) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_CUSTOMER_ID',
      });
    }

    const customerResult = await pool.query(`
      SELECT
        customer_id,
        tax_id,
        COALESCE(trade_name, legal_name, '') AS customer_name
      FROM public.customers
      WHERE customer_id = $1
      LIMIT 1
    `, [customerId]);

    const customer = customerResult.rows[0];

    if (!customer) {
      return res.status(404).json({
        ok: false,
        error: 'CUSTOMER_NOT_FOUND',
      });
    }

    const customerTaxId = normalizeCnpjCpf(customer.tax_id);

    const invoicesResult = await pool.query(`
      SELECT
        ii.invoice_id,
        ii.order_id,
        ii.nfe_number,
        ii.nfe_key,
        ii.nfe_status,
        ii.nfe_protocol,
        ii.nfe_environment,
        ii.xml_url,
        ii.danfe_url,
        ii.issued_at,
        ii.issued_date,
        ii.total_amount,
        o.customer_id
      FROM public."invoicesIssued" ii
      LEFT JOIN public.orders o
        ON o.order_id = ii.order_id
      WHERE o.customer_id = $1
      ORDER BY ii.invoice_id DESC
      LIMIT 500
    `, [customerId]);

    const invoicesIssuedRows = invoicesResult.rows.map((row) => ({
      source: 'invoicesIssued',
      invoice_id: row.invoice_id,
      order_id: row.order_id,
      customer_name: customer.customer_name,
      nfe_number: row.nfe_number,
      nfe_key: row.nfe_key,
      nfe_status: row.nfe_status,
      nfe_protocol: row.nfe_protocol,
      nfe_environment: row.nfe_environment,
      issued_at: row.issued_at,
      issued_date: row.issued_date,
      total_amount: row.total_amount,
      xml_url: row.xml_url,
      danfe_url: row.danfe_url,
    }));

    const xmlItems = listAllXmlItems();

    const legacyRows = xmlItems
      .filter((item) => {
        const xmlTaxId = normalizeCnpjCpf(item.cnpj);
        return xmlTaxId === customerTaxId;
      })
      .map((item) => ({
        source: 'painelNotasFiscais',
        invoice_id: null,
        order_id: null,
        customer_name: item.cliente || customer.customer_name,
        nfe_number: item.numero,
        nfe_key: item.chave,
        nfe_status: 'LEGACY',
        nfe_protocol: null,
        nfe_environment: 'LEGACY',
        issued_at: item.emissao,
        issued_date: item.emissao,
        total_amount: item.valorTotal,
        xml_url: item.caminho,
        danfe_url: null,
      }));

    const merged = [
      ...invoicesIssuedRows,
      ...legacyRows,
    ];

    const unique = new Map();

    for (const row of merged) {
      const key = row.nfe_key || `${row.source}-${row.nfe_number}-${row.xml_url}`;

      if (!unique.has(key)) {
        unique.set(key, row);
      }
    }

    const rows = Array.from(unique.values());

    return res.json({
      ok: true,
      total: rows.length,
      rows,
    });
  } catch (error) {
    console.error('[customersInvoicesController.listCustomerInvoices]', error);

    return res.status(500).json({
      ok: false,
      error: 'INTERNAL_ERROR',
    });
  }
}

export async function downloadCustomerInvoiceDanfe(req, res) {
  try {
    const invoiceId = req.query.invoice_id ? Number(req.query.invoice_id) : null;
    const xmlUrlQuery = String(req.query.xml_url || '').trim();
    const nfeKey = String(req.query.nfe_key || '').trim();
    const nfeNumber = String(req.query.nfe_number || 'NF').trim();
    const customerName = String(req.query.customer_name || 'CLIENTE').trim();

    let xmlContent = null;
    let status = null;
    let protocol = null;
    let xmlUrl = xmlUrlQuery;

    if (invoiceId) {
      const { rows } = await pool.query(`
        SELECT
          invoice_id,
          nfe_number,
          nfe_key,
          nfe_status,
          nfe_protocol,
          xml_url
        FROM public."invoicesIssued"
        WHERE invoice_id = $1
        LIMIT 1
      `, [invoiceId]);

      const invoice = rows[0];

      status = invoice?.nfe_status || null;
      protocol = invoice?.nfe_protocol || null;

      xmlUrl = invoice?.xml_url || xmlUrlQuery;
    }

    if (!xmlUrl) {
      return res.status(404).json({
        ok: false,
        error: 'XML_URL_NOT_FOUND',
      });
    }

    // XML local antigo
    if (xmlUrl.startsWith('/public/')) {
      const absPath = publicPathToAbsolute(xmlUrl);

      if (!fs.existsSync(absPath)) {
        return res.status(404).json({
          ok: false,
          error: 'LEGACY_XML_NOT_FOUND',
          path: absPath,
        });
      }

      xmlContent = fs.readFileSync(absPath, 'utf8');
      status = status || 'LEGACY';
    }

    // XML remoto PlugNotas / URL externa
    if (!xmlContent && /^https?:\/\//i.test(xmlUrl)) {
      const headers = {};

      const plugNotasToken =
        process.env.PLUGNOTAS_API_KEY ||
        process.env.PLUGNOTAS_TOKEN ||
        process.env.NFE_API_KEY ||
        '';

      if (plugNotasToken) {
        headers['x-api-key'] = plugNotasToken;
      }

      const response = await fetch(xmlUrl, { headers });

      if (!response.ok) {
        console.error('[downloadCustomerInvoiceDanfe][XML_FETCH_FAILED]', {
          status: response.status,
          xmlUrl,
        });

        return res.status(502).json({
          ok: false,
          error: 'XML_FETCH_FAILED',
          status: response.status,
        });
      }

      xmlContent = await response.text();
    }

    if (!xmlContent) {
      return res.status(400).json({
        ok: false,
        error: 'XML_CONTENT_REQUIRED',
      });
    }

    const pdfBuffer = await generateDanfeFromXml({
      numero: nfeNumber,
      chave: nfeKey,
      xmlContent,
      prot: {
        status,
        nfe_status: status,
        nProt: protocol,
      },
    });

    const safeNumber = sanitizeFileName(nfeNumber || 'NF');
    const safeCustomer = sanitizeFileName(customerName || 'CLIENTE').toUpperCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="DANFE-${safeNumber}-${safeCustomer}.pdf"`
    );

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[customersInvoicesController.downloadCustomerInvoiceDanfe]', error);

    return res.status(500).json({
      ok: false,
      error: 'DANFE_GENERATION_ERROR',
      message: error.message,
    });
  }
}