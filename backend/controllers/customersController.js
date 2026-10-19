// ╔════════════════════════════════════════════════════════════════════╗
// ║ customersController.js — Controller Express (ESM)                  ║
// ║ CONSART ERP                                                       ║
// ║ ✔ list/search + PDF/Excel                                         ║
// ║ ✔ Filtros completos                                               ║
// ║ ✔ Proteção por chave (.env)                                       ║
// ╚════════════════════════════════════════════════════════════════════╝

import customersApi from '../repositories/customers/customers.index.js';
import { generateCustomersPdf } from '../generationPdf/generationCustomersPdf.js';
import { generateCustomersExcel } from '../generationExcel/generationCustomersExcel.js';

import asaasApi from '../repositories/asaas/asaas.index.js';
import { verifyModulePassword } from '../repositories/modulePasswords/modulePasswords.index.js';

/* =========================================================================
   Helpers
   ========================================================================= */

function envBool(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === null || v === '') return fallback;
  return ['1', 'true', 't', 'yes', 'y', 'on'].includes(String(v).toLowerCase());
}

function denyExport(res, type) {
  return res.status(403).json({
    ok: false,
    error: `Exportação ${type} desativada no ambiente.`,
  });
}

// 🔐 KEY VALIDATION
function getExportKeyFromRequest(req) {
  return (
    req.headers['x-export-key'] ||
    req.query?.export_key ||
    req.body?.export_key ||
    ''
  ).toString().trim();
}

// Senha em public."modulePasswords" (CUSTOMERS / EXPORT);
// sem senha cadastrada → usa EXPORT_DOWNLOAD_KEY do .env
async function validateExportKey(req, res) {
  const allowed = await verifyModulePassword(
    'CUSTOMERS',
    'EXPORT',
    getExportKeyFromRequest(req),
    { fallback: process.env.EXPORT_DOWNLOAD_KEY }
  );

  if (!allowed) {
    res.status(401).json({
      ok: false,
      error: 'Chave de exportação inválida.',
    });
    return { ok: false };
  }

  return { ok: true };
}

// --------------------------------------------------

