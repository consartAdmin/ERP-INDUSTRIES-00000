// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ FILE: generationOrdersSeparationPdf.js                                     ║
// ║ MODULE: PDF — Separação de Pedido                                          ║
// ║ CONSART ERP — A4 paisagem | download direto                                ║
// ║ ✅ Compatível com STOCK_WITH_LOT e STOCK_SIMPLE                            ║
// ║ ✅ Hidrata imagem, localização, lote e estoque atual                       ║
// ║ ✅ Resolve imagens locais / URL / GCS                                      ║
// ║ ✅ Exibe Qtde do pedido + Estoque Atual                                    ║
// ║ ✅ Importa número e observação do orçamento vinculado                      ║
// ║ ✅ Compatível com output: response | file | buffer                         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pool from '../config/db.js';
import productsImagensApi from '../repositories/productsImagens/productsImagens.index.js';
import productsLocationsApi from '../repositories/productsLocations/productsLocations.index.js';
import productsStockManager from '../repositories/productsStock/productsStock.manager.js';

/* ──────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────── */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_REMOTE_BASE_URL =
  process.env.GCS_PUBLIC_BASE_URL ||
  'https://storage.googleapis.com/consart-erp';

const PAGE = {
  margin: 36,
  size: 'A4',
  layout: 'landscape',
};

const COLORS = {
  text: '#000000',
  border: '#000000',
  headerFill: '#f2f2f2',
  soft: '#666666',
};

const money = (value) =>
  Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function formatDateBR(iso) {
  if (!iso) return '';

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('/');
}

