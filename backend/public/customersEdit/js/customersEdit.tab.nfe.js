// ╔══════════════════════════════════════════════════════════════╗
// ║ customersEdit.tab.nfe.js — Aba Notas Fiscais do Cliente     ║
// ║ PRODNEX ERP | ESM                                           ║
// ║ API: /api/invoices-issued                                   ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

const INVOICES_API_BASE = '/api/invoices-issued';
const DEFAULT_LIMIT = 50;
const $ = (selector) => document.querySelector(selector);

let invoicesRequestController = null;
let invoicesRequestPromise = null;

const INVOICES_REQUEST_TIMEOUT_MS = 12000;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getCustomerId() {
  const hiddenId = $('#customer_id')?.value;
  const params = new URLSearchParams(window.location.search);
  return String(hiddenId || params.get('id') || '').trim();
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('pt-BR');
}

function formatMoney(value) {
  const numericValue = Number(value);

  return (Number.isFinite(numericValue) ? numericValue : 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDate(value) {
  if (!value) return '-';

  const rawValue = String(value);
  const isoDate = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s|$)/);

  if (isoDate) {
    const [, year, month, day] = isoDate;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return rawValue;

  return date.toLocaleDateString('pt-BR');
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.rows)) return payload.data.rows;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.invoices)) return payload.invoices;
  if (Array.isArray(payload?.data?.invoices)) return payload.data.invoices;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function getInvoiceCustomerId(row = {}) {
  return row.customer_id ?? row.customerId ?? row.id_customer ?? row.idCustomer ??
    row.customer?.customer_id ?? row.customer?.customerId ?? row.customer?.id ??
    row.cliente?.customer_id ?? row.cliente?.customerId ?? row.cliente?.id ?? null;
}

function getOpenCustomerNames() {
  return new Set(
    [$('#legal_name')?.value, $('#trade_name')?.value]
      .map(normalizeComparableText)
      .filter(Boolean)
  );
}

function filterInvoicesByCustomer(rows, customerId) {
  const expectedCustomerId = normalizeText(customerId);
  const expectedCustomerNames = getOpenCustomerNames();

  if (!expectedCustomerId) return [];

  return rows.filter((row) => {
    const invoiceCustomerId = normalizeText(getInvoiceCustomerId(row));

    // Quando a API informa o ID, ele sempre prevalece sobre o nome.
    if (invoiceCustomerId !== '') return invoiceCustomerId === expectedCustomerId;

    // Compatibilidade temporária com APIs antigas que retornam apenas o nome.
    const invoiceCustomerName = normalizeComparableText(getCustomerName(row));
    return invoiceCustomerName !== '' && expectedCustomerNames.has(invoiceCustomerName);
  });
}

function getInvoiceId(row = {}) {
  return row.invoice_id || row.id || row.customer_invoice_id || row.customerInvoiceId || '';
}

function getInvoiceNumber(row = {}) {
  return row.nfe_number || row.invoice_number || row.number || row.numero || row.numero_nfe || '-';
}

function getCustomerName(row = {}) {
  return row.customer_name || row.nome_cliente || row.razao_social || row.nome_fantasia ||
    row.customer?.legal_name || row.customer?.trade_name || row.customer?.name ||
    row.cliente?.legal_name || row.cliente?.trade_name || row.cliente?.name ||
    (typeof row.customer === 'string' ? row.customer : '') ||
    (typeof row.cliente === 'string' ? row.cliente : '') || '-';
}

function getIssueDate(row = {}) {
  return row.issued_at || row.issued_date || row.nfe_issue_datetime ||
    row.nfe_issue_date || row.issue_date || row.emissao ||
    row.data_emissao || row.created_at || null;
}

function getAccessKey(row = {}) {
  return row.nfe_key || row.access_key || row.chave_acesso || row.chave || row.chave_nfe || '';
}

function getStatus(row = {}) {
  return row.nfe_status || row.status || row.invoice_status || '-';
}

function getTotal(row = {}) {
  return row.total_amount || row.amount || row.total || row.valor_total || row.valor || 0;
}

function getXmlUrl(row = {}) {
  return normalizeText(
    row.xml_url || row.nfe_xml_url || row.xmlUrl || row.xml_path ||
    row.xmlPath || row.path_xml || row.url_xml || ''
  );
}

