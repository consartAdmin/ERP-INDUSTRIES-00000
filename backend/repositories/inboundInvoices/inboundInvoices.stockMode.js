// ╔══════════════════════════════════════════════════════════════════════╗
// ║ inboundInvoices.stockMode.js — PRODUCT_STOCK_MODE no Inbound NF-e   ║
// ║ CONSART ERP                                                         ║
// ║                                                                      ║
// ║ Responsabilidades:                                                  ║
// ║ - Resolver PRODUCT_STOCK_MODE via /api/app-features                 ║
// ║ - Manter um estado único do modo de estoque no frontend             ║
// ║ - Controlar UI de lote sem acoplar regras aos repositories          ║
// ║ - Normalizar lot_id antes de enviar itens ao backend                ║
// ║ - Validar obrigatoriedade de lote em STOCK_WITH_LOT                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const INBOUND_STOCK_FEATURE_CODE = 'PRODUCT_STOCK_MODE';

export const INBOUND_STOCK_MODES = Object.freeze({
    SIMPLE: 'STOCK_SIMPLE',
    WITH_LOT: 'STOCK_WITH_LOT',
});

const SAFE_DEFAULT_MODE = INBOUND_STOCK_MODES.WITH_LOT;

const state = {
    loaded: false,
    loadingPromise: null,
    mode: SAFE_DEFAULT_MODE,
    isSimple: false,
    requireLot: true,
    allowLots: true,
    enabled: true,
    source: 'SAFE_DEFAULT',
    feature: null,
    resolvedAt: null,
};

function upper(value) {
    return String(value ?? '').trim().toUpperCase();
}

function lower(value) {
    return String(value ?? '').trim().toLowerCase();
}

function unwrapFeatureResponse(response) {
    const root =
        response?.data?.data ??
        response?.data ??
        response?.json?.data ??
        response?.json ??
        response ??
        {};

    return root?.feature ?? response?.feature ?? root;
}

function normalizeFeatureResponse(response) {
    const feature = unwrapFeatureResponse(response);

    const optionCode = upper(
        feature?.optionCode ??
        feature?.option_code ??
        feature?.mode ??
        feature?.stockMode?.mode ??
        '',
    );

    const managerMode = lower(
        feature?.config?.managerMode ??
        feature?.config?.manager_mode ??
        '',
    );

    const isSimple =
        optionCode === INBOUND_STOCK_MODES.SIMPLE ||
        optionCode === 'SIMPLE' ||
        managerMode === 'simple';

    const isWithLot =
        optionCode === INBOUND_STOCK_MODES.WITH_LOT ||
        optionCode === 'WITH_LOT' ||
        optionCode === 'LOT' ||
        managerMode === 'with_lot' ||
        managerMode === 'lot';

    const mode = isSimple
        ? INBOUND_STOCK_MODES.SIMPLE
        : isWithLot
            ? INBOUND_STOCK_MODES.WITH_LOT
            : SAFE_DEFAULT_MODE;

    const enabled = feature?.enabled !== false;
    const effectiveSimple = enabled && mode === INBOUND_STOCK_MODES.SIMPLE;

    return {
        loaded: true,
        mode: effectiveSimple
            ? INBOUND_STOCK_MODES.SIMPLE
            : INBOUND_STOCK_MODES.WITH_LOT,
        isSimple: effectiveSimple,
        requireLot: !effectiveSimple,
        allowLots: !effectiveSimple,
        enabled,
        source: feature?.source ?? 'DEFAULT',
        feature,
        resolvedAt: new Date().toISOString(),
    };
}

function setState(next) {
    Object.assign(state, next);
    return getInboundStockMode();
}

export function getInboundStockMode() {
    return Object.freeze({
        loaded: state.loaded,
        mode: state.mode,
        isSimple: state.isSimple,
        requireLot: state.requireLot,
        allowLots: state.allowLots,
        enabled: state.enabled,
        source: state.source,
        feature: state.feature,
        resolvedAt: state.resolvedAt,
    });
}

export function isInboundSimpleStockMode() {
    return state.isSimple === true;
}

export function isInboundLotStockMode() {
    return state.requireLot === true;
}

