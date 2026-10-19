// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsController.js — Controller de Orçamentos (ESM) — CONSART ERP ║
// ║ ✅ HARDEN: logs + status code correto (400 vs 500)                  ║
// ║ ✅ Itens normalizados (public."budgetsItems") + lot_id               ║
// ║ ✅ Frete + PaymentMethods + PDF + To-Order + Kanban                 ║
// ║ ✅ PDF FIX: anexa budgetsPayments + budgetsPaymentInstallments      ║
// ║ ✅ NOVO: valida chave de liberação de estoque                       ║
// ║ ✅ NOVO: harden do desconto geral do orçamento                      ║
// ║ ✅ NOVO: valida token de override por usuário / sku / lote          ║
// ║ ✅ DEBUG: snapshot completo de override_stock/override_token        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import budgetsApi from '../repositories/budgets/budgets.index.js';
import ordersApi from '../repositories/orders/orders.index.js';
import paymentMethodsApi from '../repositories/paymentMethods/paymentMethods.index.js';
import budgetsPaymentsApi from '../repositories/budgetsPayments/budgetsPayments.index.js';
import budgetsPaymentInstallmentsApi from '../repositories/budgetsPaymentInstallments/budgetsPaymentInstallments.index.js';
import enterpriseApi from '../repositories/enterprise/enterprise.index.js';
import * as ordersKanbanApi from '../repositories/ordersKanban/ordersKanban.index.js';

import {
  generateBudgetPdf
} from '../generationPdf/generationBudgetsPdf/generationBudgetsPdf.manager.js';

import orderDeliveryApi from '../repositories/ordersDelivery/ordersDelivery.index.js';
import {
  getBudgetSettings,
} from '../repositories/budgetSettings/budgetSettings.index.js';
import {
  resolveProductsStockMode,
} from '../repositories/productsStock/productsStock.manager.js';
import {
  issueBudgetStockOverrideToken,
  validateBudgetStockOverrideForItem,
  validateBudgetStockOverrideKey,
} from '../services/security/budgetAuthorizationToken.js';

// ======================================================================
// HELPERS
// ======================================================================
function getBudgetApiContext(req, userId) {
  const scopeType = String(
    req?.appFeatureScope?.scopeType ??
    req?.featureScopeType ??
    'GLOBAL'
  ).trim().toUpperCase();

  const rawScopeId =
    req?.appFeatureScope?.scopeId ??
    req?.featureScopeId ??
    1;

  const scopeId = Number(rawScopeId);

  return {
    userId,

    featureScopeType:
      scopeType || 'GLOBAL',

    featureScopeId:
      Number.isSafeInteger(scopeId) && scopeId > 0
        ? scopeId
        : 1,
  };
}

async function getCurrentBudgetSettings() {
  const settings = await getBudgetSettings(pool);

  if (!settings) {
    const error = new Error('Parâmetros globais do orçamento não encontrados.');
    error.status = 500;
    error.code = 'BUDGET_SETTINGS_NOT_FOUND';
    throw error;
  }

  return settings;
}

