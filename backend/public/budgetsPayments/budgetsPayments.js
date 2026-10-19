    // ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgetsPayments.js — Frontend Pagamentos do Orçamento               ║
// ║ Path: backend/public/budgetsPayments/budgetsPayments.js             ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = window.location.origin;

const API_PAYMENTS = `${API_BASE}/api/budgets-payments`;
const API_INSTALLMENTS = `${API_BASE}/api/budgets-payment-installments`;

const PAYMENT_METHOD_ENDPOINTS = [
  `${API_BASE}/api/payment-methods`,
  `${API_BASE}/api/paymentMethods`,
  `${API_BASE}/api/payment-methods/active`,
  `${API_BASE}/api/paymentMethods/active`,
];

const $ = (id) => document.getElementById(id);

let currentBudgetId = null;
let paymentsCache = [];
let installmentsCache = [];
let paymentMethodsCache = [];

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
function safe(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function moneyBR(value) {
  return toNumber(value, 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dateBR(value) {
  if (!value) return '-';

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('pt-BR');
}

function dateTimeBR(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('pt-BR');
}

function toast(message, type = 'info') {
  if (window.centerAlertModal) {
    window.centerAlertModal({
      title: type === 'error' ? 'Atenção' : 'Pagamentos do Orçamento',
      message,
      type,
    });
    return;
  }

  alert(message);
}

/*
 * O token do ERP fica em localStorage (não em cookie), então o fetch não o
 * envia sozinho: é obrigatório montar o header Authorization à mão.
 * As rotas /api/budgets-payments e /api/budgets-payment-installments passaram
 * a exigir requireAuth em 16/09/2026.
 */
function getAuthToken() {
  try {
    return (
      localStorage.getItem('token')
      || localStorage.getItem('auth_token')
      || localStorage.getItem('access_token')
      || ''
    ).trim();
  } catch {
    return '';
  }
}

async function fetchJson(url, options = {}) {
  const token = getAuthToken();

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const json = await response.json().catch(() => ({}));

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      json.message || 'Sessão expirada ou sem permissão. Faça login novamente.',
    );
  }

  if (!response.ok || json.ok === false) {
    throw new Error(json.message || `Erro HTTP ${response.status}`);
  }

  return json;
}

function setLoading(button, loadingText = 'Carregando...') {
  if (!button) return () => {};

  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = loadingText;

  return () => {
    button.disabled = false;
    button.textContent = oldText;
  };
}

function getBudgetId() {
  return $('budgetId')?.value?.trim();
}

function requireBudgetId() {
  const budgetId = getBudgetId();

  if (!budgetId) {
    throw new Error('Informe o ID do orçamento.');
  }

  return budgetId;
}

function getPaymentMethodId(row = {}) {
  return (
    row.paymentMethods_id ||
    row.payment_method_id ||
    row.id ||
    row.value ||
    null
  );
}

function getPaymentMethodName(row = {}) {
  return (
    row.name ||
    row.payment_method_name ||
    row.label ||
    row.description ||
    '-'
  );
}

function getRowsFromJson(json) {
  return (
    json.rows ||
    json.data ||
    json.items ||
    json.paymentMethods ||
    json.methods ||
    []
  );
}

// ─────────────────────────────────────────────────────────────────────
// Payment Methods
// ─────────────────────────────────────────────────────────────────────
async function loadPaymentMethods() {
  const select = $('paymentMethodId');

  if (select) {
    select.innerHTML = `<option value="">Carregando formas...</option>`;
  }

  let lastError = null;

  for (const endpoint of PAYMENT_METHOD_ENDPOINTS) {
    try {
      const json = await fetchJson(endpoint);
      const rows = getRowsFromJson(json);

      if (Array.isArray(rows) && rows.length) {
        paymentMethodsCache = rows;

        if (select) {
          select.innerHTML = `
            <option value="">Selecione...</option>
            ${rows.map((row) => {
              const id = getPaymentMethodId(row);
              const name = getPaymentMethodName(row);
              const type = row.type ? ` — ${row.type}` : '';
              const installments = row.installments ? ` (${row.installments}x)` : '';

              return `<option value="${safe(id, '')}">${safe(name)}${type}${installments}</option>`;
            }).join('')}
          `;
        }

        return rows;
      }
    } catch (error) {
      lastError = error;
      console.warn('[budgetsPayments][loadPaymentMethods][TRY_FAIL]', endpoint, error.message);
    }
  }

  if (select) {
    select.innerHTML = `<option value="">Nenhuma forma encontrada</option>`;
  }

  throw new Error(
    lastError?.message ||
    'Não foi possível carregar formas de pagamento. Verifique a rota /api/payment-methods.'
  );
}

// ─────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────
function renderValidation(validation = null) {
  const box = $('validationBox');

  if (!box || !validation) {
    box?.classList.add('hidden');
    return;
  }

  $('itemsTotal').textContent = moneyBR(validation.items_total);
  $('freightValue').textContent = moneyBR(validation.freight_value);
  $('expectedTotal').textContent = moneyBR(validation.expected_total);
  $('paymentsTotal').textContent = moneyBR(validation.payments_total);
  $('differenceTotal').textContent = moneyBR(validation.difference);

  const statusEl = $('balancedStatus');

  if (validation.is_balanced) {
    statusEl.textContent = 'OK';
    statusEl.className = 'bp-status-ok';
  } else {
    statusEl.textContent = 'DIVERGENTE';
    statusEl.className = 'bp-status-alert';
  }

  box.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────────────────────────────
async function loadPayments() {
  const budgetId = requireBudgetId();
  currentBudgetId = budgetId;

  const json = await fetchJson(`${API_PAYMENTS}/budget/${encodeURIComponent(budgetId)}`);

  paymentsCache = json.rows || [];
  renderValidation(json.validation || null);
  renderPayments(paymentsCache);

  return paymentsCache;
}

function renderPayments(rows = []) {
  const tbody = $('paymentsRows');

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">Nenhum pagamento cadastrado para este orçamento.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${safe(row.budget_payment_id)}</td>
      <td>${safe(row.payment_method_name)}</td>
      <td>${safe(row.payment_method_type)}</td>
      <td>${moneyBR(row.amount)}</td>
      <td>${dateBR(row.manual_due_date)}</td>
      <td>${safe(row.installments, '1')}</td>
      <td>${safe(row.notes)}</td>
      <td>
        <div class="bp-row-actions">
          <button class="bp-mini-btn bp-mini-edit" type="button" data-action="edit" data-id="${row.budget_payment_id}">
            Editar
          </button>

          <button class="bp-mini-btn bp-mini-installments" type="button" data-action="regen" data-id="${row.budget_payment_id}">
            Parcelas
          </button>

          <button class="bp-mini-btn bp-mini-delete" type="button" data-action="delete" data-id="${row.budget_payment_id}">
            Excluir
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', handlePaymentRowAction);
  });
}

