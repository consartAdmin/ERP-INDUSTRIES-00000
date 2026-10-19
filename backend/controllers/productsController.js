// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║ 📦 productsController.js — Products (CONSART ERP | ESM)                  ║
// ║ Camada HTTP: traduz req/res para productsApi e padroniza respostas.      ║
// ║                                                                           ║
// ║ Regras de cadastro, validação e SQL de products ficam em:                 ║
// ║   services/apis/products/productsApi.js                                   ║
// ║   database/catalog/catalog_schema.products.js                             ║
// ║                                                                           ║
// ║ Permanecem aqui: upload de imagens (GCS), opções de filtros, unidades     ║
// ║ e relatórios de posição de estoque (JSON / PDF / Excel).                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

import pool from '../config/db.js';
import { Storage } from '@google-cloud/storage';

import productsApi, { ProductsApiError } from '../repositories/products/products.index.js';
import { PRODUCTS_TABLE } from '../repositories/products/products.catalog.js';

import productsGroupsApi from '../repositories/productsGroups/productsGroups.index.js';
import productsManufacturersApi from '../repositories/productsManufacturers/productsManufacturers.index.js';
import productsSuppliersApi from '../repositories/productsSuppliers/productsSuppliers.index.js';
import * as productMovementsApi from '../repositories/productMovements/productMovements.index.js';

import { generateStockPositionPdf as buildStockPositionPdf } from '../generationPdf/generateStockPositionPdf.js';
import { generateReportsProductsStockExcel } from '../generationExcel/generationReportsProductsStockExcel.js';
import { generateProductsExcel } from '../generationExcel/generationProductsExcel.js';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const TABLE_IMAGES = 'public."productsImages"';
const TABLE_STOCK = 'public."productsStock"';
const TABLE_BARCODES = 'public."productsBarCode"';
const TABLE_LOCATIONS = 'public."productsLocations"';
const TABLE_SUBGROUPS = 'public."productsSubgroups"';

const OPTIONS_LIMIT = 1000;
const STOCK_POSITION_PDF_LIMIT = 5000;
const STOCK_POSITION_MAX_LIMIT = 500;

// Erros de entrada do PostgreSQL que devem virar 400 em vez de 500
// (tipo inválido, overflow numérico, texto longo demais, NOT NULL).
const PG_INPUT_ERRORS = new Set(['22P02', '22003', '22001', '23502']);

// CSTs de ICMS que exigem base/alíquota/valor de ICMS-ST no lote.
const ICMS_ST_CSTS = new Set(['10', '30', '60', '70']);

// ---------------------------------------------------------------------------
// Configuração Google Cloud Storage
// Exemplo de path final:
//   erp-infinity-00000/productsImagens/00004828/1726750000000-00004828-descricao.webp
// ---------------------------------------------------------------------------
const GCS_BUCKET_PRODUCTS =
  process.env.GCS_BUCKET_PRODUCTS ||
  process.env.GCS_BUCKET ||
  'erp-infinity-00000';

const GCS_PREFIX_PRODUCTS = process.env.GCS_PREFIX_PRODUCTS || 'productsImagens';

const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET_PRODUCTS);

const IMAGE_EXTENSIONS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
});

