// ╔══════════════════════════════════════════════════════════════════════╗
// ║ accountsPayable.js — Frontend módulo Contas a Pagar                  ║
// ║ PRODNEX ERP — Lista, filtros, CRUD básico via /api/accounts-payable  ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openNewAccountsPayableModal } from './modal/editAccountsPayableModal.js';

import { openBatchAccountsPayableModal } from './modal/batchAccountsPayableModal.js';

import { openCashDocumentTypesModal } from
  '/public/cashDocumentTypes/cashDocumentTypesModal.js';

const API_BASE = '/api/accounts-payable';
const API_PAY = (id) => `/api/accounts-payable/${id}/pay`;
const API_CAIXA = '/api/caixa/movimentacoes';

// Endpoints para categorias / subcategorias (baseados em caixaApi.js)
const API_CAIXA_CATEGORIAS = '/api/caixa/categorias';
const API_CAIXA_SUBCATEGORIAS = '/api/caixa/subcategorias';

// Endpoints de upload de anexo (fluxo assinado)
const API_UPLOAD_SIGN = '/api/upload/accounts-payable/anexo/sign';
const API_UPLOAD_CONFIRM = '/api/upload/accounts-payable/anexo/confirm';

const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

let state = {
  page: 1,
  pageSize: 50,
  total: 0,
  search: '',
  status: '',
  month: '',
  year: String(new Date().getFullYear()),
  fromDueDate: '',
  toDueDate: '',
  items: [],
};

let caixaCategorias = [];
let caixaSubcatsPorCat = {};
let payDroppedFile = null;

function populateYearFilter() {
  const filterYear = qs('#filterYear');
  if (!filterYear) return;

  const currentYear = new Date().getFullYear();

  filterYear.innerHTML = '';

  for (let year = currentYear - 5; year <= currentYear + 10; year++) {
    const option = document.createElement('option');

    option.value = String(year);
    option.textContent = String(year);

    filterYear.appendChild(option);
  }

  filterYear.value = String(currentYear);
  state.year = String(currentYear);
}

async function loadCashDocumentTypes(selectedId = null) {
  const select = qs('#pay_document_type_id');
  if (!select) {
    console.warn(
      '[accountsPayable] Select #pay_document_type_id não encontrado.'
    );
    return;
  }

  const currentValue =
    selectedId != null && selectedId !== ''
      ? String(selectedId)
      : String(select.value || '');

  select.disabled = true;
  select.innerHTML = '<option value="">Carregando...</option>';

  try {
    const response = await fetch(
      '/api/cash-document-types?activeOnly=true',
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const responseText = await response.text();

    let data = null;

    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      console.error(
        '[accountsPayable] Resposta não JSON:',
        responseText
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        `Erro HTTP ${response.status} ao carregar tipos de documento.`
      );
    }

    if (data?.ok === false) {
      throw new Error(
        data.error || 'Erro ao carregar tipos de documento.'
      );
    }

    const rows =
      data?.data ??
      data?.rows ??
      data?.items ??
      (Array.isArray(data) ? data : []);

    console.log(
      '[accountsPayable] Tipos de documento recebidos:',
      rows
    );

    select.innerHTML =
      '<option value="">Selecione...</option>';

    if (!Array.isArray(rows) || !rows.length) {
      select.innerHTML =
        '<option value="">Nenhum tipo cadastrado</option>';
      return;
    }

    rows
      .filter((item) => item.is_active !== false)
      .forEach((item) => {
        const option = document.createElement('option');

        option.value = String(item.id);
        option.textContent = String(item.name || '');

        select.appendChild(option);
      });

    if (currentValue) {
      const optionExists = [...select.options].some(
        (option) => option.value === currentValue
      );

      if (optionExists) {
        select.value = currentValue;
      }
    }
  } catch (error) {
    console.error(
      '[accountsPayable] loadCashDocumentTypes:',
      error
    );

    select.innerHTML =
      '<option value="">Erro ao carregar</option>';
  } finally {
    select.disabled = false;
  }
}