async function defaultFetchFeature(url) {
    const response = await fetch(url, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
        },
    });

    let body = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }

    if (!response.ok) {
        const error = new Error(
            body?.error ||
            body?.message ||
            `Falha ao resolver ${INBOUND_STOCK_FEATURE_CODE} (HTTP ${response.status}).`,
        );
        error.status = response.status;
        throw error;
    }

    return body;
}

/**
 * Resolve PRODUCT_STOCK_MODE uma vez e reutiliza o resultado.
 *
 * Opções:
 * - apiBase: padrão window.location.origin
 * - scopeType / scopeId: enviados como query string quando informados
 * - fetcher: função customizada async (url) => json
 * - force: ignora cache local e resolve novamente
 */
export async function resolveInboundStockMode({
    apiBase = typeof window !== 'undefined' ? window.location.origin : '',
    scopeType = null,
    scopeId = null,
    fetcher = null,
    force = false,
} = {}) {
    if (!force && state.loaded) {
        return getInboundStockMode();
    }

    if (!force && state.loadingPromise) {
        return state.loadingPromise;
    }

    const resolver = typeof fetcher === 'function'
        ? fetcher
        : defaultFetchFeature;

    const params = new URLSearchParams();
    params.set('_', String(Date.now()));

    if (scopeType != null && String(scopeType).trim()) {
        params.set('scopeType', upper(scopeType));
    }

    const numericScopeId = Number(scopeId);
    if (Number.isSafeInteger(numericScopeId) && numericScopeId > 0) {
        params.set('scopeId', String(numericScopeId));
    }

    const base = String(apiBase || '').replace(/\/$/, '');
    const url = `${base}/api/app-features/${INBOUND_STOCK_FEATURE_CODE}/resolve?${params.toString()}`;

    state.loadingPromise = (async () => {
        try {
            const response = await resolver(url);
            return setState(normalizeFeatureResponse(response));
        } catch (error) {
            console.warn(
                '[inboundInvoices.stockMode] Falha ao resolver PRODUCT_STOCK_MODE; usando STOCK_WITH_LOT como padrão seguro:',
                error?.message || error,
            );

            return setState({
                loaded: true,
                mode: SAFE_DEFAULT_MODE,
                isSimple: false,
                requireLot: true,
                allowLots: true,
                enabled: true,
                source: 'SAFE_DEFAULT',
                feature: null,
                resolvedAt: new Date().toISOString(),
            });
        } finally {
            state.loadingPromise = null;
        }
    })();

    return state.loadingPromise;
}

export function resetInboundStockMode() {
    state.loaded = false;
    state.loadingPromise = null;
    state.mode = SAFE_DEFAULT_MODE;
    state.isSimple = false;
    state.requireLot = true;
    state.allowLots = true;
    state.enabled = true;
    state.source = 'SAFE_DEFAULT';
    state.feature = null;
    state.resolvedAt = null;
}

/**
 * Aplica o modo atual a um select/input de lote já existente no modal.
 * NÃO altera layout, classes ou estrutura do HTML.
 */
export function applyInboundStockModeToLotField(
    lotField,
    {
        simpleText = 'Controle por lote desativado',
        lotPlaceholder = 'Selecione um lote',
        clearWhenSimple = true,
    } = {},
) {
    if (!lotField) return getInboundStockMode();

    const stockMode = getInboundStockMode();

    if (stockMode.isSimple) {
        if (clearWhenSimple) {
            lotField.value = '';
        }

        if (lotField.tagName === 'SELECT') {
            lotField.innerHTML = '';
            const option = document.createElement('option');
            option.value = '';
            option.textContent = simpleText;
            option.selected = true;
            lotField.appendChild(option);
        } else {
            lotField.value = simpleText;
        }

        lotField.disabled = true;
        lotField.dataset.stockMode = INBOUND_STOCK_MODES.SIMPLE;
        lotField.setAttribute('aria-disabled', 'true');
        lotField.title = simpleText;

        return stockMode;
    }

    lotField.disabled = false;
    lotField.dataset.stockMode = INBOUND_STOCK_MODES.WITH_LOT;
    lotField.setAttribute('aria-disabled', 'false');
    lotField.title = 'Controle de estoque por lote ativo.';

    if (lotField.tagName === 'SELECT' && lotField.options.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = lotPlaceholder;
        lotField.appendChild(option);
    }

    return stockMode;
}