function getStockOverrideTtlMinutes() {
  const n = Number(process.env.BUDGET_STOCK_OVERRIDE_TTL_MINUTES || 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

function setNoCache(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeMoney(value, def = 0) {
  if (value === null || value === undefined || value === '') return Number(def);

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return Number(def);
    return Number(value.toFixed(2));
  }

  let s = String(value).trim();
  if (!s) return Number(def);

  s = s.replace(/\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');

  const n = Number(s);
  if (!Number.isFinite(n)) return Number(def);
  return Number(n.toFixed(2));
}

const isFiniteNum = (v) => Number.isFinite(Number(v));

const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
};

function errorPayload(err) {
  return {
    ok: false,
    error: String(err?.message || err || 'Erro'),
    stack: process.env.NODE_ENV === 'production' ? undefined : String(err?.stack || ''),
  };
}

function boolFromAny(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return ['1', 'true', 't', 'yes', 'y', 'on'].includes(s);
}

function safeString(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

function unwrapListResult(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function computeTotalAmount({
  subtotal = 0,
  total_discount = 0,
  freight_value = 0,
  total_amount = 0,
} = {}) {
  const explicit = normalizeMoney(total_amount, 0);
  const computed =
    normalizeMoney(subtotal, 0) -
    normalizeMoney(total_discount, 0) +
    normalizeMoney(freight_value, 0);

  if (explicit > 0) return explicit;
  return Number(Math.max(0, computed).toFixed(2));
}

/**
 * Deriva TODOS os valores financeiros do cabeçalho a partir dos ITENS.
 *
 * Por que existe: até 16/09/2026 o backend aceitava subtotal,
 * items_discount_total, total_discount e global_discount_amount prontos do
 * payload, e o computeTotalAmount acima devolvia o total_amount do cliente
 * sempre que ele fosse > 0. Consequência prática: a trava de
 * max_discount_percent comparava o desconto enviado pelo cliente contra o
 * subtotal enviado pelo MESMO cliente — auto-referente e, portanto, inócua.
 *
 * Agora o servidor é a fonte da verdade. Os valores do payload só servem para
 * detectar divergência (logada), nunca para persistir.
 *
 * Auditoria de 16/09/2026: este cálculo reproduz exatamente os totais já
 * gravados nos 192 orçamentos existentes, então não altera dado legítimo.
 *
 * Use APENAS em caminhos de escrita. Em leitura (fetchBudgetByIdData) o certo
 * é devolver o que está persistido.
 */
function deriveBudgetTotals(header = {}, items = []) {
  const money = (value) => Number(Math.round((Number(value) || 0) * 100) / 100);

  const list = Array.isArray(items) ? items : [];

  const subtotal = money(
    list.reduce(
      (acc, it) => acc + (Number(it?.quantity) || 0) * (Number(it?.unit_price) || 0),
      0,
    ),
  );

  const itemsDiscountTotal = money(
    list.reduce((acc, it) => acc + Math.max(0, Number(it?.discount_value) || 0), 0),
  );

  const globalType =
    String(header.global_discount_type || 'value').trim().toLowerCase() === 'percent'
      ? 'percent'
      : 'value';

  const globalValue = Math.max(0, money(header.global_discount_value));

  /*
   * ESPELHO EXATO de calcGlobalDiscountAmount() em
   * public/budgets/js/budgets.items.js (recalcTotals). Duas regras que a UI
   * aplica e que o servidor tem de reproduzir, senão a tela mostra um número
   * e o banco grava outro:
   *
   *  1. a base é o subtotal LÍQUIDO (já descontados os descontos de item),
   *     não o bruto;
   *  2. o desconto global é LIMITADO à base (Math.min) nos dois tipos —
   *     logo total_discount nunca excede o subtotal.
   */
  const baseAfterItemDiscounts = Math.max(0, money(subtotal - itemsDiscountTotal));

  const globalAmount = globalType === 'percent'
    ? Math.max(0, Math.min(
      baseAfterItemDiscounts,
      money((baseAfterItemDiscounts * globalValue) / 100),
    ))
    : Math.max(0, Math.min(baseAfterItemDiscounts, globalValue));

  const totalDiscount = money(itemsDiscountTotal + globalAmount);
  const freight = Math.max(0, money(header.freight_value));

  // Idêntico ao frontend: base líquida - desconto global + frete.
  // Algebricamente igual a (subtotal - total_discount + frete).
  // O clamp em zero é inalcançável dado o Math.min acima, mas fica para
  // espelhar a UI literalmente.
  const totalAmount = Math.max(0, money(baseAfterItemDiscounts - globalAmount + freight));

  return {
    subtotal,
    items_discount_total: itemsDiscountTotal,
    global_discount_type: globalType,
    global_discount_value: globalValue,
    global_discount_amount: globalAmount,
    total_discount: totalDiscount,
    freight_value: freight,
    total_amount: totalAmount,
  };
}

/**
 * Aplica os totais derivados ao cabeçalho, registrando divergências.
 * Divergência não bloqueia: o servidor simplesmente vence.
 */
function applyDerivedTotals(header = {}, items = [], contexto = '') {
  const derived = deriveBudgetTotals(header, items);

  const divergencias = Object.entries(derived)
    .filter(([campo, valorDerivado]) => {
      const enviado = header[campo];
      if (enviado === null || enviado === undefined || enviado === '') return false;
      if (campo === 'global_discount_type') return String(enviado) !== valorDerivado;
      return Math.abs((Number(enviado) || 0) - Number(valorDerivado)) > 0.01;
    })
    .map(([campo, valorDerivado]) => ({
      campo,
      enviado: header[campo],
      derivado: valorDerivado,
    }));

  if (divergencias.length) {
    console.warn('[budgets][TOTAIS DIVERGENTES DO PAYLOAD]', {
      contexto,
      budget_id: header.budget_id ?? header.id ?? null,
      itens: Array.isArray(items) ? items.length : 0,
      divergencias,
      detalhe: 'O servidor recalculou a partir dos itens e ignorou os valores '
        + 'enviados. Se isto aparecer com frequência, o frontend está calculando '
        + 'diferente do backend.',
    });
  }

  Object.assign(header, derived);
  return header;
}

async function resolveDefaultOperationTypeId() {
  const sql = `
    SELECT COALESCE(
      NULLIF(to_jsonb(op) ->> 'operation_type_id', '')::bigint,
      NULLIF(to_jsonb(op) ->> 'id', '')::bigint
    ) AS operation_type_id
    FROM public."nfeOperationTypes" op
    WHERE UPPER(
      COALESCE(
        NULLIF(to_jsonb(op) ->> 'code', ''),
        NULLIF(to_jsonb(op) ->> 'operation_code', ''),
        ''
      )
    ) = 'REVENDA_MG'
      AND COALESCE(NULLIF(to_jsonb(op) ->> 'is_active', '')::boolean, TRUE)
    LIMIT 1
  `;

  const result = await pool.query(sql);
  const operationTypeId = Number(result.rows[0]?.operation_type_id);

  return Number.isInteger(operationTypeId) && operationTypeId > 0
    ? operationTypeId
    : null;
}

function validateOverrideForItem(it, userId) {
  return validateBudgetStockOverrideForItem(it, userId);
}

function buildOverrideSnapshot(items = []) {
  return (Array.isArray(items) ? items : []).map((it) => ({
    sku: it?.sku || null,
    quantity: Number(it?.quantity || 0),
    lot_id: it?.lot_id ?? null,
    override_stock: !!it?.override_stock,
    override_token_present: !!it?.override_token,
    override_token_preview: it?.override_token
      ? `${String(it.override_token).slice(0, 40)}...`
      : null,
  }));
}

async function validateBudgetGlobalRules(header = {}, items = [], ctx = {}) {
  const settings = await getCurrentBudgetSettings();
  const maxPercent = Number(settings.max_discount_percent ?? 100);

  const stockMode = await resolveProductsStockMode({
    scopeType:
      ctx?.featureScopeType ??
      ctx?.scopeType ??
      'GLOBAL',

    scopeId:
      ctx?.featureScopeId ??
      ctx?.scopeId ??
      1,
  });

  /*
   * PRODUCT_STOCK_MODE é a fonte única para obrigatoriedade de lote.
   * budgetSettings.require_stock_lot deixa de decidir o modelo de estoque.
   */
  if (stockMode?.requireLot) {
    const itemWithoutLot = items.find(
      (item) => item?.lot_id == null || String(item.lot_id).trim() === '',
    );

    if (itemWithoutLot) {
      const error = new Error(
        `Selecione um lote para o SKU ${itemWithoutLot.sku || ''}.`,
      );
      error.status = 400;
      error.code = 'BUDGET_STOCK_LOT_REQUIRED';
      throw error;
    }
  }

  const subtotal = Math.max(0, Number(header.subtotal || 0));
  const totalDiscount = Math.max(0, Number(header.total_discount || 0));

  if (totalDiscount > subtotal * (maxPercent / 100) + 0.0001) {
    const error = new Error(
      `O desconto total excede o máximo permitido de ${maxPercent}%.`,
    );
    error.status = 400;
    error.code = 'BUDGET_MAX_DISCOUNT_EXCEEDED';
    throw error;
  }

  for (const item of items) {
    const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
    const discount = Number(item.discount_value || 0);

    if (discount > gross * (maxPercent / 100) + 0.0001) {
      const error = new Error(
        `O desconto do SKU ${item.sku || ''} excede o máximo permitido de ${maxPercent}%.`,
      );
      error.status = 400;
      error.code = 'BUDGET_ITEM_MAX_DISCOUNT_EXCEEDED';
      throw error;
    }
  }

  return settings;
}

// ======================================================================
// Bootstrap
// ======================================================================
export async function initBudgetsController() {
  try {
    await ordersApi.ensureTables?.();
    await paymentMethodsApi.ensureTable?.();
  } catch (err) {
    console.error('[initBudgetsController] failed:', err);
  }
}

// ======================================================================
// NORMALIZAÇÃO DA FORMA DE PAGAMENTO
// ======================================================================
function normalizePaymentFields(header = {}) {
  const h = { ...header };

  if (h.payment_form_id && !h.payment_method_id) {
    h.payment_method_id = h.payment_form_id;
  }

  if (!h.payment_method_name) {
    h.payment_method_name =
      h.payment_form_name ||
      h.forma_pagamento_nome ||
      h.forma_pagamento ||
      null;
  }

  return h;
}

// ======================================================================
// UTILITÁRIOS (CLIENTE)
// ======================================================================
async function getCustomerMinimalById(customerId) {
  if (!customerId) return null;

  const sql = `
      SELECT
        customer_id,
        COALESCE(trade_name, legal_name)      AS name,
        tax_id                                AS tax_id,
        email,
        COALESCE(phone_number, mobile_number) AS phone,
        postal_code,
        street_type,
        street_name,
        street_number,
        address_complement,
        neighborhood,
        city,
        state
      FROM public."customers"
      WHERE customer_id = $1
      LIMIT 1
    `;

  const r = await pool.query(sql, [customerId]);
  return r.rowCount ? r.rows[0] : null;
}

// ======================================================================
// NORMALIZAÇÃO DE ITENS (ALINHADO COM public."budgetsItems" + LOTES)
// ======================================================================
function normalizeItemPayload(it = {}) {
  const sku =
    (it.sku ?? it.product_code ?? it.codigo ?? it.productCode ?? '')
      .toString()
      .trim();

  const out = {
    sku,

    manufacturer_ref: safeString(
      it.manufacturer_ref ??
      it.manufacturerRef ??
      it.ref_fab ??
      it.refFab ??
      it.referencia_fabricante,
      100
    ) || null,

    description: (it.description ?? it.descricao ?? '').toString().trim(),
    unit: (it.unit ?? it.unidade ?? it.um ?? 'UN').toString().trim() || 'UN',
    quantity: isFiniteNum(it.quantity ?? it.quantidade ?? it.qtd)
      ? Number(it.quantity ?? it.quantidade ?? it.qtd)
      : 0,
    unit_price: isFiniteNum(it.unit_price ?? it.valor_unitario ?? it.preco_unitario ?? it.valor)
      ? Number(it.unit_price ?? it.valor_unitario ?? it.preco_unitario ?? it.valor)
      : 0,
    discount_value: isFiniteNum(it.discount_value ?? it.desconto_valor ?? it.desconto ?? it.desc)
      ? Number(it.discount_value ?? it.desconto_valor ?? it.desconto ?? it.desc)
      : 0,

    grade_id: it.grade_id ?? null,

    product_grade_id:
      it.product_grade_id ??
      it.produto_grade_id ??
      it.productGradeId ??
      null,

    product_id:
      it.product_id ??
      it.productId ??
      it.product_code_id ??
      it.productCodeId ??
      it.product_ref ??
      null,

    price_id: it.price_id ?? it.priceId ?? it.tabela_preco_id ?? it.tabelaPrecoId ?? null,
    commission_id: it.commission_id ?? it.commissionId ?? null,

    lot_id: it.lot_id ?? it.lotId ?? it.lote_id ?? it.loteId ?? null,

    override_stock: boolFromAny(it.override_stock ?? it.overrideStock),
    override_token: safeString(it.override_token ?? it.overrideToken, 4000) || null,
  };

  if (!out.sku || !out.description) {
    const e = new Error('Item inválido: required sku + description');
    e.status = 400;
    throw e;
  }

  if (out.product_id != null) {
    const s = String(out.product_id).trim();
    out.product_id = s || null;
  }

  const sanitizeInt = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  out.price_id = sanitizeInt(out.price_id);
  out.commission_id = sanitizeInt(out.commission_id);
  out.grade_id = sanitizeInt(out.grade_id);
  out.lot_id = sanitizeInt(out.lot_id);

  return out;
}

async function resolvePayloadFromRequest(body) {
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  const items = rawItems.map(normalizeItemPayload);

  const rawHeader = {
    issue_date: body?.issue_date ?? body?.header?.issue_date ?? null,
    status: body?.status ?? body?.header?.status ?? null,
    operation_type_id:
      body?.operation_type_id ??
      body?.operationTypeId ??
      body?.budget_operation_type_id ??
      body?.header?.operation_type_id ??
      body?.header?.operationTypeId ??
      body?.header?.budget_operation_type_id ??
      null,
    notes: body?.notes ?? body?.header?.notes ?? null,

    freight_value: normalizeMoney(
      body?.freight_value ??
      body?.header?.freight_value ??
      body?.frete ??
      body?.header?.frete ??
      0,
      0
    ),

    payment_form_id:
      body?.payment_form_id ??
      body?.payment_method_id ??
      body?.header?.payment_form_id ??
      body?.header?.payment_method_id ??
      null,

    payment_term_id:
      body?.payment_term_id ??
      body?.header?.payment_term_id ??
      null,

    customer_id: body?.customer_id ?? body?.header?.customer_id ?? null,

    customer_name: body?.customer_name ?? body?.header?.customer_name ?? null,
    customer_tax_id: body?.customer_tax_id ?? body?.header?.customer_tax_id ?? null,
    customer_email: body?.customer_email ?? body?.header?.customer_email ?? null,
    customer_phone: body?.customer_phone ?? body?.header?.customer_phone ?? null,

    subtotal: normalizeMoney(
      body?.subtotal ??
      body?.header?.subtotal ??
      0,
      0
    ),

    items_discount_total: normalizeMoney(
      body?.items_discount_total ??
      body?.header?.items_discount_total ??
      0,
      0
    ),

    total_discount: normalizeMoney(
      body?.total_discount ??
      body?.header?.total_discount ??
      0,
      0
    ),

    total_amount: normalizeMoney(
      body?.total_amount ??
      body?.header?.total_amount ??
      0,
      0
    ),

    global_discount_type:
      body?.global_discount_type ??
      body?.globalDiscountType ??
      body?.header?.global_discount_type ??
      body?.header?.globalDiscountType ??
      'value',

    global_discount_value: normalizeMoney(
      body?.global_discount_value ??
      body?.globalDiscountValue ??
      body?.header?.global_discount_value ??
      body?.header?.globalDiscountValue ??
      0,
      0
    ),

    global_discount_amount: normalizeMoney(
      body?.global_discount_amount ??
      body?.globalDiscountAmount ??
      body?.header?.global_discount_amount ??
      body?.header?.globalDiscountAmount ??
      0,
      0
    ),
  };

  if (!rawHeader.operation_type_id) {
    rawHeader.operation_type_id = await resolveDefaultOperationTypeId();
  }

  if (!rawHeader.operation_type_id) {
    const error = new Error(
      'Operação fiscal obrigatória. Configure uma operação ativa com o código REVENDA_MG.'
    );
    error.status = 400;
    throw error;
  }

  const needName = !rawHeader.customer_name;
  const needDoc = !rawHeader.customer_tax_id;
  const needEmail = !rawHeader.customer_email;
  const needPhone = !rawHeader.customer_phone;

  if ((needName || needDoc || needEmail || needPhone) && rawHeader.customer_id) {
    const cust = await getCustomerMinimalById(rawHeader.customer_id);

    if (cust) {
      rawHeader.customer_name = rawHeader.customer_name || cust.name || null;
      rawHeader.customer_tax_id = rawHeader.customer_tax_id || cust.tax_id || null;
      rawHeader.customer_email = rawHeader.customer_email || cust.email || null;
      rawHeader.customer_phone = rawHeader.customer_phone || cust.phone || null;
    }
  }

  /*
   * CAMINHO DE ESCRITA: o servidor recalcula todos os valores financeiros a
   * partir dos itens e descarta o que veio no payload (ver
   * deriveBudgetTotals). É isso que dá sentido à trava de
   * max_discount_percent validada em validateBudgetGlobalRules logo depois.
   */
  applyDerivedTotals(rawHeader, items, 'resolvePayloadFromRequest');

  return { header: rawHeader, items };
}

// ======================================================================
// IMAGENS PARA O PDF
// ======================================================================
async function attachImagesToItems(items) {
  if (!Array.isArray(items) || !items.length) return items;

  const skus = [
    ...new Set(
      items
        .map((it) => String(it?.product_code ?? it?.sku ?? it?.codigo ?? '').trim())
        .filter((s) => s !== '')
    ),
  ];

  if (!skus.length) return items;

  const { rows } = await pool.query(
    `
      SELECT
        img.product_image_id,
        img.product_code,
        img.barcode_id,
        img.image_url,
        img.image_path,
        img.image_alt,
        img.is_primary,
        img.position
      FROM public."productsImages" img
      WHERE img.product_code = ANY($1::text[])
        AND img.is_active = TRUE
      ORDER BY
        img.product_code,
        (img.barcode_id IS NULL) DESC,
        img.is_primary DESC,
        img.position ASC NULLS LAST,
        img.product_image_id ASC
    `,
    [skus]
  );

  // Itens de orçamento costumam gravar só unit_code (ex.: "FD.5") sem
  // barcode_id; resolve a unidade em productsBarCode para achar a imagem dela.
  const { rows: unitRows } = await pool.query(
    `
      SELECT product_code, UPPER(TRIM(unit)) AS unit, barcode_id
      FROM public."productsBarCode"
      WHERE product_code = ANY($1::text[])
        AND unit IS NOT NULL
        AND TRIM(unit) <> ''
      ORDER BY product_code, is_active DESC NULLS LAST, barcode_id ASC
    `,
    [skus]
  );

  const barcodeByProductAndUnit = new Map();
  for (const row of unitRows) {
    const key = `${String(row.product_code).trim()}|${row.unit}`;
    if (!barcodeByProductAndUnit.has(key)) barcodeByProductAndUnit.set(key, Number(row.barcode_id));
  }

  const exactByProductAndBarcode = new Map();
  const generalByProduct = new Map();
  const anyByProduct = new Map();

  for (const row of rows) {
    const code = String(row.product_code ?? '').trim();
    if (!code) continue;

    if (!anyByProduct.has(code)) anyByProduct.set(code, row);

    if (row.barcode_id == null) {
      if (!generalByProduct.has(code)) generalByProduct.set(code, row);
      continue;
    }

    const key = `${code}|${String(row.barcode_id)}`;
    if (!exactByProductAndBarcode.has(key)) {
      exactByProductAndBarcode.set(key, row);
    }
  }

  for (const it of items) {
    if (!it) continue;
    if (it.image_url || it.image_path) continue;

    const sku = String(it.product_code ?? it.sku ?? it.codigo ?? '').trim();
    if (!sku) continue;

    it.sku = it.sku || sku;

    const unitCode = String(it.unit_code ?? it.unit ?? '').trim().toUpperCase();
    const itemBarcodeId = Number(
      it.barcode_id ??
      it.barcodeId ??
      (unitCode ? barcodeByProductAndUnit.get(`${sku}|${unitCode}`) : null) ??
      NaN
    );
    const hasBarcodeId = Number.isSafeInteger(itemBarcodeId) && itemBarcodeId > 0;
    const exact = hasBarcodeId
      ? exactByProductAndBarcode.get(`${sku}|${String(itemBarcodeId)}`) || null
      : null;
    const row = exact || generalByProduct.get(sku) || anyByProduct.get(sku) || null;

    if (row) {
      it.image_url = row.image_url || it.image_url || null;
      it.image_path = row.image_path || it.image_path || null;
      it.product_image_id = row.product_image_id;
      it.image_barcode_id = row.barcode_id;
      it.image_source = exact
        ? 'BARCODE_UNIT'
        : row.barcode_id == null
          ? 'PRODUCT_GENERAL'
          : 'PRODUCT_FALLBACK';
    }
  }

  return items;
}

// ======================================================================
// PDF HELPERS
// ======================================================================
async function attachPaymentsToBudget(budget) {
  if (!budget) return budget;

  const budgetId = Number(
    budget.budget_id ??
    budget.id ??
    budget.budgetId ??
    0
  );

  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    return {
      ...budget,
      payments: [],
      payment_installments: [],
    };
  }

  let payments = [];
  let paymentInstallments = [];

  try {
    const rawPayments = await budgetsPaymentsApi.listByBudget(budgetId);
    payments = unwrapListResult(rawPayments);
  } catch (err) {
    console.error('[budgets][attachPaymentsToBudget] erro ao buscar payments:', err);
  }

  try {
    const rawInstallments = await budgetsPaymentInstallmentsApi.listByBudget(budgetId);
    paymentInstallments = unwrapListResult(rawInstallments);
  } catch (err) {
    console.error('[budgets][attachPaymentsToBudget] erro ao buscar installments:', err);
  }

  return {
    ...budget,
    payments,
    payment_installments: paymentInstallments,
  };
}

// ======================================================================
// FUNÇÃO INTERNA: BUSCA ORÇAMENTO NORMALIZADO
// ======================================================================
async function fetchBudgetByIdData(id) {
  const budgetId = Number(id);
  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    const e = new Error('Parâmetro :id inválido');
    e.status = 400;
    throw e;
  }

  const out = await budgetsApi.getById(budgetId);

  if (!out?.ok) {
    const e = new Error(out?.error || 'Erro ao buscar orçamento');
    e.status = out?.error === 'NOT_FOUND' ? 404 : out?.error === 'BAD_REQUEST' ? 400 : 500;
    throw e;
  }

  const rawHeader = out.header ?? {};
  const header = normalizePaymentFields(rawHeader);

  header.freight_value = normalizeMoney(
    header.freight_value ?? rawHeader.freight_value ?? 0,
    0
  );

  header.global_discount_type =
    String(header.global_discount_type || 'value').trim().toLowerCase() === 'percent'
      ? 'percent'
      : 'value';

  header.global_discount_value = Math.max(0, normalizeMoney(header.global_discount_value, 0));
  header.global_discount_amount = Math.max(0, normalizeMoney(header.global_discount_amount, 0));
  header.subtotal = Math.max(0, normalizeMoney(header.subtotal, 0));
  header.items_discount_total = Math.max(0, normalizeMoney(header.items_discount_total, 0));
  header.total_discount = Math.max(0, normalizeMoney(header.total_discount, 0));
  header.total_amount = computeTotalAmount(header);

  if (header.id == null && header.budget_id != null) header.id = header.budget_id;
  if (header.budget_id == null && header.id != null) header.budget_id = header.id;

  const needName = !header.customer_name;
  const needDoc = !header.customer_tax_id;
  const needEmail = !header.customer_email;
  const needPhone = !header.customer_phone;
  const needAddress = !header.street_name && !header.city && !header.state;

  if ((needName || needDoc || needEmail || needPhone || needAddress) && header.customer_id) {
    try {
      const cust = await getCustomerMinimalById(header.customer_id);

      if (cust) {
        header.customer_name = header.customer_name || cust.name || null;
        header.customer_tax_id = header.customer_tax_id || cust.tax_id || null;
        header.customer_email = header.customer_email || cust.email || null;
        header.customer_phone = header.customer_phone || cust.phone || null;

        header.postal_code = header.postal_code || cust.postal_code || null;
        header.street_type = header.street_type || cust.street_type || null;
        header.street_name = header.street_name || cust.street_name || null;
        header.street_number = header.street_number || cust.street_number || null;
        header.address_complement =
          header.address_complement || cust.address_complement || null;
        header.neighborhood = header.neighborhood || cust.neighborhood || null;
        header.city = header.city || cust.city || null;
        header.state = header.state || cust.state || null;
      }
    } catch (err) {
      console.error('[budgets][fetchBudgetByIdData] enrich customer error:', err);
    }
  }

  const items = await attachImagesToItems(out.items ?? []);

  const shipping = out.shipping || null;

  if (shipping) {
    header.freight_value = normalizeMoney(
      shipping.freight_value ?? header.freight_value ?? 0,
      0
    );

    header.freight_mode = Number(shipping.freight_mode ?? 9);
  }

  return {
    ...header,
    shipping,
    items,
  };
}

// ======================================================================
// VALIDA CHAVE DE LIBERAÇÃO DE ESTOQUE
// ======================================================================
export async function validateStockOverride(req, res) {
  setNoCache(res);

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    const settings = await getCurrentBudgetSettings();
    if (settings.out_of_stock_mode !== 'PASSWORD') {
      return res.status(403).json({
        ok: false,
        error: 'A liberação por chave não está ativa nos parâmetros.',
        code: 'STOCK_OVERRIDE_PASSWORD_DISABLED',
      });
    }

    const key = safeString(req.body?.key, 500);
    const reason = safeString(req.body?.reason, 300) || 'Liberação manual de estoque';
    const sku = safeString(req.body?.sku, 100) || null;
    const description = safeString(req.body?.description, 300) || null;

    const requestedQty = isFiniteNum(req.body?.requestedQty) ? Number(req.body.requestedQty) : 0;
    const availableQty = isFiniteNum(req.body?.availableQty) ? Number(req.body.availableQty) : 0;

    const lotId =
      req.body?.lotId != null && String(req.body?.lotId).trim() !== ''
        ? Number(req.body.lotId)
        : null;

    const keyCheck = validateBudgetStockOverrideKey(key);
    if (!keyCheck.ok && keyCheck.error === 'BUDGET_STOCK_OVERRIDE_KEY_NOT_CONFIGURED') {
      return res.status(500).json({
        ok: false,
        error: 'BUDGET_STOCK_OVERRIDE_KEY não configurada no ambiente.',
      });
    }

    if (!keyCheck.ok) {
      return res.status(401).json({
        ok: false,
        error: 'Chave inválida.',
      });
    }

    const ttlMinutes = getStockOverrideTtlMinutes();
    const now = Date.now();

    const issued = issueBudgetStockOverrideToken({
      userId,
      sku,
      description,
      requestedQty,
      availableQty,
      lotId: Number.isFinite(lotId) ? lotId : null,
      reason,
      ttlMinutes,
      now,
    });

    return res.json({
      ok: true,
      token: issued.token,
      message: 'Liberação autorizada.',
      expires_in_minutes: issued.expiresInMinutes,
      expires_at: issued.payload.expires_at,
    });
  } catch (err) {
    console.error('[budgetsController.validateStockOverride] erro:', err);
    return res.status(500).json(errorPayload(err));
  }
}

// ======================================================================
// CONTROLLERS - JSON
// ======================================================================
export async function searchBudgets(req, res) {
  setNoCache(res);

  try {
    const {
      q = '',
      limit = 20,
      offset = 0,
      status,
      date,
      dateFrom,
      dateTo,
      orderBy = 'budget_id',
      orderDirection = 'desc',
    } = req.query;

    let finalDateFrom =
      dateFrom || null;

    let finalDateTo =
      dateTo || null;

    /*
     * Mantém compatibilidade com o filtro antigo,
     * que enviava apenas uma data.
     */
    if (
      !finalDateFrom &&
      !finalDateTo &&
      date
    ) {
      finalDateFrom = date;
      finalDateTo = date;
    }

    const finalStatus =
      status
        ? String(status).toUpperCase()
        : undefined;

    const finalOrderBy =
      String(orderBy || 'budget_id').trim();

    const finalOrderDirection =
      String(orderDirection || 'desc')
        .trim()
        .toLowerCase() === 'asc'
        ? 'asc'
        : 'desc';

    const payload = {
      q: String(q || ''),

      limit:
        Math.max(
          1,
          toInt(limit, 20)
        ),

      offset:
        Math.max(
          0,
          toInt(offset, 0)
        ),

      status:
        finalStatus,

      dateFrom:
        finalDateFrom || undefined,

      dateTo:
        finalDateTo || undefined,

      orderBy:
        finalOrderBy,

      orderDirection:
        finalOrderDirection,
    };

    console.log(
      '[budgets.search] payload=',
      payload
    );

    const out =
      await budgetsApi.search(
        payload
      );

    if (!out?.ok) {
      console.error(
        '[budgets.search] out not ok:',
        out
      );

      const isValidation =
        out?.error === 'BAD_REQUEST' ||
        out?.error === 'VALIDATION' ||
        out?.code === 400 ||
        out?.status === 400;

      return res
        .status(isValidation ? 400 : 500)
        .json(out);
    }

    return res.json(out);
  } catch (err) {
    console.error(
      '[budgetsController.searchBudgets] erro:',
      err
    );

    return res
      .status(500)
      .json(errorPayload(err));
  }
}

export async function listBudgets(req, res) {
  setNoCache(res);

  try {
    const { limit = 20, offset = 0 } = req.query;

    const out = await budgetsApi.list({
      limit: Math.max(1, toInt(limit, 20)),
      offset: Math.max(0, toInt(offset, 0)),
    });

    if (!out?.ok) {
      console.error('[budgets.list] out not ok:', out);
      return res.status(500).json(out);
    }

    return res.json(out);
  } catch (err) {
    console.error('[budgetsController.listBudgets] erro:', err);
    return res.status(500).json(errorPayload(err));
  }
}

export async function getBudgetById(reqOrId, maybeRes) {
  try {
    const isController = typeof reqOrId === 'object' && reqOrId !== null;
    const id = isController ? reqOrId.params?.id : reqOrId;
    const res = isController ? maybeRes : undefined;

    if (res) setNoCache(res);

    const payload = await fetchBudgetByIdData(id);

    if (res) return res.json(payload);
    return payload;
  } catch (err) {
    const status = err?.status || 500;

    if (typeof maybeRes?.status === 'function') {
      return maybeRes.status(status).json({
        ok: false,
        error: err?.message || 'Erro ao buscar orçamento',
      });
    }

    throw err;
  }
}

export async function createBudget(req, res) {
  setNoCache(res);

  try {
    const { header, items } = await resolvePayloadFromRequest(req.body ?? {});
    const userId = getUserIdFromReq(req);

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    await validateBudgetGlobalRules(
      header,
      items,
      getBudgetApiContext(req, userId)
    );

    console.log('[budgets.create] items override snapshot=', buildOverrideSnapshot(items));

    for (const it of items) {
      if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) {
        return res.status(400).json({
          ok: false,
          error: `Quantidade inválida para SKU ${it.sku}.`,
        });
      }

      if (it.override_stock) {
        const chk = validateOverrideForItem(it, userId);

        console.log('[budgets.create][override-check]', {
          sku: it.sku,
          quantity: Number(it.quantity || 0),
          lot_id: it.lot_id ?? null,
          override_stock: !!it.override_stock,
          override_token_present: !!it.override_token,
          chk_ok: chk.ok,
          chk_error: chk.error || null,
          chk_payload: chk.payload || null,
        });

        if (!chk.ok) {
          return res.status(400).json({
            ok: false,
            error: `Override de estoque inválido para SKU ${it.sku}: ${chk.error}`,
          });
        }
      }
    }

    console.log('[budgets.create] normalized header discount=', {
      global_discount_type: header?.global_discount_type,
      global_discount_value: header?.global_discount_value,
      global_discount_amount: header?.global_discount_amount,
      subtotal: header?.subtotal,
      total_discount: header?.total_discount,
      freight_value: header?.freight_value,
      total_amount: header?.total_amount,
    });

    const out = await budgetsApi.create(
      { header, items },
      getBudgetApiContext(req, userId)
    );

    if (!out?.ok) {
      console.error('[budgets.create] out not ok:', out);

      const msg = String(out?.error || '');
      const isValidation =
        out?.error === 'BAD_REQUEST' ||
        out?.error === 'VALIDATION' ||
        out?.code === 400 ||
        out?.status === 400 ||
        msg.includes('Sem estoque') ||
        msg.includes('Override inválido') ||
        msg.includes('Quantidade inválida') ||
        msg.includes('Required');

      return res.status(isValidation ? 400 : 500).json(out);
    }

    return res.status(201).json(out);
  } catch (err) {
    console.error('[budgetsController.createBudget] erro:', err);
    const code = err?.status === 400 ? 400 : 500;
    return res.status(code).json(errorPayload(err));
  }
}