function initPayAttachmentDropzone() {
  const dropzone = qs('#pay_dropzone');
  const fileInput = qs('#pay_anexoFile');
  const content = qs('#pay_dropzone .ap-dropzone-content');

  if (!dropzone || !fileInput || !content) {
    console.warn('[accountsPayable] Dropzone de pagamento não encontrado.');
    return;
  }

  const allowedExtensions = new Set([
    'pdf', 'xml', 'png', 'jpg', 'jpeg', 'webp',
  ]);

  const getExtension = (fileName) =>
    String(fileName || '').split('.').pop().toLowerCase();

  function formatFileSize(size) {
    const bytes = Number(size || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function renderEmptyState() {
    content.innerHTML = `
      <strong>📎 Arraste o arquivo aqui</strong>
      <span>ou clique para selecionar</span>
      <small id="pay_anexoHelp" class="help-text">
        O arquivo será vinculado à movimentação no Caixa
        após confirmar o pagamento.
      </small>
    `;

    dropzone.classList.remove('has-file', 'is-dragover');
  }

  function renderSelectedFile(file) {
    content.innerHTML = '';

    const title = document.createElement('strong');
    title.textContent = '✅ Arquivo selecionado';

    const fileName = document.createElement('span');
    fileName.className = 'ap-dropzone-file-name';
    fileName.textContent = file.name;
    fileName.title = file.name;

    const fileSize = document.createElement('small');
    fileSize.className = 'help-text';
    fileSize.textContent = formatFileSize(file.size);

    content.append(title, fileName, fileSize);
    dropzone.classList.add('has-file');
    dropzone.classList.remove('is-dragover');
  }

  function validateFile(file) {
    if (!file) return 'Nenhum arquivo selecionado.';

    if (!allowedExtensions.has(getExtension(file.name))) {
      return 'Tipo não permitido. Use PDF, XML, PNG, JPG, JPEG ou WEBP.';
    }

    if (file.size > 20 * 1024 * 1024) {
      return 'O arquivo deve ter no máximo 20 MB.';
    }

    return null;
  }

  function assignFile(file) {
    const validationError = validateFile(file);

    if (validationError) {
      alert(validationError);
      return false;
    }

    payDroppedFile = file;

    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInput.files = transfer.files;
    } catch (error) {
      console.warn(
        '[accountsPayable] DataTransfer indisponível; usando arquivo em memória.',
        error
      );
    }

    renderSelectedFile(file);
    return true;
  }

  dropzone.addEventListener('click', (event) => {
    if (event.target === fileInput) return;
    fileInput.click();
  });

  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0] || null;

    if (!file) {
      payDroppedFile = null;
      renderEmptyState();
      return;
    }

    assignFile(file);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      dropzone.classList.add('is-dragover');
    });
  });

  dropzone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!dropzone.contains(event.relatedTarget)) {
      dropzone.classList.remove('is-dragover');
    }
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropzone.classList.remove('is-dragover');

    const file = event.dataTransfer?.files?.[0] || null;

    if (!file) {
      alert('Nenhum arquivo foi identificado.');
      return;
    }

    assignFile(file);
  });

  dropzone.resetPayAttachment = renderEmptyState;
  renderEmptyState();
}

function ensurePageSizeControl() {
  const tableFooter = qs('.table-layout > .table-footer');

  if (!tableFooter) {
    console.warn(
      '[accountsPayable] Footer principal da tabela não encontrado.'
    );
    return null;
  }

  let pageSizeSelect = qs('#apRowsPerPage');

  if (pageSizeSelect) {
    pageSizeSelect.value = String(state.pageSize);
    return pageSizeSelect;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'table-footer__page-size';

  const label = document.createElement('label');
  label.htmlFor = 'apRowsPerPage';
  label.textContent = 'Mostrar';

  pageSizeSelect = document.createElement('select');
  pageSizeSelect.id = 'apRowsPerPage';
  pageSizeSelect.name = 'rowsPerPage';
  pageSizeSelect.className = 'table-footer__page-size-select';
  pageSizeSelect.setAttribute(
    'aria-label',
    'Quantidade de linhas por página'
  );

  [10, 20, 30, 50, 100].forEach((quantity) => {
    const option = document.createElement('option');

    option.value = String(quantity);
    option.textContent = `${quantity} linhas`;
    option.selected = quantity === state.pageSize;

    pageSizeSelect.appendChild(option);
  });

  wrapper.append(label, pageSizeSelect);
  tableFooter.appendChild(wrapper);

  return pageSizeSelect;
}

/* ==========================
 * Inicialização
 * ========================== */
document.addEventListener('DOMContentLoaded', () => {
  console.log('[accountsPayable] Init');

  const filterForm = qs('#filterForm');
  const filterSearch = qs('#filterSearch');
  const btnApplyFilters = qs('#btnApplyFilters');
  const btnClearFilters = qs('#btnClearFilters');
  const pageSizeSelect = ensurePageSizeControl();
  const btnPreviousPage = qs('#btnPreviousPage');
  const btnNextPage = qs('#btnNextPage');

  if (filterForm) {
    filterForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      applyFilters();
    });
  }

  if (filterSearch) {
    filterSearch.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        applyFilters();
      }
    });
  }

  if (btnApplyFilters) {
    btnApplyFilters.addEventListener('click', () => {
      applyFilters();
    });
  }

  if (btnClearFilters) {
    btnClearFilters.addEventListener('click', () => {
      clearFilters();
    });
  }

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', () => {
      state.pageSize = Number(pageSizeSelect.value) || 50;
      state.page = 1;
      loadList();
    });
  }

  if (btnPreviousPage) {
    btnPreviousPage.addEventListener('click', () => {
      if (state.page <= 1) return;

      state.page -= 1;
      loadList();
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener('click', () => {
      const maxPage = Math.max(
        1,
        Math.ceil(state.total / state.pageSize)
      );

      if (state.page >= maxPage) return;

      state.page += 1;
      loadList();
    });
  }

  const btnCashDocumentTypes = qs('#btnCashDocumentTypes');

  if (btnCashDocumentTypes) {
    btnCashDocumentTypes.addEventListener('click', () => {
      openCashDocumentTypesModal({
        onChange: async () => {
          await loadCashDocumentTypes();
        },
      });
    });
  }

  const btnBatch = qs('#btnBatch');

  if (btnBatch) {
    btnBatch.addEventListener('click', () => openBatchModal());
  }

  // Drawer legado / compatibilidade
  const btnNew = qs('#btnNew');

  if (btnNew) btnNew.addEventListener('click', () => openForm());

  const tbody = qs('#apTableBody');
  if (tbody) {
    tbody.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn) return;

      const tr = btn.closest('tr');
      const id = toInt(tr?.dataset.id);
      if (!id) return;

      const action = btn.dataset.action;
      const record = state.items.find((r) => r.id === id);

      if (action === 'edit') {
        editRecord(id);
      } else if (action === 'delete') {
        deleteRecord(id);
      } else if (action === 'pay') {
        if (!record) {
          alert('Registro não encontrado na lista atual.');
          return;
        }
        openPayModal(record);
      }
    });
  }

  const payForm = qs('#payForm');
  const btnFecharPagar = qs('#fecharModalPagar');
  const btnCancelarPagar = qs('#btnCancelarPagamento');

  if (btnFecharPagar) btnFecharPagar.addEventListener('click', closePayModal);
  if (btnCancelarPagar) btnCancelarPagar.addEventListener('click', closePayModal);
  if (payForm) payForm.addEventListener('submit', onSubmitPayment);

  initCaixaCategoriasESubcategorias();
  initPayAttachmentDropzone();
  populateYearFilter();
  loadCashDocumentTypes();
  loadList();
});

