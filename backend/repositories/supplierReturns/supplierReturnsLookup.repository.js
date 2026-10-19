// ╔══════════════════════════════════════════════════════════════════╗
// ║ supplierReturnsLookup.repository.js — busca fornecedor / produto ║
// ║ colunas de suppliers (cache), fornecedor por documento, produto  ║
// ╚══════════════════════════════════════════════════════════════════╝

import pool from '../../config/db.js';
import { onlyDigits, pickExistingColumn } from './supplierReturns.utils.js';

let suppliersColumnsCache = null;

export async function getSuppliersColumns() {
    if (suppliersColumnsCache) return suppliersColumnsCache;

    const result = await pool.query(`
    SELECT column_name
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'suppliers'
  `);

    suppliersColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return suppliersColumnsCache;
}

export async function findSupplierByDocument(taxId) {
    const doc = onlyDigits(taxId);
    if (!doc) return null;

    const columns = await getSuppliersColumns();

    const idCol = pickExistingColumn(columns, ['supplier_id', 'id']);

    const docCol = pickExistingColumn(columns, [
        'tax_id',
        'supplier_document',
        'document',
        'cnpj',
        'cnpj_cpf',
        'cnpjcpf',
        'cpf_cnpj',
    ]);

    const tradeCol = pickExistingColumn(columns, [
        'trade_name',
        'supplier_name',
        'nome_fantasia',
        'fantasy_name',
        'name',
        'razao_social',
        'legal_name',
    ]);

    const legalCol = pickExistingColumn(columns, [
        'legal_name',
        'razao_social',
        'supplier_name',
        'nome',
        'name',
    ]);

    const ieCol = pickExistingColumn(columns, [
        'state_registration',
        'ie',
        'inscricao_estadual',
        'supplier_ie',
        'inscricaoestadual',
    ]);

    const cityCol = pickExistingColumn(columns, [
        'city',
        'cidade',
        'supplier_city',
        'municipio',
    ]);

    const ufCol = pickExistingColumn(columns, [
        'state',
        'uf',
        'supplier_uf',
        'estado',
    ]);

    const cepCol = pickExistingColumn(columns, [
        'postal_code',
        'cep',
        'zip',
        'zipcode',
        'supplier_postal_code',
    ]);

    const streetCol = pickExistingColumn(columns, [
        'address_street',
        'street',
        'logradouro',
        'address',
    ]);

    const numberCol = pickExistingColumn(columns, [
        'address_number',
        'number',
        'numero',
    ]);

    const districtCol = pickExistingColumn(columns, [
        'address_district',
        'district',
        'bairro',
        'neighborhood',
    ]);

    if (!idCol || !docCol) return null;

    const result = await pool.query(
        `
      SELECT *
        FROM public.suppliers
       WHERE regexp_replace(COALESCE("${docCol}"::text, ''), '\\D', '', 'g') = $1
       ORDER BY "${idCol}" DESC
       LIMIT 1
    `,
        [doc],
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
        supplier_id: row[idCol],
        trade_name: tradeCol ? row[tradeCol] || '' : '',
        legal_name: legalCol ? row[legalCol] || '' : '',
        tax_id: docCol ? row[docCol] || '' : '',
        ie: ieCol ? onlyDigits(row[ieCol] || '') : '',
        city: cityCol ? row[cityCol] || '' : '',
        uf: ufCol ? row[ufCol] || '' : '',
        postal_code: cepCol ? onlyDigits(row[cepCol] || '') : '',
        street: streetCol ? row[streetCol] || '' : '',
        number: numberCol ? row[numberCol] || '' : '',
        district: districtCol ? row[districtCol] || '' : '',
    };
}

export async function findProductByCodeOrBarcode({ cProd, cEAN }) {
    const sku = String(cProd || '').trim();
    const barcode = onlyDigits(cEAN);

    const params = [];
    const where = [];

    if (sku) {
        params.push(sku);
        where.push(`p.product_code = $${params.length}`);
    }

    if (barcode && barcode !== 'SEMGTIN') {
        params.push(barcode);
        where.push(`regexp_replace(COALESCE(p.barcode, ''), '\\D', '', 'g') = $${params.length}`);
        where.push(`EXISTS (
          SELECT 1 FROM public."productsBarCode" pb
          WHERE pb.product_code = p.product_code
            AND COALESCE(pb.is_active, TRUE) = TRUE
            AND regexp_replace(COALESCE(pb.barcode, ''), '\\D', '', 'g') = $${params.length}
        )`);
    }

    if (!where.length) return null;

    const result = await pool.query(
        `
    SELECT
      p.product_id,
      p.product_code,
      p.description,
      p.barcode,

      fc.ncm_code AS ncm,
      fc.cest_code AS cest,

      fp.icms_cst AS cst_icms,
      COALESCE(fp.pis_cst, '') AS cst_pis,
      COALESCE(fp.cofins_cst, '') AS cst_cofins

    FROM public.products p
    LEFT JOIN public."productsFiscalV2" pf
      ON pf.product_code = p.product_code
     AND pf.is_current = TRUE
     AND pf.is_active = TRUE
    LEFT JOIN public."fiscalClassificationV2" fc
      ON fc.fiscal_classification_id = pf.fiscal_classification_id
     AND fc.is_active = TRUE
    LEFT JOIN public."fiscalProfileV2" fp
      ON fp.fiscal_profile_id = fc.fiscal_profile_id
     AND fp.is_active = TRUE

    WHERE (${where.join(' OR ')})
    ORDER BY p.product_id DESC
    LIMIT 1
  `,
        params,
    );

    return result.rows[0] || null;
}
