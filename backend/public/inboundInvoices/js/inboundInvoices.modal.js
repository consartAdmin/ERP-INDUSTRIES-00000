/* PRODNEX ERP - Product linking for Inbound Invoices (frontend ESM).
 * Resolve products by their exact SKU. The form owns lot loading/rendering;
 * the picker must await that work and respect the same stock policy.
 */
'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { clearLotsCaches } from './inboundInvoices.api.js';
import { isSimpleStockMode, clearItemLotState } from './inboundInvoices.stock.js';

function normalizeProductCode(value) {
  return String(value ?? '').trim();
}

function toIntOrNull(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function getBarcodeUnit(product) {
  const rows = product?.barcodes ?? product?.product_barcodes ?? product?.productsBarCode ?? [];
  const list = Array.isArray(rows) ? rows : [];
  const barcode = product?.primary_barcode ?? product?.barcode ??
    list.find((row) => row?.is_primary === true) ?? list[0] ?? null;
  return product?.barcode_unit ?? barcode?.unit_code ?? barcode?.unit ??
    barcode?.sigla ?? barcode?.unidade ?? null;
}

function unwrapProduct(json) {
  if (!json || typeof json !== 'object' || json.ok === false || json.success === false || json.error) {
    throw new Error('A API n\u00e3o retornou os dados do produto selecionado.');
  }
  const candidates = [
    json.data?.product, json.data?.row, json.data?.item, json.data?.rows,
    json.product, json.row, json.item, json.rows, json.data, json,
  ];
  for (let candidate of candidates) {
    if (Array.isArray(candidate)) {
      if (candidate.length !== 1) continue;
      candidate = candidate[0];
    }
    if (candidate && typeof candidate === 'object' &&
        ['product_code', 'sku', 'code', 'codigo', 'product_id', 'id', 'product_stock_id', 'description']
          .some((key) => candidate[key] != null)) return candidate;
  }
  throw new Error('Resposta de produto em formato inesperado.');
}

async function resolveProduct(ROUTES, product, productCode) {
  const url = ROUTES.productByCode?.(productCode) ||
    `/api/products/${encodeURIComponent(productCode)}`;
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Falha ao consultar o SKU ${productCode} (HTTP ${response.status}).`);
  }
  const full = unwrapProduct(await response.json());
  const returnedCode = normalizeProductCode(full.product_code ?? full.sku ?? full.code ?? full.codigo);
  if (returnedCode && returnedCode !== productCode) {
    throw new Error(`A API retornou outro SKU (${returnedCode}), diferente de ${productCode}.`);
  }
  return {
    ...product,
    ...full,
    product_code: productCode,
    ncm: full.ncm ?? full.ncm_codigo ?? product.ncm,
    cfop_compra: full.cfop_compra ?? full.cfop ?? product.cfop_compra,
    unit_compra: getBarcodeUnit(full) ?? getBarcodeUnit(product) ??
      full.unit_compra ?? full.unidade_compra ?? full.unit_buy ?? full.unit ?? product.unit_compra,
    product_stock_id: full.product_stock_id ?? full.stock_id ?? full.productStockId ??
      product.product_stock_id ?? product.stock_id ?? product.productStockId ?? null,
  };
}

export function initLinkProduct({ core, ROUTES, state, refs }) {
  const selectionTokens = new WeakMap();
  // Lot changes are handled once, by inboundInvoices.form.js (including grades).
  refs.itemsTbody?.addEventListener('click', (event) => {
    if (state.inboundInvoiceReadOnly) return;
    const button = event.target.closest('button[data-act="link-product"]');
    if (!button || button.disabled) return;
    const index = Number(button.dataset.index);
    const item = state.currentItems?.[index];
    if (!item) return;

    openProductsModalSearch({
      apiBase: window.API_BASE || window.location.origin,
      async onPick(product) {
        if (state.inboundInvoiceReadOnly || state.currentItems?.[index] !== item) return;
        const code = normalizeProductCode(
          product?.product_code ?? product?.sku ?? product?.code ?? product?.codigo
        );
        if (!code) {
          core.toast.warn('Produto inv\u00e1lido', 'O produto selecionado n\u00e3o possui product_code (SKU).');
          return;
        }

        const token = Symbol('product-selection');
        selectionTokens.set(item, token);
        const isCurrent = () => !state.inboundInvoiceReadOnly &&
          state.currentItems?.[index] === item && selectionTokens.get(item) === token;
        state.pendingProductLinks = Number(state.pendingProductLinks || 0) + 1;

        try {
          const resolvedProduct = await resolveProduct(ROUTES, product, code);
          if (!isCurrent()) return;
          if (typeof state.actions?.renderItemsTable !== 'function') {
            throw new Error('O formul\u00e1rio de itens ainda n\u00e3o foi inicializado.');
          }
          const productChanged = normalizeProductCode(item.product_code) !== code;
          if (productChanged || isSimpleStockMode(state)) clearItemLotState(item);

          // Never substitute nf_product_code for the canonical ERP SKU.
          // Preserve XML description, quantities, prices and invoice identifiers.
          item.product_code = code;
          item.product_code_cad = code;
          item.product_id = toIntOrNull(resolvedProduct.product_id ?? resolvedProduct.id);
          item.product_stock_id = toIntOrNull(resolvedProduct.product_stock_id);
          item.product_description = String(
            resolvedProduct.description ?? resolvedProduct.descricao ??
            resolvedProduct.name ?? resolvedProduct.nome ?? ''
          ).trim() || null;
          item.product_name = item.product_description;
          if (resolvedProduct.ncm) item.ncm = resolvedProduct.ncm;
          if (resolvedProduct.cfop_compra) item.cfop = resolvedProduct.cfop_compra;
          const unitCode = core.normalizeUnitCode(
            getBarcodeUnit(resolvedProduct) || resolvedProduct.unit_compra ||
            resolvedProduct.unit || resolvedProduct.unidade || ''
          );
          if (unitCode) item.unit = unitCode;

          // A new selection is an explicit refresh, including previously empty lists.
          clearLotsCaches(state);
          // The renderer may clear _lots in STOCK_SIMPLE or load it in lot mode.
          // Checking _lots before/without awaiting the renderer caused the false alert.
          await state.actions.renderItemsTable(state.currentItems);
          if (!isCurrent() || isSimpleStockMode(state)) return;

          if (item._lotsLoadError) {
            core.toast.error('Erro ao consultar lotes', item._lotsLoadError);
            return;
          }
          const lots = Array.isArray(item._lots) ? item._lots : [];
          if (!lots.length) {
            core.toast.warn(
              'Sem lotes',
              `Nenhum lote foi retornado para o SKU ${code}. Verifique o v\u00ednculo e os filtros de lotes.`
            );
          } else if (!item.lot_id) {
            core.toast.warn('Lote obrigat\u00f3rio', 'Selecione um lote para este item antes de salvar/postar.');
          }
        } catch (error) {
          if (!isCurrent()) return;
          console.error('[INBOUND][LINK_PRODUCT][ERROR]', { index, productCode: code, error });
          core.toast.error('Erro ao vincular produto', error?.message || 'N\u00e3o foi poss\u00edvel vincular o produto.');
        } finally {
          state.pendingProductLinks = Math.max(0, Number(state.pendingProductLinks || 0) - 1);
        }
      },
    });
  });
}
