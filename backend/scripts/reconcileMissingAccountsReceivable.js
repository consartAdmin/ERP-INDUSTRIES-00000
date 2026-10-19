// ╔═════════════════════════════════════════════════════════════════════════════════╗
// ║ reconcileMissingAccountsReceivable.js                                           ║
// ║ CONSART ERP | PostgreSQL | Node.js ESM                                          ║
// ║ - DRY-RUN por padrão                                                            ║
// ║ - --apply para executar                                                         ║
// ║ - bloqueia divergências                                                         ║
// ║ - usa syncAuthorizedBudgetNfe() oficial                                         ║
// ║ node --env-file=.env.loca scripts/reconcileMissingAccountsReceivable.js         ║
// ╚═════════════════════════════════════════════════════════════════════════════════╝

'use strict';

import pool from '../config/db.js';
import { syncAuthorizedBudgetNfe } from '../repositories/nfeAsaasSync/nfeAsaasSync.index.js';

const EPSILON = 0.01;

const hasFlag = (name) => process.argv.includes(name);

function flagValue(name) {
    const i = process.argv.indexOf(name);
    if (i < 0) return null;
    const value = process.argv[i + 1];
    if (!value || value.startsWith('--')) return null;
    return value;
}

function positiveInt(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function round2(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function money(value) {
    return round2(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

async function loadCandidates({ nfe = null, budget = null, limit = null } = {}) {
    const where = [
        `ii.source_type = 'BUDGET'`,
        `ii.budget_id IS NOT NULL`,
        `ii.nfe_number IS NOT NULL`,
        `(
      UPPER(COALESCE(ii.nfe_status, '')) IN (
        'AUTORIZADA','AUTORIZADO','CONCLUIDO','CONCLUÍDO','EMITIDA','EMITIDO'
      )
      OR ii.nfe_status_id = 3
    )`,
    ];

    const args = [];
    let p = 1;

    if (nfe) {
        where.push(`ii.nfe_number = $${p++}`);
        args.push(nfe);
    }

    if (budget) {
        where.push(`ii.budget_id = $${p++}`);
        args.push(budget);
    }

    let limitSql = '';
    if (limit) {
        limitSql = `LIMIT $${p++}`;
        args.push(limit);
    }

    const sql = `
    WITH payment_summary AS (
      SELECT
        bp.budget_id,
        COUNT(DISTINCT bp.budget_payment_id)::int AS payment_count,
        COUNT(bpi.budget_payment_installment_id)::int AS installment_count,
        COALESCE(SUM(bpi.amount), 0)::numeric(14,2) AS installment_total,
        STRING_AGG(DISTINCT COALESCE(bp.collection_provider, 'NULL'), ', ') AS collection_providers,
        STRING_AGG(DISTINCT COALESCE(bp.boleto_mode, 'NULL'), ', ') AS boleto_modes
      FROM public."budgetsPayments" bp
      LEFT JOIN public."budgetsPaymentInstallments" bpi
        ON bpi.budget_payment_id = bp.budget_payment_id
      GROUP BY bp.budget_id
    ),
    ar_summary AS (
      SELECT
        ii2.invoice_id,
        COUNT(ar.id)::int AS ar_count,
        COALESCE(SUM(ar.value), 0)::numeric(14,2) AS ar_total
      FROM public."invoicesIssued" ii2
      LEFT JOIN public."accountsReceivable" ar
        ON ar.invoice_number = ii2.nfe_number::text
        OR ar.invoice_number LIKE ii2.nfe_number::text || '/%'
      WHERE ii2.source_type = 'BUDGET'
        AND ii2.nfe_number IS NOT NULL
      GROUP BY ii2.invoice_id
    )
    SELECT
      ii.invoice_id,
      ii.budget_id,
      ii.nfe_number,
      ii.nfe_key,
      ii.nfe_status,
      ii.nfe_status_id,
      ii.issued_date,
      ii.total_amount,
      ii.customer_name,
      COALESCE(ps.payment_count, 0) AS payment_count,
      COALESCE(ps.installment_count, 0) AS installment_count,
      COALESCE(ps.installment_total, 0) AS installment_total,
      ps.collection_providers,
      ps.boleto_modes,
      COALESCE(a.ar_count, 0) AS ar_count,
      COALESCE(a.ar_total, 0) AS ar_total
    FROM public."invoicesIssued" ii
    LEFT JOIN payment_summary ps ON ps.budget_id = ii.budget_id
    LEFT JOIN ar_summary a ON a.invoice_id = ii.invoice_id
    WHERE ${where.join('\n      AND ')}
    ORDER BY ii.issued_date ASC NULLS LAST, ii.nfe_number ASC
    ${limitSql}
  `;

    const { rows } = await pool.query(sql, args);
    return rows;
}

async function loadInstallments(budgetId) {
    const { rows } = await pool.query(
        `
      SELECT
        bp.budget_payment_id,
        bp.payment_method_id,
        bp.bank_account_id,
        bp.collection_provider,
        bp.boleto_mode,
        bpi.installment_number,
        bpi.due_date,
        bpi.amount
      FROM public."budgetsPayments" bp
      JOIN public."budgetsPaymentInstallments" bpi
        ON bpi.budget_payment_id = bp.budget_payment_id
      WHERE bp.budget_id = $1
      ORDER BY bp.budget_payment_id, bpi.installment_number, bpi.due_date
    `,
        [budgetId],
    );
    return rows;
}

async function loadArSummary(nfeNumber) {
    const { rows } = await pool.query(
        `
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(value), 0)::numeric(14,2) AS total
      FROM public."accountsReceivable"
      WHERE invoice_number = $1::text
         OR invoice_number LIKE $1::text || '/%'
    `,
        [nfeNumber],
    );

    return {
        count: Number(rows[0]?.count || 0),
        total: round2(rows[0]?.total),
    };
}

function diagnose(row) {
    const nfeTotal = round2(row.total_amount);
    const installmentTotal = round2(row.installment_total);
    const arTotal = round2(row.ar_total);
    const installmentDiff = round2(nfeTotal - installmentTotal);
    const arDiff = round2(nfeTotal - arTotal);
    const installmentCount = Number(row.installment_count || 0);
    const arCount = Number(row.ar_count || 0);

    let status = 'READY';

    if (installmentCount === 0) {
        status = 'NO_INSTALLMENTS';
    } else if (Math.abs(installmentDiff) > EPSILON) {
        status = 'INSTALLMENT_TOTAL_DIVERGENT';
    } else if (arCount > 0 && Math.abs(arDiff) <= EPSILON) {
        status = 'ALREADY_OK';
    } else if (arCount > 0) {
        status = 'PARTIAL_OR_DIVERGENT_AR';
    }

    return {
        status,
        nfeTotal,
        installmentTotal,
        installmentDiff,
        arTotal,
        arDiff,
    };
}

async function processOne(row, { apply = false, forcePartial = false } = {}) {
    const d = diagnose(row);

    console.log('');
    console.log('='.repeat(88));
    console.log(`NF-e ${row.nfe_number} | Budget ${row.budget_id} | ${row.customer_name || '-'}`);
    console.log(`Total NF-e.............: R$ ${money(d.nfeTotal)}`);
    console.log(`Parcelas...............: ${Number(row.installment_count || 0)}`);
    console.log(`Total parcelas.........: R$ ${money(d.installmentTotal)}`);
    console.log(`Dif. parcelas..........: R$ ${money(d.installmentDiff)}`);
    console.log(`AR encontrados.........: ${Number(row.ar_count || 0)}`);
    console.log(`Total AR...............: R$ ${money(d.arTotal)}`);
    console.log(`Provider...............: ${row.collection_providers || '-'}`);
    console.log(`Boleto mode............: ${row.boleto_modes || '-'}`);
    console.log(`Diagnóstico............: ${d.status}`);

    if (d.status === 'ALREADY_OK') {
        console.log('AÇÃO...................: SKIP — já conciliada.');
        return 'ALREADY_OK';
    }

    if (d.status === 'NO_INSTALLMENTS') {
        console.log('AÇÃO...................: BLOCKED — sem parcelas.');
        return 'NO_INSTALLMENTS';
    }

    if (d.status === 'INSTALLMENT_TOTAL_DIVERGENT') {
        console.log('AÇÃO...................: BLOCKED — total das parcelas diverge da NF-e.');
        return 'DIVERGENT';
    }

    if (d.status === 'PARTIAL_OR_DIVERGENT_AR' && !forcePartial) {
        console.log('AÇÃO...................: BLOCKED — AR parcial/divergente.');
        return 'PARTIAL_BLOCKED';
    }

    const installments = await loadInstallments(row.budget_id);

    console.log('Parcelas previstas:');
    installments.forEach((it, index) => {
        console.log(
            `  ${row.nfe_number}/${String(index + 1).padStart(3, '0')}` +
            ` | ${it.due_date || '-'}` +
            ` | R$ ${money(it.amount)}` +
            ` | ${it.collection_provider || 'NO_INTEGRATION'}` +
            ` | ${it.boleto_mode || 'NONE'}` +
            ` | bank=${it.bank_account_id ?? 'NULL'}`
        );
    });

    if (!apply) {
        console.log('AÇÃO...................: DRY-RUN — nenhuma alteração.');
        return 'READY';
    }

    console.log('AÇÃO...................: APPLY — sincronizando...');

    const sync = await syncAuthorizedBudgetNfe({
        budgetId: Number(row.budget_id),
        nfeNumber: Number(row.nfe_number),
        nfeKey: row.nfe_key || null,
    });

    const after = await loadArSummary(row.nfe_number);
    const diff = round2(d.nfeTotal - after.total);

    if (after.count <= 0 || Math.abs(diff) > EPSILON) {
        const error = new Error(
            `Pós-validação falhou: AR=${after.count}, total=R$ ${money(after.total)}, diferença=R$ ${money(diff)}`
        );
        error.code = 'POST_VALIDATION_FAILED';
        error.details = { sync };
        throw error;
    }

    console.log(`RESULTADO..............: OK — ${after.count} título(s), R$ ${money(after.total)}.`);
    return 'REPAIRED';
}

async function main() {
    const apply = hasFlag('--apply');
    const forcePartial = hasFlag('--force-partial');
    const nfe = positiveInt(flagValue('--nfe'));
    const budget = positiveInt(flagValue('--budget'));
    const limit = positiveInt(flagValue('--limit'));

    console.log('');
    console.log('CONSART ERP — reconcileMissingAccountsReceivable');
    console.log(`Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);
    console.log(`NF-e: ${nfe ?? 'ALL'} | Budget: ${budget ?? 'ALL'} | Limit: ${limit ?? 'ALL'}`);

    const rows = await loadCandidates({ nfe, budget, limit });

    if (!rows.length) {
        console.log('Nenhuma NF-e encontrada no escopo.');
        return;
    }

    const summary = {
        scanned: 0,
        ready: 0,
        repaired: 0,
        alreadyOk: 0,
        divergent: 0,
        noInstallments: 0,
        partialBlocked: 0,
        failed: 0,
    };

    for (const row of rows) {
        summary.scanned += 1;

        try {
            const result = await processOne(row, { apply, forcePartial });

            if (result === 'READY') summary.ready += 1;
            if (result === 'REPAIRED') summary.repaired += 1;
            if (result === 'ALREADY_OK') summary.alreadyOk += 1;
            if (result === 'DIVERGENT') summary.divergent += 1;
            if (result === 'NO_INSTALLMENTS') summary.noInstallments += 1;
            if (result === 'PARTIAL_BLOCKED') summary.partialBlocked += 1;
        } catch (error) {
            summary.failed += 1;
            console.error(
                `[ERRO] NF-e ${row.nfe_number} | Budget ${row.budget_id}:`,
                error?.message || error,
            );
        }
    }

    console.log('');
    console.log('='.repeat(88));
    console.log('RESUMO');
    console.log(`Analisadas..............: ${summary.scanned}`);
    console.log(`Prontas.................: ${summary.ready}`);
    console.log(`Reparadas...............: ${summary.repaired}`);
    console.log(`Já OK...................: ${summary.alreadyOk}`);
    console.log(`Divergentes.............: ${summary.divergent}`);
    console.log(`Sem parcelas............: ${summary.noInstallments}`);
    console.log(`AR parcial bloqueado....: ${summary.partialBlocked}`);
    console.log(`Falhas..................: ${summary.failed}`);

    if (!apply) {
        console.log('');
        console.log('DRY-RUN concluído. Para aplicar:');
        console.log('node backend/scripts/reconcileMissingAccountsReceivable.js --apply');
    }
}

main()
    .catch((error) => {
        console.error('[reconcileMissingAccountsReceivable][FATAL]', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await pool.end();
        } catch {
            // ignore
        }
    });
