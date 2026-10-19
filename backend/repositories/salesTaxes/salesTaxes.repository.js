// ╔════════════════════════════════════════════════════════════════════╗
// ║ salesTaxes.repository.js — Impostos sobre vendas (dashboard home)  ║
// ║ Fonte: snapshot fiscal por item gravado na emissão da NF-e         ║
// ║ public."ordersNfeAttemptItems" / public."budgetsNfeAttemptItems"   ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import {
    TB_INVOICES,
    TB_PRODUCTS,
    NFE_EXCLUDED_STATUSES,
} from '../salesAnalytics/salesAnalytics.constants.js';
import { normalizeDateRange } from '../salesAnalytics/salesAnalytics.sanitizers.js';
import { toNumber } from '../salesAnalytics/salesAnalytics.utils.js';
import { findTaxRegimeForDate } from '../taxRegimes/taxRegimes.repository.js';
import { estimateRegimeTaxes } from '../taxRegimes/taxRegimes.estimate.js';


// ======================================================================
// SOURCES
// ======================================================================

const ATTEMPT_SOURCES = Object.freeze([
    {
        key: 'order',
        attempts: 'public."ordersNfeAttempts"',
        items: 'public."ordersNfeAttemptItems"',
        attemptsName: 'ordersNfeAttempts',
        itemsName: 'ordersNfeAttemptItems',
    },
    {
        key: 'budget',
        attempts: 'public."budgetsNfeAttempts"',
        items: 'public."budgetsNfeAttemptItems"',
        attemptsName: 'budgetsNfeAttempts',
        itemsName: 'budgetsNfeAttemptItems',
    },
]);


// ======================================================================
// TAXES
// ======================================================================
//
// informative = shown on the dashboard but NOT added to the total:
// - ICMS-ST retido: already paid earlier in the chain, not a tax on this sale.
// - IBS / CBS: 2026 test phase, highlighted on the NF-e but offset
//   against PIS/COFINS, so adding them would double count.
//
// ======================================================================

export const SALES_TAXES = Object.freeze([
    { key: 'icms', label: 'ICMS', column: 'icms_value', base: 'icms_base' },
    { key: 'icms_st', label: 'ICMS-ST', column: 'icms_st_value', base: 'icms_st_base' },
    { key: 'fcp', label: 'FCP', column: 'fcp_value', base: 'fcp_base' },
    { key: 'fcp_st', label: 'FCP-ST', column: 'fcp_st_value', base: 'fcp_st_base' },
    { key: 'pis', label: 'PIS', column: 'pis_value', base: 'pis_base' },
    { key: 'cofins', label: 'COFINS', column: 'cofins_value', base: 'cofins_base' },
    { key: 'is', label: 'IMPOSTO SELETIVO', column: 'is_value', base: 'is_base' },
    { key: 'icms_st_retained', label: 'ICMS-ST RETIDO ANTERIORMENTE', column: 'icms_st_retained_value', base: 'icms_st_retained_base', informative: true },
    { key: 'ibs', label: 'IBS (INFORMATIVO 2026)', column: 'ibs_total_value', base: 'ibscbs_base', informative: true },
    { key: 'cbs', label: 'CBS (INFORMATIVO 2026)', column: 'cbs_value', base: 'ibscbs_base', informative: true },
]);

const PRODUCT_RANKING_LIMIT = 50;


// ======================================================================
// HELPERS
// ======================================================================

// Returns the attempt sources whose tables exist, with their column sets,
// so a database that hasn't received every fiscal migration still loads.
async function loadExistingSources() {
    const tableNames = ATTEMPT_SOURCES.flatMap((source) => [source.attemptsName, source.itemsName]);

    const { rows } = await pool.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [tableNames]
    );

    const columnsByTable = new Map();

    rows.forEach((row) => {
        if (!columnsByTable.has(row.table_name)) {
            columnsByTable.set(row.table_name, new Set());
        }
        columnsByTable.get(row.table_name).add(row.column_name);
    });

    return ATTEMPT_SOURCES
        .filter((source) =>
            columnsByTable.get(source.attemptsName)?.has('invoice_id') &&
            columnsByTable.get(source.itemsName)?.has('attempt_id')
        )
        .map((source) => ({
            ...source,
            attemptColumns: columnsByTable.get(source.attemptsName),
            itemColumns: columnsByTable.get(source.itemsName),
        }));
}

