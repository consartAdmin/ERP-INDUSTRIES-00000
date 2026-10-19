// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ sellers.js — Frontend Gestão de Vendedores (PRODNEX ERP)               ║
// ║                                                                          ║
// ║ • Lista vendedores                                                       ║
// ║ • Busca por texto                                                        ║
// ║ • Filtro por status                                                      ║
// ║ • Paginação frontend                                                     ║
// ║ • Controle de quantidade por página                                      ║
// ║ • Cria vendedor                                                          ║
// ║ • Edita vendedor                                                         ║
// ║ • Desativa vendedor                                                      ║
// ║ • Integração com /api/sellers                                            ║
// ║ • Compatível com window.apiBase / localhost:8080                         ║
// ║                                                                          ║
// ║ PRODNEX ERP · Frontend · JavaScript                                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

'use strict';

// ---------------------------------------------------------------------------
// 1. CONFIGURAÇÃO DA API
// ---------------------------------------------------------------------------

const API_BASE = String(
  window.apiBase ||
  window.API_BASE ||
  'http://localhost:8080'
).replace(/\/+$/, '');

const SELLERS_API = `${API_BASE}/api/sellers`;

// ---------------------------------------------------------------------------
// 2. ESTADO
// ---------------------------------------------------------------------------

const state = {
  sellers: [],
  filteredSellers: [],

  filters: {
    q: '',
    active: 'all', // all | active | inactive
  },

  page: 1,
  pageSize: 50,
  totalRecords: 0,
  totalPages: 1,

  editingId: null,
  loading: false,
};

// ---------------------------------------------------------------------------
// 3. CACHE DOM
// ---------------------------------------------------------------------------

const dom = {};

// ---------------------------------------------------------------------------
// 4. INICIALIZAÇÃO
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  attachEvents();

  state.pageSize = Number(dom.pageSize?.value || 50);

  await loadSellers();
}

// ---------------------------------------------------------------------------
// 5. CACHE DE ELEMENTOS
// ---------------------------------------------------------------------------

function cacheDom() {
  // Filtros
  dom.searchInput = document.getElementById('sellers-search');
  dom.activeSelect = document.getElementById('sellers-active');
  dom.btnNew = document.getElementById('sellers-btn-new');
  dom.btnPdf = document.getElementById('sellers-btn-pdf');
  dom.btnExcel = document.getElementById('sellers-btn-excel');

  // Tabela
  dom.tableBody = document.getElementById('tableBody');
  dom.emptyState = document.getElementById('sellers-empty-state');

  // Footer / paginação
  dom.tableInfo = document.getElementById('apTableInfo');
  dom.btnPrevious = document.getElementById('btnPrevious');
  dom.btnNext = document.getElementById('btnNext');
  dom.pageInfo = document.getElementById('pageInfo');
  dom.pageSize = document.getElementById('pageSize');

  // Modal
  dom.modal = document.getElementById('sellers-modal');
  dom.modalTitle = document.getElementById('sellers-modal-title');
  dom.modalClose = document.getElementById('sellers-modal-close');
  dom.modalCancel = document.getElementById('sellers-modal-cancel');
  dom.modalSave = document.getElementById('sellers-modal-save');
  dom.form = document.getElementById('sellers-form');

  // Campos
  dom.fId = document.getElementById('seller-id');
  dom.fName = document.getElementById('seller-name');
  dom.fNickname = document.getElementById('seller-nickname');
  dom.fDocument = document.getElementById('seller-document');
  dom.fEmail = document.getElementById('seller-email');
  dom.fPhone = document.getElementById('seller-phone');
  dom.fMobile = document.getElementById('seller-mobile');
  dom.fCommissionType = document.getElementById('seller-commission-type');
  dom.fCommissionValue = document.getElementById('seller-commission-value');
  dom.fActive = document.getElementById('seller-active');
  dom.fObservations = document.getElementById('seller-observations');
}

// ---------------------------------------------------------------------------
// 6. EVENTOS
// ---------------------------------------------------------------------------

