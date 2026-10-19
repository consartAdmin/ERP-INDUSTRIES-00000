// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tabDescription.js — Aba Descrição do Produto                       ║
// ║ PRODNEX ERP                                                         ║
// ║ Tabela: public."productsDescriptions"                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_ROUTE = '/api/products-descriptions';

const state = {
    initialized: false,
    loading: false,
    saving: false,

    productCode: '',
    descriptionId: null,
    isActive: true,
    initialDescription: '',
};

const dom = {};

/* =====================================================================
   API helpers
   ===================================================================== */

function getApiBase() {
    return String(window.apiBase || '').replace(/\/+$/, '');
}

function getApiUrl(path = '') {
    return `${getApiBase()}${API_ROUTE}${path}`;
}

function getToken() {
    return (
        localStorage.getItem('token') ||
        localStorage.getItem('authToken') ||
        sessionStorage.getItem('token') ||
        sessionStorage.getItem('authToken') ||
        ''
    );
}

function buildHeaders() {
    const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };

    const token = getToken();

    if (token) {
        headers.Authorization = token.startsWith('Bearer ')
            ? token
            : `Bearer ${token}`;
    }

    return headers;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        ...options,

        headers: {
            ...buildHeaders(),
            ...(options.headers || {}),
        },
    });

    const contentType =
        response.headers.get('content-type') || '';

    let payload = null;

    if (contentType.includes('application/json')) {
        payload = await response.json().catch(() => null);
    } else {
        const text = await response.text().catch(() => '');
        payload = text ? { error: text } : null;
    }

    if (!response.ok) {
        throw new Error(
            payload?.error ||
            payload?.message ||
            `Erro HTTP ${response.status}.`
        );
    }

    return payload;
}

/* =====================================================================
   DOM
   ===================================================================== */

function cacheDom() {
    dom.tab = document.getElementById('aba-descricao');

    dom.form =
        document.getElementById('formDescricaoProduto');

    dom.description =
        document.getElementById('descricaoDetalhada');

    dom.counter =
        document.getElementById('descricaoDetalhadaContador');

    dom.submitButton =
        document.getElementById('btnSalvarDescricaoProduto');

    dom.status =
        document.getElementById('descricaoProdutoStatus');

    dom.productCode =
        document.getElementById('produtoId');

    return Boolean(
        dom.tab &&
        dom.form &&
        dom.description &&
        dom.submitButton &&
        dom.productCode
    );
}

/* =====================================================================
   Interface
   ===================================================================== */

function setStatus(message = '', type = '') {
    if (!dom.status) return;

    dom.status.textContent = message;

    dom.status.classList.remove(
        'description-status--loading',
        'description-status--success',
        'description-status--error'
    );

    if (type) {
        dom.status.classList.add(
            `description-status--${type}`
        );
    }
}

function showMessage(message, type = 'success') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    if (typeof window.toast === 'function') {
        window.toast(message, type);
        return;
    }

    if (type === 'error') {
        console.error(`[DESCRIPTION] ${message}`);
        window.alert(message);
        return;
    }

    console.info(`[DESCRIPTION] ${message}`);
}

function setFormDisabled(disabled) {
    if (dom.description) {
        dom.description.disabled = disabled;
    }

    if (dom.submitButton) {
        dom.submitButton.disabled = disabled;
    }
}

function setSaving(saving) {
    state.saving = saving;

    if (!dom.submitButton) return;

    if (!dom.submitButton.dataset.originalText) {
        dom.submitButton.dataset.originalText =
            dom.submitButton.innerHTML.trim();
    }

    dom.submitButton.disabled = saving;
    dom.description.disabled = saving;

    dom.submitButton.innerHTML = saving
        ? '⏳ Salvando...'
        : dom.submitButton.dataset.originalText;
}

function updateCounter() {
    if (!dom.description || !dom.counter) return;

    dom.counter.textContent =
        String(dom.description.value.length);
}

function fillDescription(value = '') {
    dom.description.value = String(value || '');

    updateCounter();
}

function normalizeProductCode(value) {
    let code = String(value ?? '')
        .replace(/^SKU[\s:-]*/i, '')
        .trim();

    if (!code) return '';

    /*
     * O cadastro atual utiliza SKU com 8 dígitos.
     * Exemplo: 4828 → 00004828
     */
    if (/^\d+$/.test(code) && code.length < 8) {
        code = code.padStart(8, '0');
    }

    return code;
}