const TRUTHY_VALUES = new Set(['true', '1', 'yes', 'sim', 'on']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function productCodeParam(req) {
  return String(req.params.product_code ?? '').trim();
}

function positiveIntegerOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function optionalNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// Campos vazios ('' ou null) são ignorados: no INSERT o banco aplica o default
// e no UPDATE o valor atual é mantido (mesmo comportamento do COALESCE anterior).
function omitBlankFields(body) {
  return Object.fromEntries(
    Object.entries(body ?? {}).filter(
      ([, value]) => value !== undefined && value !== null && String(value).trim() !== '',
    ),
  );
}

function sendError(res, error, context, fallbackMessage) {
  if (error instanceof ProductsApiError) {
    if (error.status >= 500) console.error(`[products][${context}]`, error);
    return res.status(error.status).json({
      ok: false,
      error: error.message,
      code: error.code,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
  }

  if (PG_INPUT_ERRORS.has(error?.code)) {
    return res.status(400).json({
      ok: false,
      error: 'Dados inválidos para o produto.',
      code: 'PRODUCT_INVALID_INPUT',
      details: error.message,
    });
  }

  console.error(`[products][${context}]`, error);
  return res.status(500).json({
    ok: false,
    error: fallbackMessage,
    details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
  });
}

function slugify(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^\w]+/g, '_')         // tudo que não é letra/número vira _
    .replace(/^_+|_+$/g, '')         // tira _ do começo/fim
    .toLowerCase();
}

function lotFiscalStatus(lot) {
  if (lot.inbound_item_id == null) return 'SEM_ITEM_ENTRADA';

  if ([lot.icms_cst, lot.icms_base, lot.icms_rate, lot.icms_value].some((v) => v == null)) {
    return 'ICMS_INCOMPLETO';
  }

  if (
    ICMS_ST_CSTS.has(String(lot.icms_cst))
    && [lot.icms_st_base, lot.icms_st_rate, lot.icms_st_value].some((v) => v == null)
  ) {
    return 'ICMS_ST_INCOMPLETO';
  }

  return 'OK';
}

// ===========================================================================
// GET /api/products?limit=&page=&sort=&dir=&active=&status=&q=
//     &manufacturer_id=&supplier_id=&group_id=&subgroup_id=
// ===========================================================================
export async function list(req, res) {
  try {
    const result = await productsApi.list(req.query);
    return res.json({ ok: true, ...result });
  } catch (err) {
    return sendError(res, err, 'list', 'Erro ao listar produtos.');
  }
}

// ===========================================================================
// GET /api/products/search?q=&limit=&page=
// Busca somente produtos ativos (code, description, barcode, manufacturer_ref
// e códigos de barras ativos em productsBarCode).
// ===========================================================================
export async function search(req, res) {
  try {
    const term = String(req.query.q ?? '').trim();
    let result = await productsApi.search({ ...req.query, q: term });

    // Leitores/colagens às vezes trazem separadores ("789-1234-5678-9").
    // Sem resultado, tenta novamente só com os dígitos (EAN/GTIN).
    const digits = term.replace(/\D+/g, '');
    if (!result.rows.length && digits.length >= 8 && digits !== term) {
      result = await productsApi.search({ ...req.query, q: digits });
    }

    return res.json({ ok: true, ...result });
  } catch (err) {
    return sendError(res, err, 'search', 'Erro ao pesquisar produtos.');
  }
}

// ===========================================================================
// GET /api/products/:product_code
// ===========================================================================
export async function getById(req, res) {
  try {
    const product = await productsApi.getByCode(req.params.product_code);
    const lots = Array.isArray(product.lots) ? product.lots : [];

    return res.json({
      ok: true,
      data: {
        ...product,
        lots: lots.map((lot) => ({
          ...lot,
          inbound_product_code: lot.inbound_item_id == null ? null : product.product_code,
          fiscal_status: lotFiscalStatus(lot),
        })),
      },
    });
  } catch (err) {
    return sendError(res, err, 'getById', 'Erro ao buscar produto.');
  }
}

// ===========================================================================
// POST /api/products
// product_code omitido/vazio → gerado por trg_products_autogen_code.
// ===========================================================================
export async function create(req, res) {
  try {
    const data = await productsApi.create(omitBlankFields(req.body));
    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'create', 'Erro ao criar produto.');
  }
}

// ===========================================================================
// PUT /api/products/:product_code
// Atualiza os campos enviados + localização (corredor/prateleira/bandeja/box).
// ===========================================================================
export async function update(req, res) {
  try {
    const updated = await productsApi.updateByCode(
      req.params.product_code,
      omitBlankFields(req.body),
    );

    return res.json({
      ok: true,
      data: { ...updated, realLocationId: updated.realLocationId ?? null },
    });
  } catch (err) {
    return sendError(res, err, 'update', 'Erro ao atualizar produto.');
  }
}