function parseBool(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['1', 'true', 't', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'f', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function pickBoolQuery(req, ...keys) {
  for (const k of keys) {
    const b = parseBool(req.query?.[k]);
    if (b !== undefined) return b;
  }
  return undefined;
}

function toNumOrUndefined(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toStrOrUndefined(v) {
  const s = (v ?? '').toString().trim();
  return s ? s : undefined;
}

/* =========================================================================
   Handlers
   ========================================================================= */

export async function ensureTable(req, res) {
  try {
    const ok = await customersApi.ensureTable();
    return res.json(ok);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function list(req, res) {
  try {
    const {
      q,
      limit,
      offset,
      orderBy,
      order,
      orderDirection,
    } = req.query || {};

    const is_active = pickBoolQuery(req, 'is_active', 'status');

    const status_type_id = toNumOrUndefined(req.query?.status_type_id);
    const business_segment = toStrOrUndefined(req.query?.business_segment);
    const seller_id = toNumOrUndefined(req.query?.seller_id);
    const segment_id = toNumOrUndefined(req.query?.segment_id);

    const data = await customersApi.list({
      q: toStrOrUndefined(q),
      is_active,
      status_type_id,
      business_segment,
      seller_id,
      segment_id,
      limit: toNumOrUndefined(limit),
      offset: toNumOrUndefined(offset),
      orderBy: toStrOrUndefined(orderBy),
      order: toStrOrUndefined(orderDirection) ?? toStrOrUndefined(order),
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function search(req, res) {
  try {
    const { q, limit, offset } = req.query || {};
    const is_active = pickBoolQuery(req, 'is_active', 'status');

    const data = await customersApi.search({
      q: toStrOrUndefined(q),
      is_active: is_active ?? true,
      limit: toNumOrUndefined(limit),
      offset: toNumOrUndefined(offset),
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getById(req, res) {
  try {
    const item = await customersApi.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

export async function create(req, res) {
  try {
    const item = await customersApi.create(req.body);
    return res.status(201).json(item);
  } catch (err) {
    // CNPJ/CPF já cadastrado → informa o cliente existente
    // (customersConsart tem índices com outro nome; o detail cita o tax_id)
    if (
      err.constraint === 'idx_customers_tax_id_unique' ||
      /idx_customers_tax_id_unique/.test(err.message) ||
      (err.code === '23505' && /tax_id/.test(String(err.detail || err.message)))
    ) {
      const existing = await customersApi.findByTaxId(req.body?.tax_id).catch(() => null);
      const name = existing?.trade_name || existing?.legal_name || '';
      return res.status(409).json({
        error: 'duplicate_tax_id',
        title: 'Cliente Existente',
        message: existing
          ? `Já existe um cliente cadastrado com este CNPJ/CPF: #${existing.customer_id}${name ? ` — ${name}` : ''}`
          : 'Já existe um cliente cadastrado com este CNPJ/CPF.',
        customer_id: existing?.customer_id ?? null,
      });
    }
    const code = /(unique|duplicate key)/i.test(err.message) ? 409 : 400;
    return res.status(code).json({ error: err.message });
  }
}

export async function updateById(req, res) {
  try {
    if (!req.body || !Object.keys(req.body).length) {
      return res.status(400).json({ error: 'Empty payload' });
    }

    const item = await customersApi.updateById(req.params.id, req.body);
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
  } catch (err) {
    const code = /(unique|duplicate key)/i.test(err.message) ? 409 : 400;
    return res.status(code).json({ error: err.message });
  }
}

export async function removeById(req, res) {
  try {
    const hard = parseBool(req.query?.hard) || false;
    const result = await customersApi.removeById(req.params.id, { hard });
    if (!result.ok) return res.status(404).json({ error: 'Not found' });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// ======================================================================
// 🔄 SINCRONIZAÇÃO ASAAS
// ======================================================================
export async function syncAsaas(req, res) {
  try {
    const requestedLimit = Number(req.body?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 100;

    const customers = await customersApi.listWithoutAsaasId({ limit });

    const result = {
      found: customers.length,
      synchronized: 0,
      failed: 0,
      errors: [],
    };

    for (const customer of customers) {
      try {
        const name =
          customer.legal_name ||
          customer.trade_name ||
          `Cliente ${customer.customer_id}`;

        const cpfCnpj = String(customer.tax_id || '')
          .replace(/\D+/g, '');

        const email = String(customer.email || '').trim();

        if (!cpfCnpj && !email) {
          throw new Error(
            'Cliente sem CPF/CNPJ e sem e-mail.'
          );
        }

        const asaasId =
          await asaasApi.ensureAsaasCustomerForEcommerce({
            externalReference: String(customer.customer_id),
            name,
            email: email || undefined,
            cpfCnpj: cpfCnpj || undefined,
            phone: customer.phone_number || undefined,
            mobilePhone: customer.mobile_number || undefined,
          });

        if (!asaasId) {
          throw new Error('O Asaas não retornou o ID.');
        }

        await customersApi.saveAsaasId(
          customer.customer_id,
          asaasId
        );

        result.synchronized += 1;
      } catch (error) {
        result.failed += 1;

        result.errors.push({
          customer_id: customer.customer_id,
          name:
            customer.legal_name ||
            customer.trade_name ||
            null,
          error:
            error?.response?.data?.errors?.[0]?.description ||
            error?.response?.data?.message ||
            error?.message ||
            'Erro desconhecido',
        });
      }
    }

    const remaining =
      await customersApi.countWithoutAsaasId();

    return res.status(200).json({
      ok: true,
      ...result,
      remaining,
      hasMore: remaining > 0,
    });
  } catch (error) {
    console.error(
      '[customersController.syncAsaas]',
      error?.response?.data || error
    );

    return res.status(500).json({
      ok: false,
      error: 'Erro ao sincronizar clientes com o Asaas.',
      details: error?.message,
    });
  }
}

// ======================================================================
// 🔄 SINCRONIZAR UM CLIENTE COM O ASAAS
// POST /api/integracoes/asaas/clientes/:id/sync
// ======================================================================
export async function syncAsaasById(req, res) {
  try {
    const customerId = Number(req.params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({
        ok: false,
        error: 'ID do cliente inválido.',
      });
    }

    const customer = await customersApi.getById(customerId);

    if (!customer) {
      return res.status(404).json({
        ok: false,
        error: 'Cliente não encontrado.',
      });
    }

    const name = String(
      customer.legal_name ||
      customer.trade_name ||
      customer.name ||
      `Cliente ${customerId}`
    ).trim();

    const cpfCnpj = String(
      customer.tax_id ||
      customer.cpf_cnpj ||
      ''
    ).replace(/\D+/g, '');

    const email = String(customer.email || '').trim();

    const phone = String(
      customer.phone_number ||
      customer.phone ||
      ''
    ).trim();

    const mobilePhone = String(
      customer.mobile_number ||
      customer.mobile_phone ||
      ''
    ).trim();

    if (!cpfCnpj && !email) {
      return res.status(422).json({
        ok: false,
        error:
          'O cliente precisa ter CPF/CNPJ ou e-mail para ser sincronizado.',
      });
    }

    const previousAsaasId = String(
      customer.asaas_id ||
      customer.asaasId ||
      ''
    ).trim();

    const asaasId =
      await asaasApi.ensureAsaasCustomerForEcommerce({
        externalReference: String(customerId),
        name,
        email: email || undefined,
        cpfCnpj: cpfCnpj || undefined,
        phone: phone || undefined,
        mobilePhone: mobilePhone || undefined,
      });

    if (!asaasId) {
      throw new Error('O Asaas não retornou o ID do cliente.');
    }

    await customersApi.saveAsaasId(customerId, asaasId);

    return res.status(200).json({
      ok: true,
      message: previousAsaasId
        ? 'Cliente sincronizado novamente com o Asaas.'
        : 'Cliente criado e vinculado ao Asaas.',
      customer_id: customerId,
      asaas_id: asaasId,
      previous_asaas_id: previousAsaasId || null,
      customer: {
        customer_id: customerId,
        asaas_id: asaasId,
        name,
      },
    });
  } catch (error) {
    const message =
      error?.response?.data?.errors?.[0]?.description ||
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido';

    console.error(
      '[customersController.syncAsaasById]',
      error?.response?.data || error
    );

    const status =
      Number(error?.response?.status) >= 400 &&
        Number(error?.response?.status) <= 599
        ? Number(error.response.status)
        : 500;

    return res.status(status).json({
      ok: false,
      error: 'Erro ao sincronizar cliente com o Asaas.',
      details: message,
    });
  }
}

// ======================================================================
// 📄 PDF
// ======================================================================
export async function reportPdf(req, res) {
  try {
    // 🔐 valida chave
    const auth = await validateExportKey(req, res);
    if (!auth.ok) return;

    const pdfEnabled = envBool('EXPORT_PDF_ENABLED', true);
    if (!pdfEnabled) return denyExport(res, 'PDF');

    const q = toStrOrUndefined(req.query?.q);
    const is_active = pickBoolQuery(req, 'is_active', 'status');
    const orderBy = toStrOrUndefined(req.query?.orderBy);
    const order =
      toStrOrUndefined(req.query?.orderDirection) ??
      toStrOrUndefined(req.query?.order);

    const status_type_id = toNumOrUndefined(req.query?.status_type_id);
    const business_segment = toStrOrUndefined(req.query?.business_segment);
    const seller_id = toNumOrUndefined(req.query?.seller_id);
    const segment_id = toNumOrUndefined(req.query?.segment_id);

    const rows = await customersApi.listAllForExport({
      q,
      is_active,
      status_type_id,
      business_segment,
      seller_id,
      segment_id,
      orderBy,
      order,
    });

    await generateCustomersPdf({
      req,
      res,
      rows,
      filters: { q, is_active, status_type_id, business_segment, seller_id, segment_id },
    });
  } catch (err) {
    console.error('[customersController.reportPdf] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ======================================================================
// 📊 EXCEL
// ======================================================================
export async function reportExcel(req, res) {
  try {
    // 🔐 valida chave
    const auth = await validateExportKey(req, res);
    if (!auth.ok) return;

    const excelEnabled = envBool('EXPORT_EXCEL_ENABLED', true);
    if (!excelEnabled) return denyExport(res, 'EXCEL');

    const q = toStrOrUndefined(req.query?.q);
    const is_active = pickBoolQuery(req, 'is_active', 'status');
    const orderBy = toStrOrUndefined(req.query?.orderBy);
    const order =
      toStrOrUndefined(req.query?.orderDirection) ??
      toStrOrUndefined(req.query?.order);

    const status_type_id = toNumOrUndefined(req.query?.status_type_id);
    const business_segment = toStrOrUndefined(req.query?.business_segment);
    const seller_id = toNumOrUndefined(req.query?.seller_id);
    const segment_id = toNumOrUndefined(req.query?.segment_id);

    const rows = await customersApi.listAllForExport({
      q,
      is_active,
      status_type_id,
      business_segment,
      seller_id,
      segment_id,
      orderBy,
      order,
    });

    await generateCustomersExcel({
      req,
      res,
      rows,
      filters: { q, is_active, status_type_id, business_segment, seller_id, segment_id },
    });
  } catch (err) {
    console.error('[customersController.reportExcel] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default {
  ensureTable,
  list,
  search,
  getById,
  create,
  updateById,
  removeById,
  reportPdf,
  reportExcel,
  syncAsaas,
  syncAsaasById,
};