function attachEvents() {
  // -------------------------------------------------------------------------
  // Busca
  // -------------------------------------------------------------------------

  if (dom.searchInput) {
    let searchTimeout = null;

    dom.searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);

      searchTimeout = setTimeout(() => {
        state.filters.q = dom.searchInput.value.trim();
        state.page = 1;

        applyFiltersAndRender();
      }, 300);
    });
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  dom.activeSelect?.addEventListener('change', () => {
    state.filters.active = dom.activeSelect.value;
    state.page = 1;

    applyFiltersAndRender();
  });

  // -------------------------------------------------------------------------
  // Novo vendedor
  // -------------------------------------------------------------------------

  dom.btnPdf?.addEventListener('click', () => openExport('pdf'));
  dom.btnExcel?.addEventListener('click', () => openExport('excel'));

  dom.btnNew?.addEventListener('click', () => {
    openModalForCreate();
  });

  // -------------------------------------------------------------------------
  // Paginação
  // -------------------------------------------------------------------------

  dom.btnPrevious?.addEventListener('click', () => {
    if (state.page <= 1) return;

    state.page -= 1;

    renderTable();
    renderPagination();
  });

  dom.btnNext?.addEventListener('click', () => {
    if (state.page >= state.totalPages) return;

    state.page += 1;

    renderTable();
    renderPagination();
  });

  // -------------------------------------------------------------------------
  // Quantidade por página
  // -------------------------------------------------------------------------

  dom.pageSize?.addEventListener('change', () => {
    const newSize = Number(dom.pageSize.value);

    state.pageSize =
      Number.isFinite(newSize) && newSize > 0
        ? newSize
        : 20;

    state.page = 1;

    calculatePagination();
    renderTable();
    renderPagination();
  });

  // -------------------------------------------------------------------------
  // Modal
  // -------------------------------------------------------------------------

  dom.modalClose?.addEventListener('click', closeModal);
  dom.modalCancel?.addEventListener('click', closeModal);
  dom.modalSave?.addEventListener('click', handleSave);

  // -------------------------------------------------------------------------
  // Submit do formulário
  // -------------------------------------------------------------------------

  dom.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSave();
  });

  // -------------------------------------------------------------------------
  // ESC
  // -------------------------------------------------------------------------

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!isModalOpen()) return;

    closeModal();
  });

  // -------------------------------------------------------------------------
  // Clique no backdrop
  // -------------------------------------------------------------------------

  dom.modal?.addEventListener('click', (event) => {
    if (event.target === dom.modal) {
      closeModal();
    }
  });

  // -------------------------------------------------------------------------
  // Atualização do texto do switch
  // -------------------------------------------------------------------------

  dom.fActive?.addEventListener('change', updateActiveSwitchLabel);

  // -------------------------------------------------------------------------
  // Tipo de comissão
  // -------------------------------------------------------------------------

  dom.fCommissionType?.addEventListener(
    'change',
    updateCommissionField
  );
}

// ---------------------------------------------------------------------------
// 7. CARREGAR VENDEDORES
// ---------------------------------------------------------------------------

async function loadSellers() {
  if (state.loading) return;

  state.loading = true;

  setTableLoading(true);

  try {
    const response = await fetch(SELLERS_API, {
      method: 'GET',

      headers: {
        Accept: 'application/json',
      },

      cache: 'no-store',
    });

    const json = await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        json?.error ||
        json?.message ||
        `Erro HTTP ${response.status}`
      );
    }

    if (json?.ok === false) {
      throw new Error(
        json.error ||
        json.message ||
        'Erro ao listar vendedores.'
      );
    }

    state.sellers = normalizeSellersResponse(json);

    applyFiltersAndRender();
  } catch (error) {
    console.error(
      '[sellers] Erro ao carregar vendedores:',
      error
    );

    state.sellers = [];
    state.filteredSellers = [];
    state.totalRecords = 0;
    state.totalPages = 1;
    state.page = 1;

    renderTable();
    renderPagination();
  } finally {
    state.loading = false;

    setTableLoading(false);
  }
}

// ---------------------------------------------------------------------------
// 8. NORMALIZAR RESPOSTA DA API
// ---------------------------------------------------------------------------

function normalizeSellersResponse(json) {
  if (Array.isArray(json)) {
    return json;
  }

  if (Array.isArray(json?.data)) {
    return json.data;
  }

  if (Array.isArray(json?.items)) {
    return json.items;
  }

  if (Array.isArray(json?.rows)) {
    return json.rows;
  }

  if (Array.isArray(json?.sellers)) {
    return json.sellers;
  }

  if (Array.isArray(json?.data?.items)) {
    return json.data.items;
  }

  if (Array.isArray(json?.data?.rows)) {
    return json.data.rows;
  }

  if (Array.isArray(json?.data?.sellers)) {
    return json.data.sellers;
  }

  return [];
}