// ===========================================================================
// PUT /api/products/by-code/:product_code — atualiza somente o barcode
// barcode vazio ou null limpa o campo.
// ===========================================================================
export async function updateBarcode(req, res) {
  if (!Object.prototype.hasOwnProperty.call(req.body ?? {}, 'barcode')) {
    return res.status(400).json({ ok: false, error: 'barcode é obrigatório.' });
  }

  try {
    const data = await productsApi.updateBarcodeByCode(req.params.product_code, req.body.barcode);
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'updateBarcode', 'Erro ao atualizar código de barras do produto.');
  }
}

// ===========================================================================
// DELETE /api/products/:product_code  (soft delete)
// ===========================================================================
export async function remove(req, res) {
  try {
    const data = await productsApi.softDeleteByCode(req.params.product_code);
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'remove', 'Erro ao remover produto.');
  }
}

// ===========================================================================
// PUT /api/products/:product_code/restore  (reativar)
// ===========================================================================
export async function restore(req, res) {
  try {
    const data = await productsApi.restoreByCode(req.params.product_code);
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'restore', 'Erro ao restaurar produto.');
  }
}

// ===========================================================================
// GET /api/products/cost-map?codes=00006074,00008395
// Retorna { "00006074": 8.82, "00008395": 1.13, ... }
// ===========================================================================
export async function getCostMap(req, res) {
  try {
    const raw = String(req.query.codes || req.query.skus || '');
    const data = await productsApi.getCostMap(raw.split(','));
    return res.json({ ok: true, data });
  } catch (err) {
    return sendError(res, err, 'getCostMap', 'Erro ao buscar custos.');
  }
}

// ===========================================================================
// GET /api/products/:product_code/units  (Budgets / Orders)
// ===========================================================================
export async function listUnits(req, res) {
  const productCode = productCodeParam(req);
  if (!productCode) {
    return res.status(400).json({ ok: false, error: 'product_code é obrigatório.' });
  }

  try {
    const { rows } = await pool.query(
      `
        SELECT
          barcode_id,
          product_code,
          product_unit_id,
          barcode,
          unit_id,
          unit,
          description AS unit_description,
          COALESCE(fator, 1) AS fator,
          COALESCE(standard, false) AS standard
        FROM ${TABLE_BARCODES}
        WHERE product_code = $1
          AND is_active IS TRUE
          AND unit IS NOT NULL
          AND TRIM(unit) <> ''
        ORDER BY
          COALESCE(standard, false) DESC,
          COALESCE(fator, 1) ASC,
          unit ASC
      `,
      [productCode],
    );

    return res.json({ ok: true, rows });
  } catch (err) {
    return sendError(res, err, 'units', 'Erro ao carregar unidades do produto.');
  }
}

// ===========================================================================
// GET /api/products/:product_code/registros
// ===========================================================================
export async function getProductMovements(req, res) {
  try {
    const rows = await productMovementsApi.listByProductCode(productCodeParam(req));
    return res.json({ ok: true, rows });
  } catch (err) {
    return sendError(res, err, 'registros', 'Erro ao carregar registros do produto.');
  }
}

// ===========================================================================
// Opções de filtros
// GET /api/products/products-groups
// GET /api/products/products-subgroups?group_id=
// GET /api/products/products-manufactures
// GET /api/products/products-suppliers
// ===========================================================================
async function sendOptions(res, context, loader) {
  try {
    const data = await loader();
    return res.json({ ok: true, rows: data?.rows || data || [] });
  } catch (err) {
    return sendError(res, err, context, 'Erro ao carregar opções de filtro.');
  }
}

export function listGroupOptions(_req, res) {
  return sendOptions(res, 'products-groups', () =>
    productsGroupsApi.list({ limit: OPTIONS_LIMIT, page: 1 }));
}

export function listManufacturerOptions(_req, res) {
  return sendOptions(res, 'products-manufactures', () =>
    productsManufacturersApi.list({ limit: OPTIONS_LIMIT, page: 1 }));
}