/* ==========================
 * Filtros / Lista
 * ========================== */
function applyFilters() {
  const search = qs('#filterSearch')?.value.trim() || '';
  const status = qs('#filterStatus')?.value || '';
  const dueDate = qs('#filterDueDate')?.value || '';
  const month = qs('#filterMonth')?.value || '';
  const year = qs('#filterYear')?.value || '';

  let fromDueDate = '';
  let toDueDate = '';

  if (dueDate) {
    fromDueDate = dueDate;

    const nextDate = new Date(`${dueDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);

    toDueDate = [
      nextDate.getFullYear(),
      String(nextDate.getMonth() + 1).padStart(2, '0'),
      String(nextDate.getDate()).padStart(2, '0'),
    ].join('-');
  }

  state = {
    ...state,
    search,
    status,
    month,
    year,
    fromDueDate,
    toDueDate,
    page: 1,
  };

  loadList();
}

function clearFilters() {
  const filterSearch = qs('#filterSearch');
  const filterStatus = qs('#filterStatus');
  const filterDueDate = qs('#filterDueDate');
  const filterMonth = qs('#filterMonth');
  const filterYear = qs('#filterYear');

  const currentYear = String(new Date().getFullYear());

  if (filterSearch) filterSearch.value = '';
  if (filterStatus) filterStatus.value = '';
  if (filterDueDate) filterDueDate.value = '';
  if (filterMonth) filterMonth.value = '';
  if (filterYear) filterYear.value = currentYear;

  state = {
    ...state,
    search: '',
    status: '',
    month: '',
    year: currentYear,
    fromDueDate: '',
    toDueDate: '',
    page: 1,
  };

  loadList();
}

async function loadList() {
  try {
    const params = new URLSearchParams();
    params.set('page', state.page);
    params.set('pageSize', state.pageSize);

    if (state.search) params.set('search', state.search);
    if (state.status) params.set('status', state.status);
    if (state.month) params.set('month', state.month);
    if (state.year) params.set('year', state.year);
    if (state.fromDueDate) params.set('fromDueDate', state.fromDueDate);
    if (state.toDueDate) params.set('toDueDate', state.toDueDate);

    const url = `${API_BASE}?${params.toString()}`;
    console.log('[accountsPayable] GET', url);

    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[accountsPayable] loadList HTTP error:', res.status, res.statusText, errText);
      throw new Error('Erro ao carregar contas a pagar');
    }

    const data = await res.json().catch(() => null);
    if (!data || data.ok === false) {
      console.error('[accountsPayable] payload inesperado:', data);
      throw new Error(data?.error || 'Falha ao listar contas a pagar');
    }

    const rows =
      data.rows ||
      data.items ||
      data.data ||
      (Array.isArray(data) ? data : []);

    state.total = data.total || rows.length;
    state.items = rows;

    renderTable(rows);
    renderPagination();
  } catch (err) {
    console.error('[accountsPayable] loadList error:', err);
    alert('Erro ao carregar contas a pagar. Veja o console para detalhes.');
  }
}

/* ==========================
 * Tabela + Totais
 * ========================== */

function renderTable(rows) {
  const tbody = qs('#apTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const money = (n) => 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');

  const elTot = qs('#apTotalTitulos');
  const elPago = qs('#apTotalPago');
  const elSaldo = qs('#apSaldoAberto');

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 11;
    td.textContent = 'Nenhum registro encontrado.';
    td.style.textAlign = 'center';
    td.style.padding = '0.75rem';
    tr.appendChild(td);
    tbody.appendChild(tr);

    if (qs('#apTotalLabel')) qs('#apTotalLabel').textContent = '0 registros';
    if (elTot) elTot.textContent = 'Total dos títulos (filtro) R$ 0,00';
    if (elPago) elPago.textContent = 'Total pago R$ 0,00';
    if (elSaldo) elSaldo.textContent = 'Saldo em aberto R$ 0,00';
    return;
  }

  let totalTitulos = 0;
  let totalPago = 0;
  let saldoAberto = 0;

  rows.forEach((row) => {
    const total = Number(row.total_value || 0);
    const pago = Number(row.amount_paid || 0);
    const saldo = row.balance != null ? Number(row.balance) : total - pago;

    totalTitulos += total;
    totalPago += pago;
    saldoAberto += saldo;

    const tr = document.createElement('tr');
    tr.dataset.id = row.id;

    const statusStr = String(row.status || 'PENDING').toUpperCase();
    const canPay = statusStr !== 'PAID' && statusStr !== 'CANCELLED';

    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${row.supplier_id ?? ''}</td>
      <td>${row.supplier_name ?? ''}</td>
      <td>${row.invoice_number ?? ''}</td>
      <td>${row.issue_date ? formatDate(row.issue_date) : ''}</td>
      <td>${row.due_date ? formatDate(row.due_date) : ''}</td>
      <td>${renderStatusTag(row.status)}</td>
      <td>${money(row.total_value)}</td>
      <td>${money(row.amount_paid)}</td>
      <td>${money(row.balance)}</td>
      <td class="ap-col-actions">
        <div class="ap-actions">
          ${canPay ? `<button type="button" class="ap-btn-pay" data-action="pay">💰</button>` : ''}
          <button type="button" class="btn btn-sm btn-secondary" data-action="edit">✏️</button>
          <button type="button" class="btn btn-sm btn-danger" data-action="delete">🗑️</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  if (qs('#apTotalLabel')) {
    qs('#apTotalLabel').textContent =
      `${state.total} registro${state.total === 1 ? '' : 's'}`;
  }

  if (elTot) elTot.textContent = `Total dos títulos (filtro) ${money(totalTitulos)}`;
  if (elPago) elPago.textContent = `Total pago ${money(totalPago)}`;
  if (elSaldo) elSaldo.textContent = `Saldo em aberto ${money(saldoAberto)}`;
}

function renderStatusTag(status) {
  const s = String(status || 'PENDING').toUpperCase();
  let label = 'Pendente';
  let cls = 'ap-tag--pending';

  if (s === 'PAID') {
    label = 'Pago';
    cls = 'ap-tag--paid';
  } else if (s === 'OVERDUE') {
    label = 'Vencido';
    cls = 'ap-tag--overdue';
  } else if (s === 'CANCELLED') {
    label = 'Cancelado';
    cls = 'ap-tag--cancelled';
  }

  return `<span class="ap-tag ${cls}">${label}</span>`;
}

function renderPagination() {
  const maxPage = Math.max(
    1,
    Math.ceil(state.total / state.pageSize)
  );

  /* Protect against a page becoming invalid after filtering/deleting */
  state.page = Math.min(Math.max(1, state.page), maxPage);

  const pageInfo = qs('#apPageInfo');
  const tableInfo = qs('#apTableInfo');
  const previousButton = qs('#btnPreviousPage');
  const nextButton = qs('#btnNextPage');

  if (pageInfo) {
    pageInfo.textContent = `Página ${state.page} de ${maxPage}`;
  }

  if (tableInfo) {
    tableInfo.textContent =
      `${state.total} registro${state.total === 1 ? '' : 's'} ` +
      `encontrado${state.total === 1 ? '' : 's'}`;
  }

  if (previousButton) {
    previousButton.disabled = state.page <= 1;
  }

  if (nextButton) {
    nextButton.disabled = state.page >= maxPage;
  }
}

/* ==========================
 * Formulário / Drawer
 * ========================== */

function openForm(record = null) {
  const isEdit = !!record?.id;

  openNewAccountsPayableModal({
    mode: isEdit ? 'edit' : 'create',
    data: record || {},
    onSubmit: async ({ mode, id, payload, selectedFile, close }) => {
      const isEditing = mode === 'edit' && id;
      const url = isEditing ? `${API_BASE}/${id}` : API_BASE;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[accountsPayable] save error:', res.status, errText);
        throw new Error('Erro ao salvar conta a pagar.');
      }

      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        throw new Error(data.error || 'Falha ao salvar conta a pagar.');
      }

      const savedRecord =
        data.data ||
        data.item ||
        data.row ||
        data.account ||
        data;

      const savedId = toInt(savedRecord?.id) || toInt(id);

      if (!savedId) {
        throw new Error('Conta salva, mas o ID retornado é inválido.');
      }

      if (selectedFile) {
        await uploadAnexoAccountsPayable(savedId, selectedFile);
      }

      close('submit');
      loadList();
    },
  });
}

function closeForm() {
  const overlay = qs('#apFormOverlay');
  if (!overlay) return;

  overlay.classList.remove('is-open');
}

async function editRecord(id) {
  try {
    const url = `${API_BASE}/${id}`;
    console.log('[accountsPayable] GET', url);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Erro ao buscar registro');
    }

    const data = await res.json();
    if (!data.ok || !data.data) {
      throw new Error(data.error || 'Não encontrado');
    }

    openForm(data.data);
  } catch (err) {
    console.error('[accountsPayable] editRecord error:', err);
    alert('Erro ao carregar registro para edição.');
  }
}

async function deleteRecord(id) {
  if (!confirm(`Deseja realmente excluir a conta a pagar #${id}?`)) {
    return;
  }

  try {
    const url = `${API_BASE}/${id}`;
    console.log('[accountsPayable] DELETE', url);

    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error('Erro na exclusão');
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Falha ao excluir');
    }

    loadList();
  } catch (err) {
    console.error('[accountsPayable] deleteRecord error:', err);
    alert('Erro ao excluir registro. Veja o console.');
  }
}