export async function updateBudget(req, res) {
  setNoCache(res);

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    const { header, items } = await resolvePayloadFromRequest(req.body ?? {});

    await validateBudgetGlobalRules(
      header,
      items,
      getBudgetApiContext(req, userId)
    );

    console.log('[budgets.update] items override snapshot=', buildOverrideSnapshot(items));

    for (const it of items) {
      if (!Number.isFinite(Number(it.quantity)) || Number(it.quantity) <= 0) {
        return res.status(400).json({
          ok: false,
          error: `Quantidade inválida para SKU ${it.sku}.`,
        });
      }

      if (it.override_stock) {
        const chk = validateOverrideForItem(it, userId);

        console.log('[budgets.update][override-check]', {
          sku: it.sku,
          quantity: Number(it.quantity || 0),
          lot_id: it.lot_id ?? null,
          override_stock: !!it.override_stock,
          override_token_present: !!it.override_token,
          chk_ok: chk.ok,
          chk_error: chk.error || null,
          chk_payload: chk.payload || null,
        });

        if (!chk.ok) {
          return res.status(400).json({
            ok: false,
            error: `Override de estoque inválido para SKU ${it.sku}: ${chk.error}`,
          });
        }
      }
    }

    console.log('[budgets.update] normalized header discount=', {
      id,
      global_discount_type: header?.global_discount_type,
      global_discount_value: header?.global_discount_value,
      global_discount_amount: header?.global_discount_amount,
      subtotal: header?.subtotal,
      total_discount: header?.total_discount,
      freight_value: header?.freight_value,
      total_amount: header?.total_amount,
    });

    const out = await budgetsApi.update(
      id,
      { header, items },
      getBudgetApiContext(req, userId)
    );

    if (!out?.ok) {
      console.error('[budgets.update] out not ok:', out);

      const msg = String(out?.error || '');
      const code =
        out?.error === 'NOT_FOUND'
          ? 404
          : (
            out?.error === 'BAD_REQUEST' ||
            out?.error === 'VALIDATION' ||
            out?.code === 400 ||
            out?.status === 400 ||
            msg.includes('Sem estoque') ||
            msg.includes('Override inválido') ||
            msg.includes('Quantidade inválida') ||
            msg.includes('Required')
          )
            ? 400
            : 500;

      return res.status(code).json(out);
    }

    return res.json(out);
  } catch (err) {
    console.error('[budgetsController.updateBudget] erro:', err);
    const code = err?.status === 400 ? 400 : 500;
    return res.status(code).json(errorPayload(err));
  }
}