export function listSupplierOptions(_req, res) {
  return sendOptions(res, 'products-suppliers', () =>
    productsSuppliersApi.list({ limit: OPTIONS_LIMIT, page: 1 }));
}

export function listSubgroupOptions(req, res) {
  const groupId = positiveIntegerOrNull(req.query.group_id);

  return sendOptions(res, 'products-subgroups', async () => {
    const { rows } = await pool.query(
      `
        SELECT product_subgroup_id, product_group_id, name
        FROM ${TABLE_SUBGROUPS}
        ${groupId ? 'WHERE product_group_id = $1' : ''}
        ORDER BY name ASC
      `,
      groupId ? [groupId] : [],
    );
    return rows;
  });
}

// ===========================================================================
// Upload de imagem
// POST /api/products/:product_code/imagem
// Aceita arquivo (multipart "file"/"foto") ou "imagemBase64"/"imageBase64".
// barcode_id opcional vincula a imagem a uma unidade (PCT, FD...).
// ===========================================================================
function readUploadedImage(req) {
  if (req.file) {
    return { buffer: req.file.buffer, mimeType: req.file.mimetype || 'image/jpeg' };
  }

  const base64 = req.body?.imagemBase64 || req.body?.imageBase64;
  if (!base64) return null;

  // "data:image/png;base64,AAAA..." ou apenas "AAAA..."
  const text = String(base64);
  const commaIndex = text.indexOf(',');
  const header = commaIndex >= 0 ? text.slice(0, commaIndex) : '';
  const hasHeader = header.startsWith('data:') && header.includes(';base64');

  return {
    buffer: Buffer.from(hasHeader ? text.slice(commaIndex + 1) : text, 'base64'),
    mimeType: (hasHeader && header.slice(5, header.indexOf(';'))) || 'image/jpeg',
  };
}