// ---------------------------------------------------------------------------
// 9. FILTRAR
// ---------------------------------------------------------------------------

// Exportar PDF / Excel com os mesmos filtros da tela (busca + status)
function openExport(kind) {
  const params = new URLSearchParams();
  const q = String(state.filters.q || '').trim();

  if (q) params.set('q', q);
  if (state.filters.active && state.filters.active !== 'all') {
    params.set('active', state.filters.active);
  }

  window.open(`${SELLERS_API}/export/${kind}?${params.toString()}`, '_blank');
}

function applyFiltersAndRender() {
  const query = normalizeSearchText(state.filters.q);

  state.filteredSellers = state.sellers.filter((seller) => {
    // -----------------------------------------------------------------------
    // Status
    // -----------------------------------------------------------------------

    const active = seller.active !== false;

    if (
      state.filters.active === 'active' &&
      !active
    ) {
      return false;
    }

    if (
      state.filters.active === 'inactive' &&
      active
    ) {
      return false;
    }

    // -----------------------------------------------------------------------
    // Busca
    // -----------------------------------------------------------------------

    if (!query) {
      return true;
    }

    const searchableText = [
      seller.id,
      seller.name,
      seller.nickname,
      seller.document,
      seller.email,
      seller.phone,
      seller.mobile,
    ]
      .map(normalizeSearchText)
      .join(' ');

    return searchableText.includes(query);
  });

  calculatePagination();

  renderTable();
  renderPagination();
}

// ---------------------------------------------------------------------------
// 10. CALCULAR PAGINAÇÃO
// ---------------------------------------------------------------------------

function calculatePagination() {
  state.totalRecords = state.filteredSellers.length;

  state.totalPages = Math.max(
    1,
    Math.ceil(
      state.totalRecords /
      state.pageSize
    )
  );

  if (state.page > state.totalPages) {
    state.page = state.totalPages;
  }

  if (state.page < 1) {
    state.page = 1;
  }
}

// ---------------------------------------------------------------------------
// 11. ITENS DA PÁGINA ATUAL
// ---------------------------------------------------------------------------

function getCurrentPageItems() {
  const start =
    (state.page - 1) *
    state.pageSize;

  const end =
    start +
    state.pageSize;

  return state.filteredSellers.slice(
    start,
    end
  );
}

// ---------------------------------------------------------------------------
// 12. RENDERIZAR TABELA
// ---------------------------------------------------------------------------

function renderTable() {
  if (!dom.tableBody) return;

  dom.tableBody.innerHTML = '';

  const pageItems = getCurrentPageItems();

  // -------------------------------------------------------------------------
  // Estado vazio
  // -------------------------------------------------------------------------

  if (!pageItems.length) {
    if (dom.emptyState) {
      dom.emptyState.style.display = 'block';
    }

    updateTableInfo();

    return;
  }

  if (dom.emptyState) {
    dom.emptyState.style.display = 'none';
  }

  // -------------------------------------------------------------------------
  // Linhas
  // -------------------------------------------------------------------------

  const fragment = document.createDocumentFragment();

  pageItems.forEach((seller) => {
    const tr = document.createElement('tr');

    const sellerId = getSellerId(seller);

    const isActive =
      seller.active !== false;

    tr.dataset.id =
      sellerId != null
        ? String(sellerId)
        : '';

    tr.innerHTML = `
      <td title="${escapeHtml(seller.name || '')}">
        ${escapeHtml(seller.name || '')}
      </td>

      <td title="${escapeHtml(seller.nickname || '')}">
        ${escapeHtml(seller.nickname || '')}
      </td>

      <td title="${escapeHtml(seller.document || '')}">
        ${escapeHtml(seller.document || '')}
      </td>

      <td title="${escapeHtml(seller.email || '')}">
        ${escapeHtml(seller.email || '')}
      </td>

      <td>
        ${escapeHtml(seller.phone || '')}
      </td>

      <td>
        ${escapeHtml(seller.mobile || '')}
      </td>

      <td>
        ${escapeHtml(
      formatCommissionType(
        seller.commission_type
      )
    )}
      </td>

      <td>
        ${escapeHtml(
      formatCommissionValue(
        seller.commission_value,
        seller.commission_type
      )
    )}
      </td>

      <td>
        ${renderStatusPill(
      seller.active
    )}
      </td>

      <td class="sellers-table__actions-col">
        <div class="sellers-actions">

          <button
            type="button"
            class="btn btn-toolbar btn-sm sellers-actions__btn sellers-actions__btn--edit"
            data-action="edit"
            data-id="${escapeHtml(sellerId ?? '')}"
            title="Editar vendedor"
          >
            ✏️
          </button>

          ${isActive
        ? `
                <button
                  type="button"
                  class="btn btn-delete btn-sm sellers-actions__btn sellers-actions__btn--delete"
                  data-action="delete"
                  data-id="${escapeHtml(sellerId ?? '')}"
                  title="Desativar vendedor"
                >
                  ❌
                </button>
              `
        : ''
      }

        </div>
      </td>
    `;

    fragment.appendChild(tr);
  });

  dom.tableBody.appendChild(fragment);

  bindRowActions();

  updateTableInfo();
}