export async function deleteBudget(req, res) {
  setNoCache(res);

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const out = await budgetsApi.remove(id);

    if (!out?.ok) {
      console.error(
        '[budgets.remove] out not ok:',
        out
      );

      let code = 500;

      if (out?.error === 'NOT_FOUND') {
        code = 404;

      } else if (
        out?.error === 'BAD_REQUEST'
      ) {
        code = 400;

      } else if (
        out?.error ===
        'BUDGET_HAS_ACTIVE_ORDER'
      ) {
        code = 409;
      }


      return res
        .status(code)
        .json(out);
    }

    return res.json(out);
  } catch (err) {
    console.error('[budgetsController.deleteBudget] erro:', err);
    return res.status(500).json(errorPayload(err));
  }
}

// ======================================================================
// TRANSFORMAR EM PEDIDO + ENVIAR PARA KANBAN DE SEPARAÇÃO
// ======================================================================
export async function transformBudgetToOrder(req, res) {
  setNoCache(res);

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const out = await ordersApi.createFromBudget(id);

    if (!out?.ok) {
      console.error('[to-order] createFromBudget out not ok:', out);
      const code = out.error === 'NOT_FOUND' ? 404 : 400;
      return res.status(code).json(out);
    }

    try {
      const budgetObj = await fetchBudgetByIdData(id);
      const frete = normalizeMoney(
        budgetObj?.shipping?.freight_value ??
        budgetObj?.freight_value ??
        0,
        0
      );

      if (out?.order_id) {
        await orderDeliveryApi.upsertByOrderId(out.order_id, {
          freight_value: frete,
          freight_mode: Number(
            budgetObj?.shipping?.freight_mode ??
            (frete > 0 ? 0 : 9)
          ),
        });
      }
    } catch (err) {
      console.error('[transformBudgetToOrder][frete]', err);
    }

    let customerId = null;
    let note = null;

    try {
      const budgetObj = await fetchBudgetByIdData(id);
      customerId = budgetObj.customer_id || budgetObj.cliente_id || null;
      note = budgetObj.notes || budgetObj.observacao || budgetObj.obs || null;
    } catch (err) {
      console.error('[transformBudgetToOrder] Erro ao buscar orçamento para Kanban:', err);
    }

    try {
      if (customerId) {
        const separationNumber = out.order_number || out.order_id || null;
        const kanbanNote = note || `Pedido gerado automaticamente a partir do orçamento #${id}`;

        await ordersKanbanApi.createCard({
          customer_id: customerId,
          separation_number: separationNumber,
          note: kanbanNote,
          status: 'Enviado/Recebido',
        });
      } else {
        console.warn('[transformBudgetToOrder] Pedido criado, mas sem customer_id p/ Kanban.');
      }
    } catch (err) {
      console.error('[transformBudgetToOrder] Erro ao criar card no Kanban:', err);
    }

    return res.json({
      ok: true,
      budget_id: out.budget_id,
      order_id: out.order_id,
      order_number: out.order_number,
      message: 'Pedido criado com sucesso, orçamento convertido e enviado para o Kanban de Separação.',
    });
  } catch (err) {
    console.error('[transformBudgetToOrder] error:', err);
    return res.status(500).json(errorPayload(err));
  }
}

