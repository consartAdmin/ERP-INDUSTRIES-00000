// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ backend/generationExcel/generationProductsExcel.js                       ║
// ║ Geração e envio da planilha Excel de produtos                            ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import ExcelJS from 'exceljs';

// ─────────────────────────────────────────────────────────────────────────────
// Configurações da planilha
// ─────────────────────────────────────────────────────────────────────────────

const WORKSHEET_NAME = 'Produtos';
const FILE_NAME = 'produtos.xlsx';
const EXCEL_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const HEADER_COLOR = 'FF111827';
const HEADER_TEXT_COLOR = 'FFFFFFFF';
const BORDER_COLOR = 'FFE5E7EB';
const ZEBRA_COLOR = 'FFF9FAFB';

const CENTERED_COLUMNS = [
    'sku',
    'barcode',
    'ref_fab',
    'preco_custo',
    'preco_varejo',
    'estoque',
    'prod_fiscal',
    'foto',
    'largura_cm',
    'comprimento_cm',
    'altura_cm',
    'peso_kg',
];

// ─────────────────────────────────────────────────────────────────────────────
// Consulta dos produtos
// Sem LIMIT/OFFSET: exporta todos os produtos retornados pela consulta.
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTS_EXPORT_SQL = `
  SELECT
    p.product_code,
    p.description,
    pbc.barcode,
    p.manufacturer_ref,
    p.cost_price,
    COALESCE(ps.stock_qty, 0) AS stock_qty,
    pp.sale_price AS price_varejo,

EXISTS (
  SELECT 1
  FROM public."productsFiscalV2" pf
  WHERE TRIM(pf.product_code) = TRIM(p.product_code::text)
    AND pf.is_current IS TRUE
    AND pf.is_active IS TRUE
) AS has_fiscal_product,

    CASE
      WHEN pi.image_url IS NOT NULL THEN TRUE
      ELSE FALSE
    END AS has_image,

    pbc.width_cm,
    pbc.length_cm,
    pbc.height_cm,
    pbc.weight_kg

  FROM public."products" p

  LEFT JOIN public."productsStock" ps
    ON ps.product_stock_id = p.product_stock_id

  LEFT JOIN public."productsPrices" pp
    ON pp.product_code = p.product_code::text
   AND pp.price_id = 1

  -- Unidade/código de barras principal do produto.
  -- Prioriza o registro ativo marcado como padrão e evita duplicar produtos.
  LEFT JOIN LATERAL (
    SELECT
      bc.barcode,
      bc.width_cm,
      bc.length_cm,
      bc.height_cm,
      bc.weight_kg
    FROM public."productsBarCode" bc
    WHERE bc.product_code::text = p.product_code::text
      AND bc.is_active IS TRUE
    ORDER BY
      bc.standard DESC NULLS LAST,
      bc.barcode_id ASC
    LIMIT 1
  ) pbc ON TRUE

  LEFT JOIN LATERAL (
    SELECT img.image_url
    FROM public."productsImages" img
    WHERE img.product_code = p.product_code
      AND img.is_active = TRUE
    ORDER BY
      (img.barcode_id IS NULL) DESC,
      img.is_primary DESC,
      img.position ASC,
      img.product_image_id ASC
    LIMIT 1
  ) pi ON TRUE

  ORDER BY p.product_code DESC
`;

// ─────────────────────────────────────────────────────────────────────────────
// Conversão segura de valores
// ─────────────────────────────────────────────────────────────────────────────

function textOrEmpty(value) {
    return value == null ? '' : String(value).trim();
}