function getCurrentProductCode() {
    const inputCode = normalizeProductCode(
        document.getElementById('produtoId')?.value
    );

    const headerCode = normalizeProductCode(
        document.getElementById('headerProductCode')?.textContent
    );

    return inputCode || headerCode;
}

function hasUnsavedChanges() {
    return (
        dom.description.value.trim() !==
        state.initialDescription
    );
}

/* =====================================================================
   Aguardar carregamento do produto
   ===================================================================== */

async function waitForProductCode({
    attempts = 200,
    interval = 100,
} = {}) {
    for (let attempt = 0; attempt < attempts; attempt++) {
        const productCode = getCurrentProductCode();

        if (productCode) {
            console.log(
                '[DESCRIPTION][PRODUCT_CODE]',
                productCode
            );

            return productCode;
        }

        await new Promise((resolve) => {
            window.setTimeout(resolve, interval);
        });
    }

    return '';
}

/* =====================================================================
   Carregar descrição
   ===================================================================== */

export async function loadProductDescription(
    productCode = ''
) {
    productCode = normalizeProductCode(
        productCode || getCurrentProductCode()
    );

    if (!productCode) {
        productCode = await waitForProductCode();
    }

    if (!productCode) {
        setStatus(
            'Não foi possível identificar o SKU do produto.',
            'error'
        );

        console.error(
            '[DESCRIPTION][LOAD] SKU não identificado.'
        );

        return null;
    }

    if (state.loading) return null;

    state.loading = true;
    state.productCode = productCode;

    setFormDisabled(true);
    setStatus('Carregando descrição...', 'loading');

    try {
        const params = new URLSearchParams();

        params.set('product_code', productCode);
        params.set('limit', '1');
        params.set('offset', '0');

        const requestUrl =
            `${getApiUrl()}?${params.toString()}`;

        console.log(
            '[DESCRIPTION][LOAD] Requisição:',
            requestUrl
        );

        const payload = await apiRequest(requestUrl, {
            method: 'GET',
        });

        console.log(
            '[DESCRIPTION][LOAD] Resposta:',
            payload
        );

        const rows = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
                ? payload.data
                : [];

        const record = rows[0] || null;

        if (!record) {
            state.descriptionId = null;
            state.isActive = true;
            state.initialDescription = '';

            fillDescription('');

            setStatus(
                `Nenhuma descrição encontrada para o SKU ${productCode}.`
            );

            return null;
        }

        state.descriptionId =
            record.product_description_id;

        state.isActive =
            record.is_active !== false;

        state.initialDescription =
            String(record.description || '').trim();

        fillDescription(record.description || '');

        setStatus('');

        console.log(
            '[DESCRIPTION][LOAD] Descrição preenchida:',
            record.description
        );

        return record;
    } catch (error) {
        console.error(
            '[DESCRIPTION][LOAD] Erro:',
            error
        );

        setStatus(
            error.message || 'Erro ao carregar descrição.',
            'error'
        );

        showMessage(
            error.message || 'Erro ao carregar descrição.',
            'error'
        );

        return null;
    } finally {
        state.loading = false;
        setFormDisabled(false);
    }
}

/* =====================================================================
   Criar descrição
   ===================================================================== */

async function createDescription(description) {
    return apiRequest(getApiUrl(), {
        method: 'POST',

        body: JSON.stringify({
            product_code: state.productCode,
            description,
            is_active: true,
        }),
    });
}

/* =====================================================================
   Atualizar descrição
   ===================================================================== */

async function updateDescription(description) {
    return apiRequest(
        getApiUrl(`/${state.descriptionId}`),
        {
            method: 'PUT',

            body: JSON.stringify({
                description,
                is_active: true,
            }),
        }
    );
}

/* =====================================================================
   Salvar
   ===================================================================== */

