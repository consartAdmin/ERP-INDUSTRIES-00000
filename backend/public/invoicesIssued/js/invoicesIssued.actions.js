// ╔══════════════════════════════════════════════════════════════════════╗
// ║ invoicesIssued.actions.js — Orquestrador do módulo invoicesIssued                    ║
// ║ PRODNEX ERP                                                        ║
// ║ ✅ Modal envio de e-mail                                            ║
// ║ ✅ Download XML                                                     ║
// ║ ✅ Download DANFE                                                   ║
// ║ ✅ Download XML + DANFE + boletos em ZIP                            ║
// ║ ✅ Paginação                                                        ║
// ║ ✅ Busca                                                            ║
// ║ ✅ Sync faturadas                                                   ║
// ║ ✅ CRUD modal                                                       ║
// ║ ✅ Cancelamento NF-e via include reutilizável                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  $,
  extractAlerts,
  formatAlertTitle,
} from './invoicesIssued.utils.js';

import {
  state,
} from './invoicesIssued.state.js';

import {
  apiFetch,
  listInvoices,
  getInvoiceById,
  syncInvoicesIssued,
  getInvoicesKpis,
} from './invoicesIssued.api.js';

import {
  getQueryParams,
  getDownloadXmlUrl,
  getDownloadDanfeUrl,
} from './invoicesIssued.form.js';

import {
  renderKpis,
  renderTable,
  renderLoading,
  renderError,
} from './invoicesIssued.render.js';

import {
  openModal,
  closeModal,
  saveInvoice,
  setAfterSaveCallback,
  openEmailModal,
  closeEmailModal,
  sendInvoiceEmail,
} from './invoicesIssued.modal.js';

import {
  createSortableTable,
} from '/public/includes/js/sortableTable.js';

import {
  INVOICES_SORT_COLUMNS,
} from './invoicesIssued.config.js';

import {
  normalizeNfeStatusCode,
} from './invoicesIssued.validation.js';

import {
  initNfeCancellation,
  openNfeCancellation,
} from '/public/includes/js/nfeCancellation.js';

async function loadKpis() {
  try {
    // KPIs seguem o período de emissão do filtro (sem período = todas as notas)
    const range = $('dateFilter')?.value || {};

    const out = await getInvoicesKpis({
      dateFrom: range.startDate || '',
      dateTo: range.endDate || '',
    });

    if (!out?.ok) {
      throw new Error(
        out?.error ||
        'Erro ao carregar KPIs das NF-e.'
      );
    }

    const data = out.data || {};

    state.kpis = {
      total: Number(data.total || 0),
      authorized: Number(data.authorized || 0),
      cancelled: Number(data.cancelled || 0),
      total_amount: Number(data.total_amount || 0),
    };

    renderKpis();

  } catch (error) {
    console.error(
      '[invoicesIssued.loadKpis]',
      error
    );
  }
}

// ======================================================================
// SYNC STATUS
// ======================================================================

function showSyncStatus(message, type = 'info') {

  const el = $('syncStatus');

  if (!el) return;

  el.className = `sync-status ${type}`;
  el.replaceChildren();

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  window.clearTimeout(showSyncStatus._timer);

  showSyncStatus._timer = window.setTimeout(() => {

    el.className = 'sync-status is-hidden';
    el.textContent = '';

  }, type === 'error' || type === 'warning' ? 20000 : 6000);
}

function getDownloadFilename(response, invoiceId) {
  const disposition = response.headers.get('Content-Disposition') || '';
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  return plainMatch?.[1] || `nfe-${invoiceId}-documentos.zip`;
}