function columnOr(alias, columns, column, fallback) {
    return columns.has(column) ? `${alias}.${column}` : fallback;
}

// The NF-e attempt snapshot always stores the CST and rates of each item,
// but the *_value columns are only filled by some issuance paths. When a
// value is missing we derive it from the stored base/rate and CST, the same
// way the NF-e computes it. ST values can't be derived (MVA/destination
// rules), so those come only from the stored values.
const ICMS_NO_OWN_TAX_CSTS = "('101','102','103','201','202','203','300','400','500')";
const ICMS_NO_OWN_TAX_CST_SUFFIXES = "('30','40','41','50','60')";
const PIS_COFINS_NO_TAX_CSTS = "('04','05','06','07','08','09')";

function taxValueSql(tax, alias, columns) {
    const col = (column) => columnOr(alias, columns, column, 'NULL');
    const num = (column) => `COALESCE(${col(column)}, 0)::numeric`;
    const cst = (column) => `TRIM(COALESCE(${col(column)}::text, ''))`;
    const net = num('net_total');
    const stored = `NULLIF(${num(tax.column)}, 0)`;

    const icmsBase = `COALESCE(NULLIF(${num('icms_base')}, 0), ${net} * (1 - ${num('icms_base_reduction_pct')} / 100))`;
    const icmsHasOwnTax = `NOT (
        ${cst('icms_cst')} IN ${ICMS_NO_OWN_TAX_CSTS}
        OR (LENGTH(${cst('icms_cst')}) <= 3 AND RIGHT(${cst('icms_cst')}, 2) IN ${ICMS_NO_OWN_TAX_CST_SUFFIXES})
    )`;
    const pisCofins = (prefix) => `CASE
        WHEN RIGHT(${cst(`${prefix}_cst`)}, 2) IN ${PIS_COFINS_NO_TAX_CSTS} THEN 0
        ELSE COALESCE(NULLIF(${num(`${prefix}_base`)}, 0), ${net}) * ${num(`${prefix}_rate`)} / 100
    END`;
    const ibsCbsBase = `COALESCE(NULLIF(${num('ibscbs_base')}, 0), ${net})`;

    const derived = {
        icms: `CASE WHEN ${icmsHasOwnTax} THEN ${icmsBase} * ${num('icms_rate')} / 100 ELSE 0 END`,
        fcp: `CASE WHEN ${icmsHasOwnTax} THEN COALESCE(NULLIF(${num('fcp_base')}, 0), ${icmsBase}) * ${num('fcp_rate')} / 100 ELSE 0 END`,
        pis: pisCofins('pis'),
        cofins: pisCofins('cofins'),
        is: `COALESCE(NULLIF(${num('is_base')}, 0), ${net}) * ${num('is_rate')} / 100`,
        ibs: `${ibsCbsBase} * (${num('ibs_uf_rate')} + ${num('ibs_municipal_rate')}) / 100`,
        cbs: `${ibsCbsBase} * ${num('cbs_rate')} / 100`,
    }[tax.key];

    return derived
        ? `ROUND(COALESCE(${stored}, ${derived}), 2)`
        : num(tax.column);
}

// True when the item carried any tax rate at issuance. Lets the dashboard
// tell "no tax configured" apart from "no invoices".
function hasRateSql(alias, columns) {
    const rates = ['icms_rate', 'fcp_rate', 'pis_rate', 'cofins_rate', 'is_rate', 'ibs_uf_rate', 'ibs_municipal_rate', 'cbs_rate']
        .filter((column) => columns.has(column))
        .map((column) => `COALESCE(${alias}.${column}, 0)`);

    const stored = ['icms_value', 'icms_st_value', 'pis_value', 'cofins_value']
        .filter((column) => columns.has(column))
        .map((column) => `COALESCE(${alias}.${column}, 0)`);

    const parts = [...rates, ...stored];

    return parts.length ? `((${parts.join(' + ')}) > 0)` : 'FALSE';
}