export async function saveProductDescription(event) {
    event?.preventDefault();

    if (state.saving) return;

    const currentProductCode =
        getCurrentProductCode();

    if (!currentProductCode) {
        showMessage(
            'Não foi possível identificar o código do produto.',
            'error'
        );

        return;
    }

    if (
        state.productCode &&
        currentProductCode !== state.productCode
    ) {
        await loadProductDescription(
            currentProductCode
        );
    }

    state.productCode = currentProductCode;

    const description =
        dom.description.value.trim();

    if (!description) {
        dom.description.focus();

        showMessage(
            'Informe a descrição do produto.',
            'error'
        );

        return;
    }

    if (description.length > 10000) {
        dom.description.focus();

        showMessage(
            'A descrição pode possuir no máximo 10000 caracteres.',
            'error'
        );

        return;
    }

    setSaving(true);
    setStatus('Salvando descrição...', 'loading');

    try {
        const savedRecord = state.descriptionId
            ? await updateDescription(description)
            : await createDescription(description);

        state.descriptionId =
            savedRecord.product_description_id;

        state.isActive =
            savedRecord.is_active !== false;

        state.initialDescription =
            String(savedRecord.description || description).trim();

        fillDescription(
            savedRecord.description || description
        );

        setStatus(
            'Descrição salva com sucesso.',
            'success'
        );

        showMessage(
            'Descrição do produto salva com sucesso.',
            'success'
        );

        document.dispatchEvent(
            new CustomEvent(
                'product:description-saved',
                {
                    detail: {
                        productCode: state.productCode,
                        descriptionId:
                            state.descriptionId,
                        description:
                            state.initialDescription,
                    },
                }
            )
        );

        console.info(
            '[DESCRIPTION][SAVE] Descrição salva.',
            {
                productCode: state.productCode,
                descriptionId:
                    state.descriptionId,
            }
        );
    } catch (error) {
        console.error(
            '[DESCRIPTION][SAVE] Erro:',
            error
        );

        setStatus(
            error.message || 'Erro ao salvar descrição.',
            'error'
        );

        showMessage(
            error.message || 'Erro ao salvar descrição.',
            'error'
        );
    } finally {
        setSaving(false);
    }
}

/* =====================================================================
   Eventos
   ===================================================================== */

function bindEvents() {
    dom.form.addEventListener(
        'submit',
        saveProductDescription
    );

    dom.description.addEventListener(
        'input',
        updateCounter
    );

    dom.productCode.addEventListener(
        'change',
        async () => {
            const productCode =
                getCurrentProductCode();

            if (
                productCode &&
                productCode !== state.productCode
            ) {
                await loadProductDescription(
                    productCode
                );
            }
        }
    );

    window.addEventListener(
        'beforeunload',
        (event) => {
            if (
                state.saving ||
                !hasUnsavedChanges()
            ) {
                return;
            }

            event.preventDefault();
            event.returnValue = '';
        }
    );

    document.addEventListener(
        'product:loaded',
        async (event) => {
            const productCode =
                normalizeProductCode(
                    event.detail?.productCode
                ) || getCurrentProductCode();

            if (
                productCode &&
                productCode !== state.productCode
            ) {
                await loadProductDescription(
                    productCode
                );
            }
        }
    );
}

/* =====================================================================
   Inicialização
   ===================================================================== */

export async function initDescriptionTab(
    ctx,
    { productCode } = {}
) {
    if (state.initialized) return;

    if (!cacheDom()) {
        console.warn(
            '[DESCRIPTION][INIT] Elementos HTML não encontrados.'
        );

        return;
    }

    dom.description.maxLength = 10000;

    bindEvents();
    updateCounter();

    state.initialized = true;

    const resolvedProductCode = normalizeProductCode(
        productCode ||
        ctx?.state?.product?.product_code ||
        ctx?.state?.product?.sku ||
        getCurrentProductCode()
    );

    if (!resolvedProductCode) {
        setStatus(
            'Código do produto não carregado.',
            'error'
        );

        state.initialized = false;

        return;
    }

    state.productCode = resolvedProductCode;

    await loadProductDescription(resolvedProductCode);

    console.info(
        '[DESCRIPTION][INIT] Aba inicializada.',
        { productCode: resolvedProductCode }
    );
}

export function getDescriptionTabState() {
    return {
        initialized: state.initialized,
        loading: state.loading,
        saving: state.saving,
        productCode: state.productCode,
        descriptionId: state.descriptionId,
        isActive: state.isActive,
        hasUnsavedChanges: hasUnsavedChanges(),
    };
}