async function handleDownloadAll(invoiceId, button) {
  const originalHtml = button.innerHTML;

  try {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = '<span class="download-all-icon" aria-hidden="true">…</span>';

    showSyncStatus('Preparando XML, DANFE e boletos...', 'info');

    const response = await fetch(
      `/api/invoices-issued/${encodeURIComponent(invoiceId)}/download-all`,
      {
        method: 'GET',
        headers: { Accept: 'application/zip, application/json' },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const contentType = response.headers.get('Content-Type') || '';
      const data = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};

      throw new Error(
        data?.error || data?.message || `Erro ao preparar arquivos (HTTP ${response.status}).`,
      );
    }

    const blob = await response.blob();
    if (!blob.size) {
      throw new Error('O servidor não retornou arquivos para esta nota fiscal.');
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = getDownloadFilename(response, invoiceId);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    showSyncStatus('Download iniciado com sucesso.', 'success');
  } catch (error) {
    console.error('[INVOICES][DOWNLOAD_ALL]', error);
    showSyncStatus(error?.message || 'Erro ao baixar os documentos.', 'error');
    window.alert(error?.message || 'Erro ao baixar os documentos.');
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = originalHtml;
  }
}

function showFiscalAlerts(alerts, summary = '') {
  const el = $('syncStatus');
  if (!el || !alerts.length) return;

  window.clearTimeout(showSyncStatus._timer);
  el.className = `sync-status ${alerts.some((a) => a.severity === 'error') ? 'error' : 'warning'}`;
  el.replaceChildren();

  const heading = document.createElement('strong');
  heading.textContent = summary || `${alerts.length} problema(s) encontrado(s) na sincronização.`;
  el.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'sync-alert-list';

  alerts.slice(0, 50).forEach((alert) => {
    const item = document.createElement('li');
    const title = formatAlertTitle(alert);
    item.textContent = title ? `${title}: ${alert.message}` : alert.message;
    list.appendChild(item);
  });

  if (alerts.length > 50) {
    const item = document.createElement('li');
    item.textContent = `Mais ${alerts.length - 50} ocorrência(s) não exibida(s).`;
    list.appendChild(item);
  }

  el.appendChild(list);
}

// ======================================================================
// SORTABLE TABLE
// ======================================================================

let invoicesSortableTable = null;


// ======================================================================
// INIT SORTABLE TABLE
// ======================================================================

function initSortableTable() {

  const table =
    document.getElementById(
      'invoicesIssuedTable'
    );

  if (!table) {

    console.warn(
      '[invoicesIssued] Tabela #invoicesIssuedTable não encontrada.'
    );

    return;

  }

  invoicesSortableTable = createSortableTable({

    table,

    defaultColumn: 'nfe_number',

    defaultDirection: 'desc',

    allowedColumns:
      INVOICES_SORT_COLUMNS,

    sortOnInit: false,

    onSort: async ({
      column,
      direction,
    }) => {

      console.log(
        '[invoicesIssued] sort:',
        column,
        direction
      );

      // Sempre volta para a página 1
      // quando muda a ordenação.
      state.offset = 0;

      await loadInvoices();

    },

    onError: (error) => {

      console.error(
        '[invoicesIssued.sort]',
        error
      );

      showSyncStatus(
        error?.message ||
        'Erro ao ordenar notas fiscais.',
        'error'
      );

    },

  });

}

// ======================================================================
// PAGINATION
// ======================================================================

function renderPagination() {

  const totalRecords = Number(
    state.total || state.rows?.length || 0
  );

  const limit = Number(state.limit) || 50;
  const offset = Number(state.offset) || 0;

  const page =
    Math.floor(offset / limit) + 1;

  const totalPages =
    Math.max(
      Math.ceil(totalRecords / limit),
      1
    );

  const tableInfo = $('apTableInfo');

  if (tableInfo) {
    tableInfo.textContent =
      `${totalRecords} ${totalRecords === 1
        ? 'Registro'
        : 'Registros'
      }`;
  }

  const pageInfo = $('pageInfo');

  if (pageInfo) {
    pageInfo.textContent =
      `Página ${page} de ${totalPages}`;
  }

  const previousButton =
    $('btnPreviousPage');

  if (previousButton) {
    previousButton.disabled =
      offset <= 0;
  }

  const nextButton =
    $('btnNextPage');

  if (nextButton) {
    nextButton.disabled =
      offset + limit >= totalRecords;
  }

  // Mantém o select sincronizado com state.limit
  const rowsPerPage =
    $('apRowsPerPage');

  if (rowsPerPage) {
    rowsPerPage.value =
      String(limit);
  }
}


async function goToPreviousPage() {

  state.offset = Math.max(
    state.offset - state.limit,
    0
  );

  await loadInvoices();
}


async function goToNextPage() {

  const nextOffset =
    state.offset + state.limit;

  // Evita avançar além dos registros existentes
  if (nextOffset >= state.total) {
    return;
  }

  state.offset = nextOffset;

  await loadInvoices();
}

// ======================================================================
// LOAD INVOICES
// ======================================================================

async function loadInvoices() {

  try {

    renderLoading();

    const params = new URLSearchParams(
      getQueryParams()
    );

    const sort = invoicesSortableTable?.getState();

    if (sort?.column) {
      params.set(
        'sortBy',
        sort.column
      );

      params.set(
        'sortDirection',
        sort.direction
      );
    }

    const qs = params.toString();

    console.log(
      '[invoicesIssued] query:',
      qs
    );

    console.log(
      '[invoicesIssued] sort:',
      sort
    );

    console.log(
      '[invoicesIssued] date range:',
      $('dateFilter')?.value
    );

    const out = await listInvoices(qs);

    state.rows = Array.isArray(out?.rows)
      ? out.rows
      : [];

    state.total = Number(
      out?.total ??
      out?.count ??
      out?.totalRecords ??
      out?.total_records ??
      out?.pagination?.total ??
      state.rows.length
    );

    state.totalAmount = Number(
      out?.total_amount ??
      out?.totalAmount ??
      out?.summary?.valor_total ??
      out?.summary?.valorTotal ??
      0
    );

    state.summary =
      out?.summary ||
      out?.kpis ||
      out?.totals ||
      null;

    renderTable();
    renderKpis();
    renderPagination();

  } catch (err) {

    console.error(
      '[invoicesIssued.loadInvoices]',
      err
    );

    renderError(
      err?.message ||
      'Erro ao carregar notas fiscais.'
    );
  }
}

// ======================================================================
// SYNC NF-E
// ======================================================================

function setSyncButtonLabel(btn, text) {
  const label = btn.querySelector('[data-btn-label]');
  if (label) label.textContent = text;
  else btn.textContent = text;
}

async function handleSyncInvoices() {

  const btn = $('btnSync');

  try {

    if (btn) {
      btn.disabled = true;
      setSyncButtonLabel(btn, 'Sincronizando...');
    }

    showSyncStatus(
      'Sincronizando notas fiscais faturadas...',
      'info'
    );

    const out = await syncInvoicesIssued();
    const imported = Number(out?.imported ?? out?.total ?? 0);
    const alerts = extractAlerts(out);

    const uniqueAlerts = alerts.filter((alert, index, list) =>
      list.findIndex((item) =>
        `${item.code}|${item.orderId}|${item.message}` ===
        `${alert.code}|${alert.orderId}|${alert.message}`
      ) === index
    );

    if (uniqueAlerts.length) {
      showFiscalAlerts(
        uniqueAlerts,
        `Sincronização finalizada com ocorrências. Importados/atualizados: ${imported}.`,
      );
    } else {
      showSyncStatus(
        `Sincronização concluída. Registros importados/atualizados: ${imported}`,
        'success'
      );
    }

    state.offset = 0;

    await loadInvoices();

  } catch (err) {

    console.error(
      '[invoicesIssued.sync]',
      err
    );

    const alerts = err?.alerts?.length
      ? err.alerts
      : extractAlerts(err?.data || { error: err?.message || 'Erro desconhecido' }, { includeRoot: true });

    showFiscalAlerts(alerts, 'Não foi possível sincronizar as notas fiscais.');

  } finally {

    if (btn) {
      btn.disabled = false;
      setSyncButtonLabel(btn, 'Sincronizar');
    }
  }
}

// ======================================================================
// OPEN EMAIL MODAL
// ======================================================================

async function handleOpenEmailModal(invoiceId) {

  try {

    const out = await getInvoiceById(invoiceId);

    if (!out?.invoice) {
      throw new Error(
        'Nota fiscal não encontrada.'
      );
    }

    const invoice = out.invoice;

    // ==========================================================
    // AUTO FILL EMAIL
    // ==========================================================

    const defaultEmail =
      invoice.customer_email ||
      invoice.final_email ||
      invoice.order_email ||
      '';

    // ==========================================================
    // SET MODAL FIELDS
    // ==========================================================

    const elInvoiceId = $('email_invoice_id');
    const elEmail = $('email_to');
    const elCustomer = $('email_customer_name');
    const elNfe = $('email_nfe_number');

    if (elInvoiceId) {
      elInvoiceId.value = invoice.invoice_id || '';
    }

    if (elEmail) {
      elEmail.value = defaultEmail;
    }

    if (elCustomer) {
      elCustomer.textContent =
        invoice.customer_name || '-';
    }

    if (elNfe) {
      elNfe.textContent =
        invoice.nfe_number || '-';
    }

    // ==========================================================
    // OPEN MODAL
    // ==========================================================

    openEmailModal(invoice);

  } catch (err) {

    console.error(
      '[invoicesIssued.openEmailModal]',
      err
    );

    alert(
      err?.message ||
      'Erro ao abrir modal de e-mail.'
    );
  }
}

async function synchronizeInvoice(invoice) {
  const sourceType =
    String(invoice?.source_type || '')
      .trim()
      .toUpperCase();

  if (sourceType === 'BUDGET') {
    const budgetId =
      Number(invoice?.budget_id);

    if (
      !Number.isSafeInteger(budgetId) ||
      budgetId <= 0
    ) {
      throw new Error(
        'NF-e de orçamento sem budget_id válido.'
      );
    }

    await apiFetch(
      `/api/budgets-issued/${encodeURIComponent(
        budgetId
      )}/status`
    );

    await loadInvoices();

    return;
  }

  if (sourceType === 'ORDER') {
    const orderId =
      Number(invoice?.order_id);

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0
    ) {
      throw new Error(
        'NF-e de pedido sem order_id válido.'
      );
    }

    await apiFetch(
      `/api/orders-nfe-attempts/orders/${encodeURIComponent(
        orderId
      )}/status`
    );

    await apiFetch(
      `/api/invoices-issued/sync-from-order/${encodeURIComponent(
        orderId
      )}`,
      {
        method: 'POST',
      }
    );

    await loadInvoices();

    return;
  }

  if (sourceType === 'BONUS') {
    throw new Error(
      'A sincronização individual de NF-e de bonificação deve ocorrer pelo fluxo de bonificação.'
    );
  }

  throw new Error(
    `Origem da NF-e não suportada: ${sourceType || 'NÃO INFORMADA'}`
  );
}

