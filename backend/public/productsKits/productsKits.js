// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsKits.js                                               ║
// ║ MODULE: Products Kits Frontend                                      ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';

const API_BASE = '/api/products-kits';

let kits = [];
let kitItems = [];

const $ = (selector) => document.querySelector(selector);

const money = (value) => {
    return Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    });
};

const num = (value) => Number(value || 0);

function showMessage(message, type = 'info') {
    if (type === 'error') {
        alert(`Erro: ${message}`);
        return;
    }

    alert(message);
}

async function requestJSON(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
        ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
        throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
}

async function loadKits() {
    try {
        const q = $('#searchKit')?.value?.trim() || '';
        const data = await requestJSON(`${API_BASE}?q=${encodeURIComponent(q)}&active=all`);

        kits = data.rows || [];
        renderKits();
    } catch (error) {
        console.error('[productsKits] loadKits error:', error);

        $('#kitsTableBody').innerHTML = `
            <tr>
                <td colspan="9" class="empty">Erro ao carregar kits.</td>
            </tr>
        `;
    }
}

function renderKits() {
    const tbody = $('#kitsTableBody');

    if (!kits.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty">Nenhum kit encontrado.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = kits.map((kit) => `
        <tr>
            <td>${kit.id}</td>
            <td><strong>${kit.kit_sku || ''}</strong></td>
            <td>${kit.kit_description || ''}</td>
            <td>${kit.price_mode || 'MANUAL'}</td>
            <td>${money(kit.sale_price)}</td>
            <td>${kit.total_items || 0}</td>
            <td>${money(kit.total_cost)}</td>
            <td>
                <span class="badge ${kit.active ? 'badge-active' : 'badge-inactive'}">
                    ${kit.active ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-primary" onclick="editKit(${kit.id})">Editar</button>
                    <button class="btn btn-danger" onclick="deactivateKit(${kit.id})">Inativar</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openForm() {
    $('#kitFormSection').classList.remove('hidden');
    window.scrollTo({
        top: $('#kitFormSection').offsetTop - 20,
        behavior: 'smooth',
    });
}

function closeForm() {
    $('#kitFormSection').classList.add('hidden');
    clearForm();
}

function clearForm() {
    $('#formTitle').textContent = 'Novo Kit';
    $('#kitId').value = '';
    $('#kitSku').value = '';
    $('#kitDescription').value = '';
    $('#priceMode').value = 'MANUAL';
    $('#salePrice').value = '0';
    $('#kitActive').value = 'true';

    kitItems = [];

    clearItemInputs();
    renderItems();
}

function clearItemInputs() {
    $('#productSearch').value = '';
    $('#itemSku').value = '';
    $('#itemDescription').value = '';
    $('#itemUnit').value = '';
    $('#itemUnit').dataset.factor = '1';
    $('#itemQuantity').value = '1';
    $('#itemCostUnit').value = '0';
    $('#itemSaleUnit').value = '0';

    $('#productSuggestions')?.classList.add('hidden');

    if ($('#productSuggestions')) {
        $('#productSuggestions').innerHTML = '';
    }
}

async function editKit(id) {
    try {
        const data = await requestJSON(`${API_BASE}/${id}`);
        const kit = data.data;

        $('#formTitle').textContent = `Editar Kit #${kit.id}`;
        $('#kitId').value = kit.id;
        $('#kitSku').value = kit.kit_sku || '';
        $('#kitDescription').value = kit.kit_description || '';
        $('#priceMode').value = kit.price_mode || 'MANUAL';
        $('#salePrice').value = kit.sale_price || 0;
        $('#kitActive').value = String(kit.active !== false);

        kitItems = (kit.items || []).map((item) => ({
            product_sku: item.product_sku,
            description: item.description,
            unit: item.unit,
            unit_factor: num(item.unit_factor || item.fator || item.factor || 1),
            quantity: num(item.quantity),
            cost_unit: num(item.cost_unit),
            sale_price_unit: num(item.sale_price_unit),
            active: item.active !== false,
        }));

        renderItems();
        openForm();
    } catch (error) {
        console.error('[productsKits] editKit error:', error);
        showMessage(error.message, 'error');
    }
}

async function deactivateKit(id) {
    if (!confirm('Deseja realmente inativar este kit?')) return;

    try {
        await requestJSON(`${API_BASE}/${id}/deactivate`, {
            method: 'PATCH',
        });

        await loadKits();
    } catch (error) {
        console.error('[productsKits] deactivateKit error:', error);
        showMessage(error.message, 'error');
    }
}

function addItem() {
    const product_sku = $('#itemSku').value.trim();
    const description = $('#itemDescription').value.trim();

    if (!product_sku) {
        showMessage('Selecione um produto para adicionar ao kit.', 'error');
        return;
    }

    const item = {
        product_sku,
        description,
        unit: $('#itemUnit').value.trim(),
        unit_factor: num($('#itemUnit').dataset.factor || 1),
        quantity: num($('#itemQuantity').value || 1),
        cost_unit: num($('#itemCostUnit').value),
        sale_price_unit: num($('#itemSaleUnit').value),
        active: true,
    };

    if (item.quantity <= 0) {
        showMessage('A quantidade precisa ser maior que zero.', 'error');
        return;
    }

    if (item.unit_factor <= 0) {
        item.unit_factor = 1;
    }

    kitItems.push(item);
    clearItemInputs();
    renderItems();
}

function removeItem(index) {
    kitItems.splice(index, 1);
    renderItems();
}

function renderItems() {
    const tbody = $('#itemsTableBody');

    if (!kitItems.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty">Nenhum item adicionado.</td>
            </tr>
        `;
        updateTotals();
        return;
    }

    tbody.innerHTML = kitItems.map((item, index) => {
        const factor = num(item.unit_factor || 1);
        const totalCost = num(item.quantity) * factor * num(item.cost_unit);
        const totalSale = num(item.quantity) * factor * num(item.sale_price_unit);

        return `
            <tr>
                <td><strong>${item.product_sku || ''}</strong></td>
                <td>${item.description || ''}</td>
                <td>${item.unit || ''}</td>
                <td>${num(item.quantity).toFixed(3)}</td>
                <td>${money(item.cost_unit)}</td>
                <td>${money(item.sale_price_unit)}</td>
                <td>${money(totalCost)}</td>
                <td>${money(totalSale)}</td>
                <td>
                    <button class="btn btn-danger" onclick="removeKitItem(${index})">
                        Remover
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    updateTotals();
}

function updateTotals() {
    const totalCost = kitItems.reduce((acc, item) => {
        const factor = num(item.unit_factor || 1);
        return acc + num(item.quantity) * factor * num(item.cost_unit);
    }, 0);

    const totalSaleItems = kitItems.reduce((acc, item) => {
        const factor = num(item.unit_factor || 1);
        return acc + num(item.quantity) * factor * num(item.sale_price_unit);
    }, 0);

    $('#totalCost').textContent = money(totalCost);
    $('#totalSaleItems').textContent = money(totalSaleItems);

    if ($('#priceMode').value === 'SUM_ITEMS') {
        $('#salePrice').value = totalSaleItems.toFixed(2);
    }
}

async function saveKit() {
    try {
        const id = $('#kitId').value;

        updateTotals();

        const payload = {
            kit_sku: $('#kitSku').value.trim(),
            kit_description: $('#kitDescription').value.trim(),
            price_mode: $('#priceMode').value,
            sale_price: num($('#salePrice').value),
            active: $('#kitActive').value === 'true',
            items: kitItems,
        };

        if (!payload.kit_description) {
            showMessage('Informe a descrição do kit.', 'error');
            return;
        }

        if (!payload.items.length) {
            showMessage('Adicione pelo menos um item ao kit.', 'error');
            return;
        }

        const method = id ? 'PUT' : 'POST';
        const url = id ? `${API_BASE}/${id}` : API_BASE;

        await requestJSON(url, {
            method,
            body: JSON.stringify(payload),
        });

        showMessage('Kit salvo com sucesso.');
        closeForm();
        await loadKits();
    } catch (error) {
        console.error('[productsKits] saveKit error:', error);
        showMessage(error.message, 'error');
    }
}

function setupEvents() {
    $('#btnNovoKit')?.addEventListener('click', () => {
        clearForm();
        openForm();
    });

    $('#btnAtualizar')?.addEventListener('click', loadKits);
    $('#btnPesquisar')?.addEventListener('click', loadKits);

    $('#searchKit')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loadKits();
    });

    $('#btnFecharForm')?.addEventListener('click', closeForm);
    $('#btnCancelar')?.addEventListener('click', closeForm);
    $('#btnAdicionarItem')?.addEventListener('click', addItem);
    $('#btnSalvarKit')?.addEventListener('click', saveKit);

    $('#priceMode')?.addEventListener('change', updateTotals);

    $('#productSearch')?.addEventListener('click', () => {
        openProductsModalSearch({
            apiBase: '',
            defaultVarejoPriceId: 1,

            onPick: (product) => {
                const sku =
                    product.product_code ||
                    product.sku ||
                    product.codigo ||
                    '';

                const description =
                    product.description ||
                    product.descricao ||
                    product.nome ||
                    '';

                const unit =
                    product.matched_unit ||
                    product.unit ||
                    product.unidade ||
                    '';

                const unitFactor =
                    product.unit_factor ||
                    product.fator ||
                    product.factor ||
                    1;

                const cost =
                    product.cost_price ||
                    product.cost_unit ||
                    product.custo ||
                    0;

                const sale =
                    product.price ||
                    product.sale_price ||
                    product.preco_venda ||
                    product.preco ||
                    0;

                $('#productSearch').value = `${sku} - ${description}`;
                $('#itemSku').value = sku;
                $('#itemDescription').value = description;
                $('#itemUnit').value = unit;
                $('#itemUnit').dataset.factor = Number(unitFactor || 1);
                $('#itemCostUnit').value = Number(cost || 0);
                $('#itemSaleUnit').value = Number(sale || 0);

                $('#itemQuantity').focus();
            },
        });
    });

    $('#productSearch')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            $('#productSearch').click();
        }
    });
}

window.editKit = editKit;
window.deactivateKit = deactivateKit;
window.removeKitItem = removeItem;

document.addEventListener('DOMContentLoaded', async () => {
    setupEvents();
    await loadKits();
});