async function onSubmitForm(ev) {
  ev.preventDefault();
  const form = ev.target;

  const payload = {
    supplier_id: toInt(form.supplier_id.value),
    invoice_number: form.invoice_number.value || null,
    issue_date: form.issue_date.value,
    due_date: form.due_date.value,
    payment_date: form.payment_date.value || null,
    bank_account_id: toInt(form.elements.namedItem('bank_account_id')?.value),
    description: form.description.value || null,
    category_id: toInt(form.category_id.value),
    subcategory_id: toInt(form.subcategory_id.value),
    document_number: form.document_number.value || null,
    total_value: toFloat(form.total_value.value),
    amount_paid: toFloat(form.amount_paid.value),
    status: form.status.value || 'PENDING',
    notes: form.notes.value || null,
    attachment_url: null,
  };

  if (!payload.supplier_id) {
    alert('Informe o ID do fornecedor.');
    return;
  }
  if (!payload.issue_date || !payload.due_date) {
    alert('Informe as datas de emissão e vencimento.');
    return;
  }
  if (payload.total_value == null || Number.isNaN(payload.total_value)) {
    alert('Informe o valor total.');
    return;
  }

  const id = toInt(qs('#apId')?.value);
  const isEdit = !!id;

  try {
    const url = isEdit ? `${API_BASE}/${id}` : API_BASE;
    const method = isEdit ? 'PUT' : 'POST';

    console.log('[accountsPayable] SUBMIT', method, url, payload);

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error('Erro na gravação');
    }

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Falha ao salvar');
    }

    closeForm();
    loadList();
  } catch (err) {
    console.error('[accountsPayable] onSubmitForm error:', err);
    alert('Erro ao salvar conta a pagar. Veja o console para detalhes.');
  }
}