// ---------------------------------------------------------------------------
// 13. EVENTOS DAS LINHAS
// ---------------------------------------------------------------------------

function bindRowActions() {
  if (!dom.tableBody) return;

  dom.tableBody
    .querySelectorAll(
      '[data-action="edit"]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const id = button.dataset.id;

          openModalForEdit(id);
        }
      );
    });

  dom.tableBody
    .querySelectorAll(
      '[data-action="delete"]'
    )
    .forEach((button) => {
      button.addEventListener(
        'click',
        () => {
          const id = button.dataset.id;

          handleDelete(id);
        }
      );
    });
}

// ---------------------------------------------------------------------------
// 14. RENDERIZAR PAGINAÇÃO
// ---------------------------------------------------------------------------

function renderPagination() {
  if (dom.pageInfo) {
    dom.pageInfo.textContent =
      `Página ${state.page} de ${state.totalPages}`;
  }

  if (dom.btnPrevious) {
    dom.btnPrevious.disabled =
      state.page <= 1 ||
      state.totalRecords === 0;
  }

  if (dom.btnNext) {
    dom.btnNext.disabled =
      state.page >= state.totalPages ||
      state.totalRecords === 0;
  }

  updateTableInfo();
}

// ---------------------------------------------------------------------------
// 15. CONTADOR DE REGISTROS
// ---------------------------------------------------------------------------

function updateTableInfo() {
  if (!dom.tableInfo) return;

  const total =
    Number(state.totalRecords || 0);

  dom.tableInfo.textContent =
    `${total} ${total === 1 ? 'Registro' : 'Registros'}`;
}

// ---------------------------------------------------------------------------
// 16. FORMATAÇÃO DE COMISSÃO
// ---------------------------------------------------------------------------

function formatCommissionType(type) {
  const normalized =
    String(type || 'PERCENT')
      .trim()
      .toUpperCase();

  if (normalized === 'FIXED') {
    return 'Valor fixo (R$)';
  }

  return 'Percentual (%)';
}

function formatCommissionValue(
  value,
  type
) {
  const numericValue =
    Number(value || 0);

  const normalizedType =
    String(type || 'PERCENT')
      .trim()
      .toUpperCase();

  if (normalizedType === 'FIXED') {
    return numericValue.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      }
    );
  }

  return `${numericValue.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }
  )} %`;
}

// ---------------------------------------------------------------------------
// 17. STATUS
// ---------------------------------------------------------------------------

function renderStatusPill(active) {
  const isActive =
    active !== false;

  const cssClass = isActive
    ? 'sellers-status-pill sellers-status-pill--active'
    : 'sellers-status-pill sellers-status-pill--inactive';

  const label = isActive
    ? 'Ativo'
    : 'Inativo';

  return `
    <span class="${cssClass}">
      ${label}
    </span>
  `;
}

// ---------------------------------------------------------------------------
// 18. ABRIR MODAL — NOVO
// ---------------------------------------------------------------------------

