// ╔════════════════════════════════════════════════════════════════════╗
// ║ taxAssessment.repository.js — Apuração: débito × crédito           ║
// ║ CONSART ERP                                                        ║
// ║                                                                    ║
// ║ Débitos  = impostos das vendas (snapshot da NF-e de saída)         ║
// ║ Créditos = notas de entrada (inboundInvoiceItems), despesas que    ║
// ║            geram crédito (expenseEntries.generatestaxcredit) e     ║
// ║            saídas do Caixa na subcategoria C.M.V (Lucro Real)      ║
// ║ IRPJ/CSLL = Presumido pelo regime; Real pelo lucro estimado        ║
// ║            (receita − saídas do caixa marcadas "Dedutível no       ║
// ║            IRPJ/CSLL", na movimentação ou na subcategoria)         ║
// ║                                                                    ║
// ║ Estimativa gerencial: não substitui a apuração do contador.        ║
// ╚════════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { loadSalesTaxes } from '../salesTaxes/salesTaxes.repository.js';
import { monthsInRange } from '../taxRegimes/taxRegimes.estimate.js';


const IN_DAS = 'Recolhido dentro do DAS';
const CANCELED_STATUSES = ['CANCELED', 'CANCELLED', 'CANCELADA', 'CANCELADO'];

function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function num(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function pct(value) {
    return num(value) / 100;
}


// ======================================================================
// SCHEMA CHECKS
// ======================================================================

async function loadColumns(tables) {
    const { rows } = await pool.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
        [tables]
    );

    const map = new Map(tables.map((table) => [table, new Set()]));
    rows.forEach((row) => map.get(row.table_name)?.add(row.column_name));
    return map;
}

function sumCol(alias, columns, column) {
    return columns.has(column)
        ? `COALESCE(SUM(COALESCE(${alias}.${column}, 0)), 0)::numeric`
        : '0::numeric';
}


// ======================================================================
// PURCHASES (NOTAS DE ENTRADA)
// ======================================================================

async function loadPurchases(filters, columnsByTable) {
    const invoiceCols = columnsByTable.get('inboundInvoices');
    const itemCols = columnsByTable.get('inboundInvoiceItems');

    if (!invoiceCols.has('inbound_id') || !itemCols.has('inbound_id')) {
        return { available: false };
    }

    const dateExpr = [
        invoiceCols.has('entry_date') ? 'ii.entry_date' : null,
        invoiceCols.has('issue_date') ? 'ii.issue_date' : null,
    ].filter(Boolean);

    if (!dateExpr.length) return { available: false };

    const date = dateExpr.length > 1 ? `COALESCE(${dateExpr.join(', ')})` : dateExpr[0];
    const status = invoiceCols.has('status') ? `UPPER(COALESCE(ii.status, ''))` : `''`;

    const { rows } = await pool.query(
        `SELECT
            COUNT(DISTINCT ii.inbound_id)::int AS invoices,
            COUNT(DISTINCT ii.inbound_id) FILTER (WHERE ${status} <> 'POSTED')::int AS not_posted,
            ${sumCol('it', itemCols, 'net_total')} AS net_total,
            ${sumCol('it', itemCols, 'icms_value')} AS icms,
            ${sumCol('it', itemCols, 'fcp_value')} AS fcp,
            ${sumCol('it', itemCols, 'icms_st_value')} AS icms_st,
            ${sumCol('it', itemCols, 'ipi_value')} AS ipi,
            ${sumCol('it', itemCols, 'pis_value')} AS pis,
            ${sumCol('it', itemCols, 'cofins_value')} AS cofins
         FROM public."inboundInvoices" ii
         JOIN public."inboundInvoiceItems" it ON it.inbound_id = ii.inbound_id
         WHERE ${date}::date >= $1::date
           AND ${date}::date <= $2::date
           AND ${status} <> ALL($3::text[])`,
        [filters.startDate, filters.endDate, CANCELED_STATUSES]
    );

    const row = rows[0] || {};

    return {
        available: true,
        invoices: num(row.invoices),
        notPosted: num(row.not_posted),
        netTotal: num(row.net_total),
        icms: num(row.icms) + num(row.fcp),
        icmsSt: num(row.icms_st),
        ipi: num(row.ipi),
        pis: num(row.pis),
        cofins: num(row.cofins),
    };
}