/* ==========================
 * Pagamento / Integração Caixa
 * ========================== */

async function openPayModal(record) {
  const payModal = qs('#payModal');
  if (!payModal) return;

  // Abre explicitamente porque o CSS global de `.modal` pode manter
  // `display: none` mesmo depois da remoção do atributo `hidden`.
  payModal.hidden = false;
  payModal.classList.add('is-open');
  payModal.style.display = 'flex';
  await loadCashDocumentTypes(
    record.document_type_id ??
    record.cash_document_type_id ??
    null
  );

  qs('#pay_account_id').value = record.id;

  qs('#pay_fornecedor').value =
    record.supplier_name || `Fornecedor #${record.supplier_id || ''}`;

  qs('#pay_documento').value =
    record.nfe_number ||
    record.numero_nfe ||
    record.invoice_number ||
    record.document_number ||
    '';

  qs('#pay_vencimento').value = record.due_date ? toInputDate(record.due_date) : '';

  qs('#pay_vencimento').value = record.due_date ? toInputDate(record.due_date) : '';

  // ✅ Preenche automaticamente Data/Hora Pagamento com agora
  const campoDataHora = qs('#pay_data_hora');

  if (campoDataHora) {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
    campoDataHora.value = agora.toISOString().slice(0, 16);
  }

  const valorBase = record.balance != null
    ? record.balance
    : record.total_value ?? 0;

  qs('#pay_valor_original').value = Number(valorBase || 0).toFixed(2);

  const fileInput = qs('#pay_anexoFile');
  const progressEl = qs('#pay_anexoProgress');
  const obsEl = qs('#pay_observacao');

  if (fileInput) fileInput.value = '';
  payDroppedFile = null;
  qs('#pay_dropzone')?.resetPayAttachment?.();
  if (progressEl) {
    progressEl.value = 0;
    progressEl.style.display = 'none';
  }
  if (obsEl) obsEl.value = '';

  try {
    const res = await fetch(`/api/accounts-payable/${record.id}/anexos`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[accountsPayable] erro ao buscar anexos:', res.status, txt);
      renderAttachments([]);
    } else {
      const anexos = await res.json().catch(() => []);
      renderAttachments(Array.isArray(anexos) ? anexos : []);
    }
  } catch (err) {
    console.error('[accountsPayable] Erro ao carregar anexos:', err);
    renderAttachments([]);
  }

}

