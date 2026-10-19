import { DEFAULT_TEMPLATE } from './labels.config.js';
import { findProductByCode, requestLabelsPdf } from './labels.api.js';
import { readLabelsForm, saveConfig } from './labels.form.js';
import { resetSelectedProduct, state } from './labels.state.js';
import { buildUnitKey, renderItems, selectedUnit, setLoading, syncSearchDisplay } from './labels.render.js';
import { $, showModal } from './labels.utils.js';
import { requireProductSource, validPositiveQuantity } from './labels.validation.js';

function unitLabel(unitCode, unitName, factor) {
  let label = String(unitCode || unitName || 'UN');
  if (unitName && unitName.toUpperCase() !== label.toUpperCase()) label += ` - ${unitName}`;
  if (Number(factor) > 0) label += ` (${factor})`;
  return label;
}

function extractUnits(product) {
  const collections = [
    product.units, product.unit_options, product.sale_units, product.unidades,
    product.product_units, product.multiples_units, product.barcode_units,
  ].filter(Array.isArray);
  const units = collections.flatMap((list) => list.map((unit) => {
    const unitCode = unit.unit_code || unit.unit || unit.unidade || unit.sigla || unit.code || 'UN';
    const unitName = unit.unit_name || unit.name || unit.nome || unitCode;
    const factor = unit.factor ?? unit.fator ?? unit.multiplier ?? null;
    const barCode = unit.bar_code || unit.barcode || unit.ean || unit.codigo_barras || unit.gtin || '';
    return { unitCode: String(unitCode), unitName: String(unitName), factor, barCode: String(barCode), unitLabel: unitLabel(unitCode, unitName, factor) };
  }));
  if (units.length) return units;
  const unitCode = product.sale_unit || product.unit || product.unidade || 'UN';
  const unitName = product.sale_unit_name || product.unit_name || unitCode;
  const barCode = product.bar_code || product.barcode || product.ean || product.codigo_barras || '';
  return [{ unitCode: String(unitCode), unitName: String(unitName), factor: null, barCode: String(barCode), unitLabel: unitLabel(unitCode, unitName) }];
}

export function normalizeProduct(product, quantity = 1, rawCode = '') {
  const productCode = product?.product_code || product?.codigo_interno || product?.sku || product?.product_id || product?.code || product?.id || rawCode;
  if (!productCode) return null;
  const units = extractUnits(product);
  return {
    productCode,
    description: product.description || product.nome || product.name || product.product_name || 'Produto sem descrição',
    salePrice: product.sale_price ?? product.preco_venda ?? product.price ?? null,
    labelsPerProduct: quantity,
    units,
    selectedUnitKey: buildUnitKey(units[0], 0),
    barCode: units[0]?.barCode || '',
  };
}

export function mergeItem(item) {
  const existing = state.manualItems.find((current) => String(current.productCode) === String(item.productCode));
  if (existing) existing.labelsPerProduct += Number(item.labelsPerProduct || 1);
  else state.manualItems.push(item);
}

export function addProductSelectedInModal(product) {
  if (!product) return;

  state.selectedProduct = product;

  const preview = normalizeProduct(product, 1);
  if (!preview) {
    resetSelectedProduct();
    showModal({
      variant: 'warning',
      title: 'Produto inválido',
      message: 'O produto selecionado não possui código identificador.',
    });
    return;
  }

  const searchInput = $('#labelsQuery');
  if (searchInput) {
    searchInput.value =
      `${preview.productCode} — ${preview.description}`.trim();
  }

  const codeInput = $('#manualProductCode');
  if (codeInput) {
    codeInput.value = '';
  }
}

export async function addProduct() {
  const input = $('#manualProductCode');
  const code = (input?.value || '').trim();
  if (!requireProductSource({ code, selectedProduct: state.selectedProduct })) return;
  const quantity = validPositiveQuantity($('#manualLabelsQty')?.value || $('#labelsQty')?.value || 1);
  if (!quantity) return;

  try {
    setLoading(true);
    const product = state.selectedProduct || await findProductByCode(code);
    if (!product) return showModal({ variant: 'warning', title: 'Produto não encontrado', message: 'Nenhum produto foi localizado com o código informado.' });
    const item = normalizeProduct(product, quantity, code);
    if (!item) return showModal({ variant: 'warning', title: 'Produto inválido', message: 'O produto não possui dados suficientes para impressão.' });
    mergeItem(item);
    resetSelectedProduct();
    if (input) input.value = '';
    if ($('#manualLabelsQty')) $('#manualLabelsQty').value = '1';
    syncSearchDisplay();
    renderItems(readLabelsForm({ strict: false }));
  } catch (error) {
    showModal({ variant: 'error', title: 'Erro ao buscar produto', message: error.message });
  } finally {
    setLoading(false);
  }
}

export function buildApiPayload(payload) {
  const items = state.manualItems.map((item) => {
    const unit = selectedUnit(item);
    return {
      productCode: item.productCode,
      barCode: unit?.barCode || item.barCode || null,
      description: item.description,
      salePrice: item.salePrice,
      labelsPerProduct: Number(item.labelsPerProduct) || 1,
      unit: unit?.unitCode || null,
      unitCode: unit?.unitCode || null,
      unitName: unit?.unitName || null,
      unitLabel: unit?.unitLabel || null,
      unitFactor: unit?.factor ?? null,
    };
  });

  if (!items.length && payload.scope === 'ALL') {
    items.push({ mode: 'ALL', labelsPerProduct: payload.labelsPerProduct });
  }

  return {
    templateId: payload.templateSlug || DEFAULT_TEMPLATE,
    templateSlug: payload.templateSlug || DEFAULT_TEMPLATE,
    labelsPerProduct: payload.labelsPerProduct,
    scope: payload.scope,
    fontPreset: payload.fontPreset || 'M',
    labelParametersId: payload.labelParametersId || undefined,
    priceId: payload.priceId || undefined,
    priceTableId: payload.priceId || undefined,
    labelConfig: payload.labelConfig,
    items,
  };
}

export async function generateLabels() {
  const payload = readLabelsForm({ strict: true });
  if (!payload) return;
  try {
    saveConfig(payload);
    setLoading(true);
    const result = await requestLabelsPdf(buildApiPayload(payload), payload);
    window.open(result.objectUrl, '_blank', 'noopener');
    showModal({ variant: 'success', title: 'Etiquetas geradas com sucesso!', message: `Arquivo: <strong>${result.fileName}</strong><br><br>O download do PDF foi iniciado.` });
    setTimeout(() => URL.revokeObjectURL(result.objectUrl), 60000);
  } catch (error) {
    console.error('[Labels]', error);
    showModal({ variant: 'error', title: 'Erro ao gerar etiquetas', message: error.message });
  } finally {
    setLoading(false);
  }
}
