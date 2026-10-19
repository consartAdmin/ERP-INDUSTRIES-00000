// ╔══════════════════════════════════════════════════════════════════════╗
// ║ ordersPayments.js — Frontend Pagamentos de Pedidos                  ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

const API_BASE = '/api/orders-payments';

const $ = (selector) => document.querySelector(selector);

const els = {
  btnNovoPagamento: $('#btnNovoPagamento'),
  btnPesquisar: $('#btnPesquisar'),
  btnLimpar: $('#btnLimpar'),
  filtroOrderId: $('#filtroOrderId'),

  tableBody: $('#paymentsTableBody'),

  modal: $('#paymentModal'),
  modalTitle: $('#modalTitle'),
  btnFecharModal: $('#btnFecharModal'),
  btnCancelar: $('#btnCancelar'),
  form: $('#paymentForm'),

  order_payment_id: $('#order_payment_id'),
  order_id: $('#order_id'),
  payment_method_id: $('#payment_method_id'),
  payment_method_name: $('#payment_method_name'),
  amount: $('#amount'),
  installments: $('#installments'),
  gap_one: $('#gap_one'),
  gap_two: $('#gap_two'),
  gap_three: $('#gap_three'),
  gap_four: $('#gap_four'),
  manual_due_date: $('#manual_due_date'),
};

let state = {
  rows: [],
  editingId: null,
};

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function dateBR(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('pt-BR');
}

function dateInputValue(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getNumberValue(input, def = null) {
  const value = input.value?.trim();

  if (!value) return def;

  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

function getTextValue(input, def = null) {
  const value = input.value?.trim();
  return value || def;
}

function setLoading() {
  els.tableBody.innerHTML = `
    <tr>
      <td colspan="8" class="empty">Carregando pagamentos...</td>
    </tr>
  `;
}

function setEmpty(message = 'Nenhum pagamento encontrado.') {
  els.tableBody.innerHTML = `
    <tr>
      <td colspan="8" class="empty">${message}</td>
    </tr>
  `;
}

function renderTable() {
  if (!state.rows.length) {
    setEmpty();
    return;
  }

  els.tableBody.innerHTML = state.rows.map((row) => `
    <tr>
      <td>${row.order_payment_id}</td>
      <td>${row.order_id}</td>
      <td>${row.payment_method_name || '-'}</td>
      <td>${moneyBR(row.amount)}</td>
      <td>${row.installments || '-'}</td>
      <td>${dateBR(row.manual_due_date)}</td>
      <td>${dateBR(row.created_at)}</td>
      <td>
        <div class="actions">
          <button class="btn small" data-action="edit" data-id="${row.order_payment_id}">
            Editar
          </button>

          <button class="btn small danger" data-action="delete" data-id="${row.order_payment_id}">
            Excluir
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.message || `Erro HTTP ${response.status}`);
  }

  return data;
}

async function loadPayments() {
  try {
    setLoading();

    const orderId = els.filtroOrderId.value.trim();

    const params = new URLSearchParams();

    if (orderId) {
      params.set('order_id', orderId);
    }

    const url = params.toString()
      ? `${API_BASE}?${params.toString()}`
      : API_BASE;

    const data = await requestJson(url);

    state.rows = Array.isArray(data.rows) ? data.rows : [];

    renderTable();
  } catch (err) {
    console.error('[ordersPayments.loadPayments]', err);
    setEmpty(err.message || 'Erro ao carregar pagamentos.');
  }
}

function openModal(row = null) {
  clearForm();

  if (row) {
    state.editingId = row.order_payment_id;
    els.modalTitle.textContent = `Editar Pagamento #${row.order_payment_id}`;

    els.order_payment_id.value = row.order_payment_id || '';
    els.order_id.value = row.order_id || '';
    els.payment_method_id.value = row.payment_method_id || '';
    els.payment_method_name.value = row.payment_method_name || '';
    els.amount.value = row.amount || '';
    els.installments.value = row.installments || '';
    els.gap_one.value = row.gap_one || '';
    els.gap_two.value = row.gap_two || '';
    els.gap_three.value = row.gap_three || '';
    els.gap_four.value = row.gap_four || '';
    els.manual_due_date.value = dateInputValue(row.manual_due_date);
  } else {
    state.editingId = null;
    els.modalTitle.textContent = 'Novo Pagamento';

    const filtroOrderId = els.filtroOrderId.value.trim();
    if (filtroOrderId) {
      els.order_id.value = filtroOrderId;
    }
  }

  els.modal.classList.remove('hidden');
  els.order_id.focus();
}

function closeModal() {
  els.modal.classList.add('hidden');
  clearForm();
}

function clearForm() {
  els.form.reset();
  els.order_payment_id.value = '';
  state.editingId = null;
}

function getPayload() {
  return {
    order_id: getNumberValue(els.order_id),
    payment_method_id: getNumberValue(els.payment_method_id),
    payment_method_name: getTextValue(els.payment_method_name),
    amount: getNumberValue(els.amount, 0),
    installments: getNumberValue(els.installments),
    gap_one: getNumberValue(els.gap_one),
    gap_two: getNumberValue(els.gap_two),
    gap_three: getNumberValue(els.gap_three),
    gap_four: getNumberValue(els.gap_four),
    manual_due_date: getTextValue(els.manual_due_date),
  };
}

function validatePayload(payload) {
  if (!payload.order_id) {
    alert('Informe o número do pedido.');
    return false;
  }

  if (!payload.amount || payload.amount <= 0) {
    alert('Informe um valor maior que zero.');
    return false;
  }

  return true;
}

async function savePayment(event) {
  event.preventDefault();

  try {
    const payload = getPayload();

    if (!validatePayload(payload)) return;

    const isEditing = Boolean(state.editingId);

    const url = isEditing
      ? `${API_BASE}/${state.editingId}`
      : API_BASE;

    const method = isEditing ? 'PUT' : 'POST';

    await requestJson(url, {
      method,
      body: JSON.stringify(payload),
    });

    closeModal();
    await loadPayments();
  } catch (err) {
    console.error('[ordersPayments.savePayment]', err);
    alert(err.message || 'Erro ao salvar pagamento.');
  }
}

async function deletePayment(id) {
  const confirmed = confirm(`Deseja realmente excluir o pagamento #${id}?`);

  if (!confirmed) return;

  try {
    await requestJson(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });

    await loadPayments();
  } catch (err) {
    console.error('[ordersPayments.deletePayment]', err);
    alert(err.message || 'Erro ao excluir pagamento.');
  }
}

function handleTableClick(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const id = Number(button.dataset.id);

  if (!id) return;

  const row = state.rows.find((item) => Number(item.order_payment_id) === id);

  if (action === 'edit' && row) {
    openModal(row);
    return;
  }

  if (action === 'delete') {
    deletePayment(id);
  }
}

function bindEvents() {
  els.btnNovoPagamento.addEventListener('click', () => openModal());

  els.btnPesquisar.addEventListener('click', loadPayments);

  els.btnLimpar.addEventListener('click', () => {
    els.filtroOrderId.value = '';
    loadPayments();
  });

  els.btnFecharModal.addEventListener('click', closeModal);
  els.btnCancelar.addEventListener('click', closeModal);

  els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) {
      closeModal();
    }
  });

  els.form.addEventListener('submit', savePayment);
  els.tableBody.addEventListener('click', handleTableClick);

  els.filtroOrderId.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      loadPayments();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadPayments();
});