// ======================================================================
// EXPENSES (DESPESAS)
// ======================================================================

async function loadExpenses(filters, columnsByTable) {
    const cols = columnsByTable.get('expenseEntries');

    if (!cols.has('totalexpensevalue')) return { available: false };

    const dateExpr = [
        cols.has('issuedate') ? 'e.issuedate' : null,
        cols.has('entrydate') ? 'e.entrydate' : null,
    ].filter(Boolean);

    if (!dateExpr.length) return { available: false };

    const date = dateExpr.length > 1 ? `COALESCE(${dateExpr.join(', ')})` : dateExpr[0];
    const status = cols.has('status') ? `UPPER(COALESCE(e.status, ''))` : `''`;
    const creditable = cols.has('generatestaxcredit') ? 'COALESCE(e.generatestaxcredit, FALSE)' : 'FALSE';

    const { rows } = await pool.query(
        `SELECT
            COUNT(*)::int AS entries,
            COALESCE(SUM(COALESCE(e.totalexpensevalue, 0)), 0)::numeric AS total,
            COALESCE(SUM(COALESCE(e.totalexpensevalue, 0)) FILTER (WHERE ${creditable}), 0)::numeric AS creditable
         FROM public."expenseEntries" e
         WHERE ${date}::date >= $1::date
           AND ${date}::date <= $2::date
           AND ${status} <> ALL($3::text[])`,
        [filters.startDate, filters.endDate, CANCELED_STATUSES]
    );

    return {
        available: true,
        entries: num(rows[0]?.entries),
        total: num(rows[0]?.total),
        creditable: num(rows[0]?.creditable),
    };
}


// ======================================================================
// CASH OUTFLOWS (MOVIMENTAÇÕES DO CAIXA) — DEDUTÍVEL NO IRPJ/CSLL
// ======================================================================
//
// The "Dedutível no IRPJ/CSLL" checkbox of the movement wins; when it is
// empty the subcategory default applies (same rule as the Caixa screen).
// Multas are left out: fines are not deductible for IRPJ/CSLL.
//
// ======================================================================

