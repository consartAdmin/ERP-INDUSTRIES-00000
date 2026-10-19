// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: backend/public/promoImages/promoImages.js                     ║
// ║ MODULE: Promo Images Frontend                                       ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

const API_BASE = '/api/promo-images';

const els = {
    priceTableSelect: document.getElementById('priceTableSelect'),
    btnOpenProductSearch: document.getElementById('btnOpenProductSearch'),

    promoTitleInput: document.getElementById('promoTitleInput'),
    promoSubtitleInput: document.getElementById('promoSubtitleInput'),
    oldPriceInput: document.getElementById('oldPriceInput'),
    promoPriceInput: document.getElementById('promoPriceInput'),

    btnGeneratePromo: document.getElementById('btnGeneratePromo'),
    statusBox: document.getElementById('statusBox'),
    selectedProductBox: document.getElementById('selectedProductBox'),
    generatedImageBox: document.getElementById('generatedImageBox'),
};

const state = {
    priceTables: [],
    products: [],
    selectedProduct: null,
    searchTimer: null,
};



function moneyBR(value) {
    const n = Number(value || 0);

    return n.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
}

function safeText(value) {
    return String(value ?? '').trim();
}

function imageUrl(url) {
    const raw = safeText(url);

    if (!raw) return '';

    if (/^https?:\/\//i.test(raw)) return raw;

    if (raw.startsWith('/')) return raw;

    return `/${raw}`;
}

function showStatus(message, type = 'success') {
    els.statusBox.textContent = message;
    els.statusBox.className = `status-box ${type}`;
}

function hideStatus() {
    els.statusBox.className = 'status-box hidden';
    els.statusBox.textContent = '';
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok || json.ok === false) {
        throw new Error(json.message || `Erro HTTP ${response.status}`);
    }

    return json;
}

function renderPriceTables() {
    if (!state.priceTables.length) {
        els.priceTableSelect.innerHTML = '<option value="">Nenhuma tabela encontrada</option>';
        return;
    }

    els.priceTableSelect.innerHTML = `
    <option value="">Selecione uma tabela...</option>
    ${state.priceTables
            .map((t) => `<option value="${t.id}">${safeText(t.nome || t.name || `Tabela ${t.id}`)}</option>`)
            .join('')}
  `;
}

async function loadPriceTables() {
    try {
        const json = await fetchJson(`${API_BASE}/price-tables`);
        state.priceTables = Array.isArray(json.rows) ? json.rows : [];
        renderPriceTables();
    } catch (error) {
        console.error('[promoImages][loadPriceTables]', error);
        els.priceTableSelect.innerHTML = '<option value="">Erro ao carregar tabelas</option>';
        showStatus(error.message, 'error');
    }
}

function renderSelectedProduct() {
    if (!state.selectedProduct) {
        els.selectedProductBox.className = 'selected-empty';
        els.selectedProductBox.innerHTML = 'Nenhum produto selecionado.';
        return;
    }

    const p = state.selectedProduct;
    const img = imageUrl(p.image_url);

    els.selectedProductBox.className = '';
    els.selectedProductBox.innerHTML = `
    <div class="selected-product">
      ${img
            ? `<img src="${img}" alt="${safeText(p.description)}" onerror="this.style.display='none'">`
            : `<div class="selected-empty">Sem imagem</div>`
        }

      <div>
        <h3>${safeText(p.description)}</h3>
        <p><strong>SKU:</strong> ${safeText(p.product_code)}</p>
        <p><strong>Unidade:</strong> ${safeText(p.unit || 'UN')}</p>
        <p><strong>Preço tabela:</strong> ${moneyBR(p.price)}</p>
      </div>
    </div>
  `;
}

async function generatePromoImage() {
    if (!state.selectedProduct) return;

    const tabelaId = els.priceTableSelect.value;

    const payload = {
        tabela_preco_id: tabelaId,
        product_code: state.selectedProduct.product_code,
        title: els.promoTitleInput.value || 'PROMOÇÃO',
        subtitle: els.promoSubtitleInput.value || 'BH3 Distribuidora',
        old_price: els.oldPriceInput.value || null,
        promo_price: els.promoPriceInput.value || state.selectedProduct.price,
    };

    try {
        hideStatus();
        els.btnGeneratePromo.disabled = true;
        els.btnGeneratePromo.textContent = 'Gerando...';

        const json = await fetchJson(`${API_BASE}/generate`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        const url = json.url || json.data?.url;

        if (!url) {
            throw new Error('Imagem gerada, mas a URL não foi retornada.');
        }

        const finalUrl = `${url}?t=${Date.now()}`;

        els.generatedImageBox.innerHTML = `
      <a href="${url}" target="_blank">
        <img src="${finalUrl}" alt="Imagem promocional gerada">
      </a>
    `;

        showStatus('Imagem promocional gerada com sucesso.', 'success');
    } catch (error) {
        console.error('[promoImages][generatePromoImage]', error);
        showStatus(error.message, 'error');
    } finally {
        els.btnGeneratePromo.disabled = !state.selectedProduct;
        els.btnGeneratePromo.textContent = 'Gerar Imagem';
    }
}

function openProductModal() {
    const priceId = els.priceTableSelect.value;

    if (!priceId) {
        showStatus(
            'Selecione uma tabela de preço primeiro.',
            'error'
        );
        return;
    }

    openProductsModalSearch({
        apiBase: '',
        priceId,

        onPick(product) {
            state.selectedProduct = {
                product_id:
                    product.product_id,

                product_code:
                    product.product_code,

                description:
                    product.description,

                unit:
                    product.unit ||
                    product.unidade ||
                    product.matched_unit ||
                    'UN',

                price:
                    product.price ||
                    product.sale_price ||
                    product.preco_venda ||
                    0,

                image_url:
                    product.image_url ||
                    product.imagem ||
                    product.image ||
                    '',
            };

            els.promoPriceInput.value =
                Number(
                    state.selectedProduct.price || 0
                ).toFixed(2);

            renderSelectedProduct();

            els.btnGeneratePromo.disabled = false;

            showStatus(
                'Produto selecionado com sucesso.',
                'success'
            );
        },
    });
}

function bindEvents() {

    els.btnOpenProductSearch.addEventListener(
        'click',
        openProductModal
    );

    els.btnGeneratePromo.addEventListener(
        'click',
        generatePromoImage
    );

    els.priceTableSelect.addEventListener(
        'change',
        () => {

            state.selectedProduct = null;

            renderSelectedProduct();

            els.btnGeneratePromo.disabled = true;

            showStatus(
                'Selecione um produto.',
                'success'
            );
        }
    );
}

async function init() {
    bindEvents();
    renderSelectedProduct();

    await loadPriceTables();

    els.productsList.innerHTML = `
    <div class="selected-empty">
      Selecione uma tabela e busque um produto.
    </div>
  `;
}

init();