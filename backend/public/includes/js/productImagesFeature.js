// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productImagesFeature.js — appFeature PRODUCT_SEARCH_IMAGE_MODE      ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║                                                                      ║
// ║ Exibir/ocultar imagens de produtos nas listagens e buscas.          ║
// ║ Opções: IMAGE_SHOW | IMAGE_HIDE (option_config.showImages)          ║
// ║ Sem a feature cadastrada, desativada ou em falha → exibe.           ║
// ║ SQL: docs/shortCutsSQL/features/feature_products_search_images.md   ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

export const PRODUCT_IMAGES_FEATURE_CODE = 'PRODUCT_SEARCH_IMAGE_MODE';

/** Resolve a feature e retorna true (exibir imagens) ou false (ocultar). */
export async function resolveShowProductImages({
  apiBase = '',
  featureCode = PRODUCT_IMAGES_FEATURE_CODE,
} = {}) {
  try {
    const base = String(apiBase || '').trim().replace(/\/$/, '') || window.location.origin;
    const url = new URL(`/api/app-features/${encodeURIComponent(featureCode)}/resolve`, base);
    url.searchParams.set('_', String(Date.now()));

    const res = await fetch(url.toString(), { credentials: 'include' });
    if (!res.ok) return true;

    const feature = (await res.json())?.feature;
    if (!feature || feature.enabled === false) return true;

    const hide =
      feature.config?.showImages === false ||
      String(feature.optionCode || '').toUpperCase() === 'IMAGE_HIDE';

    return !hide;
  } catch {
    return true;
  }
}