async function loadCashDeductions(filters, columnsByTable) {
    const cols = columnsByTable.get('cashMoviments');
    const subCols = columnsByTable.get('cashSubcategories');

    if (!cols.has('movement_date') || !cols.has('amount') || !cols.has('movement_type')) {
        return { available: false };
    }

    const hasSub = subCols.has('id') && subCols.has('is_deductible') && cols.has('subcategory');
    const own = cols.has('is_deductible') ? 'm.is_deductible' : 'NULL::boolean';
    const pisFlag = cols.has('is_pis_cofins_creditable') ? 'm.is_pis_cofins_creditable' : 'NULL::boolean';
    const deductible = hasSub ? `COALESCE(${own}, s.is_deductible, FALSE)` : `COALESCE(${own}, FALSE)`;
    // Multa on a payment is a late-payment (moratória) fine: deductible.
    const extra = ['interest_amount', 'fee_amount', 'penalty_amount']
        .filter((column) => cols.has(column))
        .map((column) => ` + COALESCE(m.${column}, 0)`)
        .join('');
    const fullValue = `(COALESCE(m.amount, 0)${extra})`;
    // "Só juros, multas e encargos": the principal (e.g. a tax already in the
    // assessment) is not deducted again; late-payment fines are.
    const chargesValue = ['interest_amount', 'fee_amount', 'penalty_amount']
        .filter((column) => cols.has(column))
        .map((column) => `COALESCE(m.${column}, 0)`)
        .join(' + ') || '0';
    const value = cols.has('deduct_charges_only')
        ? `(CASE WHEN COALESCE(m.deduct_charges_only, FALSE) THEN ${chargesValue} ELSE ${fullValue} END)`
        : fullValue;
    const active = cols.has('is_active') ? 'AND COALESCE(m.is_active, TRUE)' : '';
    const subJoin = hasSub
        ? `LEFT JOIN public."cashSubcategories" s
              ON s.id::text = m.subcategory::text
              OR UPPER(TRIM(s.name)) = UPPER(TRIM(m.subcategory::text))`
        : '';
    const subName = hasSub ? `COALESCE(NULLIF(TRIM(s.name), ''), NULLIF(TRIM(m.subcategory::text), ''), 'SEM SUBCATEGORIA')` : `'SAÍDAS'`;

    // DISTINCT ON keeps one subcategory per movement when the name/id join matches twice.
    const { rows } = await pool.query(
        `WITH outflows AS (
            SELECT DISTINCT ON (m.id)
                m.id,
                ${value}::numeric AS value,
                COALESCE(m.amount, 0)::numeric AS amount,
                ${deductible} AS deductible,
                ${pisFlag} AS pis_flag,
                ${subName} AS subcategory
            FROM public."cashMoviments" m
            ${subJoin}
            WHERE m.movement_date::date >= $1::date
              AND m.movement_date::date <= $2::date
              AND translate(upper(COALESCE(m.movement_type, '')), 'ÍÌÎÏ', 'IIII') LIKE 'SAID%'
              ${active}
            ORDER BY m.id
        )
        SELECT
            subcategory,
            deductible,
            pis_flag,
            COUNT(*)::int AS movements,
            COALESCE(SUM(value), 0)::numeric AS total,
            COALESCE(SUM(amount), 0)::numeric AS amount
        FROM outflows
        GROUP BY subcategory, deductible, pis_flag`,
        [filters.startDate, filters.endDate]
    );

    const deductibleRows = rows.filter((row) => row.deductible);

    // PIS/COFINS credit base: outflows with "Dedutível no PIS/COFINS" = Sim.
    // Without a choice, C.M.V (goods bought for resale) counts by default.
    const isCmv = (name) => String(name || '').toUpperCase().replace(/[^A-Z]/g, '') === 'CMV';
    const cmvRows = rows.filter((row) => (
        row.pis_flag === true || (row.pis_flag === null && isCmv(row.subcategory))
    ));

    return {
        available: true,
        deductible: deductibleRows.reduce((sum, row) => sum + num(row.total), 0),
        nonDeductible: rows.filter((row) => !row.deductible).reduce((sum, row) => sum + num(row.total), 0),
        movements: rows.reduce((sum, row) => sum + num(row.movements), 0),
        cmvPurchases: cmvRows.reduce((sum, row) => sum + num(row.amount), 0),
        cmvMovements: cmvRows.reduce((sum, row) => sum + num(row.movements), 0),
        bySubcategory: [...deductibleRows.reduce((map, row) => {
            const label = String(row.subcategory).toUpperCase();
            return map.set(label, (map.get(label) || 0) + num(row.total));
        }, new Map())]
            .map(([label, total]) => ({ label, value: round2(total) }))
            .sort((a, b) => b.value - a.value),
    };
}


// ======================================================================
// MAIN
// ======================================================================

export async function loadTaxAssessment({ startDate = '', endDate = '' } = {}) {
    const sales = await loadSalesTaxes({ startDate, endDate });
    const filters = sales.filters;

    const columnsByTable = await loadColumns([
        'inboundInvoices', 'inboundInvoiceItems', 'expenseEntries', 'cashMoviments', 'cashSubcategories',
    ]);

    const [purchases, expenses, cash] = await Promise.all([
        loadPurchases(filters, columnsByTable).catch((error) => {
            console.error('[taxAssessment] purchases:', error);
            return { available: false };
        }),
        loadExpenses(filters, columnsByTable).catch((error) => {
            console.error('[taxAssessment] expenses:', error);
            return { available: false };
        }),
        loadCashDeductions(filters, columnsByTable).catch((error) => {
            console.error('[taxAssessment] cash deductions:', error);
            return { available: false };
        }),
    ]);

    return buildAssessment({ sales, purchases, expenses, cash, filters });
}