// ======================================================================
// TABLE CLICK
// ======================================================================

async function handleTableClick(event) {

  const btn = event.target.closest('button');

  if (!btn || btn.disabled) return;

  // ------------------------------------------------------------
  // DATASETS
  // ------------------------------------------------------------

  const reconcileId = btn.dataset.reconcile;

  const editId = btn.dataset.edit;

  const openUrl = btn.dataset.openUrl;

  const downloadAllId = btn.dataset.downloadAll;

  const emailId =
    btn.dataset.email ||
    btn.dataset.sendEmail;

  const cancelNfeId =
    btn.dataset.cancelNfe;

  // ------------------------------------------------------------
  // RECONCILE / FINISH NF-e
  // ------------------------------------------------------------

  // ------------------------------------------------------------
  // RECONCILE / SYNC NF-e
  // ORDER ou BUDGET
  // ------------------------------------------------------------

  if (reconcileId) {

    const originalHtml = btn.innerHTML;

    try {

      btn.disabled = true;
      btn.innerHTML = '⏳';

      // ----------------------------------------------------------
      // Localiza a NF-e completa dentro das linhas carregadas
      // ----------------------------------------------------------

      const invoice = state.rows.find((row) => {

        // data-reconcile currently contains order_id.
        // First try order_id for legacy ORDER rows.
        if (
          row?.order_id != null &&
          String(row.order_id) === String(reconcileId)
        ) {
          return true;
        }

        // Also accept invoice_id/id so the button can later
        // be migrated to a source-independent identifier.
        const invoiceId =
          row?.invoice_id ??
          row?.id ??
          null;

        if (
          invoiceId != null &&
          String(invoiceId) === String(reconcileId)
        ) {
          return true;
        }

        return false;
      });

      if (!invoice) {
        throw new Error(
          `NF-e ${reconcileId} não encontrada na página atual.`
        );
      }

      const sourceType =
        String(invoice?.source_type || '')
          .trim()
          .toUpperCase();

      const sourceId =
        sourceType === 'BUDGET'
          ? invoice?.budget_id
          : invoice?.order_id;

      showSyncStatus(
        sourceType === 'BUDGET'
          ? `Sincronizando NF-e do orçamento ${sourceId}...`
          : `Sincronizando NF-e do pedido ${sourceId}...`,
        'info'
      );

      // ----------------------------------------------------------
      // Nova função source-aware
      // ----------------------------------------------------------

      await synchronizeInvoice(invoice);

      showSyncStatus(
        sourceType === 'BUDGET'
          ? `NF-e do orçamento ${sourceId} sincronizada com sucesso.`
          : `NF-e do pedido ${sourceId} sincronizada com sucesso.`,
        'success'
      );

    } catch (err) {

      console.error(
        '[invoicesIssued.synchronizeInvoice]',
        err
      );

      showSyncStatus(
        err?.message ||
        'Erro ao sincronizar NF-e.',
        'error'
      );

      alert(
        err?.message ||
        'Erro ao sincronizar NF-e.'
      );

    } finally {

      btn.disabled = false;
      btn.innerHTML = originalHtml;

    }

    return;
  }

  // ------------------------------------------------------------
  // CANCEL NF-e
  // ------------------------------------------------------------

  if (cancelNfeId) {

    const originalHtml =
      btn.innerHTML;

    try {

      btn.disabled = true;

      btn.setAttribute(
        'aria-busy',
        'true'
      );

      btn.innerHTML = '⏳';

      showSyncStatus(
        'Carregando dados da NF-e para cancelamento...',
        'info'
      );

      // ----------------------------------------------------------
      // Sempre recarrega a NF-e do backend.
      //
      // Isso garante que:
      // - nfe_provider_id esteja atualizado
      // - status esteja atualizado
      // - source_type esteja atualizado
      // - order_id / budget_id / bonus_id estejam corretos
      // ----------------------------------------------------------

      const out =
        await getInvoiceById(
          cancelNfeId
        );

      if (!out?.invoice) {
        throw new Error(
          'Nota fiscal não encontrada.'
        );
      }

      const invoice =
        out.invoice;

      const status =
        normalizeNfeStatusCode(
          invoice.nfe_status
        );

      // ----------------------------------------------------------
      // Proteção adicional.
      //
      // O include nfeCancellation.js valida novamente,
      // mas aqui impedimos abrir o modal para uma NF-e inválida.
      // ----------------------------------------------------------

      if (status !== 'AUTORIZADO') {
        throw new Error(
          `Somente NF-e AUTORIZADA pode ser cancelada. Status atual: ${
            status || 'NÃO INFORMADO'
          }.`
        );
      }

      const providerId =
        String(
          invoice.nfe_provider_id || ''
        ).trim();

      if (!providerId) {
        throw new Error(
          'Esta NF-e não possui nfe_provider_id da PlugNotas.'
        );
      }

      console.log(
        '[INVOICES][CANCEL_NFE][OPEN]',
        {
          invoice_id:
            invoice.invoice_id,

          source_type:
            invoice.source_type,

          order_id:
            invoice.order_id,

          budget_id:
            invoice.budget_id,

          bonus_id:
            invoice.bonus_id,

          nfe_number:
            invoice.nfe_number,

          nfe_provider_id:
            providerId,

          nfe_status:
            invoice.nfe_status,
        }
      );

      showSyncStatus(
        `NF-e ${invoice.nfe_number || invoice.invoice_id} pronta para cancelamento.`,
        'info'
      );

      // ----------------------------------------------------------
      // Abre o include reutilizável.
      //
      // O include:
      // - solicita o cancelamento
      // - faz polling
      // - trata 400 transitório
      // - aguarda CONCLUIDO
      // - atualiza invoicesIssued
      // - exibe alerta terminal
      // - fecha o modal
      // ----------------------------------------------------------

      await openNfeCancellation(
        invoice,
        {

          // ------------------------------------------------------
          // Executado APENAS depois que o cancelamento foi
          // confirmado e o ERP atualizado.
          // ------------------------------------------------------

          onCompleted: async ({
            invoice: cancelledInvoice,
            cancellation,
          }) => {

            console.log(
              '[INVOICES][CANCEL_NFE][COMPLETED]',
              {
                invoice_id:
                  cancelledInvoice?.invoice_id,

                nfe_number:
                  cancelledInvoice?.nfe_number,

                protocolo:
                  cancellation?.protocolo,

                cStat:
                  cancellation?.cStat,

                dataCancelamento:
                  cancellation?.dataCancelamento,

                respostaSefaz:
                  cancellation?.respostaSefaz,
              }
            );

            // Mantém a página atual.
            // Não há necessidade de voltar à página 1 apenas
            // porque uma NF-e foi cancelada.

            await Promise.all([
              loadInvoices(),
              loadKpis(),
            ]);

            showSyncStatus(
              `NF-e ${
                cancelledInvoice?.nfe_number ||
                cancelledInvoice?.invoice_id ||
                ''
              } cancelada e atualizada com sucesso.`,
              'success'
            );
          },

          // ------------------------------------------------------
          // Executado em resultado terminal não concluído.
          // Ex.: rejeição, erro ou timeout.
          // ------------------------------------------------------

          onError: async ({
            invoice: failedInvoice,
            message,
            result,
          }) => {

            console.error(
              '[INVOICES][CANCEL_NFE][ERROR]',
              {
                invoice_id:
                  failedInvoice?.invoice_id,

                nfe_number:
                  failedInvoice?.nfe_number,

                message,

                result,
              }
            );

            // Recarrega porque uma reconciliação ou atualização
            // intermediária pode ter alterado a situação fiscal.

            await Promise.all([
              loadInvoices(),
              loadKpis(),
            ]);

            showSyncStatus(
              message ||
              'O cancelamento da NF-e não foi concluído.',
              'error'
            );
          },

          // ------------------------------------------------------
          // Fechamento manual do modal.
          // ------------------------------------------------------

          onClose: () => {

            console.log(
              '[INVOICES][CANCEL_NFE][CLOSE]',
              {
                invoice_id:
                  invoice.invoice_id,

                nfe_number:
                  invoice.nfe_number,
              }
            );
          },

        }
      );

    } catch (err) {

      console.error(
        '[invoicesIssued.cancelNfe]',
        err
      );

      const message =
        err?.payload?.message ||
        err?.payload?.error?.message ||
        err?.message ||
        'Erro ao abrir o cancelamento da NF-e.';

      showSyncStatus(
        message,
        'error'
      );

      window.alert(
        message
      );

    } finally {

      btn.disabled = false;

      btn.removeAttribute(
        'aria-busy'
      );

      btn.innerHTML =
        originalHtml;

    }

    return;
  }

  // ------------------------------------------------------------
  // EMAIL
  // ------------------------------------------------------------

  if (emailId) {

    await handleOpenEmailModal(emailId);

    return;
  }

  // ------------------------------------------------------------
  // DOWNLOAD
  // ------------------------------------------------------------

  if (openUrl) {

    window.open(
      openUrl,
      '_blank',
      'noopener,noreferrer'
    );

    return;
  }

  if (downloadAllId) {

    await handleDownloadAll(downloadAllId, btn);

    return;
  }

  // ------------------------------------------------------------
  // EDIT
  // ------------------------------------------------------------

  if (editId) {

    try {

      const out = await getInvoiceById(editId);

      if (!out?.invoice) {
        throw new Error('Nota fiscal não encontrada.');
      }

      openModal(out.invoice);

    } catch (err) {

      console.error(
        '[invoicesIssued.edit]',
        err
      );

      alert(
        `Erro ao abrir nota: ${err?.message || 'erro desconhecido'
        }`
      );

    }

    return;
  }

}

