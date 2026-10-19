import { ROUTES } from './labels.config.js';
import { state } from './labels.state.js';
import {
  defaultPdfName,
  downloadBlob,
  extractFilename,
  normalizeArray,
} from './labels.utils.js';
import { buildProductSearchParams } from './labels.filters.js';

async function readJson(response, context) {
  if (response.ok) return response.json();
  const detail = await response.text().catch(() => '');
  throw new Error(`${context} (${response.status}): ${detail || response.statusText}`);
}

export async function fetchLabelParameters() {
  return normalizeArray(await readJson(await fetch(ROUTES.parameters), 'Erro ao carregar modelos'));
}

export async function fetchPriceTables() {
  return normalizeArray(await readJson(await fetch(ROUTES.prices), 'Erro ao carregar tabelas de preço'));
}

export async function findProductByCode(code) {
  const params = buildProductSearchParams(code, state.currentPriceId);
  const list = normalizeArray(
    await readJson(
      await fetch(`${ROUTES.productsSearch}?${params}`),
      'Erro ao consultar produtos',
    ),
  );
  if (!list.length) return null;

  const target = String(code).trim().toLowerCase();
  return (
    list.find((product) => {
      const internal = String(
        product.product_code || product.codigo_interno || product.sku || '',
      ).toLowerCase();
      const barcode = String(
        product.bar_code || product.barcode || product.ean || product.codigo_barras || '',
      ).toLowerCase();
      return internal === target || barcode === target;
    }) || list[0]
  );
}

export async function requestLabelsPdf(apiPayload, uiPayload) {
  const response = await fetch(ROUTES.generate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiPayload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Erro ${response.status} ao gerar etiquetas: ${detail || response.statusText}`,
    );
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const fileName =
    extractFilename(response.headers.get('Content-Disposition') || '') ||
    defaultPdfName(uiPayload.templateSlug);
  downloadBlob(objectUrl, fileName);
  return { fileName, objectUrl };
}

