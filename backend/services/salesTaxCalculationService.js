// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: salesTaxCalculationService.js                                  ║
// ║ MODULE: SALES TAX CALCULATION                                        ║
// ║ CONSART ERP                                                          ║
// ║ SERVICE / FISCAL ENGINE                                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';


/* ======================================================================
   TABLES
   ====================================================================== */

const TABLE_ORDERS = 'orders';
const ALIAS_ORDERS = 'o';

const TABLE_ORDER_ITEMS = 'orderItems';
const ALIAS_ORDER_ITEMS = 'oi';

const TABLE_PRODUCTS = 'products';
const ALIAS_PRODUCTS = 'p';

const TABLE_PRODUCTS_FISCAL = 'productsFiscal';
const ALIAS_PRODUCTS_FISCAL = 'pf';

const TABLE_FISCAL_CLASSIFICATION = 'fiscalClassification';
const ALIAS_FISCAL_CLASSIFICATION = 'fc';

const TABLE_FISCAL_PROFILE = 'fiscalProfile';
const ALIAS_FISCAL_PROFILE = 'fp';

const TABLE_TAX_CALC = 'salesTaxCalculations';
const ALIAS_TAX_CALC = 'stc';

const TABLE_TAX_CALC_ITEMS = 'salesTaxCalculationItems';
const ALIAS_TAX_CALC_ITEMS = 'stci';

const TABLE_TAX_RECON = 'salesTaxReconciliation';
const ALIAS_TAX_RECON = 'str';


/* ======================================================================
   HELPERS
   ====================================================================== */

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
}

