'use strict';

import 'dotenv/config';
import pool from '../../config/db.js';

import {
    findProductByLmRef,
} from '../../repositories/inboundInvoices/inboundInvoices.index.js';

const DEFAULT_ISSUER = '44941950000196';
const DEFAULT_CODES = ['333', '334', '371', '336', '337', '338', '340'];

function onlyDigits(value) {
    return String(value ?? '').replace(/\D+/g, '');
}

function arg(name, fallback = null) {
    const prefix = `--${name}=`;
    const found = process.argv.find((v) => v.startsWith(prefix));
    return found ? found.slice(prefix.length) : fallback;
}

function parseCodes(value) {
    return String(value || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
}

async function main() {
    const issuer = onlyDigits(arg('issuer', DEFAULT_ISSUER));
    const codes = parseCodes(arg('codes', DEFAULT_CODES.join(',')));

    console.log('\n============================================================');
    console.log(' CONSART ERP - TEST inboundInvoicesApi / productsLmRef');
    console.log('============================================================');
    console.log('Issuer CNPJ :', issuer);
    console.log('NF-e codes  :', codes.join(', '));

    const supplierResult = await pool.query(
        `
      SELECT supplier_id, name, tax_id,
             regexp_replace(COALESCE(tax_id, ''), '\\D', '', 'g') AS normalized_tax_id
      FROM public.suppliers
      WHERE regexp_replace(COALESCE(tax_id, ''), '\\D', '', 'g') = $1
      ORDER BY supplier_id
    `,
        [issuer]
    );

    console.log('\n[1] SUPPLIER LOOKUP');
    console.table(supplierResult.rows);

    if (supplierResult.rowCount === 0) {
        throw new Error(`Fornecedor nao encontrado para CNPJ ${issuer}`);
    }
    if (supplierResult.rowCount > 1) {
        console.warn(`ATENCAO: ${supplierResult.rowCount} fornecedores possuem o mesmo CNPJ.`);
    }

    const supplierId = Number(supplierResult.rows[0].supplier_id);
    console.log('supplierId selecionado:', supplierId);

    console.log('\n[2] RAW productsLmRef + products JOIN');
    const rawResult = await pool.query(
        `
      SELECT
        r.product_lm_ref_id,
        r.supplier_id,
        '[' || r.nf_product_code || ']' AS nf_product_code_raw,
        length(r.nf_product_code) AS nf_code_length,
        r.product_code AS mapped_product_code,
        r.is_active,
        p.product_id,
        p.product_code AS canonical_product_code,
        p.product_stock_id
      FROM public."productsLmRef" r
      LEFT JOIN public.products p
        ON p.product_code = r.product_code
      WHERE r.supplier_id = $1
        AND BTRIM(r.nf_product_code) = ANY($2::text[])
      ORDER BY r.nf_product_code, r.product_lm_ref_id
    `,
        [supplierId, codes]
    );
    console.table(rawResult.rows);

    console.log('\n[3] CALLING findProductByLmRef() EXACTLY AS THE CONTROLLER SHOULD');
    const results = [];
    for (const nfProductCode of codes) {
        try {
            const mapping = await findProductByLmRef({
                supplierId,
                nfProductCode,
            });

            results.push({
                nf_product_code: nfProductCode,
                found: Boolean(mapping),
                product_lm_ref_id: mapping?.product_lm_ref_id ?? null,
                mapped_product_code: mapping?.product_code ?? null,
                canonical_product_code: mapping?.canonical_product_code ?? null,
                product_id: mapping?.product_id ?? null,
                product_stock_id: mapping?.product_stock_id ?? null,
                is_active: mapping?.is_active ?? null,
            });
        } catch (error) {
            results.push({
                nf_product_code: nfProductCode,
                found: false,
                error: error.message,
            });
        }
    }
    console.table(results);

    console.log('\n[4] DIAGNOSIS');
    const failed = results.filter((r) => !r.found);
    const wrong = results.filter(
        (r) => r.found && String(r.canonical_product_code || '') === String(r.nf_product_code)
    );

    if (!failed.length && !wrong.length) {
        console.log('OK: inboundInvoicesApi.findProductByLmRef() is mapping correctly.');
        console.log('Therefore, if the browser still shows 333 -> 333, the problem is AFTER/OUTSIDE this DAL function:');
        console.log('  - controller is not calling findProductByLmRef; OR');
        console.log('  - controller overwrites product_code after mapping; OR');
        console.log('  - deployed backend/frontend is an older version/cache.');
    } else {
        if (failed.length) {
            console.log('FAIL: these NF-e codes were not resolved:', failed.map((r) => r.nf_product_code).join(', '));
        }
        if (wrong.length) {
            console.log('FAIL: mapping returned NF code itself as ERP product:', wrong.map((r) => r.nf_product_code).join(', '));
        }
    }

    console.log('\nExpected examples for supplier 1:');
    console.log('333 -> 072003 | 334 -> 072004 | 336 -> 072006 | 337 -> 072007');
    console.log('338 -> 072008 | 340 -> 072010 | 371 -> 072011');
    console.log('============================================================\n');
}

main()
    .catch((error) => {
        console.error('\n[TEST FAILED]', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end().catch(() => { });
    });