function taxColumnsSql(alias, columns) {
    return SALES_TAXES
        .map((tax) => `${taxValueSql(tax, alias, columns)} AS ${tax.key}_value`)
        .join(',\n                ');
}

// ======================================================================
// MAIN
// ======================================================================

// products.cost_price at the time of the query (no cost snapshot on the
// NF-e items), used for the cost of goods sold of the apuração slide.
async function hasProductCost() {
    const { rows } = await pool.query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'cost_price'
         LIMIT 1`
    );
    return rows.length > 0;
}

export async function loadSalesTaxes({ startDate = '', endDate = '' } = {}) {

    const filters = normalizeDateRange(startDate, endDate);
    const [sources, withCost] = await Promise.all([loadExistingSources(), hasProductCost()]);
    const params = [NFE_EXCLUDED_STATUSES, filters.startDate, filters.endDate];

    const validInvoicesSql = `
        SELECT
            ii.invoice_id,
            NULLIF(TRIM(ii.nfe_key), '') AS nfe_key,
            COALESCE(ii.total_amount, 0)::numeric AS total_amount
        FROM ${TB_INVOICES} ii
        WHERE
            ii.issued_date IS NOT NULL
            AND ii.issued_date >= $2::date
            AND ii.issued_date < ($3::date + INTERVAL '1 day')
            AND ii.cancelled_at IS NULL
            AND UPPER(COALESCE(ii.nfe_status, '')) <> ALL($1::text[])
    `;

    // Without any NF-e attempt table there is no tax snapshot to read.
    if (!sources.length) {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS invoices, COALESCE(SUM(total_amount), 0)::numeric AS revenue
             FROM (${validInvoicesSql}) vi`,
            params
        );

        return buildResponse({
            filters,
            totals: { ...rows[0], covered_invoices: 0, covered_revenue: 0 },
            taxRow: {},
            productRows: [],
            sourcesAvailable: false,
            regimeContext: await loadRegimeContext(filters),
        });
    }

    const attemptsSql = sources.map((source) => `
        SELECT
            '${source.key}'::text AS source,
            a.attempt_id,
            a.invoice_id,
            NULLIF(TRIM(${columnOr('a', source.attemptColumns, 'access_key', 'NULL')}::text), '') AS access_key,
            ${columnOr('a', source.attemptColumns, 'authorized_at', 'NULL')}::timestamptz AS authorized_at
        FROM ${source.attempts} a
    `).join('\n        UNION ALL\n');

    const itemsSql = sources.map((source) => `
        SELECT
            ca.invoice_id,
            ${columnOr('i', source.itemColumns, 'product_code', 'NULL')}::text AS product_code,
            ${columnOr('i', source.itemColumns, 'description', 'NULL')}::text AS description,
            COALESCE(${columnOr('i', source.itemColumns, 'net_total', 'NULL')}, 0)::numeric AS net_total,
            COALESCE(${columnOr('i', source.itemColumns, 'quantity', 'NULL')}, 0)::numeric AS quantity,
            ${hasRateSql('i', source.itemColumns)} AS has_rate,
                ${taxColumnsSql('i', source.itemColumns)}
        FROM chosen_attempts ca
        JOIN ${source.items} i
            ON i.attempt_id = ca.attempt_id
        WHERE ca.source = '${source.key}'
    `).join('\n        UNION ALL\n');

    const baseCte = `
        WITH valid_invoices AS (
            ${validInvoicesSql}
        ),

        attempts AS (
            ${attemptsSql}
        ),

        -- One NF-e attempt per invoice: the authorized one, else the latest.
        chosen_attempts AS (
            SELECT DISTINCT ON (vi.invoice_id)
                vi.invoice_id,
                at.source,
                at.attempt_id
            FROM valid_invoices vi
            JOIN attempts at
                ON at.invoice_id = vi.invoice_id
                OR (at.access_key IS NOT NULL AND at.access_key = vi.nfe_key)
            ORDER BY
                vi.invoice_id,
                (at.authorized_at IS NULL),
                COALESCE(at.invoice_id = vi.invoice_id, FALSE) DESC,
                at.attempt_id DESC
        ),

        tax_items AS (
            ${itemsSql}
        )
    `;

    const totalsSql = `
        ${baseCte}
        SELECT
            (SELECT COUNT(*)::int FROM valid_invoices) AS invoices,
            (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM valid_invoices) AS revenue,
            (SELECT COUNT(DISTINCT invoice_id)::int FROM tax_items) AS covered_invoices,
            (SELECT COUNT(*)::int FROM tax_items) AS items,
            (SELECT COUNT(*)::int FROM tax_items WHERE has_rate) AS items_with_rates,
            (
                SELECT COALESCE(SUM(vi.total_amount), 0)::numeric
                FROM valid_invoices vi
                WHERE vi.invoice_id IN (SELECT invoice_id FROM tax_items)
            ) AS covered_revenue,
            ${withCost ? `(
                SELECT COALESCE(SUM(t.quantity * COALESCE(p.cost_price, 0)), 0)::numeric
                FROM tax_items t
                LEFT JOIN ${TB_PRODUCTS} p ON p.product_code = t.product_code
            )` : '0::numeric'} AS cost_of_goods
    `;

    const byTaxSql = `
        ${baseCte}
        SELECT
            ${SALES_TAXES.map((tax) => `COALESCE(SUM(t.${tax.key}_value), 0)::numeric AS ${tax.key}`).join(',\n            ')}
        FROM tax_items t
    `;

    const byProductSql = `
        ${baseCte},

        product_taxes AS (
            SELECT
                CONCAT_WS(
                    ' - ',
                    NULLIF(TRIM(p.manufacturer_ref), ''),
                    COALESCE(
                        NULLIF(TRIM(t.description), ''),
                        NULLIF(TRIM(t.product_code), ''),
                        'SEM PRODUTO'
                    )
                ) AS label,
                COALESCE(SUM(t.net_total), 0)::numeric AS net_total,
                ${SALES_TAXES
                    .filter((tax) => !tax.informative)
                    .map((tax) => `COALESCE(SUM(t.${tax.key}_value), 0)::numeric AS ${tax.key}`)
                    .join(',\n                ')}
            FROM tax_items t
            LEFT JOIN ${TB_PRODUCTS} p
                ON p.product_code = t.product_code
            GROUP BY
                t.product_code,
                t.description,
                p.manufacturer_ref
        )

        SELECT *
        FROM product_taxes
    `;

    const [totals, byTax, byProduct, regimeContext] = await Promise.all([
        pool.query(totalsSql, params),
        pool.query(byTaxSql, params),
        pool.query(byProductSql, params),
        loadRegimeContext(filters),
    ]);

    return buildResponse({
        filters,
        totals: totals.rows[0] || {},
        taxRow: byTax.rows[0] || {},
        productRows: byProduct.rows,
        sourcesAvailable: true,
        regimeContext,
    });
}