function numberOrZero(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Estrutura das colunas
// ─────────────────────────────────────────────────────────────────────────────

function configureColumns(worksheet) {
    worksheet.columns = [
        { header: 'SKU', key: 'sku', width: 12 },
        { header: 'Descrição', key: 'descricao', width: 60 },
        { header: 'Código de Barras', key: 'barcode', width: 20 },
        { header: 'Ref. Fabricante', key: 'ref_fab', width: 18 },
        { header: 'Preço Custo', key: 'preco_custo', width: 14 },
        { header: 'Preço Varejo', key: 'preco_varejo', width: 14 },
        { header: 'Estoque', key: 'estoque', width: 10 },
        { header: 'Produto Fiscal', key: 'prod_fiscal', width: 14 },
        { header: 'Foto?', key: 'foto', width: 10 },
        { header: 'Largura (cm)', key: 'largura_cm', width: 14 },
        { header: 'Comprimento (cm)', key: 'comprimento_cm', width: 16 },
        { header: 'Altura (cm)', key: 'altura_cm', width: 14 },
        { header: 'Peso (kg)', key: 'peso_kg', width: 12 },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Cabeçalho
// ─────────────────────────────────────────────────────────────────────────────

function styleHeader(worksheet) {
    const headerRow = worksheet.getRow(1);

    headerRow.font = {
        bold: true,
        color: { argb: HEADER_TEXT_COLOR },
    };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_COLOR },
    };
    headerRow.alignment = {
        horizontal: 'center',
        vertical: 'middle',
    };
    headerRow.height = 22;
}

// ─────────────────────────────────────────────────────────────────────────────
// Linhas de dados
// ─────────────────────────────────────────────────────────────────────────────

function addProductRows(worksheet, products) {
    for (const product of products) {
        const row = worksheet.addRow({
            sku: textOrEmpty(product.product_code),
            descricao: textOrEmpty(product.description),
            barcode: textOrEmpty(product.barcode),
            ref_fab: textOrEmpty(product.manufacturer_ref),
            preco_custo: numberOrZero(product.cost_price),
            preco_varejo: numberOrZero(product.price_varejo),
            estoque: numberOrZero(product.stock_qty),
            prod_fiscal: product.has_fiscal_product ? '✓' : '✕',
            foto: product.has_image ? 'Sim' : 'Não',
            largura_cm: nullableNumber(product.width_cm),
            comprimento_cm: nullableNumber(product.length_cm),
            altura_cm: nullableNumber(product.height_cm),
            peso_kg: nullableNumber(product.weight_kg),
        });

        for (const column of CENTERED_COLUMNS) {
            row.getCell(column).alignment = {
                horizontal: 'center',
                vertical: 'middle',
            };
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatação numérica
// ─────────────────────────────────────────────────────────────────────────────

function applyNumberFormats(worksheet, lastRowNumber) {
    for (let rowNumber = 2; rowNumber <= lastRowNumber; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);

        row.getCell('preco_custo').numFmt = 'R$ #,##0.00';
        row.getCell('preco_varejo').numFmt = 'R$ #,##0.00';
        row.getCell('largura_cm').numFmt = '#,##0.000';
        row.getCell('comprimento_cm').numFmt = '#,##0.000';
        row.getCell('altura_cm').numFmt = '#,##0.000';
        row.getCell('peso_kg').numFmt = '#,##0.000';
        row.height = 18;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Destaque da coluna SKU
// ─────────────────────────────────────────────────────────────────────────────

function styleSkuColumn(worksheet) {
    worksheet.getColumn('sku').eachCell((cell, rowNumber) => {
        if (rowNumber === 1) return;

        cell.font = {
            ...(cell.font || {}),
            bold: true,
        };
        cell.alignment = {
            ...(cell.alignment || {}),
            horizontal: 'center',
            vertical: 'middle',
        };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bordas e efeito zebra
// ─────────────────────────────────────────────────────────────────────────────

function applyBordersAndZebra(worksheet, lastRowNumber) {
    for (let rowNumber = 1; rowNumber <= lastRowNumber; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: BORDER_COLOR } },
                left: { style: 'thin', color: { argb: BORDER_COLOR } },
                bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
                right: { style: 'thin', color: { argb: BORDER_COLOR } },
            };
        });

        if (rowNumber >= 2 && rowNumber % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: ZEBRA_COLOR },
            };
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtro e congelamento do cabeçalho
// ─────────────────────────────────────────────────────────────────────────────

function configureWorksheetView(worksheet) {
    worksheet.autoFilter = {
        from: 'A1',
        to: 'M1',
    };

    worksheet.views = [
        {
            state: 'frozen',
            xSplit: 0,
            ySplit: 1,
        },
    ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Criação do workbook
// ─────────────────────────────────────────────────────────────────────────────

function buildWorkbook(products) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(WORKSHEET_NAME);

    workbook.creator = 'CONSART ERP';
    workbook.created = new Date();
    workbook.modified = new Date();

    configureColumns(worksheet);
    styleHeader(worksheet);
    addProductRows(worksheet, products);

    const lastRowNumber = worksheet.lastRow?.number || 1;

    applyNumberFormats(worksheet, lastRowNumber);
    styleSkuColumn(worksheet);
    applyBordersAndZebra(worksheet, lastRowNumber);
    configureWorksheetView(worksheet);

    return workbook;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resposta HTTP
// ─────────────────────────────────────────────────────────────────────────────

async function sendWorkbook(res, workbook) {
    res.status(200);
    res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${FILE_NAME}"`,
    );
    res.setHeader('Cache-Control', 'no-store');

    await workbook.xlsx.write(res);
    res.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Consulta todos os produtos, gera a planilha XLSX e envia o arquivo.
 *
 * @param {import('express').Request} req Requisição HTTP do Express.
 * @param {import('express').Response} res Resposta HTTP do Express.
 * @param {{ query: Function }} pool Pool de conexões do PostgreSQL.
 * @returns {Promise<void>}
 */
export async function generateProductsExcel(req, res, pool) {
    try {
        if (!pool || typeof pool.query !== 'function') {
            throw new TypeError('Pool de banco de dados inválido.');
        }

        const { rows } = await pool.query(PRODUCTS_EXPORT_SQL);

        console.info('[products][generateProductsExcel] success', {
            exportedRows: rows.length,
            filters: req.query || {},
        });

        const workbook = buildWorkbook(rows);
        await sendWorkbook(res, workbook);
    } catch (error) {
        console.error('[products][generateProductsExcel] error:', error);

        if (!res.headersSent) {
            res.status(500).json({
                ok: false,
                error: 'Falha ao exportar produtos.',
            });
            return;
        }

        if (!res.writableEnded) {
            res.end();
        }
    }
}
