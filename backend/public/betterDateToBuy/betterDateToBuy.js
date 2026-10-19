// ╔════════════════════════════════════════════════════════════════════╗
// ║ betterDateToBuy.js                                                ║
// ║ PRODNEX ERP                                                       ║
// ║ Monthly customer repurchase alerts                                ║
// ╚════════════════════════════════════════════════════════════════════╝

import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';

const API = '/api/betterDateToBuy';

const form = document.getElementById('betterDateForm');
const tableBody = document.getElementById('alertsTableBody');
const btnRefresh = document.getElementById('btnRefresh');
const customerIdInput = document.getElementById('customer_id');
const customerNameInput = document.getElementById('customer_name');
const btnSearchCustomer = document.getElementById('btnSearchCustomer');
const alertDayInput = document.getElementById('alert_day');
const notesInput = document.getElementById('notes');

let currentAlerts = [];
let editingId = null;

init();

function init() {
    bindEvents();
    loadAlerts();
}

function bindEvents() {
    form.addEventListener('submit', saveAlert);
    btnRefresh.addEventListener('click', loadAlerts);
    btnSearchCustomer.addEventListener('click', openCustomerSearch);
}

function openCustomerSearch(e) {
    e.preventDefault();

    openCustomersModalSearch({
        onPick(customer) {
            customerIdInput.value =
                customer.customer_id ||
                customer.id ||
                '';

            customerNameInput.value =
                customer.trade_name ||
                customer.nome_fantasia ||
                customer.legal_name ||
                customer.razao_social ||
                customer.nome ||
                '';
        }
    });
}

async function loadAlerts() {
    try {
        const res = await fetch(API);

        if (!res.ok) {
            throw new Error(`Error loading alerts (${res.status})`);
        }

        const response = await res.json();

        if (!response.ok) {
            throw new Error(response.error || 'Error loading alerts.');
        }

        currentAlerts = response.data || [];
        tableBody.innerHTML = '';

        if (!currentAlerts.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5">No alerts created yet.</td>
                </tr>
            `;
            return;
        }

        for (const item of currentAlerts) {
            const id = item.better_date_to_buy_id || item.id;

            const tr = document.createElement('tr');

            tr.innerHTML = `
                <td>${escapeHtml(item.trade_name || item.customer_name || 'Unknown customer')}</td>
                <td>${escapeHtml(item.alert_day || '')}</td>
                <td>${escapeHtml(item.status || '')}</td>
                <td>${escapeHtml(item.notes || '')}</td>
                <td>
                    <div class="actions-cell">
                        <button
                            type="button"
                            data-id="${id}"
                            class="btn btn-toolbar btn-sm markSentBtn">
                            Mark Sent
                        </button>

                        <button
                            type="button"
                            data-id="${id}"
                            class="btn btn-toolbar btn-sm editBtn">
                            ✏️ Edit
                        </button>

                        <button
                            type="button"
                            data-id="${id}"
                            class="btn btn-toolbar btn-sm removeBtn">
                            🗑️ Remove
                        </button>
                    </div>
                </td>
            `;

            tableBody.appendChild(tr);
        }

        bindTableButtons();

    } catch (err) {
        console.error('Load alerts error:', err);
        alert(err.message);
    }
}

async function saveAlert(e) {
    e.preventDefault();

    try {
        const payload = {
            customer_id: Number(customerIdInput.value),
            alert_day: Number(alertDayInput.value),
            notes: notesInput.value.trim()
        };

        validate(payload);

        const isEditing = Boolean(editingId);

        const res = await fetch(
            isEditing ? `${API}/${editingId}` : API,
            {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(
                errorText ||
                (isEditing ? 'Error updating alert.' : 'Error creating alert.')
            );
        }

        alert(
            isEditing
                ? 'Alert updated successfully.'
                : 'Alert created successfully.'
        );

        resetForm();
        await loadAlerts();

    } catch (err) {
        console.error('Save error:', err);
        alert(err.message);
    }
}

function validate(data) {
    if (!data.customer_id) {
        throw new Error('Select a customer.');
    }

    if (!data.alert_day || data.alert_day < 1 || data.alert_day > 31) {
        throw new Error('Alert day must be between 1 and 31.');
    }
}

function bindTableButtons() {
    document.querySelectorAll('.markSentBtn').forEach(btn => {
        btn.onclick = () => markAsSent(btn.dataset.id);
    });

    document.querySelectorAll('.editBtn').forEach(btn => {
        btn.onclick = () => editAlert(btn.dataset.id);
    });

    document.querySelectorAll('.removeBtn').forEach(btn => {
        btn.onclick = () => removeAlert(btn.dataset.id);
    });
}

async function markAsSent(id) {
    try {
        const res = await fetch(
            `${API}/${id}/mark-sent`,
            {
                method: 'PATCH'
            }
        );

        if (!res.ok) {
            throw new Error('Error marking alert.');
        }

        await loadAlerts();

    } catch (err) {
        console.error('Mark sent error:', err);
        alert(err.message);
    }
}

function editAlert(id) {
    const item = currentAlerts.find(row =>
        String(row.better_date_to_buy_id || row.id) === String(id)
    );

    if (!item) {
        alert('Alert not found.');
        return;
    }

    editingId = id;

    customerIdInput.value =
        item.customer_id ||
        item.cliente_id ||
        '';

    customerNameInput.value =
        item.trade_name ||
        item.customer_name ||
        item.legal_name ||
        '';

    alertDayInput.value =
        item.alert_day ||
        '';

    notesInput.value =
        item.notes ||
        '';

    const submitBtn = form.querySelector('button[type="submit"]');

    if (submitBtn) {
        submitBtn.textContent = 'Update Alert';
    }

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

async function removeAlert(id) {
    const ok = confirm('Remove this alert?');

    if (!ok) return;

    try {
        const res = await fetch(
            `${API}/${id}`,
            {
                method: 'DELETE'
            }
        );

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Error removing alert.');
        }

        await loadAlerts();

    } catch (err) {
        console.error('Remove error:', err);
        alert(err.message);
    }
}

function resetForm() {
    form.reset();

    editingId = null;

    customerIdInput.value = '';
    customerNameInput.value = '';

    const submitBtn = form.querySelector('button[type="submit"]');

    if (submitBtn) {
        submitBtn.textContent = 'Save Alert';
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}