function closePayModal() {
  const payModal = qs('#payModal');
  if (!payModal) return;
  payModal.classList.remove('is-open');
  payModal.style.display = 'none';
  payModal.hidden = true;
}

async function onSubmitPayment(ev) {
  ev.preventDefault();

  const idConta = toInt(qs('#pay_account_id')?.value);
  if (!idConta) {
    alert('Conta não identificada.');
    return;
  }

  const record = state.items.find((r) => r.id === idConta);
  if (!record) {
    alert('Conta não encontrada na lista atual.');
    return;
  }

  const valorOriginal = toFloat(qs('#pay_valor_original')?.value) ?? 0;
  const dataHoraRaw = qs('#pay_data_hora')?.value;
  const dataPagamento = dataHoraRaw || new Date().toISOString();

  const multa = toFloat(qs('#pay_multa')?.value) ?? 0;
  const juros = toFloat(qs('#pay_juros')?.value) ?? 0;
  const encargos = toFloat(qs('#pay_encargos')?.value) ?? 0;

  const contaSelect = qs('#pay_conta_caixa');
  let conta_caixa = null;
  if (contaSelect && contaSelect.value) {
    conta_caixa = contaSelect.options[contaSelect.selectedIndex].text.trim();
  }
  if (!conta_caixa) {
    alert('Informe a Conta de Caixa (obrigatória).');
    return;
  }

  const categoria = qs('#pay_categoria')?.value || null;
  const subcategoria = qs('#pay_subcategoria')?.value || null;
  const observacao = qs('#pay_observacao')?.value || '';

  const fileInput = qs('#pay_anexoFile');
  const file = fileInput?.files?.[0] || payDroppedFile || null;
  const progressEl = qs('#pay_anexoProgress');

  const payloadCaixa = {
    data_hora: dataPagamento,
    tipo_movimentacao: 'SAÍDA',
    conta_caixa,
    valor: valorOriginal,
    tipo_documento: record.document_type || 'DUPLICATA',
    numero_documento:
      qs('#pay_documento')?.value?.trim() ||
      record.nfe_number ||
      record.numero_nfe ||
      record.invoice_number ||
      String(record.id),
    fornecedor: record.supplier_name || '',
    observacao,
    multa,
    juros,
    encargos,
    categoria,
    subcategoria,
    is_active: true,
  };

  try {
    console.log('[accountsPayable] Pagar → Caixa', API_CAIXA, payloadCaixa);

    const res = await fetch(API_CAIXA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadCaixa),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[accountsPayable] erro ao criar movimentação caixa:', errText);
      alert('Falha ao registrar o pagamento no Caixa.');
      return;
    }

    const paymentDate = String(dataPagamento).slice(0, 10);
    const payloadPay = {
      payment_date: paymentDate,
      paid_increment: valorOriginal,
      multa,
      juros,
      encargos,
      observacao,
    };

    const payRes = await fetch(API_PAY(idConta), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadPay),
    });

    if (!payRes.ok) {
      const txt = await payRes.text().catch(() => '');
      console.error('[accountsPayable] pay endpoint HTTP error', payRes.status, txt);
      alert(
        'Pagamento registrado no Caixa, mas falhou ao atualizar o Status da Conta a Pagar.\n' +
        'Abra a conta e marque como Pago manualmente, ou tente novamente.'
      );
      closePayModal();
      loadList();
      return;
    }

    const payData = await payRes.json().catch(() => ({}));
    if (!payData.ok) {
      console.error('[accountsPayable] pay endpoint retorno inválido', payData);
      alert(
        'Pagamento registrado no Caixa, mas falhou ao atualizar o Status da Conta a Pagar.\n' +
        'Verifique o console.'
      );
      closePayModal();
      loadList();
      return;
    }

    if (file) {
      await uploadAnexoAccountsPayable(idConta, file, progressEl);
      if (fileInput) fileInput.value = '';
      payDroppedFile = null;
    }

    closePayModal();
    loadList();

  } catch (err) {
    console.error('[accountsPayable] onSubmitPayment error:', err);
    alert('Erro inesperado ao registrar o pagamento no Caixa.');
  }
}