// ======================================================================
// BIND EVENTS
// ======================================================================

function bindEvents() {

  // ------------------------------------------------------------
  // CALLBACK SAVE
  // ------------------------------------------------------------

  setAfterSaveCallback(loadInvoices);

  // ------------------------------------------------------------
  // REFRESH
  // ------------------------------------------------------------

  $('btnRefresh')
    ?.addEventListener(
      'click',
      () => {
        loadInvoices();
        loadKpis();
      }
    );

  // ------------------------------------------------------------
  // SYNC
  // ------------------------------------------------------------

  $('btnSync')
    ?.addEventListener(
      'click',
      handleSyncInvoices
    );

  // ------------------------------------------------------------
  // SEARCH
  // ------------------------------------------------------------

  $('btnSearch')
    ?.addEventListener(
      'click',
      () => {

        state.offset = 0;

        loadInvoices();
        loadKpis();
      }
    );

  $('searchInput')
    ?.addEventListener(
      'keydown',
      (event) => {

        if (event.key === 'Enter') {

          state.offset = 0;

          loadInvoices();
        }
      }
    );

  $('dateFilter')
    ?.addEventListener(
      'range-change',
      () => {
        state.offset = 0;
        loadInvoices();
        loadKpis();
      }
    );

  // ------------------------------------------------------------
  // PAGINATION
  // ------------------------------------------------------------

  $('btnPreviousPage')
    ?.addEventListener(
      'click',
      goToPreviousPage
    );

  $('btnNextPage')
    ?.addEventListener(
      'click',
      goToNextPage
    );

  // ------------------------------------------------------------
  // ROWS PER PAGE
  // ------------------------------------------------------------

  $('apRowsPerPage')
    ?.addEventListener(
      'change',
      async (event) => {

        const newLimit =
          Number(event.target.value);

        if (
          !Number.isSafeInteger(newLimit) ||
          newLimit <= 0
        ) {
          return;
        }

        state.limit = newLimit;

        // Ao mudar 20 → 50 etc.,
        // sempre retorna à primeira página.
        state.offset = 0;

        await loadInvoices();
      }
    );

  // ------------------------------------------------------------
  // NEW
  // ------------------------------------------------------------

  $('btnNew')
    ?.addEventListener(
      'click',
      () => openModal()
    );

  // ------------------------------------------------------------
  // CLOSE MODAL
  // ------------------------------------------------------------

  $('btnCloseModal')
    ?.addEventListener(
      'click',
      closeModal
    );

  $('btnCancelModal')
    ?.addEventListener(
      'click',
      closeModal
    );

  // ------------------------------------------------------------
  // CLOSE EMAIL MODAL
  // ------------------------------------------------------------

  $('btnCloseEmailModal')
    ?.addEventListener(
      'click',
      closeEmailModal
    );

  $('btnCancelEmailModal')
    ?.addEventListener(
      'click',
      closeEmailModal
    );

  // ------------------------------------------------------------
  // SEND EMAIL
  // ------------------------------------------------------------

  $('btnSendInvoiceEmail')
    ?.addEventListener(
      'click',
      sendInvoiceEmail
    );

  // ------------------------------------------------------------
  // DOWNLOAD XMLs / PDFs BY FILTER
  // ------------------------------------------------------------

  $('btnDownloadXmls')
    ?.addEventListener(
      'click',
      () => {
        const url = getDownloadXmlUrl();
        console.log('[INVOICES][DOWNLOAD_XMLS]', url);
        window.location.href = url;
      }
    );

  $('btnDownloadPdfs')
    ?.addEventListener(
      'click',
      () => {
        const url = getDownloadDanfeUrl();
        console.log('[INVOICES][DOWNLOAD_PDFS]', url);
        window.location.href = url;
      }
    );

  // ------------------------------------------------------------
  // BACKDROP CLICK
  // ------------------------------------------------------------

  $('invoiceIssuedModal')
    ?.addEventListener(
      'click',
      (event) => {

        if (
          event.target.id ===
          'invoiceIssuedModal'
        ) {
          closeModal();
        }
      }
    );

  $('emailModal')
    ?.addEventListener(
      'click',
      (event) => {

        if (
          event.target.id ===
          'emailModal'
        ) {
          closeEmailModal();
        }
      }
    );

  // ------------------------------------------------------------
  // ESC
  // ------------------------------------------------------------

  document.addEventListener(
    'keydown',
    (event) => {

      if (event.key === 'Escape') {

        closeModal();
        closeEmailModal();
      }
    }
  );

  // ------------------------------------------------------------
  // SAVE FORM
  // ------------------------------------------------------------

  $('invoiceForm')
    ?.addEventListener(
      'submit',
      saveInvoice
    );

  // ------------------------------------------------------------
  // TABLE EVENTS
  // ------------------------------------------------------------

  $('tableBody')
    ?.addEventListener(
      'click',
      handleTableClick
    );
}

// ======================================================================
// INIT
// ======================================================================

export async function initInvoicesIssuedActions() {
  closeModal();
  closeEmailModal();

  initSortableTable();
  bindEvents();

  // ============================================================
  // Reusable NF-e cancellation include
  // ============================================================

  await initNfeCancellation();

  await Promise.all([
    loadKpis(),
    loadInvoices(),
  ]);
}

export {
  loadInvoices,
  handleSyncInvoices,
  handleTableClick,
};