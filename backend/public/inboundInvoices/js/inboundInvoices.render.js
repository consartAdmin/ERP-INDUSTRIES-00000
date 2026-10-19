/* ╔══════════════════════════════════════════════════════════════════╗
   ║ inboundInvoices.render.js — Listagem, paginação e renderização           ║
   ║ PRODNEX ERP | Frontend (ESM)                                     ║
   ║ ✅ Confirmação via modal CONSART                                 ║
   ║ ✅ Logs de listagem / edição / exclusão                          ║
   ║ ✅ Tratamento seguro de erro no DELETE                           ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

/** Data de emissão da NF-e (coluna DATE): mostra dd/mm/aaaa sem deslocar o fuso. */
function formatIssueDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export function initList({ core, ROUTES, state, refs, switchTab }) {
  const API_INBOUND = ROUTES.inboundBase();

  const makeTraceId = (prefix = 'LIST') => {
    const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
    return `${prefix}-${Date.now()}-${rand}`;
  };

  async function readResponseAsText(response) {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }

  function safeJsonParse(txt) {
    try {
      return JSON.parse(txt);
    } catch {
      return null;
    }
  }

  async function loadInvoices() {
    const traceId = makeTraceId('LOAD');

    try {
      const params = new URLSearchParams({
        limit: String(state.pageSize),
        offset: String((state.page - 1) * state.pageSize),
        orderBy: `${state.orderBy} ${state.orderDirection}`,
      });

      if (refs.search?.value?.trim()) {
        params.set('search', refs.search.value.trim());
      }

      if (state.dateFrom) {
        params.set('dateFrom', state.dateFrom);
      }

      if (state.dateTo) {
        params.set('dateTo', state.dateTo);
      }

      const url = `${API_INBOUND}?${params.toString()}`;

      console.log('[FRONT][INBOUND][LIST][LOAD][START]', {
        traceId,
        url,
        page: state.page,
        pageSize: state.pageSize,
        search: refs.search?.value?.trim() || '',
      });

      const res = await fetch(url);
      const text = await readResponseAsText(res);
      const data = safeJsonParse(text) || {};

      if (!res.ok) {
        console.error('[FRONT][INBOUND][LIST][LOAD][ERROR]', {
          traceId,
          status: res.status,
          body: data || text,
        });

        core.toast.error(
          'Erro ao carregar notas',
          data?.error || data?.detail || 'Falha ao carregar a listagem.'
        );

        state.total = 0;
        renderTable([]);
        renderPagination();
        return;
      }

      state.total = data.total || 0;
      renderTable(data.items || []);
      renderPagination();

      console.log('[FRONT][INBOUND][LIST][LOAD][DONE]', {
        traceId,
        total: state.total,
        itemsCount: Array.isArray(data.items) ? data.items.length : 0,
      });
    } catch (err) {
      console.error('[FRONT][INBOUND][LIST][LOAD][FATAL]', {
        traceId,
        message: err?.message,
        stack: err?.stack,
      });

      state.total = 0;
      renderTable([]);
      renderPagination();

      core.toast.error(
        'Erro inesperado',
        err?.message || 'Falha inesperada ao carregar a listagem.'
      );
    }
  }

  function renderTable(items) {
    if (!refs.tbody) return;

    refs.tbody.innerHTML = '';

    items.forEach((row) => {
      const inboundId = Number(row.inbound_id ?? row.id);
      if (!Number.isInteger(inboundId) || inboundId <= 0) {
        console.warn('[FRONT][INBOUND][LIST][INVALID_ID]', row);
        return;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
  <td>${inboundId}</td>
  <td>${row.supplier_name || 'Fornecedor não cadastrado'}</td>
  <td>${row.access_key || ''}</td>
  <td>${row.invoice_number || ''}</td>
  <td>${row.series || ''}</td>
  <td>${row.issuer || ''}</td>
  <td>${row.recipient || ''}</td>
  <td>${core.moneyBR(row.total_amount || 0)}</td>
  <td>${formatIssueDate(row.issue_date)}</td>
  <td>
    ${row.created_at
          ? new Date(row.created_at).toLocaleString('pt-BR')
          : ''}
  </td>
  <td>
    <button
      class="btn btn-toolbar btn-sm"
      data-act="edit"
      data-id="${inboundId}"
      title="Editar"
    >👁️</button>

    <button
      class="btn btn-toolbar btn-sm"
      data-act="del"
      data-id="${inboundId}"
      title="Excluir"
    >🗑️</button>
  </td>
`;
      refs.tbody.appendChild(tr);
    });
  }

  function renderPagination() {
    const totalRecords = Number(state.total) || 0;
    const pageSize = Number(state.pageSize) || 50;
    const totalPages = Math.max(
      1,
      Math.ceil(totalRecords / pageSize)
    );

    if (state.page > totalPages) {
      state.page = totalPages;
    }

    if (refs.pageInfo) {
      refs.pageInfo.textContent =
        `Página ${state.page} de ${totalPages}`;
    }

    if (refs.tableInfo) {
      refs.tableInfo.textContent =
        `${totalRecords} ${totalRecords === 1
          ? 'registro'
          : 'registros'
        }`;
    }

    if (refs.pagePrev) {
      refs.pagePrev.disabled = state.page <= 1;
    }

    if (refs.pageNext) {
      refs.pageNext.disabled =
        totalRecords === 0 || state.page >= totalPages;
    }

    if (refs.rowsPerPage) {
      refs.rowsPerPage.value = String(pageSize);
    }
  }

  // ===============================================================
  // TABLE BUTTONS
  // ===============================================================
  refs.tbody?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;

    const id = Number(btn.dataset.id);
    if (!Number.isInteger(id) || id <= 0) {
      core.toast.error('Erro', 'Identificador da nota inválido.');
      return;
    }
    const act = btn.dataset.act;
    const traceId = makeTraceId(act === 'del' ? 'DEL' : 'EDIT');

    if (act === 'edit') {
      console.log('[FRONT][INBOUND][LIST][EDIT][START]', {
        traceId,
        invoiceId: id,
      });

      await state.actions.openFormEdit?.(id);

      console.log('[FRONT][INBOUND][LIST][EDIT][DONE]', {
        traceId,
        invoiceId: id,
      });

      return;
    }

    if (act === 'del') {
      console.log('[FRONT][INBOUND][LIST][DELETE][ASK_CONFIRM]', {
        traceId,
        invoiceId: id,
      });

      const confirmed = await state.actions.confirmDelete?.({
        title: 'Excluir nota de entrada',
        message: 'Tem certeza que deseja excluir esta nota?',
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
      });

      if (!confirmed) {
        console.log('[FRONT][INBOUND][LIST][DELETE][CANCELLED]', {
          traceId,
          invoiceId: id,
        });
        return;
      }

      try {
        const r = await fetch(`${API_INBOUND}/${id}`, {
          method: 'DELETE',
          headers: {
            'x-inbound-trace-id': traceId,
          },
        });

        const text = await readResponseAsText(r);
        const j = safeJsonParse(text) || (text ? { error: text } : null);

        console.log('[FRONT][INBOUND][LIST][DELETE][RESPONSE]', {
          traceId,
          invoiceId: id,
          status: r.status,
          body: j || text,
        });

        if (!r.ok) {
          return core.toast.error(
            'Erro ao excluir',
            j?.error || j?.detail || 'Falha ao excluir nota.'
          );
        }

        await loadInvoices();

        core.toast.success('Nota excluída', 'A nota foi excluída com sucesso.');
        switchTab?.('list');

        console.log('[FRONT][INBOUND][LIST][DELETE][DONE]', {
          traceId,
          invoiceId: id,
        });
      } catch (err) {
        console.error('[FRONT][INBOUND][LIST][DELETE][FATAL]', {
          traceId,
          invoiceId: id,
          message: err?.message,
          stack: err?.stack,
        });

        core.toast.error(
          'Erro inesperado',
          err?.message || 'Falha inesperada ao excluir a nota.'
        );
      }
    }
  });

  // ===============================================================
  // SEARCH
  // ===============================================================
  refs.btnSearch?.addEventListener('click', () => {
    state.page = 1;
    loadInvoices();
  });

  refs.filterDateRange?.addEventListener('range-change', (event) => {
    state.dateFrom = String(event.detail?.startDate || '');
    state.dateTo = String(event.detail?.endDate || '');
    state.page = 1;
    loadInvoices();
  });

  refs.pagePrev &&
    (refs.pagePrev.onclick = () => {
      if (state.page > 1) {
        state.page--;
        loadInvoices();
      }
    });

  refs.pageNext &&
    (refs.pageNext.onclick = () => {
      const tp = Math.max(1, Math.ceil(state.total / state.pageSize));
      if (state.page < tp) {
        state.page++;
        loadInvoices();
      }
    });

  refs.btnNewFromList?.addEventListener('click', () => {
    console.log('[FRONT][INBOUND][LIST][NEW]');
    state.actions.openFormNew?.();
  });

  // expose
  refs.rowsPerPage?.addEventListener('change', () => {
    const pageSize = Number(refs.rowsPerPage.value);

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      return;
    }

    state.pageSize = pageSize;
    state.page = 1;

    loadInvoices();
  });

  refs.search?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();
    state.page = 1;

    loadInvoices();
  });

  // Synchronize initial rows-per-page
  if (refs.rowsPerPage) {
    const initialPageSize = Number(refs.rowsPerPage.value);

    if (
      Number.isInteger(initialPageSize) &&
      initialPageSize > 0
    ) {
      state.pageSize = initialPageSize;
    }
  }

  // Expose
  state.actions.loadInvoices = loadInvoices;
}
