// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productLocationsFeature.js — appFeature PRODUCT_LOCATIONS            ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║                                                                      ║
// ║ Usar/não usar localizações físicas de produtos em todos os módulos. ║
// ║ Opções: LOCATIONS_ENABLED | LOCATIONS_DISABLED                      ║
// ║         (option_config.useLocations)                                ║
// ║ Sem a feature cadastrada, desativada ou em falha → usa.             ║
// ║                                                                      ║
// ║ Marcação HTML: data-feature="PRODUCT_LOCATIONS" → ocultado quando   ║
// ║ a feature estiver em LOCATIONS_DISABLED.                            ║
// ║ SQL: docs/shortCutsSQL/features/feature_products_locations.md       ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

export const PRODUCT_LOCATIONS_FEATURE_CODE = 'PRODUCT_LOCATIONS';
export const PRODUCT_LOCATIONS_SELECTOR = `[data-feature="${PRODUCT_LOCATIONS_FEATURE_CODE}"]`;

// Uma única requisição por página, compartilhada por todos os chamadores.
let cachedPromise = null;

async function fetchUseProductLocations(apiBase) {
  try {
    const base = String(apiBase || '').trim().replace(/\/$/, '') || window.location.origin;
    const url = new URL(`/api/app-features/${encodeURIComponent(PRODUCT_LOCATIONS_FEATURE_CODE)}/resolve`, base);
    url.searchParams.set('_', String(Date.now()));

    const res = await fetch(url.toString(), { credentials: 'include' });
    if (!res.ok) return true;

    const feature = (await res.json())?.feature;
    if (!feature || feature.enabled === false) return true;

    const disabled =
      feature.config?.useLocations === false ||
      String(feature.optionCode || '').toUpperCase() === 'LOCATIONS_DISABLED';

    return !disabled;
  } catch {
    return true;
  }
}

/** Resolve a feature e retorna true (usar localizações) ou false (não usar). */
export function resolveUseProductLocations({ apiBase = '' } = {}) {
  if (!cachedPromise) cachedPromise = fetchUseProductLocations(apiBase);
  return cachedPromise;
}

// Regra global: elementos marcados que forem renderizados depois (linhas de
// tabela etc.) também ficam ocultos, sem precisar chamar apply() de novo.
function ensureGlobalStyle() {
  if (document.getElementById('productLocationsFeatureStyle')) return;
  const style = document.createElement('style');
  style.id = 'productLocationsFeatureStyle';
  style.textContent = `html.no-product-locations ${PRODUCT_LOCATIONS_SELECTOR} { display: none !important; }`;
  document.head.appendChild(style);
}

/**
 * Oculta os elementos marcados com data-feature="PRODUCT_LOCATIONS" quando a
 * feature está desativada. Ativada → não mexe no DOM (cada tela controla o
 * próprio hidden, ex.: listas que só aparecem depois de carregar).
 */
export function applyProductLocationsVisibility(useLocations, root = document) {
  ensureGlobalStyle();
  document.documentElement.classList.toggle('no-product-locations', !useLocations);
  if (!useLocations) {
    root.querySelectorAll(PRODUCT_LOCATIONS_SELECTOR).forEach((el) => {
      el.hidden = true;
      el.style.setProperty('display', 'none', 'important');
    });
  }
  return useLocations;
}

/** Resolve + aplica no DOM. Retorna o booleano resolvido. */
export async function initProductLocationsFeature({ apiBase = '', root = document } = {}) {
  const useLocations = await resolveUseProductLocations({ apiBase });
  applyProductLocationsVisibility(useLocations, root);
  return useLocations;
}

/**
 * Para páginas dedicadas a localizações: quando desativada, troca o
 * conteúdo da página por um aviso. Retorna true se a página pode seguir.
 */
export async function guardProductLocationsPage({ apiBase = '', container = null } = {}) {
  const useLocations = await resolveUseProductLocations({ apiBase });
  if (useLocations) return true;

  const target = container || document.querySelector('main') || document.body;
  const notice = document.createElement('div');
  notice.className = 'product-locations-disabled-notice';
  notice.style.cssText = 'max-width:640px;margin:48px auto;padding:24px;border:1px solid #f0c36d;'
    + 'background:#fff8e1;border-radius:8px;font-family:inherit;text-align:center;color:#5d4200;';
  notice.innerHTML = '<h3 style="margin:0 0 8px;">📍 Localizações desativadas</h3>'
    + '<p style="margin:0;">A funcionalidade <strong>Localização de produtos</strong> (PRODUCT_LOCATIONS) '
    + 'está desativada para esta empresa. Fale com o administrador para ativá-la.</p>';

  [...target.children].forEach((child) => {
    if (child.tagName === 'SCRIPT' || child.classList.contains('menu-principal')
      || child.id === 'menuConsartMount' || child.id === 'menu-consart-mount') return;
    child.style.setProperty('display', 'none', 'important');
  });
  target.appendChild(notice);
  return false;
}

// Acesso para scripts clássicos (não-módulo).
if (typeof window !== 'undefined') {
  window.ProductLocationsFeature = {
    FEATURE_CODE: PRODUCT_LOCATIONS_FEATURE_CODE,
    resolve: resolveUseProductLocations,
    apply: applyProductLocationsVisibility,
    init: initProductLocationsFeature,
    guardPage: guardProductLocationsPage,
  };
}