/**
 * Upload de anexo vinculado à conta a pagar.
 * Usa o fluxo assinado: sign + PUT + confirm.
 */
async function uploadAnexoAccountsPayable(accountPayableId, file, progressEl = null) {
  if (!accountPayableId || !file) return null;

  const mimeType = file.type || 'application/octet-stream';

  try {
    if (progressEl) {
      progressEl.style.display = 'block';
      progressEl.value = 10;
    }

    const signRes = await fetch(API_UPLOAD_SIGN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountPayableId,
        filename: file.name,
        mimeType,
      }),
    });

    const signData = await signRes.json().catch(() => ({}));

    if (!signRes.ok || !signData.ok || !signData.url || !signData.object) {
      console.error('[accountsPayable] sign upload error:', signData);
      throw new Error(signData.error || 'Erro ao assinar upload do anexo.');
    }

    if (progressEl) progressEl.value = 35;

    const putRes = await fetch(signData.url, {
      method: signData.method || 'PUT',
      headers: {
        'Content-Type': mimeType,
        ...(signData.headers || {}),
      },
      body: file,
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => '');
      console.error('[accountsPayable] put upload error:', putRes.status, errText);
      throw new Error('Erro ao enviar arquivo para o bucket.');
    }

    if (progressEl) progressEl.value = 75;

    const confirmRes = await fetch(API_UPLOAD_CONFIRM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountPayableId,
        filename: file.name,
        mimeType,
        object: signData.object,
        bucket: signData.bucket,
      }),
    });

    const confirmData = await confirmRes.json().catch(() => ({}));

    if (!confirmRes.ok || !confirmData.ok) {
      console.error('[accountsPayable] confirm upload error:', confirmData);
      throw new Error(confirmData.error || 'Erro ao confirmar anexo.');
    }

    if (progressEl) progressEl.value = 100;

    return confirmData;
  } finally {
    if (progressEl) {
      setTimeout(() => {
        progressEl.style.display = 'none';
        progressEl.value = 0;
      }, 700);
    }
  }
}

/* ==========================
 * Categorias / Subcategorias do Caixa
 * ========================== */

async function initCaixaCategoriasESubcategorias() {
  await loadCaixaCategorias();

  const selCat = qs('#pay_categoria');
  if (selCat) {
    selCat.addEventListener('change', () => {
      const catId = selCat.value || null;
      loadCaixaSubcategorias(catId);
    });
  }
}

async function loadCaixaCategorias() {
  const selCat = qs('#pay_categoria');
  if (!selCat) return;

  try {
    const res = await fetch(API_CAIXA_CATEGORIAS);
    if (!res.ok) throw new Error('Erro ao listar categorias do Caixa');

    const data = await res.json();
    let rows = [];
    if (Array.isArray(data)) rows = data;
    else if (Array.isArray(data.rows)) rows = data.rows;
    else if (Array.isArray(data.items)) rows = data.items;
    else if (Array.isArray(data.data)) rows = data.data;

    caixaCategorias = rows;

    const firstOption = selCat.querySelector('option')?.cloneNode(true);
    selCat.innerHTML = '';
    if (firstOption) {
      selCat.appendChild(firstOption);
    } else {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '(opcional)';
      selCat.appendChild(opt);
    }

    rows
      .filter((c) => c.is_active !== false)
      .forEach((cat) => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.nome;
        selCat.appendChild(opt);
      });

  } catch (err) {
    console.error('[accountsPayable] loadCaixaCategorias error:', err);
  }
}