function openModalForCreate() {
  state.editingId = null;

  resetForm();

  if (dom.modalTitle) {
    dom.modalTitle.textContent =
      'Novo vendedor';
  }

  if (dom.fCommissionType) {
    dom.fCommissionType.value =
      'PERCENT';
  }

  if (dom.fCommissionValue) {
    dom.fCommissionValue.value =
      '0';
  }

  if (dom.fActive) {
    dom.fActive.checked = true;
  }

  updateActiveSwitchLabel();
  updateCommissionField();

  openModal();

  requestAnimationFrame(() => {
    dom.fName?.focus();
  });
}

// ---------------------------------------------------------------------------
// 19. ABRIR MODAL — EDITAR
// ---------------------------------------------------------------------------

function openModalForEdit(id) {
  const seller = findSellerById(id);

  if (!seller) {
    console.warn(
      '[sellers] Vendedor não encontrado para edição:',
      id
    );

    return;
  }

  const sellerId =
    getSellerId(seller);

  state.editingId =
    sellerId;

  if (dom.modalTitle) {
    dom.modalTitle.textContent =
      'Editar vendedor';
  }

  if (dom.fId) {
    dom.fId.value =
      sellerId ?? '';
  }

  if (dom.fName) {
    dom.fName.value =
      seller.name || '';
  }

  if (dom.fNickname) {
    dom.fNickname.value =
      seller.nickname || '';
  }

  if (dom.fDocument) {
    dom.fDocument.value =
      seller.document || '';
  }

  if (dom.fEmail) {
    dom.fEmail.value =
      seller.email || '';
  }

  if (dom.fPhone) {
    dom.fPhone.value =
      seller.phone || '';
  }

  if (dom.fMobile) {
    dom.fMobile.value =
      seller.mobile || '';
  }

  if (dom.fCommissionType) {
    dom.fCommissionType.value =
      String(
        seller.commission_type ||
        'PERCENT'
      ).toUpperCase();
  }

  if (dom.fCommissionValue) {
    dom.fCommissionValue.value =
      seller.commission_value != null
        ? seller.commission_value
        : 0;
  }

  if (dom.fActive) {
    dom.fActive.checked =
      seller.active !== false;
  }

  if (dom.fObservations) {
    dom.fObservations.value =
      seller.observations || '';
  }

  updateActiveSwitchLabel();
  updateCommissionField();

  openModal();

  requestAnimationFrame(() => {
    dom.fName?.focus();
  });
}

// ---------------------------------------------------------------------------
// 20. ABRIR MODAL
// ---------------------------------------------------------------------------

function openModal() {
  if (!dom.modal) {
    console.warn(
      '[sellers] #sellers-modal não encontrado.'
    );

    return;
  }

  dom.modal.classList.remove('hidden');
  dom.modal.classList.add('is-open');

  dom.modal.removeAttribute(
    'aria-hidden'
  );

  document.body.classList.add(
    'modal-open'
  );
}

// ---------------------------------------------------------------------------
// 21. FECHAR MODAL
// ---------------------------------------------------------------------------

function closeModal() {
  if (!dom.modal) return;

  dom.modal.classList.add('hidden');
  dom.modal.classList.remove('is-open');

  dom.modal.setAttribute(
    'aria-hidden',
    'true'
  );

  document.body.classList.remove(
    'modal-open'
  );

  state.editingId = null;
}

// ---------------------------------------------------------------------------
// 22. MODAL ESTÁ ABERTO?
// ---------------------------------------------------------------------------

function isModalOpen() {
  if (!dom.modal) return false;

  return (
    !dom.modal.classList.contains('hidden') ||
    dom.modal.classList.contains('is-open')
  );
}

// ---------------------------------------------------------------------------
// 23. RESETAR FORMULÁRIO
// ---------------------------------------------------------------------------

function resetForm() {
  dom.form?.reset();

  if (dom.fId) {
    dom.fId.value = '';
  }

  if (dom.fName) {
    dom.fName.value = '';
  }

  if (dom.fNickname) {
    dom.fNickname.value = '';
  }

  if (dom.fDocument) {
    dom.fDocument.value = '';
  }

  if (dom.fEmail) {
    dom.fEmail.value = '';
  }

  if (dom.fPhone) {
    dom.fPhone.value = '';
  }

  if (dom.fMobile) {
    dom.fMobile.value = '';
  }

  if (dom.fCommissionType) {
    dom.fCommissionType.value =
      'PERCENT';
  }

  if (dom.fCommissionValue) {
    dom.fCommissionValue.value =
      '0';
  }

  if (dom.fActive) {
    dom.fActive.checked = true;
  }

  if (dom.fObservations) {
    dom.fObservations.value = '';
  }
}