// ======================================================================
// RESPONSE
// ======================================================================

// Regime valid at the end of the period + revenue of the 12 months before
// it (RBT12, used by the Simples Nacional brackets). Failures here must not
// break the dashboard: it then shows only the NF-e taxes.
async function loadRegimeContext(filters) {
    try {
        const regime = await findTaxRegimeForDate(filters.endDate);
        if (!regime) return { regime: null, rbt12: 0 };

        const { rows } = await pool.query(
            `SELECT COALESCE(SUM(COALESCE(ii.total_amount, 0)), 0)::numeric AS rbt12
             FROM ${TB_INVOICES} ii
             WHERE ii.issued_date IS NOT NULL
               AND ii.issued_date >= ($2::date - INTERVAL '12 months')
               AND ii.issued_date < $2::date
               AND ii.cancelled_at IS NULL
               AND UPPER(COALESCE(ii.nfe_status, '')) <> ALL($1::text[])`,
            [NFE_EXCLUDED_STATUSES, filters.startDate]
        );

        return { regime, rbt12: toNumber(rows[0]?.rbt12) };
    } catch (error) {
        console.error('[salesTaxes] Failed to load tax regime:', error);
        return { regime: null, rbt12: 0, error: true };
    }
}

function rankProducts(products) {
    const ranked = products
        .filter((product) => product.value > 0)
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

    const total = ranked.reduce((sum, product) => sum + product.value, 0);
    let accumulated = 0;

    return ranked.slice(0, PRODUCT_RANKING_LIMIT).map((product) => {
        accumulated += product.value;
        const accumulatedPct = total > 0 ? (accumulated / total) * 100 : 0;

        return {
            ...product,
            percentage: total > 0 ? (product.value / total) * 100 : 0,
            accumulated: accumulatedPct,
            class: accumulatedPct <= 80 ? 'A' : accumulatedPct <= 95 ? 'B' : 'C',
        };
    });
}