function sanitizeFilename(name) {
  return String(name || 'arquivo')
    .replace(/[\/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOr(value, alternative = '---') {
  return value === null ||
    value === undefined ||
    value === ''
    ? alternative
    : String(value);
}

function trunc(text, max = 60) {
  const value = String(text || '');

  return value.length > max
    ? `${value.slice(0, max - 3)}...`
    : value;
}

function defaultFilename(order) {
  const number =
    order?.number ||
    order?.order_number ||
    order?.order_id ||
    'pedido';

  const customer = String(
    order?.customer_name ||
    order?.nome_razao_social ||
    '',
  )
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .toLowerCase();

  return customer
    ? `pedido-separacao-${number}-${customer}.pdf`
    : `pedido-separacao-${number}.pdf`;
}

function normalizeSku(value) {
  return String(value || '').trim();
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return null;
}

function normalizeAddressPiece(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function formatLocationRow(row) {
  if (!row) return '';

  const corridorNumber =
    normalizeAddressPiece(row.corredor)
      .replace(/^CORREDOR\s*/i, '');

  const shelf =
    normalizeAddressPiece(row.prateleira)
      .replace(/^PRATELEIRA\s*/i, '');

  const tray =
    normalizeAddressPiece(row.bandeja)
      .replace(/^BANDEJA\s*/i, '');

  const box =
    normalizeAddressPiece(row.box)
      .replace(/^BOX\s*/i, '');

  const address = `${shelf}${tray}` || box;

  if (corridorNumber && address) {
    return `CORREDOR ${corridorNumber}, ${address}`;
  }

  if (corridorNumber) {
    return `CORREDOR ${corridorNumber}`;
  }

  if (address) {
    return address;
  }

  return '';
}

function parseLocationDisplay(locationText) {
  const raw = String(locationText || '').trim();

  if (!raw) {
    return {
      corredor: '',
      endereco: '',
    };
  }

  const normalized = raw
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim();

  const match = normalized.match(
    /^CORREDOR\s*(.+?)(?:,\s*(.+))?$/i,
  );

  if (match) {
    const corridorNumber =
      String(match[1] || '').trim();

    const addressPart =
      String(match[2] || '').trim();

    return {
      corredor: corridorNumber
        ? `CORREDOR ${corridorNumber}`
        : '',

      endereco: addressPart,
    };
  }

  return {
    corredor: '',
    endereco: normalized,
  };
}

function chooseBestLocation(rows = []) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return null;
  }

  return (
    rows.find((row) => row.is_active) ||
    rows[0] ||
    null
  );
}

function chooseBestLot(lots = [], item = {}) {
  if (
    !Array.isArray(lots) ||
    lots.length === 0
  ) {
    return null;
  }

  const wantedCode = firstNonEmpty(
    item?.lot_code,
    item?.lote,
    item?.batch,
  );

  if (wantedCode) {
    const exact = lots.find(
      (lot) =>
        String(lot.lot_code || '').trim() ===
        String(wantedCode).trim(),
    );

    if (exact) {
      return exact;
    }
  }

  const wantedLotId = firstNonEmpty(
    item?.lot_id,
  );

  if (wantedLotId !== null) {
    const exactById = lots.find(
      (lot) =>
        Number(lot.lot_id) ===
        Number(wantedLotId),
    );

    if (exactById) {
      return exactById;
    }
  }

  const quantity = Number(
    item.quantity ??
    item.quantidade ??
    0,
  );

  const availableEnough = lots.find(
    (lot) =>
      Number(lot.qty_available || 0) >= quantity &&
      Number(lot.qty_available || 0) > 0,
  );

  if (availableEnough) {
    return availableEnough;
  }

  const firstAvailable = lots.find(
    (lot) =>
      Number(lot.qty_available || 0) > 0,
  );

  if (firstAvailable) {
    return firstAvailable;
  }

  return lots[0];
}

function formatStock(value) {
  const number = Number(value || 0);

  return Number.isInteger(number)
    ? String(number)
    : number.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
}

function drawManualFillLine(
  doc,
  x,
  y,
  width,
  rowHeight,
) {
  const paddingX = 8;
  const lineY =
    y +
    Math.round(rowHeight / 2) +
    4;

  const x1 = x + paddingX;
  const x2 = x + width - paddingX;

  doc
    .save()
    .moveTo(x1, lineY)
    .lineTo(x2, lineY)
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .stroke()
    .restore();
}

function joinUniqueTexts(...parts) {
  const cleaned = parts
    .map((value) =>
      String(value || '').trim(),
    )
    .filter(Boolean);

  const unique = [];

  for (const part of cleaned) {
    const exists = unique.some(
      (saved) =>
        saved.toLowerCase() ===
        part.toLowerCase(),
    );

    if (!exists) {
      unique.push(part);
    }
  }

  return unique.join('\n');
}

function resolveBudgetDisplayNumber(order) {
  return firstNonEmpty(
    order?.budget_number,
    order?.budget_no,
    order?.orcamento_numero,
    order?.budget_row?.budget_number,
    order?.budget_row?.number,
    order?.budget_row?.numero,
  );
}

function resolveObservationText(object) {
  return firstNonEmpty(
    object?.notes,
    object?.observacoes,
    object?.observation,
    object?.obs,
    object?.observacao,
    object?.budget_notes,
    object?.order_notes,
  );
}

/* ──────────────────────────────────────────────────────────────
   Orçamento vinculado
────────────────────────────────────────────────────────────── */

async function getOrderLinkData(order) {
  const orderId = firstNonEmpty(
    order?.order_id,
    order?.id,
  );

  if (
    orderId === null ||
    String(orderId).trim() === ''
  ) {
    return null;
  }

  try {
    const result = await pool.query(
      `
      SELECT
        o.order_id,
        o.budget_id,
        o.origin_budget_id,
        o.budget_number,
        o.notes,
        o.observacoes,
        o.observation
      FROM public."orders" o
      WHERE o.order_id = $1
      LIMIT 1
      `,
      [Number(orderId)],
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      '[generationOrdersSeparationPdf] erro ao buscar vínculo do pedido/orçamento:',
      error?.message || error,
    );

    return null;
  }
}

async function getBudgetById(budgetId) {
  if (
    budgetId === null ||
    budgetId === undefined ||
    String(budgetId).trim() === ''
  ) {
    return null;
  }

  try {
    const result = await pool.query(
      `
      SELECT
        b.budget_id,
        b.number,
        b.budget_number,
        b.number AS numero,
        b.notes,
        b.observacoes,
        b.observation,
        b.obs,
        b.created_at
      FROM public."budgets" b
      WHERE b.budget_id = $1
      LIMIT 1
      `,
      [Number(budgetId)],
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      '[generationOrdersSeparationPdf] erro ao buscar orçamento por budget_id:',
      error?.message || error,
    );

    return null;
  }
}

async function getBudgetByNumber(
  budgetNumber,
) {
  if (
    budgetNumber === null ||
    budgetNumber === undefined ||
    String(budgetNumber).trim() === ''
  ) {
    return null;
  }

  try {
    const result = await pool.query(
      `
      SELECT
        b.budget_id,
        b.number,
        b.budget_number,
        b.number AS numero,
        b.notes,
        b.observacoes,
        b.observation,
        b.obs,
        b.created_at
      FROM public."budgets" b
      WHERE
        CAST(b.number AS TEXT) = $1
        OR CAST(b.budget_number AS TEXT) = $1
      ORDER BY b.budget_id DESC
      LIMIT 1
      `,
      [String(budgetNumber).trim()],
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error(
      '[generationOrdersSeparationPdf] erro ao buscar orçamento por número:',
      error?.message || error,
    );

    return null;
  }
}

async function resolveBudgetForOrder(order) {
  const directBudgetId = firstNonEmpty(
    order?.budget_id,
    order?.origin_budget_id,
  );

  const directBudgetNumber =
    firstNonEmpty(
      order?.budget_number,
      order?.budget_no,
      order?.orcamento_numero,
    );

  if (
    directBudgetId !== null &&
    String(directBudgetId).trim() !== ''
  ) {
    const budget =
      await getBudgetById(
        directBudgetId,
      );

    if (budget) {
      return budget;
    }
  }

  if (
    directBudgetNumber !== null &&
    String(directBudgetNumber).trim() !== ''
  ) {
    const budget =
      await getBudgetByNumber(
        directBudgetNumber,
      );

    if (budget) {
      return budget;
    }
  }

  const link =
    await getOrderLinkData(order);

  if (!link) {
    return null;
  }

  const linkedBudgetId = firstNonEmpty(
    link?.budget_id,
    link?.origin_budget_id,
  );

  const linkedBudgetNumber =
    firstNonEmpty(
      link?.budget_number,
    );

  if (
    linkedBudgetId !== null &&
    String(linkedBudgetId).trim() !== ''
  ) {
    const budget =
      await getBudgetById(
        linkedBudgetId,
      );

    if (budget) {
      return budget;
    }
  }

  if (
    linkedBudgetNumber !== null &&
    String(linkedBudgetNumber).trim() !== ''
  ) {
    const budget =
      await getBudgetByNumber(
        linkedBudgetNumber,
      );

    if (budget) {
      return budget;
    }
  }

  return null;
}

async function hydrateOrderWithBudget(
  order = {},
) {
  const budget =
    await resolveBudgetForOrder(order);

  const orderLink =
    await getOrderLinkData(order);

  const budgetNumber = firstNonEmpty(
    order?.budget_number,
    order?.budget_no,
    order?.orcamento_numero,
    orderLink?.budget_number,
    budget?.budget_number,
    budget?.number,
    budget?.numero,
  );

  const budgetObservation =
    resolveObservationText(budget);

  const orderObservation =
    firstNonEmpty(
      resolveObservationText(order),
      resolveObservationText(orderLink),
    );

  return {
    ...order,

    budget_id: firstNonEmpty(
      order?.budget_id,
      order?.origin_budget_id,
      orderLink?.budget_id,
      orderLink?.origin_budget_id,
      budget?.budget_id,
    ),

    budget_number:
      budgetNumber ?? null,

    budget_notes:
      budgetObservation || '',

    order_notes_resolved:
      orderObservation || '',

    notes_combined:
      joinUniqueTexts(
        orderObservation,
        budgetObservation,
      ),

    budget_row:
      budget || null,

    order_link_row:
      orderLink || null,
  };
}

/* ──────────────────────────────────────────────────────────────
   Produto e estoque
────────────────────────────────────────────────────────────── */

async function getProductFromDb(item) {
  const productId = firstNonEmpty(
    item?.product_id,
    item?.id_produto,
  );

  const sku = normalizeSku(
    firstNonEmpty(
      item?.sku,
      item?.product_code,
      item?.codigo,
      item?.code,
    ),
  );

  if (
    productId !== null &&
    String(productId).trim() !== ''
  ) {
    const result = await pool.query(
      `
      SELECT
        p.product_id,
        p.product_code,
        p.product_stock_id,
        p.description
      FROM public.products p
      WHERE p.product_id = $1
      LIMIT 1
      `,
      [Number(productId)],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  if (sku) {
    const result = await pool.query(
      `
      SELECT
        p.product_id,
        p.product_code,
        p.product_stock_id,
        p.description
      FROM public.products p
      WHERE p.product_code = $1
      LIMIT 1
      `,
      [sku],
    );

    if (result.rows[0]) {
      return result.rows[0];
    }
  }

  return null;
}

async function getCurrentStockByProduct(
  item,
  product = null,
) {
  const productId = firstNonEmpty(
    item?.product_id,
    product?.product_id,
  );

  const sku = normalizeSku(
    firstNonEmpty(
      item?.sku,
      item?.product_code,
      item?.codigo,
      item?.code,
      product?.product_code,
    ),
  );

  if (
    product?.product_stock_id !== null &&
    product?.product_stock_id !== undefined
  ) {
    const result = await pool.query(
      `
      SELECT
        COALESCE(ps.stock_qty, 0)
          AS stock_qty
      FROM public."productsStock" ps
      WHERE ps.product_stock_id = $1
      LIMIT 1
      `,
      [Number(product.product_stock_id)],
    );

    if (result.rows[0]) {
      return Number(
        result.rows[0].stock_qty || 0,
      );
    }
  }

  if (
    productId !== null &&
    String(productId).trim() !== ''
  ) {
    const result = await pool.query(
      `
      SELECT
        COALESCE(ps.stock_qty, 0)
          AS stock_qty
      FROM public.products p
      LEFT JOIN public."productsStock" ps
        ON ps.product_stock_id =
           p.product_stock_id
      WHERE p.product_id = $1
      LIMIT 1
      `,
      [Number(productId)],
    );

    if (result.rows[0]) {
      return Number(
        result.rows[0].stock_qty || 0,
      );
    }
  }

  if (sku) {
    const result = await pool.query(
      `
      SELECT
        COALESCE(ps.stock_qty, 0)
          AS stock_qty
      FROM public.products p
      LEFT JOIN public."productsStock" ps
        ON ps.product_stock_id =
           p.product_stock_id
      WHERE p.product_code = $1
      LIMIT 1
      `,
      [sku],
    );

    if (result.rows[0]) {
      return Number(
        result.rows[0].stock_qty || 0,
      );
    }
  }

  return 0;
}

async function hydrateItemForPdf(
  item,
  cache = {},
) {
  const cloned = {
    ...item,
  };

  const rawSku = normalizeSku(
    firstNonEmpty(
      cloned?.sku,
      cloned?.product_code,
      cloned?.codigo,
      cloned?.code,
    ),
  );

  let product = null;

  const productCacheKey =
    cloned?.product_id !== null &&
      cloned?.product_id !== undefined
      ? `id:${cloned.product_id}`
      : rawSku
        ? `sku:${rawSku}`
        : null;

  if (
    productCacheKey &&
    cache.products?.has(productCacheKey)
  ) {
    product =
      cache.products.get(
        productCacheKey,
      );
  } else {
    product =
      await getProductFromDb(cloned);

    if (
      productCacheKey &&
      cache.products
    ) {
      cache.products.set(
        productCacheKey,
        product || null,
      );
    }
  }

  const productId = firstNonEmpty(
    cloned?.product_id,
    product?.product_id,
  );

  const sku = normalizeSku(
    firstNonEmpty(
      rawSku,
      product?.product_code,
    ),
  );

  const description = firstNonEmpty(
    cloned?.description,
    cloned?.descricao,
    cloned?.product_name,
    product?.description,
  );

  cloned.product_id =
    productId ?? null;

  cloned.sku =
    sku || '';

  cloned.description =
    description || '';

  if (
    cloned.current_stock === null ||
    cloned.current_stock === undefined
  ) {
    let currentStock = null;

    const stockCacheKey =
      product?.product_stock_id !== null &&
        product?.product_stock_id !== undefined
        ? `ps:${product.product_stock_id}`
        : sku
          ? `sku:${sku}`
          : null;

    if (
      stockCacheKey &&
      cache.stocks?.has(stockCacheKey)
    ) {
      currentStock =
        cache.stocks.get(
          stockCacheKey,
        );
    } else {
      try {
        currentStock =
          await getCurrentStockByProduct(
            cloned,
            product,
          );
      } catch (error) {
        console.error(
          '[generationOrdersSeparationPdf] erro ao buscar estoque atual:',
          error?.message || error,
        );

        currentStock = 0;
      }

      if (
        stockCacheKey &&
        cache.stocks
      ) {
        cache.stocks.set(
          stockCacheKey,
          Number(currentStock || 0),
        );
      }
    }

    cloned.current_stock =
      Number(currentStock || 0);
  }

  const currentLocation = firstNonEmpty(
    cloned?.location,
    cloned?.localizacao,
    cloned?.addressing,
  );

  if (
    cache.useLocations !== false &&
    !currentLocation &&
    sku
  ) {
    let locationRow = null;

    if (
      cache.locations?.has(sku)
    ) {
      locationRow =
        cache.locations.get(sku);
    } else {
      try {
        const response =
          await productsLocationsApi
            .listByProductCode(sku);

        const rows =
          Array.isArray(response?.rows)
            ? response.rows
            : [];

        locationRow =
          chooseBestLocation(rows);
      } catch (error) {
        console.error(
          '[generationOrdersSeparationPdf] erro ao buscar localização:',
          error?.message || error,
        );
      }

      if (cache.locations) {
        cache.locations.set(
          sku,
          locationRow || null,
        );
      }
    }

    if (locationRow) {
      cloned.location =
        formatLocationRow(locationRow);

      cloned.location_row =
        locationRow;
    }
  }

  /*
   * STOCK_SIMPLE:
   * - não consulta productsStockLots;
   * - não hidrata lote;
   * - remove qualquer lote recebido no pedido.
   */
  if (!cache.stockMode?.requireLot) {
    cloned.lot_code = '';
    cloned.lot_id = null;
    cloned.lot_row = null;

    delete cloned.lote;
    delete cloned.batch;
  } else {
    /*
     * STOCK_WITH_LOT:
     * preserva lote já informado ou seleciona
     * automaticamente o melhor lote disponível.
     */
    const currentLot = firstNonEmpty(
      cloned?.lot_code,
      cloned?.lote,
      cloned?.batch,
    );

    if (!currentLot && sku) {
      let lots = null;

      if (
        cache.lots?.has(sku)
      ) {
        lots =
          cache.lots.get(sku);
      } else {
        try {
          lots =
            await cache.lotStrategy
              .getProductsStockLotsByProductCode(
                sku,
              );
        } catch (error) {
          console.error(
            '[generationOrdersSeparationPdf] erro ao buscar lotes:',
            error?.message || error,
          );

          lots = [];
        }

        if (cache.lots) {
          cache.lots.set(
            sku,
            Array.isArray(lots)
              ? lots
              : [],
          );
        }
      }

      const bestLot = chooseBestLot(
        Array.isArray(lots)
          ? lots
          : [],
        cloned,
      );

      if (bestLot) {
        cloned.lot_code =
          bestLot.lot_code || '';

        cloned.lot_id =
          bestLot.lot_id ?? null;

        cloned.lot_row =
          bestLot;
      }
    }
  }

  const hasOwnImage =
    firstNonEmpty(
      cloned?.image_path,
      cloned?.imagePath,
      cloned?.image_file,
      cloned?.imageFile,
      cloned?.imagem_path,
      cloned?.image_url,
      cloned?.imageUrl,
      cloned?.product_image_url,
    ) !== null;

  if (
    !hasOwnImage &&
    productId !== null
  ) {
    let primaryImage = null;

    if (
      cache.images?.has(productId)
    ) {
      primaryImage =
        cache.images.get(productId);
    } else {
      try {
        primaryImage =
          await productsImagensApi
            .getPrimaryImageByProductId(
              Number(productId),
            );
      } catch (error) {
        console.error(
          '[generationOrdersSeparationPdf] erro ao buscar imagem principal:',
          error?.message || error,
        );
      }

      if (cache.images) {
        cache.images.set(
          productId,
          primaryImage || null,
        );
      }
    }

    if (primaryImage) {
      cloned.image_path = firstNonEmpty(
        primaryImage.image_path,
        cloned.image_path,
      );

      cloned.image_url = firstNonEmpty(
        primaryImage.image_url,
        cloned.image_url,
      );

      cloned.image_alt = firstNonEmpty(
        primaryImage.image_alt,
        cloned.image_alt,
      );
    }
  }

  return cloned;
}

async function hydrateOrderItems(
  order,
  {
    scopeType = 'GLOBAL',
    scopeId = 1,
  } = {},
) {
  const items = Array.isArray(order?.items)
    ? order.items
    : [];

  const {
    strategy: stockStrategy,
    modeConfig: stockMode,
  } =
    await productsStockManager
      .resolveProductsStockStrategy({
        scopeType,
        scopeId,
      });

  const useLocations =
    await productsLocationsApi
      .resolveUseProductLocations({
        scopeType,
        scopeId,
      });

  const cache = {
    useLocations,
    products: new Map(),
    locations: new Map(),
    lots: new Map(),
    images: new Map(),
    stocks: new Map(),

    stockMode,

    lotStrategy:
      stockMode.isWithLot
        ? stockStrategy
        : null,
  };

  const hydrated = [];

  for (const item of items) {
    hydrated.push(
      await hydrateItemForPdf(
        item,
        cache,
      ),
    );
  }

  return hydrated;
}

/* ──────────────────────────────────────────────────────────────
   Imagens
────────────────────────────────────────────────────────────── */

function localBufferIfExists(
  absolutePath,
) {
  try {
    if (
      absolutePath &&
      fs.existsSync(absolutePath)
    ) {
      return fs.readFileSync(
        absolutePath,
      );
    }
  } catch {
    // Ignora imagem local inválida.
  }

  return null;
}

async function httpBuffer(url) {
  try {
    if (typeof fetch === 'function') {
      const response =
        await fetch(url);

      if (!response.ok) {
        return null;
      }

      const arrayBuffer =
        await response.arrayBuffer();

      return Buffer.from(
        arrayBuffer,
      );
    }

    const library =
      url.startsWith('https')
        ? await import('node:https')
        : await import('node:http');

    return await new Promise(
      (resolve) => {
        library.default
          .get(url, (response) => {
            if (
              response.statusCode !== 200
            ) {
              resolve(null);
              return;
            }

            const chunks = [];

            response.on(
              'data',
              (chunk) =>
                chunks.push(chunk),
            );

            response.on(
              'end',
              () =>
                resolve(
                  Buffer.concat(chunks),
                ),
            );
          })
          .on(
            'error',
            () => resolve(null),
          );
      },
    );
  } catch {
    return null;
  }
}

async function drawImageBuffer(
  doc,
  buffer,
  x,
  y,
  fit,
) {
  if (!buffer) {
    return false;
  }

  try {
    doc.image(
      buffer,
      x,
      y,
      {
        fit,
        align: 'center',
        valign: 'center',
      },
    );

    return true;
  } catch {
    try {
      const sharp =
        (await import('sharp')).default;

      const pngBuffer =
        await sharp(buffer)
          .png()
          .toBuffer();

      doc.image(
        pngBuffer,
        x,
        y,
        {
          fit,
          align: 'center',
          valign: 'center',
        },
      );

      return true;
    } catch {
      return false;
    }
  }
}

async function resolveItemImageBuffer(
  item,
  options = {},
) {
  const imagesDir =
    options.imagesDir ||
    path.resolve(
      __dirname,
      '../public/imagens',
    );

  const remoteBase =
    String(
      options.remoteImagesBaseUrl ||
      '',
    ).trim();

  if (
    !item ||
    typeof item !== 'object'
  ) {
    return null;
  }

  const pathCandidates = [
    item.image_path,
    item.imagePath,
    item.image_file,
    item.imageFile,
    item.imagem_path,
    item.imagemFile,
  ].filter(Boolean);

  for (
    const candidate of pathCandidates
  ) {
    const value =
      String(candidate).trim();

    if (/^https?:\/\//i.test(value)) {
      const buffer =
        await httpBuffer(value);

      if (buffer) {
        return buffer;
      }

      continue;
    }

    const localPath =
      path.isAbsolute(value)
        ? value
        : path.resolve(
          imagesDir,
          value,
        );

    const localBuffer =
      localBufferIfExists(localPath);

    if (localBuffer) {
      return localBuffer;
    }

    if (remoteBase) {
      const url =
        `${remoteBase.replace(/\/+$/, '')}/` +
        value.replace(/^\/+/, '');

      const remoteBuffer =
        await httpBuffer(url);

      if (remoteBuffer) {
        return remoteBuffer;
      }
    }
  }

  const urlCandidates = [
    item.image_url,
    item.imageUrl,
    item.product_image_url,
    item.productImageUrl,
    item.imagem_url,
    item.url_imagem,
    item.image_gcs,
    item.image_gcs_url,
  ].filter(Boolean);

  for (
    const candidate of urlCandidates
  ) {
    const value =
      String(candidate).trim();

    if (/^https?:\/\//i.test(value)) {
      const buffer =
        await httpBuffer(value);

      if (buffer) {
        return buffer;
      }
    }
  }

  const sku =
    String(item?.sku || '').trim();

  if (sku) {
    const localFiles = [
      path.resolve(
        imagesDir,
        `${sku}.png`,
      ),
      path.resolve(
        imagesDir,
        `${sku}.jpg`,
      ),
      path.resolve(
        imagesDir,
        `${sku}.jpeg`,
      ),
      path.resolve(
        imagesDir,
        `${sku}.webp`,
      ),
    ];

    for (const file of localFiles) {
      const buffer =
        localBufferIfExists(file);

      if (buffer) {
        return buffer;
      }
    }

    if (remoteBase) {
      const base =
        remoteBase.replace(
          /\/+$/,
          '',
        );

      const prefix =
        'bh3Distribuidora/productsImagens';

      for (
        const extension of [
          'png',
          'jpg',
          'jpeg',
          'webp',
        ]
      ) {
        const url =
          `${base}/${prefix}/` +
          `${sku}.${extension}`;

        const buffer =
          await httpBuffer(url);

        if (buffer) {
          return buffer;
        }
      }
    }
  }

  return null;
}

/* ──────────────────────────────────────────────────────────────
   Layout
────────────────────────────────────────────────────────────── */

const HEADER_Y = 30;
const RIGHT_HEADER_Y_OFFSET = 14;
const TABLE_START_Y = 138;

const COLS = {
  x: [
    36,
    94,
    154,
    384,
    474,
    554,
    604,
    659,
    729,
    768,
  ],

  w: [
    58,
    60,
    230,
    90,
    80,
    50,
    55,
    70,
    39,
    38,
  ],

  headers: [
    'Imagem',
    'SKU',
    'Descrição',
    'Localização',
    'Lote',
    'U.M.',
    'Qtde',
    'Estoque Atual',
    'Status',
    'Pendente',
  ],

  rowHeight: 48,
  headerHeight: 20,
};

// appFeature PRODUCT_LOCATIONS = LOCATIONS_DISABLED: sem a coluna Localização;
// a Descrição absorve a largura (mesmos índices, coluna 3 com largura 0).
const COLS_NO_LOCATION = {
  ...COLS,
  w: COLS.w.map((width, index) => {
    if (index === 2) return COLS.w[2] + COLS.w[3];
    if (index === 3) return 0;
    return width;
  }),
};

const SUMMARY = {
  gapAfterTable: 18,
  summaryBoxHeight: 46,
  summaryBoxWidth: 420,
  obsGap: 14,
  obsMinHeight: 58,
  footerReserve: 34,
};

function drawSeparationFields(doc) {
  const y =
    16 +
    RIGHT_HEADER_Y_OFFSET;

  const separatorX = 535;
  const dateX = 700;
  const lineY = y + 8;

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.text)
    .text(
      'Separador:',
      separatorX,
      y,
      {
        width: 48,
        lineBreak: false,
      },
    );

  doc
    .moveTo(
      separatorX + 49,
      lineY,
    )
    .lineTo(
      dateX - 12,
      lineY,
    )
    .lineWidth(0.5)
    .strokeColor(COLORS.border)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLORS.text)
    .text(
      'Data:',
      dateX,
      y,
      {
        width: 28,
        lineBreak: false,
      },
    );

  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      '____/____/________',
      dateX + 29,
      y,
      {
        width: 77,
        lineBreak: false,
      },
    );
}

function drawHeader(
  doc,
  company,
  order,
) {
  const logoCandidates = [
    company?.logoPath,
  ].filter(Boolean);

  let logoPath = null;

  for (
    const candidate of logoCandidates
  ) {
    if (
      candidate &&
      fs.existsSync(candidate)
    ) {
      logoPath = candidate;
      break;
    }
  }

  if (logoPath) {
    try {
      doc.image(
        logoPath,
        38,
        18,
        {
          fit: [110, 70],
        },
      );
    } catch {
      // Continua sem imagem.
    }
  }

  const leftX =
    logoPath ? 160 : 38;

  const rightX = 535;

  const rightHeaderY =
    HEADER_Y +
    RIGHT_HEADER_Y_OFFSET;

  const budgetDisplayNumber =
    resolveBudgetDisplayNumber(order);

  drawSeparationFields(doc);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(
      textOr(
        company?.name,
        'CONSART ERP',
      ),
      leftX,
      HEADER_Y,
    );

  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      textOr(company?.cnpj, ''),
      leftX,
      HEADER_Y + 14,
    )
    .text(
      textOr(
        company?.addressLine,
        '',
      ),
      leftX,
      HEADER_Y + 26,
    )
    .text(
      textOr(
        company?.contacts,
        '',
      ),
      leftX,
      HEADER_Y + 38,
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(
      'ROMANEIO DE SEPARAÇÃO',
      rightX,
      rightHeaderY,
      {
        width: 240,
        align: 'left',
      },
    );

  doc
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Pedido: ${textOr(
        order?.number ||
        order?.order_number ||
        order?.order_id,
      )}`,
      rightX,
      rightHeaderY + 20,
    )
    .text(
      `Data: ${formatDateBR(
        order?.issue_date ||
        order?.created_at,
      )}`,
      rightX,
      rightHeaderY + 32,
    )
    .text(
      `Cliente: ${textOr(
        order?.customer_name ||
        order?.nome_razao_social,
      )}`,
      rightX,
      rightHeaderY + 44,
    )
    .text(
      `CPF/CNPJ: ${textOr(
        order?.customer_tax_id ||
        order?.cnpj_cpf,
      )}`,
      rightX,
      rightHeaderY + 56,
    )
    .text(
      `Vendedor: ${textOr(
        order?.seller_name ||
        order?.vendedor,
      )}`,
      rightX,
      rightHeaderY + 68,
    );

  if (
    budgetDisplayNumber !== null &&
    String(
      budgetDisplayNumber,
    ).trim() !== ''
  ) {
    doc.text(
      `Orçamento: ${String(
        budgetDisplayNumber,
      ).trim()}`,
      rightX,
      rightHeaderY + 80,
    );
  }
}

function drawTableHeader(doc, y, cols = COLS) {
  const {
    x,
    w,
    headers,
    headerHeight,
  } = cols;

  doc
    .font('Helvetica-Bold')
    .fontSize(8.1);

  headers.forEach(
    (label, index) => {
      if (!w[index]) return;

      doc.save();

      doc
        .rect(
          x[index],
          y,
          w[index],
          headerHeight,
        )
        .fill(
          COLORS.headerFill,
        );

      doc.restore();

      doc
        .rect(
          x[index],
          y,
          w[index],
          headerHeight,
        )
        .lineWidth(0.4)
        .stroke(
          COLORS.border,
        );

      doc
        .fillColor(COLORS.text)
        .text(
          label,
          x[index],
          y + 5,
          {
            width: w[index],
            align: 'center',
          },
        );
    },
  );
}

function drawRowBorders(doc, y, cols = COLS) {
  const {
    x,
    w,
    rowHeight,
  } = cols;

  for (
    let index = 0;
    index < x.length;
    index += 1
  ) {
    if (!w[index]) continue;

    doc
      .rect(
        x[index],
        y,
        w[index],
        rowHeight,
      )
      .lineWidth(0.25)
      .stroke(
        COLORS.border,
      );
  }
}

function drawFooter(
  doc,
  pageIndex,
) {
  const footerY =
    doc.page.height -
    PAGE.margin -
    12;

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.soft)
    .text(
      `Página ${pageIndex}`,
      0,
      footerY,
      {
        width: doc.page.width,
        align: 'center',
        lineBreak: false,
      },
    );
}

function estimateObservationHeight(
  doc,
  text,
  width,
) {
  if (!text) {
    return 0;
  }

  const textHeight =
    doc.heightOfString(
      String(text),
      {
        width,
        align: 'left',
      },
    );

  return Math.max(
    SUMMARY.obsMinHeight,
    24 +
    Math.ceil(textHeight) +
    10,
  );
}

function addNewTablePage(
  doc,
  company,
  order,
  cols = COLS,
) {
  doc.addPage({
    margin: PAGE.margin,
    size: PAGE.size,
    layout: PAGE.layout,
  });

  drawHeader(
    doc,
    company,
    order,
  );

  drawTableHeader(
    doc,
    TABLE_START_Y,
    cols,
  );

  return (
    TABLE_START_Y +
    cols.headerHeight
  );
}

function addNewSummaryPage(
  doc,
  company,
  order,
) {
  doc.addPage({
    margin: PAGE.margin,
    size: PAGE.size,
    layout: PAGE.layout,
  });

  drawHeader(
    doc,
    company,
    order,
  );

  return TABLE_START_Y - 10;
}

/* ──────────────────────────────────────────────────────────────
   Principal
────────────────────────────────────────────────────────────── */

export async function generateOrderSeparationPdf(
  order,
  options = {},
) {
  const {
    company = {},
    output = 'response',
    res = null,
    filename = defaultFilename(order),

    dir = path.resolve(
      __dirname,
      '../public/pdfs',
    ),

    imagesDir = path.resolve(
      __dirname,
      '../public/imagens',
    ),

    remoteImagesBaseUrl =
    DEFAULT_REMOTE_BASE_URL,

    hydrateItems = true,
    hydrateBudget = true,

    stockScopeType = 'GLOBAL',
    stockScopeId = 1,
  } = options;

  const doc = new PDFDocument({
    margin: PAGE.margin,
    size: PAGE.size,
    layout: PAGE.layout,
    autoFirstPage: true,
  });

  const chunks = [];
  let fileStream;

  if (
    output === 'response' &&
    res
  ) {
    res.setHeader(
      'Content-Type',
      'application/pdf',
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(
        filename,
      )}"`,
    );

    doc.pipe(res);
  } else if (output === 'file') {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(
        dir,
        {
          recursive: true,
        },
      );
    }

    const fullPath =
      path.join(
        dir,
        sanitizeFilename(filename),
      );

    fileStream =
      fs.createWriteStream(
        fullPath,
      );

    doc.pipe(fileStream);
  } else {
    doc.on(
      'data',
      (chunk) =>
        chunks.push(chunk),
    );
  }

  let page = 1;

  // appFeature PRODUCT_LOCATIONS: LOCATIONS_DISABLED → PDF sem a coluna Localização
  const showLocations =
    await productsLocationsApi
      .resolveUseProductLocations({
        scopeType: stockScopeType,
        scopeId: stockScopeId,
      });

  const cols =
    showLocations
      ? COLS
      : COLS_NO_LOCATION;

  const hydratedOrder =
    hydrateBudget
      ? await hydrateOrderWithBudget(
        order || {},
      )
      : {
        ...(order || {}),
      };

  const rawItems =
    Array.isArray(
      hydratedOrder?.items,
    )
      ? hydratedOrder.items
      : [];

  const items =
    hydrateItems
      ? await hydrateOrderItems(
        hydratedOrder,
        {
          scopeType:
            stockScopeType,

          scopeId:
            stockScopeId,
        },
      )
      : rawItems;

  drawHeader(
    doc,
    company,
    hydratedOrder,
  );

  drawTableHeader(
    doc,
    TABLE_START_Y,
    cols,
  );

  let y =
    TABLE_START_Y +
    cols.headerHeight;

  let totalQuantity = 0;

  const totalItems =
    items.length;

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index];

    const quantity = Number(
      item.quantity ??
      item.quantidade ??
      0,
    );

    const currentStock = Number(
      item.current_stock ??
      0,
    );

    totalQuantity += quantity;

    if (
      y + cols.rowHeight >
      doc.page.height -
      PAGE.margin -
      70
    ) {
      drawFooter(
        doc,
        page,
      );

      page += 1;

      y = addNewTablePage(
        doc,
        company,
        hydratedOrder,
        cols,
      );
    }

    drawRowBorders(
      doc,
      y,
      cols,
    );

    const imageX =
      cols.x[0] + 3;

    const imageY =
      y + 3;

    const imageWidth =
      cols.w[0] - 6;

    const imageHeight = 42;

    const imageBuffer =
      await resolveItemImageBuffer(
        item,
        {
          imagesDir,
          remoteImagesBaseUrl,
        },
      );

    const imageDrawn =
      await drawImageBuffer(
        doc,
        imageBuffer,
        imageX,
        imageY,
        [
          imageWidth,
          imageHeight,
        ],
      );

    if (!imageDrawn) {
      doc
        .font('Helvetica')
        .fontSize(6)
        .fillColor(COLORS.soft)
        .text(
          'sem imagem',
          imageX,
          imageY + 17,
          {
            width: imageWidth,
            align: 'center',
            lineBreak: false,
          },
        );
    }

    const sku =
      textOr(item?.sku, '');

    const description = trunc(
      item?.description ||
      item?.descricao ||
      item?.product_name ||
      '',
      56,
    );

    const location = String(
      item?.location ||
      item?.localizacao ||
      item?.addressing ||
      '',
    ).trim();

    const {
      corredor,
      endereco,
    } =
      parseLocationDisplay(
        location,
      );

    const lot = trunc(
      item?.lot_code ||
      item?.lote ||
      item?.batch ||
      '',
      18,
    );

    const unit = textOr(
      item?.unit ||
      item?.unidade ||
      item?.um,
      '',
    );

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.text);

    doc.text(
      sku,
      cols.x[1] + 2,
      y + 14,
      {
        width: cols.w[1] - 4,
        align: 'center',
        lineBreak: false,
      },
    );

    doc.text(
      description,
      cols.x[2] + 3,
      y + 9,
      {
        width: cols.w[2] - 6,
        height: 30,
        align: 'left',
      },
    );

    if (
      showLocations &&
      (corredor || endereco)
    ) {
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(COLORS.text)
        .text(
          corredor,
          cols.x[3] + 2,
          y + 8,
          {
            width:
              cols.w[3] - 4,

            align: 'center',
            lineBreak: false,
          },
        );

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(COLORS.text)
        .text(
          endereco,
          cols.x[3] + 2,
          y + 22,
          {
            width:
              cols.w[3] - 4,

            align: 'center',
            lineBreak: false,
          },
        );
    }

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.text)
      .text(
        lot,
        cols.x[4] + 2,
        y + 14,
        {
          width:
            cols.w[4] - 4,

          align: 'center',
          lineBreak: false,
        },
      );

    doc.text(
      unit,
      cols.x[5] + 2,
      y + 14,
      {
        width:
          cols.w[5] - 4,

        align: 'center',
        lineBreak: false,
      },
    );

    doc.text(
      formatStock(quantity),
      cols.x[6] + 2,
      y + 14,
      {
        width:
          cols.w[6] - 4,

        align: 'center',
        lineBreak: false,
      },
    );

    doc.text(
      formatStock(currentStock),
      cols.x[7] + 2,
      y + 14,
      {
        width:
          cols.w[7] - 4,

        align: 'center',
        lineBreak: false,
      },
    );

    drawManualFillLine(
      doc,
      cols.x[8],
      y,
      cols.w[8],
      cols.rowHeight,
    );

    drawManualFillLine(
      doc,
      cols.x[9],
      y,
      cols.w[9],
      cols.rowHeight,
    );

    y += cols.rowHeight;
  }

  const observation = String(
    firstNonEmpty(
      hydratedOrder?.notes_combined,
      hydratedOrder
        ?.order_notes_resolved,
      hydratedOrder?.notes,
      hydratedOrder?.observacoes,
      hydratedOrder?.observation,
      hydratedOrder?.budget_notes,
    ) || '',
  ).trim();

  const observationWidth = 770;

  const observationHeight =
    observation
      ? estimateObservationHeight(
        doc,
        observation,
        observationWidth - 20,
      )
      : 0;

  const summaryBlockHeight =
    SUMMARY.gapAfterTable +
    SUMMARY.summaryBoxHeight +
    (
      observation
        ? SUMMARY.obsGap +
        observationHeight
        : 0
    ) +
    SUMMARY.footerReserve;

  const pageBottomLimit =
    doc.page.height -
    PAGE.margin;

  const requiredBottom =
    y +
    summaryBlockHeight;

  if (
    requiredBottom >
    pageBottomLimit
  ) {
    drawFooter(
      doc,
      page,
    );

    page += 1;

    y = addNewSummaryPage(
      doc,
      company,
      hydratedOrder,
    );
  }

  const summaryY =
    y +
    SUMMARY.gapAfterTable;

  doc
    .rect(
      36,
      summaryY,
      SUMMARY.summaryBoxWidth,
      SUMMARY.summaryBoxHeight,
    )
    .lineWidth(0.4)
    .stroke(COLORS.border);

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(
      'Resumo da Separação',
      46,
      summaryY + 6,
      {
        lineBreak: false,
      },
    );

  doc
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Total de itens: ${totalItems}`,
      46,
      summaryY + 22,
      {
        lineBreak: false,
      },
    )
    .text(
      `Quantidade do pedido: ${formatStock(
        totalQuantity,
      )}`,
      170,
      summaryY + 22,
      {
        lineBreak: false,
      },
    )
    .text(
      `Valor do pedido: R$ ${money(
        hydratedOrder?.total_amount ||
        hydratedOrder?.total ||
        0,
      )}`,
      320,
      summaryY + 22,
      {
        lineBreak: false,
      },
    );

  if (observation) {
    const observationY =
      summaryY +
      SUMMARY.summaryBoxHeight +
      SUMMARY.obsGap;

    doc
      .rect(
        36,
        observationY,
        observationWidth,
        observationHeight,
      )
      .lineWidth(0.4)
      .stroke(COLORS.border);

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(
        'Observações',
        46,
        observationY + 6,
        {
          lineBreak: false,
        },
      );

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(COLORS.text)
      .text(
        observation,
        46,
        observationY + 20,
        {
          width:
            observationWidth - 20,

          height:
            observationHeight - 24,

          align: 'left',
        },
      );
  }

  drawFooter(
    doc,
    page,
  );

  doc.end();

  if (output === 'response') {
    return;
  }

  if (output === 'file') {
    const fullPath =
      path.join(
        dir,
        sanitizeFilename(filename),
      );

    await new Promise(
      (resolve, reject) => {
        fileStream.on(
          'finish',
          resolve,
        );

        fileStream.on(
          'error',
          reject,
        );
      },
    );

    return fullPath;
  }

  return new Promise((resolve) => {
    doc.on(
      'end',
      () =>
        resolve(
          Buffer.concat(chunks),
        ),
    );
  });
}

export default {
  generateOrderSeparationPdf,
};