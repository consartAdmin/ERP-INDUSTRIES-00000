// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.init.js — Inicialização do módulo de produtos              ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './products.state.js';
import { fmtInt } from './products.utils.js';
import { getLimitSelect, setStatus } from './products.dom.js';

import {
  bindSearch,
  bindLimit,
  bindFilters,
  loadFilterOptions
} from './products.search.js';

import { bindExport, bindStockPdf } from './products.export.js';
import { bindCameraDropZone } from './products.dragdrop.js';
import { bindColumnsSettings } from './products.columns.js';
import { loadProducts, renderTableHeader } from './products.render.js';
import { resolveShowProductImages } from '/public/includes/js/productImagesFeature.js';
import { resolveUseProductLocations } from '/public/includes/js/productLocationsFeature.js';

async function bootstrap() {
  try {
    const sel = getLimitSelect();
    if (sel) state.limit = fmtInt(sel.value, 20);

    bindSearch();
    bindLimit();
    bindFilters();
    bindColumnsSettings();

    // appFeatures PRODUCT_SEARCH_IMAGE_MODE / PRODUCT_LOCATIONS: sem a feature cadastrada → exibe
    const [showImages, showLocations] = await Promise.all([
      resolveShowProductImages(),
      resolveUseProductLocations(),
      loadFilterOptions(),
    ]);
    state.showImages = showImages;
    state.showLocations = showLocations;
    // cabeçalho já no modo certo antes de a lista carregar
    renderTableHeader();

    bindExport();
    bindCameraDropZone();
    bindStockPdf();

    loadProducts();
  } catch (e) {
    console.error('[products] bootstrap error:', e);
    setStatus('Falha ao inicializar a página de produtos.', 'error');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}