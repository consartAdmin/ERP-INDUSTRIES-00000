// ╔══════════════════════════════════════════════════════════════╗
// ║ batchCrmDeals.js — Inserção CRM em Lote | CONSART           ║
// ║ PRODNEX ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

const state = {
  customers: [],
  selected: new Map(),
};

const els = {
  searchInput: document.getElementById('bcd-customer-search'),
  searchBtn: document.getElementById('bcd-search-btn'),
  exportBtn: document.getElementById('bcd-export-btn'),
  selectAll: document.getElementById('bcd-select-all'),
  customersBody: document.getElementById('bcd-customers-body'),

  status: document.getElementById('bcd-status'),
  foundCount: document.getElementById('bcd-found-count'),
  selectedCount: document.getElementById('bcd-selected-count'),
  createdCount: document.getElementById('bcd-created-count'),
  failedCount: document.getElementById('bcd-failed-count'),
  previewBody: document.getElementById('bcd-preview-body'),
};

async function apiGet(path) {
  const response = await fetch(path);
  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP_${response.status}`);
  }

  return data;
}

async function apiPost(path, payload) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `HTTP_${response.status}`);
  }

  return data;
}

function text(value) {
  return String(value ?? '').trim();
}

function setStatus(message, type = 'info') {
  if (!els.status) return;
  els.status.textContent = message || '';
  els.status.className = `bcd-status bcd-status-${type}`;
}

function setLoading(isLoading) {
  if (els.searchBtn) els.searchBtn.disabled = isLoading;
  if (els.exportBtn) els.exportBtn.disabled = isLoading;
}

function getCustomerId(row) {
  return row.customer_id ?? row.id ?? row.cliente_id ?? row.customerId ?? null;
}

function getCustomerName(row) {
  return (
    row.customer_name ??
    row.trade_name ??
    row.nome_fantasia ??
    row.legal_name ??
    row.razao_social ??
    row.name ??
    'Cliente sem nome'
  );
}

function getCustomerTaxId(row) {
  return row.tax_id ?? row.cnpj_cpf ?? row.cpf_cnpj ?? row.document ?? row.cnpj ?? row.cpf ?? '-';
}

function getCustomerPhone(row) {
  return row.phone ?? row.mobile_number ?? row.telefone ?? row.phone_number ?? row.whatsapp ?? '-';
}

function updateSummary() {
  if (els.foundCount) els.foundCount.textContent = String(state.customers.length);
  if (els.selectedCount) els.selectedCount.textContent = String(state.selected.size);
}

function renderEmptyCustomers(message) {
  if (!els.customersBody) return;
  els.customersBody.innerHTML = `<tr><td colspan="5">${message}</td></tr>`;
}

function renderCustomers(customers = []) {
  if (!els.customersBody) return;

  state.customers = customers;
  els.customersBody.innerHTML = '';

  if (!customers.length) {
    renderEmptyCustomers('Nenhum cliente encontrado.');
    updateSummary();
    return;
  }

  customers.forEach((customer) => {
    const customerId = getCustomerId(customer);
    const customerName = getCustomerName(customer);

    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <input
          type="checkbox"
          class="bcd-customer-check"
          data-id="${customerId ?? ''}"
        />
      </td>
      <td>${customerId ?? '-'}</td>
      <td>${customerName}</td>
      <td>${getCustomerTaxId(customer)}</td>
      <td>${getCustomerPhone(customer)}</td>
    `;

    const checkbox = tr.querySelector('.bcd-customer-check');
    checkbox.checked = state.selected.has(String(customerId));

    checkbox.addEventListener('change', () => {
      if (!customerId) {
        checkbox.checked = false;
        return;
      }

      if (checkbox.checked) {
        state.selected.set(String(customerId), {
          customer_id: Number(customerId),
          customer_name: customerName,
        });
      } else {
        state.selected.delete(String(customerId));
      }

      updateSummary();
      syncSelectAllState();
    });

    els.customersBody.appendChild(tr);
  });

  syncSelectAllState();
  updateSummary();
}

async function searchCustomers() {
  const q = text(els.searchInput?.value);

  if (q.length < 3) {
    setStatus('Digite pelo menos 3 caracteres para buscar clientes.', 'error');
    return;
  }

  setLoading(true);
  setStatus('Buscando clientes...', 'info');

  try {
    const json = await apiGet(
      `/api/crm-deals/batch/customers/search?q=${encodeURIComponent(q)}`
    );

    const customers = json.data ?? json.rows ?? json.customers ?? [];

    renderCustomers(customers);
    setStatus(`${customers.length} cliente(s) encontrado(s).`, 'success');
  } catch (err) {
    console.error('[batchCrmDeals.searchCustomers]', err);
    renderEmptyCustomers('Erro ao buscar clientes.');
    setStatus(`Erro ao buscar clientes: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

function getSelectedCustomers() {
  return Array.from(state.selected.values());
}

function syncSelectAllState() {
  if (!els.selectAll) return;

  const validCustomers = state.customers
    .map(getCustomerId)
    .filter(Boolean)
    .map(String);

  if (!validCustomers.length) {
    els.selectAll.checked = false;
    els.selectAll.indeterminate = false;
    return;
  }

  const selectedOnScreen = validCustomers.filter((id) => state.selected.has(id));

  els.selectAll.checked = selectedOnScreen.length === validCustomers.length;
  els.selectAll.indeterminate =
    selectedOnScreen.length > 0 && selectedOnScreen.length < validCustomers.length;
}

function toggleSelectAll() {
  const checked = !!els.selectAll?.checked;

  state.customers.forEach((customer) => {
    const customerId = getCustomerId(customer);
    if (!customerId) return;

    if (checked) {
      state.selected.set(String(customerId), {
        customer_id: Number(customerId),
        customer_name: getCustomerName(customer),
      });
    } else {
      state.selected.delete(String(customerId));
    }
  });

  renderCustomers(state.customers);
  updateSummary();
}

async function exportSelectedCustomersToCrm() {
  const customers = getSelectedCustomers();

  if (!customers.length) {
    setStatus('Selecione pelo menos um cliente para exportar ao CRM.', 'error');
    return;
  }

  setLoading(true);
  setStatus('Exportando clientes selecionados para o CRM...', 'info');

  try {
    const json = await apiPost('/api/crm-deals/batch/create', {
      customers,
      defaults: {
        stage_code: 'NOVO',
      },
    });

    if (els.createdCount) els.createdCount.textContent = String(json.summary?.created ?? 0);
    if (els.failedCount) els.failedCount.textContent = String(json.summary?.failed ?? 0);

    setStatus(
      `Exportação finalizada: ${json.summary?.created || 0} criado(s), ${json.summary?.failed || 0} falha(s).`,
      json.summary?.failed ? 'error' : 'success'
    );
  } catch (err) {
    console.error('[batchCrmDeals.exportSelectedCustomersToCrm]', err);
    setStatus(`Erro ao exportar para CRM: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
}

els.searchBtn?.addEventListener('click', searchCustomers);
els.exportBtn?.addEventListener('click', exportSelectedCustomersToCrm);
els.selectAll?.addEventListener('change', toggleSelectAll);

els.searchInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    searchCustomers();
  }
});

renderEmptyCustomers('Faça uma busca para listar os clientes.');
updateSummary();
setStatus('Pronto para selecionar clientes e exportar ao CRM.', 'info');