function pct(value) {
  return toNumber(value, 0) / 100;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getFederalIbptPercent(row) {
  const origem = Number(row.origem_mercadoria);
  const isImported = Number.isFinite(origem) && origem !== 0;

  if (isImported) {
    return firstNumber(row.ibpt_importado, row.ibpt_nacional, 0);
  }

  return firstNumber(row.ibpt_nacional, row.ibpt_importado, 0);
}

function computeAllocatedFreight(orderFreight, itemNetValue, totalNetItems) {
  if (orderFreight <= 0 || itemNetValue <= 0 || totalNetItems <= 0) return 0;
  return round((itemNetValue / totalNetItems) * orderFreight, 2);
}

function computeTaxRates(row) {
  return {
    icmsRate: firstNumber(
      row.aliquota_icms,
      row.icms_rate,
      row.fp_icms_rate,
      0
    ),
    pisRate: firstNumber(
      row.pis_aliquota,
      row.pis_rate,
      row.fp_pis_rate,
      0
    ),
    cofinsRate: firstNumber(
      row.cofins_aliquota,
      row.cofins_rate,
      row.fp_cofins_rate,
      0
    ),
    ipiRate: firstNumber(
      row.ipi_aliquota,
      0
    ),
    fcpRate: firstNumber(
      row.aliquota_fcp,
      0
    ),
    reducaoBc: firstNumber(
      row.reducao_bc,
      0
    )
  };
}

function computeGrossAndNet(row) {
  const quantity = toNumber(row.quantity, 0);
  const unitPrice = toNumber(row.unit_price, 0);
  const discountValue = toNumber(row.discount_value, 0);

  const grossValue = round(quantity * unitPrice, 2);
  const netValue = round(grossValue - discountValue, 2);

  return {
    quantity,
    unitPrice,
    discountValue,
    grossValue,
    netValue
  };
}

function computeItemCalculation(row, orderFreight, totalNetItems) {
  const {
    quantity,
    unitPrice,
    discountValue,
    grossValue,
    netValue
  } = computeGrossAndNet(row);

  const freightAllocated = computeAllocatedFreight(orderFreight, netValue, totalNetItems);

  const {
    icmsRate,
    pisRate,
    cofinsRate,
    ipiRate,
    fcpRate,
    reducaoBc
  } = computeTaxRates(row);

  const icmsBase = round(netValue * (1 - pct(reducaoBc)), 2);
  const icmsValue = round(icmsBase * pct(icmsRate), 2);

  const pisBase = round(netValue, 2);
  const pisValue = round(pisBase * pct(pisRate), 2);

  const cofinsBase = round(netValue, 2);
  const cofinsValue = round(cofinsBase * pct(cofinsRate), 2);

  const ipiBase = round(netValue, 2);
  const ipiValue = round(ipiBase * pct(ipiRate), 2);

  const fcpValue = round(netValue * pct(fcpRate), 2);

  const federalIbpt = getFederalIbptPercent(row);
  const stateIbpt = firstNumber(row.ibpt_estadual, 0);
  const municipalIbpt = firstNumber(row.ibpt_municipal, 0);
  const estimatedTaxPercent = federalIbpt + stateIbpt + municipalIbpt;
  const estimatedTaxBurden = round(netValue * pct(estimatedTaxPercent), 2);

  const costPriceAtSale = firstNumber(row.cost_price_at_sale, row.product_cost_price, 0);
  const costTotal = round(quantity * costPriceAtSale, 2);

  const grossProfitValue = round(
    netValue - costTotal - icmsValue - pisValue - cofinsValue - ipiValue - fcpValue,
    2
  );

  const grossMarginPercent = netValue > 0
    ? round((grossProfitValue / netValue) * 100, 4)
    : 0;

  return {
    quantity,
    unitPrice,
    discountValue,
    grossValue,
    netValue,
    freightAllocated,
    costPriceAtSale,
    costTotal,
    icmsRate,
    icmsBase,
    icmsValue,
    pisRate,
    pisBase,
    pisValue,
    cofinsRate,
    cofinsBase,
    cofinsValue,
    ipiRate,
    ipiBase,
    ipiValue,
    fcpRate,
    fcpValue,
    estimatedTaxBurden,
    grossProfitValue,
    grossMarginPercent
  };
}


/* ======================================================================
   FETCH SOURCE DATA
   ====================================================================== */

export async function fetchOrderFiscalData(orderId, client = pool) {
  const sql = `
    SELECT

      /* ================================================================
         ORDERS
      ================================================================ */

      ${ALIAS_ORDERS}.order_id,
      ${ALIAS_ORDERS}.number,
      ${ALIAS_ORDERS}.issue_date,
      ${ALIAS_ORDERS}.customer_id,
      ${ALIAS_ORDERS}.customer_name,
      ${ALIAS_ORDERS}.freight_value,
      ${ALIAS_ORDERS}.price_id,


      /* ================================================================
         ORDER ITEMS
      ================================================================ */

      ${ALIAS_ORDER_ITEMS}.order_item_id,
      ${ALIAS_ORDER_ITEMS}.sku,
      ${ALIAS_ORDER_ITEMS}.description,
      ${ALIAS_ORDER_ITEMS}.quantity,
      ${ALIAS_ORDER_ITEMS}.unit,
      ${ALIAS_ORDER_ITEMS}.unit_price,
      ${ALIAS_ORDER_ITEMS}.discount_value,
      ${ALIAS_ORDER_ITEMS}.cost_price_at_sale,
      ${ALIAS_ORDER_ITEMS}.price_id AS order_item_price_id,


      /* ================================================================
         PRODUCTS
      ================================================================ */

      ${ALIAS_PRODUCTS}.product_id,
      ${ALIAS_PRODUCTS}.product_code,
      ${ALIAS_PRODUCTS}.description AS product_description,
      ${ALIAS_PRODUCTS}.cost_price AS product_cost_price,
      ${ALIAS_PRODUCTS}.products_fiscal_id,


      /* ================================================================
         PRODUCTS FISCAL
      ================================================================ */

      ${ALIAS_PRODUCTS_FISCAL}.products_fiscal_id AS pf_products_fiscal_id,
      ${ALIAS_PRODUCTS_FISCAL}.fiscal_profile_id,
      ${ALIAS_PRODUCTS_FISCAL}.fiscal_classification_id,

      ${ALIAS_PRODUCTS_FISCAL}.classification_name AS pf_classification_name,
      ${ALIAS_PRODUCTS_FISCAL}.description_class AS pf_description_class,
      ${ALIAS_PRODUCTS_FISCAL}.profile_name AS pf_profile_name,
      ${ALIAS_PRODUCTS_FISCAL}.description_profile AS pf_description_profile,

      ${ALIAS_PRODUCTS_FISCAL}.ncm_code,
      ${ALIAS_PRODUCTS_FISCAL}.ncm_description AS pf_ncm_description,
      ${ALIAS_PRODUCTS_FISCAL}.cest_code,
      ${ALIAS_PRODUCTS_FISCAL}.cest_description AS pf_cest_description,

      ${ALIAS_PRODUCTS_FISCAL}.cfop_exit,
      ${ALIAS_PRODUCTS_FISCAL}.origin_code,

      ${ALIAS_PRODUCTS_FISCAL}.icms_cst,
      ${ALIAS_PRODUCTS_FISCAL}.icms_rate,
      ${ALIAS_PRODUCTS_FISCAL}.aliquota_icms,
      ${ALIAS_PRODUCTS_FISCAL}.reducao_bc,

      ${ALIAS_PRODUCTS_FISCAL}.pis_cst,
      ${ALIAS_PRODUCTS_FISCAL}.pis_rate,
      ${ALIAS_PRODUCTS_FISCAL}.pis_aliquota,

      ${ALIAS_PRODUCTS_FISCAL}.cofins_cst,
      ${ALIAS_PRODUCTS_FISCAL}.cofins_rate,
      ${ALIAS_PRODUCTS_FISCAL}.cofins_aliquota,

      ${ALIAS_PRODUCTS_FISCAL}.ipi_cst,
      ${ALIAS_PRODUCTS_FISCAL}.ipi_aliquota,

      ${ALIAS_PRODUCTS_FISCAL}.aliquota_fcp,

      ${ALIAS_PRODUCTS_FISCAL}.ibpt_nacional,
      ${ALIAS_PRODUCTS_FISCAL}.ibpt_importado,
      ${ALIAS_PRODUCTS_FISCAL}.ibpt_estadual,
      ${ALIAS_PRODUCTS_FISCAL}.ibpt_municipal,

      ${ALIAS_PRODUCTS_FISCAL}.origem_mercadoria,


      /* ================================================================
         FISCAL CLASSIFICATION
      ================================================================ */

      ${ALIAS_FISCAL_CLASSIFICATION}.classification_name,
      ${ALIAS_FISCAL_CLASSIFICATION}.description AS fc_description,
      ${ALIAS_FISCAL_CLASSIFICATION}.ncm_code AS fc_ncm_code,
      ${ALIAS_FISCAL_CLASSIFICATION}.ncm_description,
      ${ALIAS_FISCAL_CLASSIFICATION}.cest_code AS fc_cest_code,
      ${ALIAS_FISCAL_CLASSIFICATION}.cest_description,


      /* ================================================================
         FISCAL PROFILE
      ================================================================ */

      ${ALIAS_FISCAL_PROFILE}.profile_name,
      ${ALIAS_FISCAL_PROFILE}.description_profile,
      ${ALIAS_FISCAL_PROFILE}.description AS fp_description,
      ${ALIAS_FISCAL_PROFILE}.icms_cst AS fp_icms_cst,
      ${ALIAS_FISCAL_PROFILE}.icms_rate AS fp_icms_rate,
      ${ALIAS_FISCAL_PROFILE}.cfop_exit AS fp_cfop_exit,
      ${ALIAS_FISCAL_PROFILE}.origin_code AS fp_origin_code,
      ${ALIAS_FISCAL_PROFILE}.pis_cst AS fp_pis_cst,
      ${ALIAS_FISCAL_PROFILE}.pis_rate AS fp_pis_rate,
      ${ALIAS_FISCAL_PROFILE}.cofins_cst AS fp_cofins_cst,
      ${ALIAS_FISCAL_PROFILE}.cofins_rate AS fp_cofins_rate,
      ${ALIAS_FISCAL_PROFILE}.benefit_code AS fp_benefit_code

    FROM "${TABLE_ORDERS}" ${ALIAS_ORDERS}

    JOIN "${TABLE_ORDER_ITEMS}" ${ALIAS_ORDER_ITEMS}
      ON ${ALIAS_ORDER_ITEMS}.order_id = ${ALIAS_ORDERS}.order_id

      LEFT JOIN "${TABLE_PRODUCTS}" ${ALIAS_PRODUCTS}
      ON TRIM(${ALIAS_PRODUCTS}.product_code) = TRIM(${ALIAS_ORDER_ITEMS}.sku)

      LEFT JOIN "${TABLE_PRODUCTS_FISCAL}" ${ALIAS_PRODUCTS_FISCAL}
      ON ${ALIAS_PRODUCTS_FISCAL}.products_fiscal_id = ${ALIAS_PRODUCTS}.products_fiscal_id
      AND COALESCE(${ALIAS_PRODUCTS_FISCAL}.is_active, true) = true
      AND COALESCE(${ALIAS_PRODUCTS_FISCAL}.is_current, true) = true

      LEFT JOIN "${TABLE_FISCAL_CLASSIFICATION}" ${ALIAS_FISCAL_CLASSIFICATION}
      ON ${ALIAS_FISCAL_CLASSIFICATION}.fiscal_classification_id =
      ${ALIAS_PRODUCTS_FISCAL}.fiscal_classification_id

      LEFT JOIN "${TABLE_FISCAL_PROFILE}" ${ALIAS_FISCAL_PROFILE}
      ON ${ALIAS_FISCAL_PROFILE}.fiscal_profile_id =
      ${ALIAS_PRODUCTS_FISCAL}.fiscal_profile_id

      WHERE ${ALIAS_ORDERS}.order_id = $1
      ORDER BY ${ALIAS_ORDER_ITEMS}.order_item_id ASC
      `;

  const { rows } = await client.query(sql, [orderId]);
  return rows;
}


/* ======================================================================
   CLEAN PREVIOUS CALCULATION
   ====================================================================== */

export async function deletePreviousCalculationByOrder(orderId, client = pool) {
  const findSql = `
    SELECT ${ALIAS_TAX_CALC}.sales_tax_calc_id
    FROM "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
    WHERE ${ALIAS_TAX_CALC}.order_id = $1
    ORDER BY ${ALIAS_TAX_CALC}.sales_tax_calc_id DESC
  `;

  const previous = await client.query(findSql, [orderId]);

  if (!previous.rows.length) {
    return [];
  }

  const ids = previous.rows.map(row => row.sales_tax_calc_id);

  await client.query(
    `DELETE FROM "${TABLE_TAX_CALC}" WHERE order_id = $1`,
    [orderId]
  );

  await client.query(
    `DELETE FROM "${TABLE_TAX_RECON}" WHERE order_id = $1`,
    [orderId]
  );

  return ids;
}


/* ======================================================================
   INSERT HEADER
   ====================================================================== */

export async function insertSalesTaxCalculation(header, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_TAX_CALC}" (
      reference_type,
      reference_id,
      order_id,
      order_number,
      issue_date,
      customer_id,
      customer_name,
      price_id,
      regime_type,
      gross_total,
      discount_total,
      net_total,
      freight_total,
      icms_total,
      pis_total,
      cofins_total,
      ipi_total,
      fcp_total,
      tax_burden_total,
      cost_total,
      gross_profit_total,
      margin_percent,
      status,
      notes
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,$16,$17,$18,
      $19,$20,$21,$22,$23,$24
    )
    RETURNING sales_tax_calc_id
  `;

  const params = [
    'ORDER',
    header.order_id,
    header.order_id,
    header.order_number,
    header.issue_date,
    header.customer_id,
    header.customer_name,
    header.price_id,
    'LUCRO_REAL',
    header.gross_total,
    header.discount_total,
    header.net_total,
    header.freight_total,
    header.icms_total,
    header.pis_total,
    header.cofins_total,
    header.ipi_total,
    header.fcp_total,
    header.tax_burden_total,
    header.cost_total,
    header.gross_profit_total,
    header.margin_percent,
    'CALCULATED',
    header.notes || null
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}


/* ======================================================================
   INSERT ITEM
   ====================================================================== */

export async function insertSalesTaxCalculationItem(item, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_TAX_CALC_ITEMS}" (
      sales_tax_calc_id,
      order_id,
      order_item_id,
      sku,
      description,
      quantity,
      unit,
      unit_price,
      gross_value,
      discount_value,
      net_value,
      freight_allocated,
      cost_price_at_sale,
      cost_total,
      products_fiscal_id,
      fiscal_profile_id,
      fiscal_classification_id,
      ncm_code,
      cest_code,
      cfop_exit,
      origin_code,
      icms_cst,
      icms_rate,
      icms_base,
      icms_value,
      pis_cst,
      pis_rate,
      pis_base,
      pis_value,
      cofins_cst,
      cofins_rate,
      cofins_base,
      cofins_value,
      ipi_cst,
      ipi_rate,
      ipi_base,
      ipi_value,
      fcp_rate,
      fcp_value,
      ibpt_nacional,
      ibpt_importado,
      ibpt_estadual,
      ibpt_municipal,
      estimated_tax_burden,
      gross_profit_value,
      gross_margin_percent
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
      $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,
      $37,$38,$39,$40,$41,$42,$43,$44,$45,$46
    )
    RETURNING sales_tax_calc_item_id
  `;

  const params = [
    item.sales_tax_calc_id,
    item.order_id,
    item.order_item_id,
    item.sku,
    item.description,
    item.quantity,
    item.unit,
    item.unit_price,
    item.gross_value,
    item.discount_value,
    item.net_value,
    item.freight_allocated,
    item.cost_price_at_sale,
    item.cost_total,
    item.products_fiscal_id,
    item.fiscal_profile_id,
    item.fiscal_classification_id,
    item.ncm_code,
    item.cest_code,
    item.cfop_exit,
    item.origin_code,
    item.icms_cst,
    item.icms_rate,
    item.icms_base,
    item.icms_value,
    item.pis_cst,
    item.pis_rate,
    item.pis_base,
    item.pis_value,
    item.cofins_cst,
    item.cofins_rate,
    item.cofins_base,
    item.cofins_value,
    item.ipi_cst,
    item.ipi_rate,
    item.ipi_base,
    item.ipi_value,
    item.fcp_rate,
    item.fcp_value,
    item.ibpt_nacional,
    item.ibpt_importado,
    item.ibpt_estadual,
    item.ibpt_municipal,
    item.estimated_tax_burden,
    item.gross_profit_value,
    item.gross_margin_percent
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}


