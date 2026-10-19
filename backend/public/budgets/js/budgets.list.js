// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.list.js — Listagem (filtros, fetch, render)         ║
// ║ PRODNEX ERP                                                 ║
// ║ ✅ Bloqueia edição de orçamento fechado/fiscal              ║
// ║ ✅ Para CONVERTIDO / NF-e emitida: PDF + COPIAR            ║
// ║ ✅ Copia orçamento e abre o novo no editor                 ║
// ╚══════════════════════════════════════════════════════════════╝

import { $, fmtMoney, ROUTES, safeUpper, state } from './budgets.core.js';
import { authHeaders, fetchSafe, handleAuthFail, toast } from './budgets.infra.js';
import { openEditor, closeEditor, activateTab } from './budgets.editor.js';
import { openPdf, transformToOrder, copyBudget } from './budgets.actions.js';

import {
  applyNfeIssuanceModeUI,
} from './budgets.nfeIssuanceMode.js';

import {
  createSortableTable
} from '/public/includes/js/sortableTable.js';

let budgetsSortableTable = null;

function getApiBase() {
  return (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
}

function isLockedBudgetStatus(statusRaw) {
  const status = safeUpper(statusRaw || '');

  return [
    'CONVERTIDO',
    'EMITIDO NOTA FISCAL',
    'EMITIDO NF',
    'NF-E EMITIDA',
    'NFE EMITIDA',
    'NOTA FISCAL EMITIDA',
    'FATURADO',
    'FATURADA',
  ].includes(status);
}

async function copyBudgetFromList(budgetId) {
  const id = Number(budgetId);
  if (!Number.isFinite(id) || id <= 0) {
    return toast.error('Erro', 'ID do orçamento inválido.');
  }
  return copyBudget(id);
}


async function deleteBudgetFromList(budgetId, statusRaw = '') {
  const id = Number(budgetId);

  if (!Number.isInteger(id) || id <= 0) {
    return toast.error('Erro', 'ID do orçamento inválido.');
  }

  const status = safeUpper(statusRaw || '');

  if (isLockedBudgetStatus(status)) {
    return toast.warn(
      'Orçamento bloqueado',
      'Este orçamento não pode ser excluído porque já foi convertido, faturado ou possui NF-e emitida.'
    );
  }

  const confirmed = window.confirm(
    `Deseja realmente excluir o orçamento #${id}?\n\nEsta operação não poderá ser desfeita.`
  );

  if (!confirmed) return false;

  const out = await fetchSafe(ROUTES.budgetById(id), {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return false;

    const msg =
      out?.json?.message ||
      out?.json?.error ||
      out?.text ||
      `Não foi possível excluir o orçamento #${id}.`;

    toast.error(
      'Erro ao excluir',
      String(msg).slice(0, 260)
    );

    return false;
  }

  toast.success(
    'Orçamento',
    `✅ Orçamento #${id} excluído com sucesso.`
  );

  /*
   * Se a página atual ficar vazia após a exclusão,
   * volta uma página antes de recarregar a listagem.
   */
  if (
    state.page > 1 &&
    Array.isArray(state.list) &&
    state.list.length <= 1
  ) {
    state.page -= 1;
  }

  await fetchBudgets();
  return true;
}

export function bindListUI() {
  const $q = $('#q');
  const $dateRange = $('#dateFilter');
  const $status = $('#statusFilter');
  const $limit = $('#apRowsPerPage');

  if (!budgetsSortableTable) {
    budgetsSortableTable = createSortableTable({
      table: $('#tableBody')?.closest('table'),

      defaultColumn:
        state.orderBy || 'budget_id',

      defaultDirection:
        state.orderDirection || 'desc',

      allowedColumns: [
        'budget_id',
        'issue_date',
        'customer_name',
        'notes',
        'customer_tax_id',
        'items_count',
        'total_amount',
        'status',
        'seller_id',
      ],

      sortOnInit: false,

      onSort: async ({
        column,
        direction,
      }) => {
        console.log(
          '[budgets][sort]',
          {
            column,
            direction,
          }
        );

        state.orderBy = column;
        state.orderDirection = direction;
        state.page = 1;

        await fetchBudgets();
      },

      onError: (error) => {
        console.error(
          '[budgets][sortableTable]',
          error
        );

        toast.error(
          'Erro ao ordenar',
          error?.message ||
          'Não foi possível ordenar os orçamentos.'
        );
      },
    });
  }

  const syncDateRangeState = () => {
    const range = $dateRange?.value || {};

    state.filterDateFrom = range.startDate || '';
    state.filterDateTo = range.endDate || '';
  };

  const applyFiltersAndFetch = () => {
    state.q = $q?.value.trim() || '';
    state.filterStatus = $status?.value || '';

    syncDateRangeState();

    state.page = 1;
    fetchBudgets();
  };

  $('#btnBuscar')?.addEventListener(
    'click',
    applyFiltersAndFetch
  );

  $q?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      applyFiltersAndFetch();
    }
  });

  $dateRange?.addEventListener('range-change', (event) => {
    const range = event.detail || $dateRange.value || {};

    state.filterDateFrom = range.startDate || '';
    state.filterDateTo = range.endDate || '';

    state.page = 1;
    fetchBudgets();
  });

  $status?.addEventListener('change', () => {
    state.filterStatus = $status.value || '';
    state.page = 1;
    fetchBudgets();
  });

  $('#btnRecarregar')?.addEventListener(
    'click',
    () => fetchBudgets()
  );

  $('#btnNovo')?.addEventListener(
    'click',
    () => openEditor()
  );

  $limit?.addEventListener('change', (event) => {
    state.limit = Number(event.target.value) || 50;
    state.page = 1;
    fetchBudgets();
  });

  $('#pagAnterior')?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      fetchBudgets();
    }
  });

  $('#pagProxima')?.addEventListener('click', () => {
    const max = Math.ceil(state.total / state.limit) || 1;

    if (state.page < max) {
      state.page += 1;
      fetchBudgets();
    }
  });

  $('#btnLista')?.addEventListener('click', () => {
    closeEditor();
    activateTab('list');
    fetchBudgets();
  });
}