async function handlePaymentRowAction(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === 'edit') {
    startEditPayment(id);
    return;
  }

  if (action === 'regen') {
    await regenerateInstallmentsByPayment(id, button);
    return;
  }

  if (action === 'delete') {
    await deletePayment(id, button);
  }
}

function startEditPayment(id) {
  const row = paymentsCache.find((item) => String(item.budget_payment_id) === String(id));

  if (!row) {
    toast('Pagamento não encontrado em tela.', 'error');
    return;
  }

  $('budgetPaymentId').value = row.budget_payment_id;
  $('paymentMethodId').value = row.payment_method_id || '';
  $('amount').value = toNumber(row.amount, 0).toFixed(2);
  $('manualDueDate').value = row.manual_due_date || '';
  $('notes').value = row.notes || '';
  $('autoGenerateInstallments').checked = true;

  $('btnSavePayment').textContent = 'Atualizar pagamento';
  $('btnCancelEdit').classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function savePayment(event) {
  event.preventDefault();

  const budgetId = requireBudgetId();
  const paymentId = $('budgetPaymentId')?.value?.trim();

  const payload = {
    budget_id: Number(budgetId),
    payment_method_id: Number($('paymentMethodId')?.value),
    amount: Number($('amount')?.value || 0),
    manual_due_date: $('manualDueDate')?.value || null,
    notes: $('notes')?.value?.trim() || null,
  };

  if (!payload.payment_method_id) {
    toast('Selecione uma forma de pagamento.', 'error');
    return;
  }

  if (payload.amount < 0) {
    toast('O valor não pode ser negativo.', 'error');
    return;
  }

  const autoGenerate = $('autoGenerateInstallments')?.checked ?? true;

  const button = $('btnSavePayment');
  const restore = setLoading(button, paymentId ? 'Atualizando...' : 'Salvando...');

  try {
    if (paymentId) {
      await fetchJson(`${API_PAYMENTS}/${encodeURIComponent(paymentId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          regenerate_installments: autoGenerate,
        }),
      });

      toast('Pagamento atualizado com sucesso.', 'success');
    } else {
      await fetchJson(API_PAYMENTS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          auto_generate_installments: autoGenerate,
        }),
      });

      toast('Pagamento criado com sucesso.', 'success');
    }

    clearForm();
    await loadAll();
  } catch (error) {
    console.error('[budgetsPayments][savePayment][ERROR]', error);
    toast(error.message || 'Erro ao salvar pagamento.', 'error');
  } finally {
    restore();
  }
}

async function deletePayment(id, button) {
  const confirmed = confirm(`Excluir o pagamento ID ${id}?`);
  if (!confirmed) return;

  const restore = setLoading(button, '...');

  try {
    await fetchJson(`${API_PAYMENTS}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    toast('Pagamento removido com sucesso.', 'success');
    await loadAll();
  } catch (error) {
    console.error('[budgetsPayments][deletePayment][ERROR]', error);
    toast(error.message || 'Erro ao remover pagamento.', 'error');
  } finally {
    restore();
  }
}

async function deleteAllPayments() {
  const budgetId = requireBudgetId();

  const confirmed = confirm(`Remover TODOS os pagamentos do orçamento ${budgetId}?`);
  if (!confirmed) return;

  const button = $('btnDeleteAllPayments');
  const restore = setLoading(button, 'Removendo...');

  try {
    await fetchJson(`${API_PAYMENTS}/budget/${encodeURIComponent(budgetId)}/all`, {
      method: 'DELETE',
    });

    toast('Pagamentos removidos com sucesso.', 'success');
    clearForm();
    await loadAll();
  } catch (error) {
    console.error('[budgetsPayments][deleteAllPayments][ERROR]', error);
    toast(error.message || 'Erro ao remover pagamentos.', 'error');
  } finally {
    restore();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Installments
// ─────────────────────────────────────────────────────────────────────
async function loadInstallments() {
  const budgetId = requireBudgetId();

  const json = await fetchJson(`${API_INSTALLMENTS}/budget/${encodeURIComponent(budgetId)}`);

  installmentsCache = json.rows || [];
  renderInstallments(installmentsCache);

  return installmentsCache;
}

function renderInstallments(rows = []) {
  const tbody = $('installmentsRows');

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">Nenhuma parcela gerada para este orçamento.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const status = String(row.status || 'PENDENTE').toLowerCase();

    return `
      <tr>
        <td>${safe(row.budget_payment_installment_id)}</td>
        <td>${safe(row.budget_payment_id)}</td>
        <td>${safe(row.installment_number)}</td>
        <td>${dateBR(row.due_date)}</td>
        <td>${moneyBR(row.amount)}</td>
        <td><span class="bp-pill bp-pill-${status}">${safe(row.status)}</span></td>
        <td>${moneyBR(row.paid_amount)}</td>
        <td>${dateTimeBR(row.paid_at)}</td>
        <td>${safe(row.notes)}</td>
      </tr>
    `;
  }).join('');
}

async function regenerateInstallmentsByPayment(id, button = null) {
  const restore = setLoading(button, '...');

  try {
    await fetchJson(`${API_PAYMENTS}/${encodeURIComponent(id)}/regenerate-installments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    toast('Parcelas regeneradas com sucesso.', 'success');
    await loadAll();
  } catch (error) {
    console.error('[budgetsPayments][regenerateInstallmentsByPayment][ERROR]', error);
    toast(error.message || 'Erro ao regenerar parcelas.', 'error');
  } finally {
    restore();
  }
}

async function regenerateInstallmentsByBudget() {
  const budgetId = requireBudgetId();

  const button = $('btnRegenerateBudgetInstallments');
  const restore = setLoading(button, 'Regenerando...');

  try {
    await fetchJson(`${API_PAYMENTS}/budget/${encodeURIComponent(budgetId)}/regenerate-installments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    toast('Parcelas do orçamento regeneradas com sucesso.', 'success');
    await loadAll();
  } catch (error) {
    console.error('[budgetsPayments][regenerateInstallmentsByBudget][ERROR]', error);
    toast(error.message || 'Erro ao regenerar parcelas do orçamento.', 'error');
  } finally {
    restore();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Form
// ─────────────────────────────────────────────────────────────────────
function clearForm() {
  $('budgetPaymentId').value = '';
  $('paymentMethodId').value = '';
  $('amount').value = '';
  $('manualDueDate').value = '';
  $('notes').value = '';
  $('autoGenerateInstallments').checked = true;

  $('btnSavePayment').textContent = 'Salvar pagamento';
  $('btnCancelEdit').classList.add('hidden');
}

// ─────────────────────────────────────────────────────────────────────
// Load all
// ─────────────────────────────────────────────────────────────────────
async function loadAll() {
  const budgetId = requireBudgetId();
  currentBudgetId = budgetId;

  const button = $('btnLoadBudget');
  const restore = setLoading(button, 'Carregando...');

  try {
    await loadPayments();
    await loadInstallments();
  } catch (error) {
    console.error('[budgetsPayments][loadAll][ERROR]', error);
    toast(error.message || 'Erro ao carregar orçamento.', 'error');

    renderValidation(null);

    $('paymentsRows').innerHTML = `
      <tr>
        <td colspan="8">${safe(error.message, 'Erro ao carregar pagamentos.')}</td>
      </tr>
    `;

    $('installmentsRows').innerHTML = `
      <tr>
        <td colspan="9">Não foi possível carregar parcelas.</td>
      </tr>
    `;
  } finally {
    restore();
  }
}

// ─────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────
function bindEvents() {
  $('btnLoadBudget')?.addEventListener('click', loadAll);
  $('btnReload')?.addEventListener('click', loadAll);

  $('budgetId')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadAll();
    }
  });

  $('paymentForm')?.addEventListener('submit', savePayment);

  $('btnClearForm')?.addEventListener('click', clearForm);
  $('btnCancelEdit')?.addEventListener('click', clearForm);

  $('btnRegenerateBudgetInstallments')?.addEventListener('click', regenerateInstallmentsByBudget);
  $('btnDeleteAllPayments')?.addEventListener('click', deleteAllPayments);
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();

  try {
    await loadPaymentMethods();
  } catch (error) {
    console.error('[budgetsPayments][BOOT][paymentMethods][ERROR]', error);
    toast(error.message, 'error');
  }

  const params = new URLSearchParams(window.location.search);
  const budgetIdFromUrl = params.get('budget_id') || params.get('budgetId');

  if (budgetIdFromUrl) {
    $('budgetId').value = budgetIdFromUrl;
    await loadAll();
  }
});