// ---------------------------------------------------------------------------
// 24. SALVAR
// ---------------------------------------------------------------------------

async function handleSave() {
  if (state.loading) return;

  const validation =
    validateForm();

  if (!validation.ok) {
    alert(validation.message);

    validation.element?.focus();

    return;
  }

  const payload =
    buildSellerPayload();

  setSaveLoading(true);

  try {
    const editing =
      state.editingId !== null &&
      state.editingId !== undefined &&
      state.editingId !== '';

    const endpoint = editing
      ? `${SELLERS_API}/${encodeURIComponent(state.editingId)}`
      : SELLERS_API;

    const method = editing
      ? 'PUT'
      : 'POST';

    const response = await fetch(
      endpoint,
      {
        method,

        headers: {
          'Content-Type':
            'application/json',

          Accept:
            'application/json',
        },

        body:
          JSON.stringify(payload),
      }
    );

    const json =
      await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        json?.error ||
        json?.message ||
        `Erro HTTP ${response.status}`
      );
    }

    if (json?.ok === false) {
      throw new Error(
        json.error ||
        json.message ||
        'Erro ao salvar vendedor.'
      );
    }

    closeModal();

    await loadSellers();
  } catch (error) {
    console.error(
      '[sellers] Erro ao salvar vendedor:',
      error
    );

    alert(
      error.message ||
      'Erro inesperado ao salvar vendedor.'
    );
  } finally {
    setSaveLoading(false);
  }
}

// ---------------------------------------------------------------------------
// 25. VALIDAÇÃO
// ---------------------------------------------------------------------------

function validateForm() {
  const name =
    dom.fName?.value.trim() || '';

  if (!name) {
    return {
      ok: false,
      message:
        'O nome do vendedor é obrigatório.',
      element:
        dom.fName,
    };
  }

  const commissionValue =
    Number(
      dom.fCommissionValue?.value || 0
    );

  if (
    !Number.isFinite(
      commissionValue
    )
  ) {
    return {
      ok: false,
      message:
        'Informe um valor de comissão válido.',
      element:
        dom.fCommissionValue,
    };
  }

  if (commissionValue < 0) {
    return {
      ok: false,
      message:
        'A comissão não pode ser negativa.',
      element:
        dom.fCommissionValue,
    };
  }

  const commissionType =
    String(
      dom.fCommissionType?.value ||
      'PERCENT'
    ).toUpperCase();

  if (
    commissionType === 'PERCENT' &&
    commissionValue > 100
  ) {
    return {
      ok: false,
      message:
        'A comissão percentual não pode ser maior que 100%.',
      element:
        dom.fCommissionValue,
    };
  }

  return {
    ok: true,
  };
}

// ---------------------------------------------------------------------------
// 26. PAYLOAD
// ---------------------------------------------------------------------------

function buildSellerPayload() {
  return {
    name:
      dom.fName?.value.trim() || '',

    nickname:
      emptyToNull(
        dom.fNickname?.value
      ),

    document:
      emptyToNull(
        dom.fDocument?.value
      ),

    email:
      emptyToNull(
        dom.fEmail?.value
      ),

    phone:
      emptyToNull(
        dom.fPhone?.value
      ),

    mobile:
      emptyToNull(
        dom.fMobile?.value
      ),

    commission_type:
      String(
        dom.fCommissionType?.value ||
        'PERCENT'
      ).toUpperCase(),

    commission_value:
      Number(
        dom.fCommissionValue?.value ||
        0
      ),

    active:
      Boolean(
        dom.fActive?.checked
      ),

    observations:
      emptyToNull(
        dom.fObservations?.value
      ),
  };
}

// ---------------------------------------------------------------------------
// 27. DESATIVAR
// ---------------------------------------------------------------------------