function buildResponse({ filters, totals, taxRow, productRows, sourcesAvailable, regimeContext = {} }) {

    const totalRevenue = toNumber(totals.revenue);
    const coveredRevenue = toNumber(totals.covered_revenue);

    const estimate = estimateRegimeTaxes(regimeContext.regime, {
        revenue: totalRevenue,
        startDate: filters.startDate,
        endDate: filters.endDate,
        rbt12Computed: regimeContext.rbt12,
        itemPis: toNumber(taxRow.pis),
        itemCofins: toNumber(taxRow.cofins),
    });

    const replaced = new Set(estimate.replacedKeys);

    // NF-e item taxes (over invoices that carry a tax snapshot).
    const itemTaxes = SALES_TAXES.map((tax) => {
        const inDas = replaced.has(tax.key);

        return {
            key: tax.key,
            label: inDas ? `${tax.label} (INCLUÍDO NO DAS)` : tax.label,
            value: toNumber(taxRow[tax.key]),
            informative: Boolean(tax.informative) || inDas,
            base: coveredRevenue,
        };
    });

    // Regime taxes (DAS, IRPJ, CSLL...) are estimated over the whole revenue.
    const regimeTaxes = estimate.taxes.map((tax) => ({
        ...tax,
        informative: false,
        estimated: true,
        base: totalRevenue,
    }));

    const allTaxes = [...itemTaxes, ...regimeTaxes];
    const counted = allTaxes.filter((tax) => !tax.informative);
    const totalTaxes = counted.reduce((sum, tax) => sum + tax.value, 0);

    // Each tax over its own base, so invoices without a tax snapshot
    // don't dilute the NF-e part of the rate.
    const effectiveRate = counted.reduce(
        (sum, tax) => sum + (tax.base > 0 ? (tax.value / tax.base) * 100 : 0),
        0
    );

    const byTax = allTaxes
        .map(({ base, ...tax }) => ({
            ...tax,
            percentage: !tax.informative && totalTaxes > 0 ? (tax.value / totalTaxes) * 100 : 0,
            rateOverRevenue: base > 0 ? (tax.value / base) * 100 : 0,
        }))
        .sort((a, b) => Number(a.informative) - Number(b.informative) || b.value - a.value);

    // Regime taxes are proportional to revenue, so each product carries
    // its share by sales value.
    const regimeRate = totalRevenue > 0
        ? regimeTaxes.reduce((sum, tax) => sum + tax.value, 0) / totalRevenue
        : 0;

    const countedItemKeys = SALES_TAXES
        .filter((tax) => !tax.informative && !replaced.has(tax.key))
        .map((tax) => tax.key);

    const byProduct = rankProducts(productRows.map((row) => {
        const netTotal = toNumber(row.net_total);
        const value = countedItemKeys.reduce((sum, key) => sum + toNumber(row[key]), 0) +
            netTotal * regimeRate;

        return {
            label: String(row.label || 'SEM PRODUTO'),
            value: Math.round(value * 100) / 100,
            netTotal,
            effectiveRate: netTotal > 0 ? (value / netTotal) * 100 : 0,
        };
    }));

    return {
        filters,
        sourcesAvailable,
        regimeContext,
        regime: estimate.regime
            ? { ...estimate.regime, summary: estimate.summary }
            : null,
        summary: {
            totalRevenue,
            coveredRevenue,
            totalTaxes,
            effectiveRate,
            netAfterTaxes: totalRevenue - (totalRevenue * effectiveRate / 100),
            totalInvoices: Number(totals.invoices || 0),
            coveredInvoices: Number(totals.covered_invoices || 0),
            items: Number(totals.items || 0),
            itemsWithRates: Number(totals.items_with_rates || 0),
            costOfGoods: toNumber(totals.cost_of_goods),
        },
        byTax,
        byProduct,
    };
}