function renderMessage(message) {
  const tbody = $('#customerInvoicesTbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" class="text-center">${escapeHtml(message)}</td>
    </tr>
  `;
}

function setLoading() {
  renderMessage('Carregando notas fiscais...');
}

function setEmpty() {
  renderMessage('Nenhuma nota fiscal encontrada para este cliente.');
}

function setError(message = 'Erro ao carregar notas fiscais do cliente.') {
  renderMessage(message);
}

function buildDanfeDownloadUrl(row = {}) {
  const invoiceId = normalizeText(getInvoiceId(row));
  if (!invoiceId) return '';

  return `${INVOICES_API_BASE}/${encodeURIComponent(invoiceId)}/danfe`;
}

function buildXmlDownloadUrl(row = {}) {
  const invoiceId = normalizeText(getInvoiceId(row));

  if (invoiceId) {
    return `${INVOICES_API_BASE}/${encodeURIComponent(invoiceId)}/xml`;
  }

  return getXmlUrl(row);
}

function renderRows(rows) {
  const tbody = $('#customerInvoicesTbody');
  if (!tbody) return;
  if (!rows.length) return setEmpty();

  tbody.innerHTML = rows.map((row) => {
    const invoiceNumber = getInvoiceNumber(row);
    const issueDate = formatDate(getIssueDate(row));
    const customerName = getCustomerName(row);
    const accessKey = getAccessKey(row) || '-';
    const status = getStatus(row);
    const total = formatMoney(getTotal(row));
    const xmlDownloadUrl = buildXmlDownloadUrl(row);
    const danfeDownloadUrl = buildDanfeDownloadUrl(row);

    return `
      <tr>
        <td title="${escapeHtml(invoiceNumber)}">${escapeHtml(invoiceNumber)}</td>
        <td title="${escapeHtml(issueDate)}">${escapeHtml(issueDate)}</td>
        <td title="${escapeHtml(customerName)}">${escapeHtml(customerName)}</td>
        <td title="${escapeHtml(accessKey)}">${escapeHtml(accessKey)}</td>
        <td title="${escapeHtml(status)}">${escapeHtml(status)}</td>
        <td title="${escapeHtml(total)}">${escapeHtml(total)}</td>
<td>
  <div class="document-actions">
    ${xmlDownloadUrl ? `
      <a
        class="btn-icon-clean document-action"
        href="${escapeHtml(xmlDownloadUrl)}"
        title="Baixar XML da NF-e"
        aria-label="Baixar XML da NF-e"
      >
        <img
          class="document-action-image"
          src="/iconsImagens/xmlDanfe.png"
          alt=""
          aria-hidden="true"
        >
      </a>
    ` : `
      <span
        class="btn-icon-clean document-action"
        title="XML da nota fiscal não disponível"
        aria-label="XML da nota fiscal não disponível"
        aria-disabled="true"
      >
        <img
          class="document-action-image"
          src="/iconsImagens/xmlDanfe.png"
          alt=""
          aria-hidden="true"
        >
      </span>
    `}

    ${danfeDownloadUrl ? `
      <a
        class="btn-icon-clean document-action"
        href="${escapeHtml(danfeDownloadUrl)}"
        title="Baixar DANFE"
        aria-label="Baixar DANFE"
      >
        <img
          class="document-action-image"
          src="/iconsImagens/pdf.png"
          alt=""
          aria-hidden="true"
        >
      </a>
    ` : `
      <span
        class="btn-icon-clean document-action"
        title="DANFE não disponível"
        aria-label="DANFE não disponível"
        aria-disabled="true"
      >
        <img
          class="document-action-image"
          src="/iconsImagens/pdf.png"
          alt=""
          aria-hidden="true"
        >
      </span>
    `}
  </div>
</td>
      </tr>
    `;
  }).join('');
}

async function loadCustomerInvoices({ force = false } = {}) {
  const customerId = getCustomerId();

  if (!customerId) {
    setError('Cliente não identificado para carregar notas fiscais.');
    return;
  }

  if (invoicesRequestPromise && !force) {
    return invoicesRequestPromise;
  }

  if (force) invoicesRequestController?.abort();

  const requestController = new AbortController();
  invoicesRequestController = requestController;
  let requestTimedOut = false;

  const timeoutId = window.setTimeout(() => {
    requestTimedOut = true;
    requestController.abort();
  }, INVOICES_REQUEST_TIMEOUT_MS);

  setLoading();

  const requestPromise = (async () => {
    const params = new URLSearchParams({
      customer_id: customerId,
      limit: String(DEFAULT_LIMIT),
      offset: '0',
    });
    const url = `${INVOICES_API_BASE}?${params.toString()}`;
    const startedAt = performance.now();

    console.debug('[customersEdit.tab.nfe] loading invoices:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal: requestController.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `HTTP ${response.status}`);
    }

    const rows = normalizeRows(payload);
    const customerInvoices = filterInvoicesByCustomer(rows, customerId);

    if (rows.length > 0 && customerInvoices.length === 0) {
      console.warn(
        '[customersEdit.tab.nfe] A API retornou notas sem ID ou nome compatível com o cliente aberto.',
        { customerId, customerNames: [...getOpenCustomerNames()] }
      );
    }

    renderRows(customerInvoices);
    console.debug(
      `[customersEdit.tab.nfe] invoices loaded in ${Math.round(performance.now() - startedAt)} ms`
    );
  })();

  invoicesRequestPromise = requestPromise;

  try {
    await requestPromise;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (requestTimedOut) {
        console.error('[customersEdit.tab.nfe] invoices request timeout:', error);
        setError('A consulta das notas fiscais excedeu 12 segundos. Tente atualizar novamente.');
      }

      return;
    }

    console.error('[customersEdit.tab.nfe] loadCustomerInvoices error:', error);
    setError(error.message || 'Erro ao carregar notas fiscais do cliente.');
  } finally {
    window.clearTimeout(timeoutId);

    if (invoicesRequestController === requestController) {
      invoicesRequestController = null;
    }

    if (invoicesRequestPromise === requestPromise) {
      invoicesRequestPromise = null;
    }
  }
}

function setupNfeTab() {
  $('#btnReloadCustomerInvoices')?.addEventListener('click', () => {
    loadCustomerInvoices({ force: true });
  });

  document.querySelectorAll('.tab[data-tab], .customer-tab-btn[data-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.tab === 'tab-notas-fiscais') {
        loadCustomerInvoices();
      }
    });
  });

  const activeNfeTab = document.querySelector(
    '.tab.is-active[data-tab="tab-notas-fiscais"], ' +
    '.customer-tab-btn.active[data-tab="tab-notas-fiscais"]'
  );

  if (activeNfeTab) loadCustomerInvoices();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupNfeTab, { once: true });
} else {
  setupNfeTab();
}

export { loadCustomerInvoices };