const tbody = document.querySelector('#tableBody');

if (tbody && !tbody.dataset.actionsBound) {
  tbody.addEventListener('click', onListAction);
  tbody.dataset.actionsBound = 'true';
}

export async function fetchBudgets() {
  const offset = (state.page - 1) * state.limit;

  const url = ROUTES.budgetsSearch(
    state.q,
    state.limit,
    offset,
    state.filterDateFrom,
    state.filterDateTo,
    state.filterStatus,
    state.orderBy,
    state.orderDirection
  );

  console.log('[budgets] GET', url);

  const out = await fetchSafe(url, {
    method: 'GET',
    headers: authHeaders(),
  });

  console.log('[budgets] HTTP', out.status, 'ok=', out.ok);
  console.log('[budgets] BODY:', (out.text || '').slice(0, 2000));

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return;
    toast.error('Erro ao listar', (out.text || `HTTP ${out.status}`).slice(0, 220));
    state.list = [];
    state.total = 0;
    renderList();
    return;
  }

  const js = out.json || { rows: [], total: 0 };
  state.list = js.rows || [];
  state.total = js.total || 0;
  renderList();
}

export function renderList() {
  const tbody = document.querySelector('#tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const escapeHtml = (v) =>
    String(v ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const clip = (s, n = 38) => {
    const t = String(s ?? '').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  };

  for (const b of state.list) {
    const id = b.id ?? b.budget_id ?? b.budget_number ?? b.number ?? null;

    const number = b.number ?? b.budget_number ?? b.id ?? b.budget_id ?? '';
    const data = String(b.issue_date || b.created_at || '').slice(0, 10);
    const cli = b.customer_name || b.nome_razao_social || '';

    const obsRaw =
      b.observation ??
      b.observacao ??
      b.obs ??
      b.note ??
      b.notes ??
      b.observacao_cliente ??
      '';

    const obsTitle = escapeHtml(obsRaw);
    const obsText = escapeHtml(clip(obsRaw, 42));

    const doc = b.customer_tax_id || b.cnpj_cpf || '';
    const itens = b.items_count ?? b.itens ?? 0;
    const total = Number(b.total_amount || b.total || 0);
    const status = safeUpper(b.status || 'ABERTO');
    const seller =
      b.seller_name ??
      b.vendedor_nome ??
      b.seller_nickname ??
      b.vendedor_apelido ??
      b.seller?.nickname ??
      b.seller?.name ??
      b.vendedor?.apelido ??
      b.vendedor?.nome ??
      b.seller_id ??
      b.vendedor_id ??
      '';

    const isLocked = isLockedBudgetStatus(status);

    let badgeClass = 'badge--open';
    if (status === 'APROVADO') badgeClass = 'badge--approved';
    if (status === 'CANCELADO') badgeClass = 'badge--canceled';
    if (status === 'CONVERTIDO') badgeClass = 'badge--approved';
    if (status.includes('EMITID')) badgeClass = 'badge--approved';
    if (status.includes('FATURAD')) badgeClass = 'badge--approved';

    let actionsHtml = '';

    if (isLocked) {
      actionsHtml = `
    <div class="btn-icon-group">
<button
  type="button"
  class="btn-icon-clean img-action"
  data-act="copy"
  data-id="${escapeHtml(id)}"
  data-status="${escapeHtml(status)}"
  title="Copiar orçamento"
  aria-label="Copiar orçamento"
>
  <img
    src="/public/invoicesIssued/icons/copy.png"
    alt=""
    class="img-w-5 img-h-5"
    aria-hidden="true"
  />
</button>

      <button
        type="button"
        class="btn-icon-clean img-action"
        data-act="pdf"
        data-id="${escapeHtml(id)}"
        data-status="${escapeHtml(status)}"
        title="Baixar PDF"
        aria-label="Baixar PDF"
      >
        <img
          src="/public/invoicesIssued/icons/pdf.png"
          alt=""
          class="img-w-7 img-h-7"
        />
      </button>
    </div>
  `;
    } else {
      actionsHtml = `
    <div class="btn-icon-group">
<button
  type="button"
  class="btn-icon-clean img-action"
  data-act="open"
  data-id="${escapeHtml(id)}"
  data-status="${escapeHtml(status)}"
  title="Editar"
  aria-label="Editar orçamento"
>
  <img
    src="/public/invoicesIssued/icons/edit.png"
    alt=""
    class="img-w-5 img-h-5"
    aria-hidden="true"
  />
</button>

<button
  type="button"
  class="btn-icon-clean img-action"
  data-act="copy"
  data-id="${escapeHtml(id)}"
  data-status="${escapeHtml(status)}"
  title="Copiar orçamento"
  aria-label="Copiar orçamento"
>
  <img
    src="/public/invoicesIssued/icons/copy.png"
    alt=""
    class="img-w-5 img-h-5"
    aria-hidden="true"
  />
</button>

<button
  type="button"
  class="btn-icon-clean img-action"
  data-act="pdf"
  data-id="${escapeHtml(id)}"
  data-status="${escapeHtml(status)}"
  title="Baixar PDF"
  aria-label="Baixar PDF"
>
  <img
    src="/public/invoicesIssued/icons/pdf.png"
    alt=""
    class="img-w-7 img-h-7"
    aria-hidden="true"
  />
</button>

<button
  type="button"
  class="btn-icon-clean img-action"
  data-act="order"
  data-id="${escapeHtml(id)}"
  data-status="${escapeHtml(status)}"
  title="Transformar em pedido"
  aria-label="Transformar em pedido"
  hidden
  style="display: none !important;"
>
  <img
    src="/public/invoicesIssued/icons/order.png"
    alt=""
    class="img-w-5 img-h-5"
    aria-hidden="true"
  />
</button>

<button
  type="button"
  class="btn-icon-clean budget-delete-action"
  data-act="delete"
  data-id="${escapeHtml(id)}"
  data-status="${escapeHtml(status)}"
  title="Excluir orçamento"
  aria-label="Excluir orçamento"
>
  <span aria-hidden="true" style="font-size:16px;line-height:1;">🗑️</span>
</button>
    </div>
  `;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="num ta-right">${escapeHtml(number)}</td>
      <td>${escapeHtml(data)}</td>
      <td title="${escapeHtml(cli)}">${escapeHtml(clip(cli, 50))}</td>
      <td class="cell-obs" title="${obsTitle}">${obsText}</td>
      <td class="num">${escapeHtml(doc)}</td>
      <td class="num ta-right">${escapeHtml(itens)}</td>
      <td class="money ta-right">${fmtMoney(total)}</td>

      <td>
        <span class="badge ${badgeClass}">
          ${escapeHtml(status.charAt(0) + status.slice(1).toLowerCase())}
        </span>
      </td>

      <td title="${escapeHtml(seller)}">
        ${escapeHtml(clip(seller, 30) || '—')}
      </td>

      <td class="col-acoes row gap-8">
        ${actionsHtml}
      </td>
    `;

    tbody.appendChild(tr);
  }

  // ================================================================
  // FOOTER / PAGINAÇÃO
  // ================================================================

  const total =
    Number(state.total || 0);

  const limit =
    Number(state.limit || 50);

  const max =
    Math.max(
      1,
      Math.ceil(total / limit)
    );

  // ✅ Quantidade total de registros encontrados
  const recordsInfo =
    $('#limit');

  if (recordsInfo) {
    recordsInfo.textContent =
      total === 1
        ? '1 registro'
        : `${total} registros`;
  }

  // ✅ Página atual
  const pageInfo =
    $('#infoPagina');

  if (pageInfo) {
    pageInfo.textContent =
      `Página ${state.page} de ${max}`;
  }

  // ✅ Botão página anterior
  const prevBtn =
    $('#pagAnterior');

  if (prevBtn) {
    prevBtn.disabled =
      state.page <= 1;
  }

  // ✅ Botão próxima página
  const nextBtn =
    $('#pagProxima');

  if (nextBtn) {
    nextBtn.disabled =
      state.page >= max;
  }

  // ✅ Mantém o select sincronizado com state.limit
  const pageSize =
    $('#apRowsPerPage');

  if (pageSize) {
    pageSize.value =
      String(limit);
  }

  // ✅ Reaplica a feature após criar os botões dinâmicos da lista
  applyNfeIssuanceModeUI();
}


async function onListAction(e) {
  console.log('[budgets][actions] click target:', e.target);

  const el = e.target.closest('[data-act]');

  console.log('[budgets][actions] element:', el);

  if (!el) return;

  const id = el.dataset.id;
  const act = el.dataset.act;
  const status = safeUpper(el.dataset.status || '');

  console.log('[budgets][actions]', {
    id,
    act,
    status,
  });

  try {
    if (act === 'copy') {
      return await copyBudgetFromList(id);
    }

    if (isLockedBudgetStatus(status)) {
      if (act === 'pdf') {
        return await openPdf(id);
      }

      toast.info?.(
        'Orçamento bloqueado',
        'Este orçamento não pode mais ser editado, mas você pode baixar o PDF ou copiá-lo.'
      );

      return;
    }

    if (act === 'open') {
      console.log('[budgets][edit] Abrindo orçamento:', {
        id,
        numericId: Number(id),
        status,
      });

      try {
        await openEditor(Number(id));

        activateTab('editor');

        console.log('[budgets][edit] Editor aberto e aba ativada.');
      } catch (error) {
        console.error('[budgets][edit] Erro ao abrir:', error);

        toast.error(
          'Erro ao editar orçamento',
          error?.message || `Não foi possível abrir o orçamento #${id}.`
        );
      }

      return;
    }
    if (act === 'pdf') return await openPdf(id);
    if (act === 'order') return await transformToOrder(id);
    if (act === 'delete') return await deleteBudgetFromList(id, status);

    console.warn('[budgets][actions] Ação desconhecida:', act);
  } catch (error) {
    console.error('[budgets][actions] Falha:', error);

    toast.error(
      'Erro',
      error?.message || 'Não foi possível executar a ação.'
    );
  }
}