// ======================================================================
// RULES PER REGIME
// ======================================================================
//
// SIMPLES / MEI   ICMS, PIS, COFINS, IRPJ, CSLL dentro do DAS: sem crédito.
// PRESUMIDO       ICMS/IPI não cumulativos (crédito das entradas);
//                 PIS/COFINS cumulativos (sem crédito); IRPJ/CSLL presumidos.
// REAL            ICMS/IPI com crédito; PIS/COFINS não cumulativos com
//                 crédito sobre compras e despesas que geram crédito;
//                 IRPJ/CSLL sobre o lucro estimado.
// SEM REGIME      Débito e crédito como destacados nas notas.
//
// ======================================================================

function buildAssessment({ sales, purchases, expenses, cash = { available: false }, filters }) {
    const regime = sales.regimeContext?.regime || null;
    const regimeKey = regime?.regime || null;
    const isSimples = ['SIMPLES', 'MEI'].includes(regimeKey);
    const isExcesso = regimeKey === 'SIMPLES_EXCESSO';
    const months = monthsInRange(filters.startDate, filters.endDate);

    const saleTax = (key) => num(sales.byTax.find((tax) => tax.key === key)?.value);
    const regimeTax = (key) => num(sales.byTax.find((tax) => tax.key === key && tax.estimated)?.value);

    const revenue = num(sales.summary.totalRevenue);
    const p = purchases.available ? purchases : { netTotal: 0, icms: 0, icmsSt: 0, ipi: 0, pis: 0, cofins: 0 };
    const e = expenses.available ? expenses : { total: 0, creditable: 0 };

    const rows = [];
    const creditOrigins = [];
    const calc = { months };

    const addRow = (row) => rows.push({
        estimated: false,
        note: '',
        ...row,
        debit: round2(row.debit),
        credit: round2(row.credit),
    });

    // ---------------- ICMS / IPI ----------------
    if (isSimples) {
        addRow({ key: 'icms', label: 'ICMS', debit: 0, credit: 0, note: IN_DAS });
    } else {
        addRow({ key: 'icms', label: 'ICMS (+FCP)', debit: saleTax('icms') + saleTax('fcp'), credit: p.icms });
        creditOrigins.push({ label: 'ICMS DAS COMPRAS', value: p.icms });
    }

    addRow({
        key: 'icms_st',
        label: 'ICMS-ST',
        debit: saleTax('icms_st') + saleTax('fcp_st'),
        credit: 0,
        note: 'ST pago na entrada entra no custo, não gera crédito',
    });

    if (!isSimples && !isExcesso) {
        addRow({ key: 'ipi', label: 'IPI', debit: 0, credit: p.ipi, note: 'As notas de venda não destacam IPI' });
        creditOrigins.push({ label: 'IPI DAS COMPRAS', value: p.ipi });
    }

    // ---------------- PIS / COFINS ----------------
    if (isSimples || isExcesso) {
        addRow({ key: 'pis', label: 'PIS', debit: 0, credit: 0, note: IN_DAS });
        addRow({ key: 'cofins', label: 'COFINS', debit: 0, credit: 0, note: IN_DAS });
    } else if (regimeKey === 'PRESUMIDO') {
        addRow({
            key: 'pis', label: 'PIS (CUMULATIVO)',
            debit: saleTax('pis') || regimeTax('regime_pis'), credit: 0,
            estimated: !saleTax('pis'), note: 'Regime cumulativo: sem créditos',
        });
        addRow({
            key: 'cofins', label: 'COFINS (CUMULATIVO)',
            debit: saleTax('cofins') || regimeTax('regime_cofins'), credit: 0,
            estimated: !saleTax('cofins'), note: 'Regime cumulativo: sem créditos',
        });
    } else if (regimeKey === 'REAL') {
        // Não cumulativo: crédito pela alíquota do regime sobre as compras
        // e despesas que geram crédito, mesmo quando o fornecedor não destacou.
        const pisRate = pct(regime.pis_rate);
        const cofinsRate = pct(regime.cofins_rate);
        const pisPurchases = Math.max(p.pis, p.netTotal * pisRate);
        const cofinsPurchases = Math.max(p.cofins, p.netTotal * cofinsRate);
        const pisExpenses = e.creditable * pisRate;
        const cofinsExpenses = e.creditable * cofinsRate;
        const cmvCash = cash.available ? num(cash.cmvPurchases) : 0;
        const pisCmv = cmvCash * pisRate;
        const cofinsCmv = cmvCash * cofinsRate;

        Object.assign(calc, {
            pisRate, cofinsRate, cmvCash,
            pisPurchases, cofinsPurchases, pisExpenses, cofinsExpenses, pisCmv, cofinsCmv,
        });

        addRow({
            key: 'pis', label: 'PIS (NÃO CUMULATIVO)',
            debit: saleTax('pis') || regimeTax('regime_pis'),
            credit: pisPurchases + pisExpenses + pisCmv,
            estimated: true,
        });
        addRow({
            key: 'cofins', label: 'COFINS (NÃO CUMULATIVO)',
            debit: saleTax('cofins') || regimeTax('regime_cofins'),
            credit: cofinsPurchases + cofinsExpenses + cofinsCmv,
            estimated: true,
        });

        creditOrigins.push(
            { label: 'PIS/COFINS DAS COMPRAS', value: pisPurchases + cofinsPurchases, estimated: true },
            { label: 'PIS/COFINS DAS DESPESAS', value: pisExpenses + cofinsExpenses, estimated: true },
            { label: 'PIS/COFINS DAS SAÍDAS DO CAIXA', value: pisCmv + cofinsCmv, estimated: true },
        );
    } else {
        addRow({ key: 'pis', label: 'PIS', debit: saleTax('pis'), credit: p.pis });
        addRow({ key: 'cofins', label: 'COFINS', debit: saleTax('cofins'), credit: p.cofins });
        creditOrigins.push({ label: 'PIS/COFINS DAS COMPRAS', value: p.pis + p.cofins });
    }

    // ---------------- DAS ----------------
    const das = regimeTax('regime_das');
    if (das > 0) {
        addRow({ key: 'das', label: 'DAS — SIMPLES NACIONAL', debit: das, credit: 0, estimated: true, note: 'Sem créditos no Simples' });
    }

    // ---------------- IRPJ / CSLL ----------------
    // Deductions: cash outflows flagged "Dedutível no IRPJ/CSLL" (they already
    // include the CMV paid to suppliers). Without the cash table, fall back to
    // product cost × quantity sold + expense entries.
    const costOfGoods = num(sales.summary.costOfGoods);
    const useCash = cash.available;
    const deductions = useCash ? cash.deductible : costOfGoods + e.total;
    const result = {
        revenue,
        basis: useCash ? 'caixa' : 'custo',
        deductions,
        nonDeductible: useCash ? cash.nonDeductible : 0,
        deductionsBySubcategory: useCash ? cash.bySubcategory : [],
        costOfGoods: useCash ? 0 : costOfGoods,
        expenses: useCash ? 0 : e.total,
        profit: revenue - deductions,
        method: null,
    };

    if (regimeKey === 'PRESUMIDO') {
        result.method = 'presumido';
        addRow({ key: 'irpj', label: 'IRPJ (PRESUMIDO)', debit: regimeTax('regime_irpj'), credit: 0, estimated: true });
        addRow({ key: 'csll', label: 'CSLL (PRESUMIDO)', debit: regimeTax('regime_csll'), credit: 0, estimated: true });
    } else if (regimeKey === 'REAL') {
        const margin = num(regime.estimated_profit_margin_pct);
        const useBooks = deductions > 0;
        const profit = useBooks ? result.profit : revenue * pct(margin);

        result.method = useBooks ? 'lucro' : (margin > 0 ? 'margem' : null);
        result.profit = profit;

        if (result.method) {
            const base = Math.max(0, profit);
            const threshold = num(regime.irpj_additional_monthly_threshold) * months;
            const irpj = base * pct(regime.irpj_rate) + Math.max(0, base - threshold) * pct(regime.irpj_additional_rate);

            Object.assign(calc, { irpjBase: base, csllBase: base, threshold, margin });

            addRow({ key: 'irpj', label: 'IRPJ (LUCRO REAL)', debit: irpj, credit: 0, estimated: true });
            addRow({ key: 'csll', label: 'CSLL (LUCRO REAL)', debit: base * pct(regime.csll_rate), credit: 0, estimated: true });
        }
    }

    // ---------------- BALANCES ----------------
    const byTax = rows.map((row) => {
        const balance = round2(row.debit - row.credit);
        return {
            ...row,
            balance,
            toPay: Math.max(0, balance),
            creditBalance: Math.max(0, -balance),
        };
    });

    const total = (field) => round2(byTax.reduce((sum, row) => sum + row[field], 0));
    const visibleRows = byTax.filter((row) => row.debit > 0 || row.credit > 0 || row.note === IN_DAS);

    return {
        filters,
        regime: sales.regime,
        sources: {
            sales: sales.sourcesAvailable,
            purchases: purchases.available,
            expenses: expenses.available,
        },
        summary: {
            revenue,
            debits: total('debit'),
            credits: total('credit'),
            toPay: total('toPay'),
            creditBalance: total('creditBalance'),
            burdenOverRevenue: revenue > 0 ? (total('toPay') / revenue) * 100 : 0,
            salesInvoices: num(sales.summary.totalInvoices),
            purchaseInvoices: num(purchases.invoices),
            purchasesNotPosted: num(purchases.notPosted),
            purchasesTotal: round2(p.netTotal),
            expenseEntries: num(expenses.entries),
            expensesTotal: round2(e.total),
            creditableExpenses: round2(e.creditable),
            cmvPurchases: round2(cash.available ? num(cash.cmvPurchases) : 0),
            cmvMovements: cash.available ? num(cash.cmvMovements) : 0,
        },
        byTax: visibleRows,
        creditOrigins: creditOrigins
            .map((origin) => ({ ...origin, value: round2(origin.value) }))
            .filter((origin) => origin.value > 0),
        result: {
            ...result,
            profit: round2(result.profit),
            costOfGoods: round2(result.costOfGoods),
            expenses: round2(result.expenses),
            deductions: round2(result.deductions),
            nonDeductible: round2(result.nonDeductible),
        },
        memory: buildCalculationMemory({
            rows: visibleRows, regime, regimeLabel: sales.regime?.summary || sales.regime?.label || '',
            sales, saleTax, regimeTax, p, e, purchases, expenses, cash, result, calc, filters,
            totals: { debits: total('debit'), credits: total('credit'), toPay: total('toPay'), creditBalance: total('creditBalance') },
        }),
    };
}