/* ======================================================================
   INSERT RECONCILIATION
   ====================================================================== */

export async function insertSalesTaxReconciliation(data, client = pool) {
  const sql = `
    INSERT INTO "${TABLE_TAX_RECON}" (
      reference_type,
      reference_id,
      order_id,
      order_item_id,
      sku,
      divergence_type,
      expected_value,
      actual_value,
      difference_value,
      details,
      status
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING reconciliation_id
  `;

  const params = [
    'ORDER',
    data.reference_id,
    data.order_id,
    data.order_item_id || null,
    data.sku || null,
    data.divergence_type,
    data.expected_value ?? null,
    data.actual_value ?? null,
    data.difference_value ?? null,
    data.details || null,
    data.status || 'OPEN'
  ];

  const { rows } = await client.query(sql, params);
  return rows[0];
}


/* ======================================================================
   BUILD RECONCILIATION ALERTS
   ====================================================================== */

function buildItemReconciliationAlerts(row, calc) {
  const alerts = [];

  if (!row.product_id) {
    alerts.push({
      divergence_type: 'PRODUCT_NOT_FOUND',
      details: `SKU ${row.sku} was not found in products table.`
    });
  }

  if (!row.products_fiscal_id && !row.pf_products_fiscal_id) {
    alerts.push({
      divergence_type: 'MISSING_PRODUCT_FISCAL',
      details: `SKU ${row.sku} has no productsFiscal linked.`
    });
  }

  if (!firstNonEmptyString(row.ncm_code, row.fc_ncm_code)) {
    alerts.push({
      divergence_type: 'MISSING_NCM',
      details: `SKU ${row.sku} has no NCM defined.`
    });
  }

  if (!firstNonEmptyString(row.cest_code, row.fc_cest_code)) {
    alerts.push({
      divergence_type: 'MISSING_CEST',
      details: `SKU ${row.sku} has no CEST defined.`
    });
  }

  if (!firstNonEmptyString(row.icms_cst, row.fp_icms_cst)) {
    alerts.push({
      divergence_type: 'MISSING_ICMS_CST',
      details: `SKU ${row.sku} has no ICMS CST defined.`
    });
  }

  if (!firstNonEmptyString(row.pis_cst, row.fp_pis_cst)) {
    alerts.push({
      divergence_type: 'MISSING_PIS_CST',
      details: `SKU ${row.sku} has no PIS CST defined.`
    });
  }

  if (!firstNonEmptyString(row.cofins_cst, row.fp_cofins_cst)) {
    alerts.push({
      divergence_type: 'MISSING_COFINS_CST',
      details: `SKU ${row.sku} has no COFINS CST defined.`
    });
  }

  if (calc.costPriceAtSale <= 0) {
    alerts.push({
      divergence_type: 'MISSING_COST',
      expected_value: null,
      actual_value: calc.costPriceAtSale,
      difference_value: null,
      details: `SKU ${row.sku} has zero or null cost at sale.`
    });
  }

  return alerts;
}