async function handleDelete(id) {
  const seller =
    findSellerById(id);

  if (!seller) {
    console.warn(
      '[sellers] Vendedor não encontrado:',
      id
    );

    return;
  }

  const sellerId =
    getSellerId(seller);

  const sellerName =
    seller.name ||
    `#${sellerId}`;

  const confirmed = confirm(
    `Deseja desativar o vendedor "${sellerName}"?`
  );

  if (!confirmed) return;

  try {
    const response =
      await fetch(
        `${SELLERS_API}/${encodeURIComponent(sellerId)}`,
        {
          method: 'DELETE',

          headers: {
            Accept:
              'application/json',
          },
        }
      );

    const json =
      await parseJsonResponse(response);

    if (!response.ok) {
      throw new Error(
        json?.error ||
        json?.message ||
        `Erro HTTP ${response.status}`
      );
    }

    if (json?.ok === false) {
      throw new Error(
        json.error ||
        json.message ||
        'Erro ao desativar vendedor.'
      );
    }

    await loadSellers();
  } catch (error) {
    console.error(
      '[sellers] Erro ao desativar vendedor:',
      error
    );

    alert(
      error.message ||
      'Erro inesperado ao desativar vendedor.'
    );
  }
}

// ---------------------------------------------------------------------------
// 28. LOCALIZAR VENDEDOR
// ---------------------------------------------------------------------------

function findSellerById(id) {
  return state.sellers.find(
    (seller) =>
      String(getSellerId(seller)) ===
      String(id)
  );
}

// ---------------------------------------------------------------------------
// 29. NORMALIZAR ID
// ---------------------------------------------------------------------------

function getSellerId(seller) {
  return (
    seller?.id ??
    seller?.seller_id ??
    seller?.sellerId ??
    seller?.sellers_id ??
    null
  );
}

// ---------------------------------------------------------------------------
// 30. SWITCH ATIVO
// ---------------------------------------------------------------------------

function updateActiveSwitchLabel() {
  if (!dom.fActive) return;

  const switchContainer =
    dom.fActive.closest(
      '.sellers-switch'
    );

  const label =
    switchContainer?.querySelector(
      '.sellers-switch__label'
    );

  if (!label) return;

  label.textContent =
    dom.fActive.checked
      ? 'Ativo'
      : 'Inativo';
}

// ---------------------------------------------------------------------------
// 31. CAMPO COMISSÃO
// ---------------------------------------------------------------------------

function updateCommissionField() {
  if (
    !dom.fCommissionType ||
    !dom.fCommissionValue
  ) {
    return;
  }

  const type =
    String(
      dom.fCommissionType.value ||
      'PERCENT'
    ).toUpperCase();

  if (type === 'PERCENT') {
    dom.fCommissionValue.step =
      '0.0001';

    dom.fCommissionValue.min =
      '0';

    dom.fCommissionValue.max =
      '100';
  } else {
    dom.fCommissionValue.step =
      '0.01';

    dom.fCommissionValue.min =
      '0';

    dom.fCommissionValue.removeAttribute(
      'max'
    );
  }
}

// ---------------------------------------------------------------------------
// 32. LOADING DA TABELA
// ---------------------------------------------------------------------------

function setTableLoading(loading) {
  if (!dom.tableBody) return;

  if (!loading) return;

  dom.tableBody.innerHTML = `
    <tr>
      <td colspan="10" style="text-align:center;">
        Carregando vendedores...
      </td>
    </tr>
  `;

  if (dom.emptyState) {
    dom.emptyState.style.display =
      'none';
  }
}

// ---------------------------------------------------------------------------
// 33. LOADING DO BOTÃO SALVAR
// ---------------------------------------------------------------------------

function setSaveLoading(loading) {
  if (!dom.modalSave) return;

  dom.modalSave.disabled =
    Boolean(loading);

  dom.modalSave.textContent =
    loading
      ? 'Salvando...'
      : 'Salvar';
}

// ---------------------------------------------------------------------------
// 34. PARSE JSON SEGURO
// ---------------------------------------------------------------------------

async function parseJsonResponse(
  response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: response.ok,
      message: text,
    };
  }
}

// ---------------------------------------------------------------------------
// 35. NORMALIZAR TEXTO DE BUSCA
// ---------------------------------------------------------------------------

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .trim();
}

// ---------------------------------------------------------------------------
// 36. STRING VAZIA → NULL
// ---------------------------------------------------------------------------

function emptyToNull(value) {
  const normalized =
    String(value ?? '').trim();

  return normalized || null;
}

// ---------------------------------------------------------------------------
// 37. ESCAPE HTML
// ---------------------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? '')
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#39;'
    );
}