async function loadCaixaSubcategorias(categoriaId, selectedSubId = null) {
  const selSub = qs('#pay_subcategoria');
  if (!selSub) return;

  const firstOption = selSub.querySelector('option')?.cloneNode(true) || (() => {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '(opcional)';
    return o;
  })();

  selSub.innerHTML = '';
  selSub.appendChild(firstOption);

  if (!categoriaId) {
    return;
  }

  if (caixaSubcatsPorCat[categoriaId]) {
    fillSubcategoriasSelect(selSub, caixaSubcatsPorCat[categoriaId], selectedSubId);
    return;
  }

  try {
    const params = new URLSearchParams();
    params.set('categoria_id', categoriaId);
    const url = `${API_CAIXA_SUBCATEGORIAS}?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Erro ao listar subcategorias do Caixa');

    const data = await res.json();
    let rows = [];
    if (Array.isArray(data)) rows = data;
    else if (Array.isArray(data.rows)) rows = data.rows;
    else if (Array.isArray(data.items)) rows = data.items;
    else if (Array.isArray(data.data)) rows = data.data;

    caixaSubcatsPorCat[categoriaId] = rows;
    fillSubcategoriasSelect(selSub, rows, selectedSubId);

  } catch (err) {
    console.error('[accountsPayable] loadCaixaSubcategorias error:', err);
  }
}

function fillSubcategoriasSelect(selectEl, rows, selectedSubId) {
  rows
    .filter((s) => s.is_active !== false)
    .forEach((sub) => {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.nome;
      selectEl.appendChild(opt);
    });

  if (selectedSubId != null) {
    selectEl.value = selectedSubId;
  }
}

/* ==========================
 * Helpers
 * ========================== */

function toInt(v) {
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function toFloat(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function formatDate(d) {
  const str = String(d);
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return date.toLocaleDateString('pt-BR');
}

function toInputDate(d) {
  const str = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
}

function renderAttachments(attachments) {
  const box = document.getElementById('pay_attachmentsBox');
  if (!box) return;

  box.innerHTML = '';

  if (!Array.isArray(attachments) || !attachments.length) {
    return;
  }

  attachments.forEach((attachment) => {
    const url =
      attachment.file_url ||
      attachment.url ||
      '';

    const name =
      attachment.file_name ||
      attachment.original_name ||
      attachment.filename ||
      attachment.nome ||
      attachment.name ||
      'Arquivo';

    const type = String(
      attachment.file_type ||
      attachment.document_type ||
      attachment.tipo ||
      'OUTRO'
    ).toUpperCase();

    const icon =
      type === 'XML' ? '📄' :
        type === 'DANFE' ? '📕' :
          type === 'PDF' ? '📕' :
            type === 'IMAGE' ? '🖼️' :
              '🧾';

    const card = document.createElement('article');
    card.className = 'modal-attachment-card';
    card.setAttribute('role', 'listitem');
    card.style.cssText = 'box-sizing:border-box;position:relative;display:flex;flex-direction:column;align-items:flex-start;min-width:0;height:100px;padding:10px;margin:0;overflow:hidden;background:#fff;border:1px solid #d1d5db;border-radius:8px;';

    const iconBox = document.createElement('div');
    iconBox.className = 'modal-attachment-card__icon';
    iconBox.textContent = icon;
    iconBox.style.cssText = 'display:block!important;flex:0 0 auto!important;width:auto!important;min-width:0!important;height:15px!important;min-height:15px!important;padding:0!important;margin:0 0 3px 0!important;background:transparent!important;border:0!important;font-size:15px!important;line-height:15px!important;';

    const content = document.createElement('div');
    content.className = 'modal-attachment-card__content';
    content.style.cssText = 'display:block!important;flex:0 0 auto!important;width:100%!important;min-width:0!important;height:27px!important;min-height:27px!important;margin:0!important;padding:0!important;overflow:hidden!important;';

    const typeElement = document.createElement('strong');
    typeElement.className = 'modal-attachment-card__type';
    typeElement.textContent = type;
    typeElement.style.cssText = 'display:block!important;height:13px!important;margin:0!important;padding:0!important;overflow:hidden!important;font-size:11px!important;line-height:13px!important;';

    const nameElement = document.createElement('span');
    nameElement.className = 'modal-attachment-card__name';
    nameElement.textContent = name;
    nameElement.title = name;
    nameElement.style.cssText = 'display:block!important;width:100%!important;height:12px!important;margin:1px 0 0 0!important;padding:0!important;overflow:hidden!important;font-size:10px!important;line-height:12px!important;text-overflow:ellipsis!important;white-space:nowrap!important;';

    content.appendChild(typeElement);
    content.appendChild(nameElement);

    card.appendChild(iconBox);
    card.appendChild(content);

    if (url) {
      const openLink = document.createElement('a');

      openLink.className = 'modal-attachment-card__open';
      openLink.href = url;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      openLink.textContent = 'Abrir';
      openLink.title = `Abrir ${name}`;
      openLink.style.cssText = 'position:static!important;display:inline-flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:100%!important;height:21px!important;min-height:21px!important;padding:2px 7px!important;margin:auto 0 0 0!important;color:#1d4ed8!important;font-size:10px!important;line-height:15px!important;text-decoration:none!important;background:#eff6ff!important;border:1px solid #bfdbfe!important;border-radius:5px!important;';

      card.appendChild(openLink);
    }

    box.appendChild(card);
  });
}

function openBatchModal() {
  openBatchAccountsPayableModal({
    onSubmit: async ({ payloads, close }) => {
      if (!payloads.length) {
        alert('Nenhuma parcela gerada.');
        return;
      }

      const ok = confirm(`Deseja gerar ${payloads.length} contas a pagar?`);
      if (!ok) return;

      for (const payload of payloads) {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          console.error('[accountsPayable] batch create error:', txt);
          throw new Error('Erro ao gerar uma das contas do lote.');
        }

        const data = await res.json().catch(() => ({}));

        if (data.ok === false) {
          throw new Error(data.error || 'Falha ao gerar conta do lote.');
        }
      }

      close('submit');
      loadList();
      alert('Lote gerado com sucesso.');
    },
  });
}