/* ======================================================================
   MAIN CALCULATION
   ====================================================================== */

export async function calculateOrderSalesTaxes(orderId) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const rows = await fetchOrderFiscalData(orderId, client);

    if (!rows.length) {
      throw new Error(`Order ${orderId} not found.`);
    }

    await deletePreviousCalculationByOrder(orderId, client);

    const orderFreight = toNumber(rows[0].freight_value, 0);

    let totalNetItems = 0;

    for (const row of rows) {
      const { netValue } = computeGrossAndNet(row);
      totalNetItems += netValue;
    }

    totalNetItems = round(totalNetItems, 2);

    const items = [];
    const reconciliations = [];

    let grossTotal = 0;
    let discountTotal = 0;
    let netTotal = 0;
    let icmsTotal = 0;
    let pisTotal = 0;
    let cofinsTotal = 0;
    let ipiTotal = 0;
    let fcpTotal = 0;
    let taxBurdenTotal = 0;
    let costTotal = 0;
    let grossProfitTotal = 0;

    for (const row of rows) {
      const calc = computeItemCalculation(row, orderFreight, totalNetItems);

      grossTotal += calc.grossValue;
      discountTotal += calc.discountValue;
      netTotal += calc.netValue;

      icmsTotal += calc.icmsValue;
      pisTotal += calc.pisValue;
      cofinsTotal += calc.cofinsValue;
      ipiTotal += calc.ipiValue;
      fcpTotal += calc.fcpValue;

      /* ================================================================
         CARGA TRIBUTÁRIA = SOMA DOS TRIBUTOS DIRETOS DO ITEM
      ================================================================ */
      const totalDirectTaxes =
        calc.icmsValue +
        calc.pisValue +
        calc.cofinsValue +
        calc.ipiValue +
        calc.fcpValue;

      taxBurdenTotal += totalDirectTaxes;

      costTotal += calc.costTotal;
      grossProfitTotal += calc.grossProfitValue;

      items.push({
        order_id: row.order_id,
        order_item_id: row.order_item_id,
        sku: row.sku,
        description: firstNonEmptyString(row.description, row.product_description),
        quantity: calc.quantity,
        unit: row.unit,
        unit_price: calc.unitPrice,
        gross_value: calc.grossValue,
        discount_value: calc.discountValue,
        net_value: calc.netValue,
        freight_allocated: calc.freightAllocated,
        cost_price_at_sale: calc.costPriceAtSale,
        cost_total: calc.costTotal,

        products_fiscal_id: row.pf_products_fiscal_id || row.products_fiscal_id || null,
        fiscal_profile_id: row.fiscal_profile_id || null,
        fiscal_classification_id: row.fiscal_classification_id || null,

        ncm_code: firstNonEmptyString(row.ncm_code, row.fc_ncm_code),
        cest_code: firstNonEmptyString(row.cest_code, row.fc_cest_code),
        cfop_exit: firstNonEmptyString(row.cfop_exit, row.fp_cfop_exit),
        origin_code: firstNonEmptyString(row.origin_code, row.fp_origin_code),

        icms_cst: firstNonEmptyString(row.icms_cst, row.fp_icms_cst),
        icms_rate: calc.icmsRate,
        icms_base: calc.icmsBase,
        icms_value: calc.icmsValue,

        pis_cst: firstNonEmptyString(row.pis_cst, row.fp_pis_cst),
        pis_rate: calc.pisRate,
        pis_base: calc.pisBase,
        pis_value: calc.pisValue,

        cofins_cst: firstNonEmptyString(row.cofins_cst, row.fp_cofins_cst),
        cofins_rate: calc.cofinsRate,
        cofins_base: calc.cofinsBase,
        cofins_value: calc.cofinsValue,

        ipi_cst: firstNonEmptyString(row.ipi_cst),
        ipi_rate: calc.ipiRate,
        ipi_base: calc.ipiBase,
        ipi_value: calc.ipiValue,

        fcp_rate: calc.fcpRate,
        fcp_value: calc.fcpValue,

        ibpt_nacional: row.ibpt_nacional,
        ibpt_importado: row.ibpt_importado,
        ibpt_estadual: row.ibpt_estadual,
        ibpt_municipal: row.ibpt_municipal,

        estimated_tax_burden: calc.estimatedTaxBurden,
        gross_profit_value: calc.grossProfitValue,
        gross_margin_percent: calc.grossMarginPercent
      });

      const itemAlerts = buildItemReconciliationAlerts(row, calc);

      for (const alert of itemAlerts) {
        reconciliations.push({
          reference_id: row.order_id,
          order_id: row.order_id,
          order_item_id: row.order_item_id,
          sku: row.sku,
          divergence_type: alert.divergence_type,
          expected_value: alert.expected_value ?? null,
          actual_value: alert.actual_value ?? null,
          difference_value: alert.difference_value ?? null,
          details: alert.details,
          status: 'OPEN'
        });
      }
    }

    grossTotal = round(grossTotal, 2);
    discountTotal = round(discountTotal, 2);
    netTotal = round(netTotal, 2);
    icmsTotal = round(icmsTotal, 2);
    pisTotal = round(pisTotal, 2);
    cofinsTotal = round(cofinsTotal, 2);
    ipiTotal = round(ipiTotal, 2);
    fcpTotal = round(fcpTotal, 2);
    taxBurdenTotal = round(taxBurdenTotal, 2);
    costTotal = round(costTotal, 2);
    grossProfitTotal = round(grossProfitTotal, 2);

    const marginPercent = netTotal > 0
      ? round((grossProfitTotal / netTotal) * 100, 4)
      : 0;

    const header = rows[0];

    const insertedHeader = await insertSalesTaxCalculation({
      order_id: header.order_id,
      order_number: header.number,
      issue_date: header.issue_date,
      customer_id: header.customer_id,
      customer_name: header.customer_name,
      price_id: header.price_id || null,
      gross_total: grossTotal,
      discount_total: discountTotal,
      net_total: netTotal,
      freight_total: orderFreight,
      icms_total: icmsTotal,
      pis_total: pisTotal,
      cofins_total: cofinsTotal,
      ipi_total: ipiTotal,
      fcp_total: fcpTotal,
      tax_burden_total: taxBurdenTotal,
      cost_total: costTotal,
      gross_profit_total: grossProfitTotal,
      margin_percent: marginPercent,
      notes: null
    }, client);

    const salesTaxCalcId = insertedHeader.sales_tax_calc_id;

    for (const item of items) {
      await insertSalesTaxCalculationItem({
        ...item,
        sales_tax_calc_id: salesTaxCalcId
      }, client);
    }

    for (const rec of reconciliations) {
      await insertSalesTaxReconciliation(rec, client);
    }

    await client.query('COMMIT');

    return {
      success: true,
      sales_tax_calc_id: salesTaxCalcId,
      header: {
        order_id: header.order_id,
        order_number: header.number,
        issue_date: header.issue_date,
        customer_id: header.customer_id,
        customer_name: header.customer_name,
        gross_total: grossTotal,
        discount_total: discountTotal,
        net_total: netTotal,
        freight_total: orderFreight,
        icms_total: icmsTotal,
        pis_total: pisTotal,
        cofins_total: cofinsTotal,
        ipi_total: ipiTotal,
        fcp_total: fcpTotal,
        tax_burden_total: taxBurdenTotal,
        cost_total: costTotal,
        gross_profit_total: grossProfitTotal,
        margin_percent: marginPercent
      },
      items_count: items.length,
      reconciliation_count: reconciliations.length
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


/* ======================================================================
   LIST CALCULATIONS
   ====================================================================== */

export async function listSalesTaxCalculations(filters = {}, client = pool) {
  const TABLE_TAX_CALC = 'salesTaxCalculations';
  const ALIAS_TAX_CALC = 'stc';

  const where = [];
  const params = [];
  let idx = 1;

  if (filters.date_from) {
    where.push(`${ALIAS_TAX_CALC}.issue_date >= $${idx++}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    where.push(`${ALIAS_TAX_CALC}.issue_date <= $${idx++}`);
    params.push(filters.date_to);
  }

  const safeLimit = Math.max(1, Math.min(Number(filters.limit) || 100, 500));
  params.push(safeLimit);

  const sql = `
    SELECT
      ${ALIAS_TAX_CALC}.sales_tax_calc_id,
      ${ALIAS_TAX_CALC}.order_id,
      ${ALIAS_TAX_CALC}.order_number,
      ${ALIAS_TAX_CALC}.issue_date,
      ${ALIAS_TAX_CALC}.customer_id,
      ${ALIAS_TAX_CALC}.customer_name,
      ${ALIAS_TAX_CALC}.gross_total,
      ${ALIAS_TAX_CALC}.discount_total,
      ${ALIAS_TAX_CALC}.net_total,
      ${ALIAS_TAX_CALC}.icms_total,
      ${ALIAS_TAX_CALC}.pis_total,
      ${ALIAS_TAX_CALC}.cofins_total,
      ${ALIAS_TAX_CALC}.ipi_total,
      ${ALIAS_TAX_CALC}.fcp_total,
      ${ALIAS_TAX_CALC}.tax_burden_total,
      ${ALIAS_TAX_CALC}.cost_total,
      ${ALIAS_TAX_CALC}.gross_profit_total,
      ${ALIAS_TAX_CALC}.margin_percent,
      ${ALIAS_TAX_CALC}.status,
      ${ALIAS_TAX_CALC}.created_at
    FROM "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${ALIAS_TAX_CALC}.issue_date DESC, ${ALIAS_TAX_CALC}.created_at DESC
    LIMIT $${idx}
  `;

  const { rows } = await client.query(sql, params);
  return rows;
}


/* ======================================================================
   GET CALCULATION BY ID
   ====================================================================== */

export async function getSalesTaxCalculationById(id, client = pool) {
  const headerSql = `
    SELECT *
    FROM "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
    WHERE ${ALIAS_TAX_CALC}.sales_tax_calc_id = $1
  `;

  const itemsSql = `
    SELECT *
    FROM "${TABLE_TAX_CALC_ITEMS}" ${ALIAS_TAX_CALC_ITEMS}
    WHERE ${ALIAS_TAX_CALC_ITEMS}.sales_tax_calc_id = $1
    ORDER BY ${ALIAS_TAX_CALC_ITEMS}.sales_tax_calc_item_id ASC
  `;

  const reconSql = `
    SELECT *
    FROM "${TABLE_TAX_RECON}" ${ALIAS_TAX_RECON}
    WHERE ${ALIAS_TAX_RECON}.reference_id = (
      SELECT ${ALIAS_TAX_CALC}.order_id
      FROM "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
      WHERE ${ALIAS_TAX_CALC}.sales_tax_calc_id = $1
    )
    ORDER BY ${ALIAS_TAX_RECON}.reconciliation_id ASC
  `;

  const headerResult = await client.query(headerSql, [id]);

  if (!headerResult.rows.length) {
    return null;
  }

  const itemsResult = await client.query(itemsSql, [id]);
  const reconResult = await client.query(reconSql, [id]);

  return {
    header: headerResult.rows[0],
    items: itemsResult.rows,
    reconciliation: reconResult.rows
  };
}


/* ======================================================================
   LIST RECONCILIATION
   ====================================================================== */

export async function listSalesTaxReconciliation(filters = {}, client = pool) {
  const where = [];
  const params = [];
  let idx = 1;

  if (filters.order_id) {
    where.push(`${ALIAS_TAX_RECON}.order_id = $${idx++}`);
    params.push(filters.order_id);
  }

  if (filters.status) {
    where.push(`${ALIAS_TAX_RECON}.status = $${idx++}`);
    params.push(filters.status);
  }

  if (filters.divergence_type) {
    where.push(`${ALIAS_TAX_RECON}.divergence_type = $${idx++}`);
    params.push(filters.divergence_type);
  }

  const sql = `
    SELECT
      ${ALIAS_TAX_RECON}.reconciliation_id,
      ${ALIAS_TAX_RECON}.reference_type,
      ${ALIAS_TAX_RECON}.reference_id,
      ${ALIAS_TAX_RECON}.order_id,
      ${ALIAS_TAX_RECON}.order_item_id,
      ${ALIAS_TAX_RECON}.sku,
      ${ALIAS_TAX_RECON}.divergence_type,
      ${ALIAS_TAX_RECON}.expected_value,
      ${ALIAS_TAX_RECON}.actual_value,
      ${ALIAS_TAX_RECON}.difference_value,
      ${ALIAS_TAX_RECON}.details,
      ${ALIAS_TAX_RECON}.status,
      ${ALIAS_TAX_RECON}.created_at,
      ${ALIAS_TAX_RECON}.resolved_at
    FROM "${TABLE_TAX_RECON}" ${ALIAS_TAX_RECON}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${ALIAS_TAX_RECON}.created_at DESC, ${ALIAS_TAX_RECON}.reconciliation_id DESC
  `;

  const { rows } = await client.query(sql, params);
  return rows;
}


/* ======================================================================
   RESOLVE RECONCILIATION
   ====================================================================== */

export async function resolveSalesTaxReconciliation(reconciliationId, client = pool) {
  const sql = `
    UPDATE "${TABLE_TAX_RECON}"
    SET
      status = 'RESOLVED',
      resolved_at = now()
    WHERE reconciliation_id = $1
    RETURNING *
  `;

  const { rows } = await client.query(sql, [reconciliationId]);
  return rows[0] || null;
}

/* ======================================================================
   LIST ORDER IDS BY PERIOD
   ====================================================================== */

export async function listOrderIdsByPeriod(dateFrom, dateTo, client = pool) {
  const TABLE_ORDERS = 'orders';
  const ALIAS_ORDERS = 'o';

  const sql = `
    SELECT
      ${ALIAS_ORDERS}.order_id
    FROM "${TABLE_ORDERS}" ${ALIAS_ORDERS}
    WHERE ${ALIAS_ORDERS}.issue_date BETWEEN $1 AND $2
    ORDER BY ${ALIAS_ORDERS}.issue_date ASC, ${ALIAS_ORDERS}.order_id ASC
  `;

  const { rows } = await client.query(sql, [dateFrom, dateTo]);
  return rows.map(row => row.order_id);
}

/* ======================================================================
   CALCULATE SALES TAXES BY PERIOD
   ====================================================================== */

export async function calculateSalesTaxesByPeriod(dateFrom, dateTo) {
  const orderIds = await listOrderIdsByPeriod(dateFrom, dateTo);

  if (!orderIds.length) {
    return {
      date_from: dateFrom,
      date_to: dateTo,
      orders_found: 0,
      calculated_count: 0,
      calculation_ids: []
    };
  }

  const calculationIds = [];

  for (const orderId of orderIds) {
    const result = await calculateOrderSalesTaxes(orderId);
    if (result?.sales_tax_calc_id) {
      calculationIds.push(result.sales_tax_calc_id);
    }
  }

  return {
    date_from: dateFrom,
    date_to: dateTo,
    orders_found: orderIds.length,
    calculated_count: calculationIds.length,
    calculation_ids: calculationIds
  };
}

/* ======================================================================
   PERIOD SUMMARY
   ====================================================================== */

export async function getSalesTaxPeriodSummary(dateFrom, dateTo, client = pool) {
  const TABLE_TAX_CALC = 'salesTaxCalculations';
  const ALIAS_TAX_CALC = 'stc';

  const TABLE_TAX_CALC_ITEMS = 'salesTaxCalculationItems';
  const ALIAS_TAX_CALC_ITEMS = 'stci';

  const TABLE_TAX_RECON = 'salesTaxReconciliation';
  const ALIAS_TAX_RECON = 'str';

  const summarySql = `
    SELECT
      COUNT(${ALIAS_TAX_CALC}.sales_tax_calc_id)                      AS calculations_count,
      COALESCE(SUM(${ALIAS_TAX_CALC}.gross_total), 0)                AS gross_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.discount_total), 0)             AS discount_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.net_total), 0)                  AS net_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.freight_total), 0)              AS freight_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.icms_total), 0)                 AS icms_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.pis_total), 0)                  AS pis_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.cofins_total), 0)               AS cofins_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.ipi_total), 0)                  AS ipi_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.fcp_total), 0)                  AS fcp_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.tax_burden_total), 0)           AS tax_burden_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.cost_total), 0)                 AS cost_total,
      COALESCE(SUM(${ALIAS_TAX_CALC}.gross_profit_total), 0)         AS gross_profit_total,
      CASE
        WHEN COALESCE(SUM(${ALIAS_TAX_CALC}.net_total), 0) > 0
          THEN ROUND(
            (COALESCE(SUM(${ALIAS_TAX_CALC}.gross_profit_total), 0)
            / COALESCE(SUM(${ALIAS_TAX_CALC}.net_total), 0)) * 100
          , 4)
        ELSE 0
      END AS margin_percent
    FROM "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
    WHERE ${ALIAS_TAX_CALC}.issue_date BETWEEN $1 AND $2
  `;

  const calculationsSql = `
    SELECT
      ${ALIAS_TAX_CALC}.sales_tax_calc_id,
      ${ALIAS_TAX_CALC}.order_id,
      ${ALIAS_TAX_CALC}.order_number,
      ${ALIAS_TAX_CALC}.issue_date,
      ${ALIAS_TAX_CALC}.customer_name,
      ${ALIAS_TAX_CALC}.net_total,
      ${ALIAS_TAX_CALC}.tax_burden_total,
      ${ALIAS_TAX_CALC}.gross_profit_total,
      ${ALIAS_TAX_CALC}.margin_percent,
      ${ALIAS_TAX_CALC}.created_at
    FROM "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
    WHERE ${ALIAS_TAX_CALC}.issue_date BETWEEN $1 AND $2
    ORDER BY ${ALIAS_TAX_CALC}.issue_date DESC, ${ALIAS_TAX_CALC}.sales_tax_calc_id DESC
  `;

  const itemsSql = `
    SELECT
      ${ALIAS_TAX_CALC_ITEMS}.*
    FROM "${TABLE_TAX_CALC_ITEMS}" ${ALIAS_TAX_CALC_ITEMS}
    JOIN "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
      ON ${ALIAS_TAX_CALC}.sales_tax_calc_id = ${ALIAS_TAX_CALC_ITEMS}.sales_tax_calc_id
    WHERE ${ALIAS_TAX_CALC}.issue_date BETWEEN $1 AND $2
    ORDER BY ${ALIAS_TAX_CALC}.issue_date DESC, ${ALIAS_TAX_CALC_ITEMS}.sales_tax_calc_item_id ASC
  `;

  const reconciliationSql = `
    SELECT
      ${ALIAS_TAX_RECON}.*
    FROM "${TABLE_TAX_RECON}" ${ALIAS_TAX_RECON}
    JOIN "${TABLE_TAX_CALC}" ${ALIAS_TAX_CALC}
      ON ${ALIAS_TAX_CALC}.order_id = ${ALIAS_TAX_RECON}.order_id
    WHERE ${ALIAS_TAX_CALC}.issue_date BETWEEN $1 AND $2
    ORDER BY ${ALIAS_TAX_RECON}.created_at DESC, ${ALIAS_TAX_RECON}.reconciliation_id DESC
  `;

  const [summaryResult, calculationsResult, itemsResult, reconciliationResult] =
    await Promise.all([
      client.query(summarySql, [dateFrom, dateTo]),
      client.query(calculationsSql, [dateFrom, dateTo]),
      client.query(itemsSql, [dateFrom, dateTo]),
      client.query(reconciliationSql, [dateFrom, dateTo])
    ]);

  return {
    date_from: dateFrom,
    date_to: dateTo,
    summary: summaryResult.rows[0] || {},
    calculations: calculationsResult.rows || [],
    items: itemsResult.rows || [],
    reconciliation: reconciliationResult.rows || []
  };
}