async function registerProductImage({
  productCode,
  barcodeId,
  imageUrl,
  imagePath,
  imageAlt,
  requestedPrimary,
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Imagens da mesma unidade. NULL representa a imagem geral do produto.
    const { rows: existing } = await client.query(
      `
        SELECT product_image_id, is_primary, position
        FROM ${TABLE_IMAGES}
        WHERE product_code = $1
          AND barcode_id IS NOT DISTINCT FROM $2
          AND is_active = TRUE
        ORDER BY position ASC, product_image_id ASC
      `,
      [productCode, barcodeId],
    );

    const isPrimary = requestedPrimary || existing.length === 0;
    const lastPosition = existing.length
      ? (existing[existing.length - 1].position || existing.length)
      : 0;

    if (isPrimary && existing.length) {
      await client.query(
        `
          UPDATE ${TABLE_IMAGES}
          SET is_primary = FALSE, updated_at = NOW()
          WHERE product_code = $1
            AND barcode_id IS NOT DISTINCT FROM $2
            AND is_primary = TRUE
        `,
        [productCode, barcodeId],
      );
    }

    const { rows: [image] } = await client.query(
      `
        INSERT INTO ${TABLE_IMAGES}
          (product_code, barcode_id, image_url, image_path, image_alt,
           is_primary, position, created_at, updated_at, is_active)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), TRUE)
        RETURNING
          product_image_id,
          product_code,
          barcode_id,
          image_url,
          image_path,
          image_alt,
          is_primary,
          position,
          is_active
      `,
      [productCode, barcodeId, imageUrl, imagePath, imageAlt, isPrimary, lastPosition + 1],
    );

    // O ponteiro global recebe apenas imagem geral. Imagens de PCT/FD.5
    // continuam independentes por barcode_id.
    if (barcodeId === null) {
      await client.query(
        `
          UPDATE ${PRODUCTS_TABLE}
          SET product_imagem_id = $1, updated_at = NOW()
          WHERE product_code = $2
        `,
        [image.product_image_id, productCode],
      );
    }

    await client.query('COMMIT');
    return image;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function uploadImage(req, res) {
  const productCode = productCodeParam(req);
  if (!productCode) {
    return res.status(400).json({ ok: false, error: 'product_code é obrigatório.' });
  }

  const barcodeIdRaw = req.body?.barcode_id;
  const hasBarcodeId = barcodeIdRaw !== undefined && barcodeIdRaw !== null && barcodeIdRaw !== '';
  const barcodeId = hasBarcodeId ? positiveIntegerOrNull(barcodeIdRaw) : null;

  if (hasBarcodeId && barcodeId === null) {
    return res.status(400).json({ ok: false, error: 'barcode_id inválido.' });
  }

  try {
    const { rows: [product] } = await pool.query(
      `SELECT product_code, description FROM ${PRODUCTS_TABLE} WHERE product_code = $1`,
      [productCode],
    );

    if (!product) {
      return res.status(404).json({ ok: false, error: 'Produto não encontrado.' });
    }

    if (barcodeId !== null) {
      const { rows } = await pool.query(
        `
          SELECT barcode_id
          FROM ${TABLE_BARCODES}
          WHERE barcode_id = $1
            AND product_code = $2
            AND is_active = TRUE
          LIMIT 1
        `,
        [barcodeId, productCode],
      );

      if (!rows.length) {
        return res.status(400).json({
          ok: false,
          error: 'O barcode_id não pertence ao product_code informado.',
        });
      }
    }

    const image = readUploadedImage(req);
    if (!image?.buffer?.length) {
      return res.status(400).json({
        ok: false,
        error: 'Nenhuma imagem enviada. Use campo "file"/"foto" ou "imagemBase64".',
      });
    }

    const ext = IMAGE_EXTENSIONS[image.mimeType];
    if (!ext) {
      return res.status(415).json({
        ok: false,
        error: `Tipo de imagem não suportado (${image.mimeType}). Use JPEG, PNG ou WEBP.`,
      });
    }

    const skuSlug = slugify(product.product_code) || productCode;
    const descSlug = slugify(product.description) || 'produto';
    const gcsPath = `${GCS_PREFIX_PRODUCTS}/${skuSlug}/${Date.now()}-${skuSlug}-${descSlug}.${ext}`;
    const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_PRODUCTS}/${gcsPath}`;

    try {
      await bucket.file(gcsPath).save(image.buffer, {
        resumable: false,
        contentType: image.mimeType,
      });
    } catch (gcsErr) {
      console.error('[products][uploadImage] erro ao enviar para GCS:', gcsErr);
      return res.status(500).json({ ok: false, error: 'Erro ao enviar imagem para storage.' });
    }

    try {
      const data = await registerProductImage({
        productCode,
        barcodeId,
        imageUrl: publicUrl,
        imagePath: gcsPath,
        imageAlt: req.body?.imageAlt || req.body?.image_alt || null,
        requestedPrimary: TRUTHY_VALUES.has(
          String(req.body?.is_primary ?? '').trim().toLowerCase(),
        ),
      });
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.error('[products][uploadImage] erro ao registrar imagem no banco:', dbErr);

      // O upload no GCS foi concluído; devolve a URL para o front não perder o arquivo.
      return res.json({
        ok: true,
        data: { image_url: publicUrl, image_path: gcsPath },
        warning: 'Imagem enviada ao storage, mas houve erro ao registrar em productsImages.',
      });
    }
  } catch (err) {
    return sendError(res, err, 'uploadImage', 'Erro interno ao fazer upload da imagem.');
  }
}

// ===========================================================================
// GET /api/products/export — lista de produtos em XLSX
// ===========================================================================
export async function exportExcel(req, res) {
  return generateProductsExcel(req, res, pool);
}

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ Posição de Estoque (Custo x Quantidade)                              ║
// ║   GET /api/products/stock-position         → JSON paginado           ║
// ║   GET /api/products/stock-position/pdf     → PDF                     ║
// ║   GET /api/products/stock-position/excel   → XLSX                    ║
// ╚══════════════════════════════════════════════════════════════════════╝
const STOCK_TOTAL_EXPR = '(COALESCE(p.cost_price,0) * COALESCE(ps.stock_qty,0))';

const STOCK_POSITION_ORDER = Object.freeze({
  description_asc: 'p.description ASC NULLS LAST',
  description_desc: 'p.description DESC NULLS LAST',
  code_asc: 'p.product_code ASC',
  code_desc: 'p.product_code DESC',
  sku_asc: 'p.product_code ASC',
  sku_desc: 'p.product_code DESC',
  stock_desc: 'COALESCE(ps.stock_qty,0) DESC NULLS LAST',
  stock_asc: 'COALESCE(ps.stock_qty,0) ASC NULLS LAST',
  cost_desc: 'COALESCE(p.cost_price,0) DESC NULLS LAST',
  cost_asc: 'COALESCE(p.cost_price,0) ASC NULLS LAST',
  total_desc: `${STOCK_TOTAL_EXPR} DESC NULLS LAST`,
  total_asc: `${STOCK_TOTAL_EXPR} ASC NULLS LAST`,
  total_value_desc: `${STOCK_TOTAL_EXPR} DESC NULLS LAST`,
  total_value_asc: `${STOCK_TOTAL_EXPR} ASC NULLS LAST`,
});

function stockPositionOrder(value) {
  const key = String(value || 'description_asc').trim().toLowerCase();
  return STOCK_POSITION_ORDER[key] || STOCK_POSITION_ORDER.description_asc;
}

// Filtros compartilhados entre o JSON e o PDF (mesmos filtros da tela).
function buildStockPositionFilters(query = {}) {
  const params = [];
  const where = [];
  const bind = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  const activeRaw = query.active;
  if (activeRaw === undefined || activeRaw === null || activeRaw === '') {
    where.push('p.is_active IS DISTINCT FROM FALSE');
  } else {
    const active = String(activeRaw).toLowerCase() === 'true' || String(activeRaw) === '1';
    where.push(`p.is_active = ${bind(active)}`);
  }

  const q = String(query.q || '').trim();
  if (q) {
    const placeholder = bind(`%${q}%`);
    where.push(`(p.product_code ILIKE ${placeholder} OR p.description ILIKE ${placeholder})`);
  }

  const idFilters = [
    ['supplier_id', 'p.supplier_id'],
    ['group_id', 'p.product_group_id'],
    ['subgroup_id', 'p.product_subgroup_id'],
    ['brand_id', 'p.manufacturer_id'],
  ];

  for (const [input, column] of idFilters) {
    const value = optionalNumber(query[input]);
    if (value !== null) where.push(`${column} = ${bind(value)}`);
  }

  if (String(query.only_stock || '') === '1') {
    where.push('COALESCE(ps.stock_qty, 0) > 0');
  }

  const costMin = optionalNumber(query.cost_min);
  if (costMin !== null) where.push(`COALESCE(p.cost_price, 0) >= ${bind(costMin)}`);

  const costMax = optionalNumber(query.cost_max);
  if (costMax !== null) where.push(`COALESCE(p.cost_price, 0) <= ${bind(costMax)}`);

  return {
    q,
    params,
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    orderSql: stockPositionOrder(query.order),
  };
}

export async function stockPositionList(req, res) {
  try {
    const page = positiveIntegerOrNull(req.query.page) ?? 1;
    const limit = Math.min(STOCK_POSITION_MAX_LIMIT, positiveIntegerOrNull(req.query.limit) ?? 50);
    const offset = (page - 1) * limit;

    const { params, whereSql, orderSql } = buildStockPositionFilters(req.query);

    const sqlRows = `
      SELECT
        p.product_code            AS code,
        p.description             AS description,
        COALESCE(p.cost_price,0)  AS cost,
        COALESCE(ps.stock_qty,0)  AS stock,
        ${STOCK_TOTAL_EXPR}       AS total_value
      FROM ${PRODUCTS_TABLE} p
      LEFT JOIN ${TABLE_STOCK} ps
        ON ps.product_stock_id = p.product_stock_id
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const sqlAgg = `
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(COALESCE(ps.stock_qty,0)), 0)::numeric AS sum_stock,
        COALESCE(SUM(${STOCK_TOTAL_EXPR}), 0)::numeric AS sum_cost
      FROM ${PRODUCTS_TABLE} p
      LEFT JOIN ${TABLE_STOCK} ps
        ON ps.product_stock_id = p.product_stock_id
      ${whereSql}
    `;

    const [rowsResult, aggResult] = await Promise.all([
      pool.query(sqlRows, [...params, limit, offset]),
      pool.query(sqlAgg, params),
    ]);

    const agg = aggResult.rows[0] ?? {};

    return res.json({
      ok: true,
      data: {
        page,
        limit,
        total: Number(agg.total ?? 0),
        rows: rowsResult.rows,
        summary: {
          sum_stock: Number(agg.sum_stock ?? 0),
          sum_cost: Number(agg.sum_cost ?? 0),
        },
      },
    });
  } catch (err) {
    return sendError(res, err, 'stockPositionList', 'Erro ao gerar posição de estoque.');
  }
}

export async function stockPositionPdf(req, res) {
  try {
    const { q, params, whereSql, orderSql } = buildStockPositionFilters(req.query);

    const { rows } = await pool.query(
      `
        SELECT
          p.product_code             AS code,
          p.description              AS description,
          COALESCE(p.cost_price, 0)  AS cost,
          COALESCE(ps.stock_qty, 0)  AS stock
        FROM ${PRODUCTS_TABLE} p
        LEFT JOIN ${TABLE_STOCK} ps
          ON ps.product_stock_id = p.product_stock_id
        ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ${STOCK_POSITION_PDF_LIMIT}
      `,
      params,
    );

    const pdfBuffer = await buildStockPositionPdf({ rows, filterText: q });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="posicao_estoque.pdf"');
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    return sendError(res, err, 'stockPositionPdf', 'Erro ao gerar PDF da posição de estoque.');
  }
}

export async function stockPositionExcel(req, res) {
  const { order = 'description_asc', only_stock = '0', active = '1' } = req.query;

  try {
    const where = [];
    if (String(only_stock) === '1') where.push('COALESCE(ps.stock_qty, 0) > 0');
    if (String(active) === '1') where.push('COALESCE(p.is_active, true) IS TRUE');

    const { rows } = await pool.query(`
      SELECT
        p.product_id AS id,
        p.product_code AS codigo,
        p.description AS descricao,
        COALESCE(loc.localizacao, '') AS localizacao,
        COALESCE(p.cost_price, 0)::numeric AS custo,
        COALESCE(ps.stock_qty, 0)::numeric AS estoque
      FROM ${PRODUCTS_TABLE} p
      LEFT JOIN ${TABLE_STOCK} ps
        ON ps.product_stock_id = p.product_stock_id
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(
            DISTINCT NULLIF(TRIM(CONCAT_WS(' - ',
              NULLIF(TRIM(pl.corredor), ''),
              NULLIF(TRIM(pl.prateleira), ''),
              NULLIF(TRIM(pl.bandeja), ''),
              NULLIF(TRIM(pl.box), ''),
              NULLIF(TRIM(pl.observacao), '')
            )), ''),
            ' | '
          ) AS localizacao
        FROM ${TABLE_LOCATIONS} pl
        WHERE TRIM(pl.product_code) = TRIM(p.product_code)
          AND pl.is_active = TRUE
      ) loc ON TRUE
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${stockPositionOrder(order)}
    `);

    return generateReportsProductsStockExcel(rows, { order, only_stock, active }, res);
  } catch (err) {
    return sendError(res, err, 'stockPositionExcel', 'Erro ao gerar Excel da posição de estoque.');
  }
}

// ---------------------------------------------------------------------------
// Export default
// ---------------------------------------------------------------------------
export default {
  list,
  search,
  getById,
  create,
  update,
  updateBarcode,
  remove,
  restore,
  getCostMap,
  listUnits,
  getProductMovements,
  listGroupOptions,
  listSubgroupOptions,
  listManufacturerOptions,
  listSupplierOptions,
  uploadImage,
  exportExcel,
  stockPositionList,
  stockPositionPdf,
  stockPositionExcel,
};