// ======================================================================
// OBJETO DO ORÇAMENTO (USADO NO PDF / OUTROS MÓDULOS)
// ======================================================================
export async function getBudgetObjectById(id) {
  try {
    return await fetchBudgetByIdData(id);
  } catch (err) {
    console.error('[budgets][getBudgetObjectById] erro ao buscar orçamento:', err);
    return null;
  }
}

// ======================================================================
// PDF DE ORÇAMENTO
// ======================================================================
function joinCompanyAddress(enterprise = {}) {
  const street = [enterprise.address, enterprise.address_number]
    .filter(Boolean)
    .join(', ');

  const cityState = [enterprise.city, enterprise.state]
    .filter(Boolean)
    .join(' - ');

  return [
    street,
    enterprise.address_complement,
    enterprise.district,
    cityState,
    enterprise.zip_code ? `CEP: ${enterprise.zip_code}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function mapEnterpriseToPdfCompany(enterprise) {
  if (!enterprise) {
    const error = new Error('Nenhuma empresa ativa foi encontrada para gerar o PDF.');
    error.code = 'ACTIVE_ENTERPRISE_NOT_FOUND';
    throw error;
  }

  const name = enterprise.trade_name || enterprise.corporate_name || '';
  const phone = [enterprise.phone, enterprise.whatsapp]
    .filter(Boolean)
    .join(' / ');

  return {
    enterpriseId: enterprise.id,
    name,
    legalName: enterprise.corporate_name || name,
    tradeName: enterprise.trade_name || name,
    cnpj: enterprise.cnpj || '',

    streetName: enterprise.address || '',
    streetNumber: enterprise.address_number || '',
    neighborhood: enterprise.district || '',
    city: enterprise.city || '',
    state: enterprise.state || '',
    postalCode: enterprise.zip_code || '',
    addressLine: joinCompanyAddress(enterprise),

    phone,
    contacts: phone,
    email: enterprise.email || '',
    website: enterprise.website || '',
    site: enterprise.website || '',
    logoPath: enterprise.logo_url || '',
    logoUrl: enterprise.logo_url || '',
    pdfFooter: enterprise.pdf_footer || '',
  };
}

export async function getBudgetPdf(req, res) {
  setNoCache(res);

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'ID de orçamento inválido.' });
  }

  try {
    const baseBudget = await fetchBudgetByIdData(id);

    if (!baseBudget) {
      return res.status(404).json({ ok: false, error: 'Orçamento não encontrado.' });
    }

    const budget = await attachPaymentsToBudget(baseBudget);
    const enterprise = await enterpriseApi.findActive();
    const company = mapEnterpriseToPdfCompany(enterprise);

    const paymentMethodResolver = async (paymentId) => {
      if (!paymentId) return null;

      try {
        const pm = await paymentMethodsApi.getById(paymentId);
        return pm?.name || pm?.description || pm?.payment_method_name || null;
      } catch (err) {
        console.error('[PDF][paymentMethodResolver] erro:', err);
        return null;
      }
    };

    // Content-Type e Content-Disposition ("<número> - <cliente>.pdf") são
    // definidos pelo gerador do template
    await generateBudgetPdf(budget, {
      company,
      output: 'response',
      res,
      paymentMethodResolver,
      debug: false,
    });
  } catch (err) {
    console.error('[PDF] erro:', err);

    if (!res.headersSent) {
      return res.status(500).json({
        ok: false,
        error: 'Erro ao gerar PDF',
      });
    }
  }
}

// ======================================================================
// AUTH CTX
// ======================================================================
function getUserIdFromReq(req) {
  const candidates = [
    req?.user?.user_id,
    req?.user?.id,
    req?.auth?.user_id,
    req?.auth?.id,
    req?.session?.user?.user_id,
    req?.session?.user?.id,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

// ======================================================================
// COPY
// ======================================================================
export async function copyBudget(req, res) {
  setNoCache(res);

  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'ID inválido' });
    }

    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
    }

    // item_ids (optional): products chosen in the copy modal
    const itemIds = Array.isArray(req.body?.item_ids)
      ? req.body.item_ids
      : null;

    const out = await budgetsApi.copyFromBudget(
      id,
      getBudgetApiContext(req, userId),
      { itemIds }
    );

    if (!out?.ok) {
      const code =
        out?.error === 'NOT_FOUND'
          ? 404
          : out?.error === 'BAD_REQUEST'
            ? 400
            : 500;

      return res.status(code).json(out);
    }

    return res.status(201).json({
      ok: true,
      new_budget_id: out.id,
      seller_id: out.seller_id ?? null,
      message: 'Orçamento copiado com sucesso.',
    });
  } catch (err) {
    console.error('[budgetsController.copyBudget] erro:', err);
    return res.status(500).json(errorPayload(err));
  }
}

export async function getStockOverrideStatus(req, res) {
  setNoCache(res);

  try {
    const settings = await getCurrentBudgetSettings();

    return res.json({
      ok: true,
      enabled: settings.out_of_stock_mode === 'PASSWORD',
      out_of_stock_mode: settings.out_of_stock_mode,
      ttl_minutes: getStockOverrideTtlMinutes(),
      requires_auth: settings.out_of_stock_mode === 'PASSWORD',
    });
  } catch (err) {
    console.error('[budgetsController.getStockOverrideStatus] erro:', err);
    return res.status(500).json(errorPayload(err));
  }
}

// ======================================================================
// CUSTOMER STATUS / OBSERVATION
// ======================================================================
export async function getCustomerStatus(req, res) {
  setNoCache(res);

  try {
    const customerId =
      req.params?.customer_id ||
      req.query?.customer_id ||
      null;

    if (!customerId) {
      return res.status(400).json({
        ok: false,
        error: 'customer_id obrigatório.',
      });
    }

    const sql = `
  SELECT
    cs.id,
    cs.customer_id,
    cs.status_type_id,
    cs.note,
    cs.updated_at,
    cs.updated_by
  FROM public."customerStatus" cs
  WHERE cs.customer_id = $1
  LIMIT 1
`;
    const { rows } = await pool.query(sql, [customerId]);

    return res.json({
      ok: true,
      data: rows[0] || null,
    });

  } catch (err) {
    console.error('[budgetsController.getCustomerStatus] erro:', err);

    return res.status(500).json({
      ok: false,
      error: 'Erro ao buscar observação do cliente.',
      details: err.message,
    });
  }
}

// ======================================================================
// VALIDA CHAVE E GERA TOKENS PARA VÁRIOS PRODUTOS
// ======================================================================
export async function validateStockOverrideBatch(req, res) {
  setNoCache(res);

  try {
    const userId = getUserIdFromReq(req);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: 'UNAUTHORIZED',
      });
    }

    const settings = await getCurrentBudgetSettings();
    if (settings.out_of_stock_mode !== 'PASSWORD') {
      return res.status(403).json({
        ok: false,
        error: 'A liberação por chave não está ativa nos parâmetros.',
        code: 'STOCK_OVERRIDE_PASSWORD_DISABLED',
      });
    }

    const key = safeString(req.body?.key, 500);
    const rawItems = Array.isArray(req.body?.items)
      ? req.body.items
      : [];

    if (!key) {
      return res.status(400).json({
        ok: false,
        error: 'Informe a chave de liberação.',
      });
    }

    if (!rawItems.length) {
      return res.status(400).json({
        ok: false,
        error: 'Nenhum produto informado para liberação.',
      });
    }

    const keyCheck = validateBudgetStockOverrideKey(key);

    if (!keyCheck.ok && keyCheck.error === 'BUDGET_STOCK_OVERRIDE_KEY_NOT_CONFIGURED') {
      return res.status(500).json({
        ok: false,
        error: 'BUDGET_STOCK_OVERRIDE_KEY não configurada no ambiente.',
      });
    }

    if (!keyCheck.ok) {
      return res.status(401).json({
        ok: false,
        error: 'Chave inválida.',
      });
    }

    const ttlMinutes = getStockOverrideTtlMinutes();
    const issuedAt = Date.now();
    const overrides = rawItems.map((rawItem, index) => {
      const sku =
        safeString(
          rawItem?.sku ??
          rawItem?.product_code ??
          rawItem?.codigo,
          100
        ) || null;

      const description =
        safeString(
          rawItem?.description ??
          rawItem?.descricao,
          300
        ) || null;

      const requestedQty = isFiniteNum(
        rawItem?.requestedQty ??
        rawItem?.requested_qty ??
        rawItem?.quantity
      )
        ? Number(
          rawItem?.requestedQty ??
          rawItem?.requested_qty ??
          rawItem?.quantity
        )
        : 0;

      const availableQty = isFiniteNum(
        rawItem?.availableQty ??
        rawItem?.available_qty ??
        rawItem?.available
      )
        ? Number(
          rawItem?.availableQty ??
          rawItem?.available_qty ??
          rawItem?.available
        )
        : 0;

      const rawLotId =
        rawItem?.lotId ??
        rawItem?.lot_id ??
        null;

      const lotId =
        rawLotId != null &&
          String(rawLotId).trim() !== '' &&
          Number.isFinite(Number(rawLotId))
          ? Number(rawLotId)
          : null;

      const reason =
        safeString(
          rawItem?.reason,
          300
        ) ||
        (
          lotId == null
            ? 'Produto sem estoque ou lote disponível'
            : 'Lote sem saldo disponível'
        );

      if (!sku) {
        const error = new Error(
          `SKU não informado no item ${index + 1}.`
        );

        error.status = 400;
        throw error;
      }

      if (
        !Number.isFinite(requestedQty) ||
        requestedQty <= 0
      ) {
        const error = new Error(
          `Quantidade inválida para SKU ${sku}.`
        );

        error.status = 400;
        throw error;
      }

      const issued = issueBudgetStockOverrideToken({
        userId,
        sku,
        description,
        requestedQty,
        availableQty,
        lotId,
        reason,
        ttlMinutes,
        now: issuedAt,
      });

      return {
        sku,
        lot_id: lotId,
        requested_qty: requestedQty,
        available_qty: availableQty,

        override_stock: true,
        override_token: issued.token,

        expires_at: issued.payload.expires_at,
      };
    });

    return res.json({
      ok: true,
      message: `${overrides.length} produto(s) autorizado(s).`,

      expires_in_minutes: ttlMinutes,
      overrides,
    });
  } catch (err) {
    console.error(
      '[budgetsController.validateStockOverrideBatch] erro:',
      err
    );

    const status =
      Number.isFinite(Number(err?.status))
        ? Number(err.status)
        : 500;

    return res.status(status).json(
      errorPayload(err)
    );
  }
}