/**
 * Aplica a regra a vários campos de lote sem mudar a estrutura da tabela/modal.
 */
export function applyInboundStockModeToLotFields(
    root = document,
    {
        selector = '[data-role="lot-select"], #lote, #lot_id, select[name="lot_id"]',
        ...options
    } = {},
) {
    const fields = Array.from(root?.querySelectorAll?.(selector) || []);
    for (const field of fields) {
        applyInboundStockModeToLotField(field, options);
    }
    return fields.length;
}

/**
 * Use antes de persistir um item.
 * Em STOCK_SIMPLE elimina lot_id para impedir que um valor antigo/oculto
 * seja enviado ao backend.
 */
export function normalizeInboundItemForStockMode(item = {}) {
    const normalized = { ...item };

    if (state.isSimple) {
        normalized.lot_id = null;
        normalized.lotId = null;
        normalized.lote_id = null;
        normalized.loteId = null;
    }

    return normalized;
}

export function normalizeInboundItemsForStockMode(items = []) {
    if (!Array.isArray(items)) return [];
    return items.map(normalizeInboundItemForStockMode);
}

/**
 * Validação de UI. A validação definitiva deve continuar existindo no backend.
 */
export function validateInboundItemStockMode(item = {}) {
    if (!state.requireLot) {
        return { ok: true };
    }

    const rawLotId =
        item?.lot_id ??
        item?.lotId ??
        item?.lote_id ??
        item?.loteId ??
        null;

    const lotId = Number(rawLotId);

    if (!Number.isSafeInteger(lotId) || lotId <= 0) {
        const productCode = String(
            item?.product_code ??
            item?.productCode ??
            item?.sku ??
            '',
        ).trim();

        return {
            ok: false,
            code: 'INBOUND_ITEM_LOT_REQUIRED',
            message: productCode
                ? `Selecione um lote para o SKU ${productCode}.`
                : 'Selecione um lote para o produto.',
        };
    }

    return { ok: true, lotId };
}

export function assertInboundItemStockMode(item = {}) {
    const result = validateInboundItemStockMode(item);
    if (result.ok) return result;

    const error = new Error(result.message);
    error.code = result.code;
    error.status = 400;
    throw error;
}

export function assertInboundItemsStockMode(items = []) {
    if (!Array.isArray(items)) return true;
    for (const item of items) {
        assertInboundItemStockMode(item);
    }
    return true;
}

/**
 * Helper para inicialização do modal.
 * Exemplo:
 *
 * await initInboundStockMode({
 *   root: modalElement,
 *   selector: 'select[data-role="lot-select"]',
 * });
 */
export async function initInboundStockMode({
    root = typeof document !== 'undefined' ? document : null,
    selector = '[data-role="lot-select"], #lote, #lot_id, select[name="lot_id"]',
    apiBase,
    scopeType,
    scopeId,
    fetcher,
    force = false,
    simpleText,
    lotPlaceholder,
} = {}) {
    const stockMode = await resolveInboundStockMode({
        apiBase,
        scopeType,
        scopeId,
        fetcher,
        force,
    });

    if (root) {
        applyInboundStockModeToLotFields(root, {
            selector,
            simpleText,
            lotPlaceholder,
        });
    }

    return stockMode;
}

export default {
    INBOUND_STOCK_FEATURE_CODE,
    INBOUND_STOCK_MODES,
    getInboundStockMode,
    isInboundSimpleStockMode,
    isInboundLotStockMode,
    resolveInboundStockMode,
    resetInboundStockMode,
    applyInboundStockModeToLotField,
    applyInboundStockModeToLotFields,
    normalizeInboundItemForStockMode,
    normalizeInboundItemsForStockMode,
    validateInboundItemStockMode,
    assertInboundItemStockMode,
    assertInboundItemsStockMode,
    initInboundStockMode,
};