// ======================================================================
// MEMÓRIA DE CÁLCULO
// ======================================================================
//
// Sections of lines { label, formula, value, kind } used by the Excel and
// PDF exports. value is a number (R$) or text; kind: '' | 'sub' | 'total'.
//
// ======================================================================

const brl = (value) => num(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const rateText = (value) => `${num(value).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%`;
const dateBR = (value) => String(value || '').slice(0, 10).split('-').reverse().join('/');

function buildCalculationMemory({ rows, regime, regimeLabel, sales, saleTax, regimeTax, p, e, purchases, expenses, cash, result, calc, filters, totals }) {
    const regimeKey = regime?.regime || null;
    const revenue = num(sales.summary.totalRevenue);
    const invoices = num(sales.summary.totalInvoices);
    const sections = [];
    const line = (label, value, formula = '', kind = '') => ({ label, value, formula, kind });

    // ---------------- PARÂMETROS ----------------
    const params = [
        line('Período', `${dateBR(filters.startDate)} até ${dateBR(filters.endDate)}`, `${calc.months} mês(es)`),
        line('Regime tributário', regimeLabel || 'Sem regime cadastrado', regimeKey ? '' : 'Débito e crédito como destacados nas notas'),
    ];

    if (regimeKey === 'REAL' || regimeKey === 'PRESUMIDO') {
        params.push(
            line('Alíquota PIS', rateText(regime.pis_rate)),
            line('Alíquota COFINS', rateText(regime.cofins_rate)),
            line('Alíquota IRPJ', rateText(regime.irpj_rate),
                `Adicional ${rateText(regime.irpj_additional_rate)} sobre o que passar de ${brl(regime.irpj_additional_monthly_threshold)} por mês`),
            line('Alíquota CSLL', rateText(regime.csll_rate)),
        );
    }
    if (regimeKey === 'PRESUMIDO') {
        params.push(
            line('Presunção IRPJ', rateText(regime.irpj_presumption_pct)),
            line('Presunção CSLL', rateText(regime.csll_presumption_pct)),
        );
    }
    sections.push({ title: 'Parâmetros', lines: params });

    // ---------------- BASES ----------------
    const bases = [
        line('Receita das vendas', revenue, `${invoices} nota(s) de venda autorizada(s) no período`),
    ];
    if (purchases.available) {
        bases.push(line('Notas de entrada (valor líquido)', p.netTotal,
            `${num(purchases.invoices)} nota(s) lançada(s)` +
            (num(purchases.notPosted) ? `; ${num(purchases.notPosted)} pendente(s) de lançamento` : '')));
    }
    if (expenses.available) {
        bases.push(
            line('Despesas lançadas', e.total, `${num(expenses.entries)} despesa(s)`),
            line('Despesas que geram crédito', e.creditable, 'Despesas marcadas "Gera crédito"', 'sub'),
        );
    }
    if (cash.available && regimeKey === 'REAL') {
        bases.push(line('Saídas do caixa com crédito de PIS/COFINS', calc.cmvCash,
            `${num(cash.cmvMovements)} lançamento(s) "Dedutível no PIS/COFINS" = Sim (sem escolha: C.M.V)`));
    }
    sections.push({ title: 'Bases do período', lines: bases });

    // ---------------- APURAÇÃO POR IMPOSTO ----------------
    const debitFormula = (key) => {
        if (key === 'icms') return `ICMS ${brl(saleTax('icms'))} + FCP ${brl(saleTax('fcp'))} destacados nas notas de venda`;
        if (key === 'icms_st') return 'ICMS-ST + FCP-ST destacados nas notas de venda';
        if (key === 'pis' || key === 'cofins') {
            const rate = key === 'pis' ? regime?.pis_rate : regime?.cofins_rate;
            return saleTax(key) || !regime
                ? `${key.toUpperCase()} destacado nas notas de venda`
                : `Receita ${brl(revenue)} × ${rateText(rate)}`;
        }
        if (key === 'das') return `Receita ${brl(revenue)} × alíquota efetiva do Simples`;
        if (key === 'irpj' && regimeKey === 'PRESUMIDO') {
            const base = revenue * pct(regime.irpj_presumption_pct);
            return `Receita × presunção ${rateText(regime.irpj_presumption_pct)} = base ${brl(base)}; ` +
                `base × ${rateText(regime.irpj_rate)} + adicional ${rateText(regime.irpj_additional_rate)} sobre o que passar de ` +
                `${brl(num(regime.irpj_additional_monthly_threshold) * calc.months)}`;
        }
        if (key === 'csll' && regimeKey === 'PRESUMIDO') {
            const base = revenue * pct(regime.csll_presumption_pct);
            return `Receita × presunção ${rateText(regime.csll_presumption_pct)} = base ${brl(base)}; base × ${rateText(regime.csll_rate)}`;
        }
        if (key === 'irpj') {
            const excess = Math.max(0, calc.irpjBase - calc.threshold);
            return `Lucro ${brl(calc.irpjBase)} × ${rateText(regime.irpj_rate)} + ` +
                `(${brl(calc.irpjBase)} − ${brl(calc.threshold)}) = ${brl(excess)} × ${rateText(regime.irpj_additional_rate)}`;
        }
        if (key === 'csll') return `Lucro ${brl(calc.csllBase)} × ${rateText(regime.csll_rate)}`;
        return '';
    };

    const creditLines = (key) => {
        if (['SIMPLES', 'MEI'].includes(regimeKey)) return [];
        if (key === 'icms') return [line('ICMS destacado nas notas de entrada', p.icms, '', 'sub')];
        if (key === 'ipi') return [line('IPI destacado nas notas de entrada', p.ipi, '', 'sub')];
        if ((key === 'pis' || key === 'cofins') && regimeKey === 'REAL') {
            const isPis = key === 'pis';
            const rate = isPis ? regime.pis_rate : regime.cofins_rate;
            const highlighted = isPis ? p.pis : p.cofins;
            return [
                line('Notas de entrada', isPis ? calc.pisPurchases : calc.cofinsPurchases,
                    `Maior entre o destacado ${brl(highlighted)} e ${brl(p.netTotal)} × ${rateText(rate)}`, 'sub'),
                line('Despesas que geram crédito', isPis ? calc.pisExpenses : calc.cofinsExpenses,
                    `${brl(e.creditable)} × ${rateText(rate)}`, 'sub'),
                line('Saídas do caixa', isPis ? calc.pisCmv : calc.cofinsCmv,
                    `${brl(calc.cmvCash)} × ${rateText(rate)}`, 'sub'),
            ];
        }
        if ((key === 'pis' || key === 'cofins') && !regimeKey) {
            return [line(`${key.toUpperCase()} destacado nas notas de entrada`, key === 'pis' ? p.pis : p.cofins, '', 'sub')];
        }
        return [];
    };

    rows.forEach((row) => {
        const lines = [line('Débito', row.debit, row.note === IN_DAS ? IN_DAS : debitFormula(row.key))];
        const credits = creditLines(row.key);

        if (row.credit > 0 || credits.length) {
            lines.push(line('(−) Crédito', row.credit, credits.length > 1 ? 'Soma das linhas abaixo' : ''));
            lines.push(...credits);
        }
        lines.push(row.balance >= 0
            ? line('= A recolher', row.balance, 'Débito − crédito', 'total')
            : line('= Saldo credor', -row.balance, 'Crédito maior que o débito: passa para o próximo período', 'total'));
        if (row.note && row.note !== IN_DAS) lines.push(line('Observação', row.note));

        sections.push({ title: row.label + (row.estimated ? ' (estimado)' : ''), lines });
    });

    // ---------------- BASE IRPJ / CSLL (LUCRO REAL) ----------------
    if (regimeKey === 'REAL' && result.method) {
        const lines = [line('Receita das vendas', revenue)];

        if (result.method === 'margem') {
            lines.push(line('= Lucro estimado', result.profit,
                `Sem saídas dedutíveis: receita × margem ${rateText(calc.margin)}`, 'total'));
        } else if (result.basis === 'caixa') {
            lines.push(line('(−) Saídas dedutíveis no IRPJ/CSLL', -result.deductions,
                'Saídas do caixa marcadas "Dedutível no IRPJ/CSLL": valor + juros + multa + encargos; ' +
                'nas marcadas "Só juros, multas e encargos", sem o valor principal'));
            result.deductionsBySubcategory.forEach((item) => lines.push(line(item.label, -item.value, '', 'sub')));
            lines.push(line('= Lucro estimado', result.profit, 'Receita − saídas dedutíveis', 'total'));
            lines.push(line('Saídas não dedutíveis (fora da base)', result.nonDeductible));
        } else {
            lines.push(
                line('(−) Custo das mercadorias vendidas', -result.costOfGoods, 'Custo do produto × quantidade vendida'),
                line('(−) Despesas lançadas', -result.expenses),
                line('= Lucro estimado', result.profit, 'Receita − custo − despesas', 'total'),
            );
        }
        sections.push({ title: 'Base do IRPJ / CSLL (Lucro Real)', lines });
    }

    // ---------------- RESUMO ----------------
    sections.push({
        title: 'Resumo',
        lines: [
            line('Débitos (vendas)', totals.debits),
            line('Créditos (compras e despesas)', totals.credits),
            line('A recolher', totals.toPay, 'Soma dos impostos com débito maior que crédito', 'total'),
            line('Saldo credor (próximo período)', totals.creditBalance),
        ],
    });

    return sections.map((section) => ({
        ...section,
        lines: section.lines.map((item) => ({
            ...item,
            value: typeof item.value === 'number' ? round2(item.value) : item.value,
        })),
    }));
}
