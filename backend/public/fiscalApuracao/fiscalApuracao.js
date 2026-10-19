// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalApuracao.js                                              ║
// ║ MODULE: FISCAL APURACAO                                              ║
// ║ PRODNEX ERP                                                          ║
// ║ FRONTEND LOGIC                                                       ║
// ║ UPDATE: XML + split Entrada/Saída + exportação PDF/EXCEL            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = `${window.location.origin}/api`;

const XML_IMPORT_MODES = {
  AUTO: 'AUTO',
  ENTRADA: 'ENTRADA',
  SAIDA: 'SAIDA'
};

const state = {
  selectedApuracaoId: null,
  currentDocumentsEntrada: [],
  currentDocumentsSaida: []
};

const dom = {
  dateFromInput: document.getElementById('dateFromInput'),
  dateToInput: document.getElementById('dateToInput'),
  regimeTypeSelect: document.getElementById('regimeTypeSelect'),

  btnCreateApuracao: document.getElementById('btnCreateApuracao'),
  btnRefreshList: document.getElementById('btnRefreshList'),
  btnImportXml: document.getElementById('btnImportXml'),
  btnRebuildSummary: document.getElementById('btnRebuildSummary'),
  btnCloseApuracao: document.getElementById('btnCloseApuracao'),
  btnReopenApuracao: document.getElementById('btnReopenApuracao'),
  btnDeleteApuracao: document.getElementById('btnDeleteApuracao'),
  btnExportDocsPdf: document.getElementById('btnExportDocsPdf'),
  btnExportDocsExcel: document.getElementById('btnExportDocsExcel'),

  xmlFilesInput: document.getElementById('xmlFilesInput'),
  xmlImportModeSelect: document.getElementById('xmlImportModeSelect'),
  xmlImportModeBadge: document.getElementById('xmlImportModeBadge'),

  feedbackBox: document.getElementById('feedbackBox'),

  tbodyApuracoes: document.getElementById('tbodyApuracoes'),
  tbodyDocumentsEntrada: document.getElementById('tbodyDocumentsEntrada'),
  tbodyDocumentsSaida: document.getElementById('tbodyDocumentsSaida'),
  tbodyItems: document.getElementById('tbodyItems'),
  tbodyReconciliation: document.getElementById('tbodyReconciliation'),

  cardIcmsDebit: document.getElementById('cardIcmsDebit'),
  cardIcmsCredit: document.getElementById('cardIcmsCredit'),
  cardIcmsSt: document.getElementById('cardIcmsSt'),
  cardPisPayable: document.getElementById('cardPisPayable'),
  cardCofinsPayable: document.getElementById('cardCofinsPayable'),
  cardIpiPayable: document.getElementById('cardIpiPayable'),
  cardFcp: document.getElementById('cardFcp'),

  cardIcmsDebitBase: document.getElementById('cardIcmsDebitBase'),
  cardIcmsCreditBase: document.getElementById('cardIcmsCreditBase'),
  cardIcmsStBase: document.getElementById('cardIcmsStBase'),
  cardPisBase: document.getElementById('cardPisBase'),
  cardCofinsBase: document.getElementById('cardCofinsBase'),
  cardIpiBase: document.getElementById('cardIpiBase'),
  cardFcpBase: document.getElementById('cardFcpBase'),

  detailApuracaoId: document.getElementById('detailApuracaoId'),
  detailStatus: document.getElementById('detailStatus'),
  detailPeriod: document.getElementById('detailPeriod'),
  detailRegime: document.getElementById('detailRegime'),
  detailIcmsDebit: document.getElementById('detailIcmsDebit'),
  detailIcmsCredit: document.getElementById('detailIcmsCredit'),
  detailIcmsSt: document.getElementById('detailIcmsSt'),
  detailIcmsPayable: document.getElementById('detailIcmsPayable'),
  detailPisDebit: document.getElementById('detailPisDebit'),
  detailPisCredit: document.getElementById('detailPisCredit'),
  detailCofinsDebit: document.getElementById('detailCofinsDebit'),
  detailCofinsCredit: document.getElementById('detailCofinsCredit'),
  detailIpiDebit: document.getElementById('detailIpiDebit'),
  detailIpiCredit: document.getElementById('detailIpiCredit'),
  detailFcpTotal: document.getElementById('detailFcpTotal'),
  detailGrossDocuments: document.getElementById('detailGrossDocuments')
};


/* ======================================================================
   HELPERS
   ====================================================================== */

function moneyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function numberBR(value, digits = 4) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateBR(dateValue) {
  if (!dateValue) return '-';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);

  return date.toLocaleDateString('pt-BR');
}

function setFeedback(message, type = 'success') {
  if (!dom.feedbackBox) return;

  dom.feedbackBox.hidden = false;
  dom.feedbackBox.textContent = message;
  dom.feedbackBox.className = `fa-feedback fa-feedback--${type}`;
}

function clearFeedback() {
  if (!dom.feedbackBox) return;

  dom.feedbackBox.hidden = true;
  dom.feedbackBox.textContent = '';
  dom.feedbackBox.className = 'fa-feedback';
}

function setSelectedApuracaoId(id) {
  const normalizedId = Number(id);

  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    state.selectedApuracaoId = null;
    return;
  }

  state.selectedApuracaoId = normalizedId;
}

function markSelectedApuracaoRow(id) {
  const normalizedId = Number(id);

  dom.tbodyApuracoes
    ?.querySelectorAll('tr[data-apuracao-id]')
    .forEach(row => {
      const rowId = Number(row.dataset.apuracaoId);
      row.classList.toggle('is-selected', rowId === normalizedId);
    });
}

function setButtonLoading(button, loadingText, isLoading) {
  if (!button) return;

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent || '';
  }

  button.disabled = isLoading;
  button.textContent = isLoading
    ? loadingText
    : button.dataset.originalText;
}

function getCurrentFilters() {
  return {
    date_from: dom.dateFromInput?.value?.trim() || '',
    date_to: dom.dateToInput?.value?.trim() || '',
    regime_type: dom.regimeTypeSelect?.value || 'LUCRO_REAL'
  };
}

function validatePeriod() {
  const { date_from, date_to } = getCurrentFilters();

  if (!date_from || !date_to) {
    throw new Error('Informe a data inicial e a data final.');
  }

  if (date_from > date_to) {
    throw new Error('A data inicial não pode ser maior que a data final.');
  }

  return getCurrentFilters();
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...options
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      data?.details ||
      data?.error ||
      `HTTP ${response.status}`
    );
  }

  return data;
}

function statusBadge(status) {
  const s = String(status || '').toUpperCase();

  if (s === 'CLOSED') {
    return `<span class="fa-badge fa-badge--closed">${escapeHtml(s)}</span>`;
  }

  return `<span class="fa-badge fa-badge--open">${escapeHtml(s || 'OPEN')}</span>`;
}

function severityBadge(severity) {
  const s = String(severity || 'MEDIUM').toUpperCase();

  if (s === 'HIGH') {
    return `<span class="fa-badge fa-badge--high">${escapeHtml(s)}</span>`;
  }

  if (s === 'LOW') {
    return `<span class="fa-badge fa-badge--low">${escapeHtml(s)}</span>`;
  }

  return `<span class="fa-badge fa-badge--medium">${escapeHtml(s)}</span>`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function resolveSummaryNumber(summary, keys = [], fallback = 0) {
  for (const key of keys) {
    if (summary && summary[key] != null && summary[key] !== '') {
      return toNumber(summary[key], fallback);
    }
  }
  return fallback;
}

function setBaseLine(element, value) {
  if (!element) return;
  element.textContent = `Base: ${moneyBR(value)}`;
}

function resolveTaxBases(summary = {}) {
  return {
    icmsDebitBase: resolveSummaryNumber(summary, [
      'icms_debit_base',
      'icms_debit_base_total',
      'base_icms_debit',
      'base_icms_debito',
      'icms_base_debit_total',
      'icms_bc_debit_total'
    ]),
    icmsCreditBase: resolveSummaryNumber(summary, [
      'icms_credit_base',
      'icms_credit_base_total',
      'base_icms_credit',
      'base_icms_credito',
      'icms_base_credit_total',
      'icms_bc_credit_total'
    ]),
    icmsStBase: resolveSummaryNumber(summary, [
      'icms_st_base',
      'icms_st_base_total',
      'base_icms_st',
      'bc_icms_st',
      'bc_st_total'
    ]),
    pisBase: resolveSummaryNumber(summary, [
      'pis_base',
      'pis_base_total',
      'base_pis',
      'pis_tax_base',
      'pis_bc_total'
    ]),
    cofinsBase: resolveSummaryNumber(summary, [
      'cofins_base',
      'cofins_base_total',
      'base_cofins',
      'cofins_tax_base',
      'cofins_bc_total'
    ]),
    ipiBase: resolveSummaryNumber(summary, [
      'ipi_base',
      'ipi_base_total',
      'base_ipi',
      'ipi_tax_base',
      'ipi_bc_total'
    ]),
    fcpBase: resolveSummaryNumber(summary, [
      'fcp_base',
      'fcp_base_total',
      'base_fcp',
      'fcp_tax_base',
      'fcp_bc_total'
    ])
  };
}

function normalizeXmlImportMode(value) {
  const mode = String(value || '').trim().toUpperCase();

  if (mode === XML_IMPORT_MODES.ENTRADA) return XML_IMPORT_MODES.ENTRADA;
  if (mode === XML_IMPORT_MODES.SAIDA) return XML_IMPORT_MODES.SAIDA;

  return XML_IMPORT_MODES.AUTO;
}

function getSelectedXmlImportMode() {
  return normalizeXmlImportMode(dom.xmlImportModeSelect?.value);
}

function updateXmlImportModeBadge() {
  if (!dom.xmlImportModeBadge) return;

  const mode = getSelectedXmlImportMode();

  if (mode === XML_IMPORT_MODES.ENTRADA) {
    dom.xmlImportModeBadge.textContent = 'Modo: ENTRADA';
    dom.xmlImportModeBadge.style.background = '#e8f7ee';
    dom.xmlImportModeBadge.style.borderColor = '#b8e3c7';
    dom.xmlImportModeBadge.style.color = '#1f6b3b';
    return;
  }

  if (mode === XML_IMPORT_MODES.SAIDA) {
    dom.xmlImportModeBadge.textContent = 'Modo: SAÍDA';
    dom.xmlImportModeBadge.style.background = '#fff1f1';
    dom.xmlImportModeBadge.style.borderColor = '#f3c4c4';
    dom.xmlImportModeBadge.style.color = '#a33a3a';
    return;
  }

  dom.xmlImportModeBadge.textContent = 'Modo: AUTO';
  dom.xmlImportModeBadge.style.background = '#eef3ff';
  dom.xmlImportModeBadge.style.borderColor = '#d7e2ff';
  dom.xmlImportModeBadge.style.color = '#31456a';
}

function getXmlImportModeLabel(mode) {
  const normalized = normalizeXmlImportMode(mode);

  if (normalized === XML_IMPORT_MODES.ENTRADA) return 'ENTRADA';
  if (normalized === XML_IMPORT_MODES.SAIDA) return 'SAÍDA';
  return 'AUTO';
}

function getDocumentDirection(row = {}) {
  return String(
    row.document_direction ||
    row.direction ||
    row.entry_exit_type ||
    row.document_type ||
    row.source_type ||
    ''
  ).toUpperCase();
}

function splitDocumentsByDirection(rows = []) {
  const entradaRows = [];
  const saidaRows = [];

  for (const row of rows) {
    const direction = getDocumentDirection(row);

    if (
      direction.includes('SAIDA') ||
      direction.includes('SAÍDA') ||
      direction === 'OUT' ||
      direction === 'OUTPUT'
    ) {
      saidaRows.push(row);
    } else {
      entradaRows.push(row);
    }
  }

  return { entradaRows, saidaRows };
}

function buildPartnerButtonCell(row) {
  const partnerName = escapeHtml(row.partner_name || 'Parceiro não informado');

  return `
    <button
      type="button"
      class="fa-btn-partner"
      title="${partnerName}"
      aria-label="Parceiro: ${partnerName}"
    >
      👤
    </button>
  `;
}

function getExportRows() {
  return [
    ...state.currentDocumentsEntrada.map(row => ({
      direcao: 'ENTRADA',
      id: row.fiscal_apuracao_document_id ?? '',
      tipo: row.document_type || '',
      modelo: row.model || '',
      numero: row.number || '',
      data: formatDateBR(row.issue_date),
      parceiro: row.partner_name || '',
      total_nf: Number(row.total_nfe_value || 0),
      icms: Number(row.total_icms_value || 0),
      icms_st: Number(row.total_icms_st_value || 0),
      pis: Number(row.total_pis_value || 0),
      cofins: Number(row.total_cofins_value || 0),
      ipi: Number(row.total_ipi_value || 0)
    })),
    ...state.currentDocumentsSaida.map(row => ({
      direcao: 'SAÍDA',
      id: row.fiscal_apuracao_document_id ?? '',
      tipo: row.document_type || '',
      modelo: row.model || '',
      numero: row.number || '',
      data: formatDateBR(row.issue_date),
      parceiro: row.partner_name || '',
      total_nf: Number(row.total_nfe_value || 0),
      icms: Number(row.total_icms_value || 0),
      icms_st: Number(row.total_icms_st_value || 0),
      pis: Number(row.total_pis_value || 0),
      cofins: Number(row.total_cofins_value || 0),
      ipi: Number(row.total_ipi_value || 0)
    }))
  ];
}

function ensureSelectedApuracaoForExport() {
  if (!state.selectedApuracaoId) {
    throw new Error('Selecione uma apuração primeiro.');
  }
}

function ensureDocumentsForExport() {
  const totalDocs = state.currentDocumentsEntrada.length + state.currentDocumentsSaida.length;
  if (!totalDocs) {
    throw new Error('Não há documentos carregados para exportação.');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildExportFilename(extension) {
  const filters = getCurrentFilters();
  const dateFrom = (filters.date_from || 'sem-data-inicial').replaceAll('-', '');
  const dateTo = (filters.date_to || 'sem-data-final').replaceAll('-', '');
  const apuracaoId = state.selectedApuracaoId || 'sem-id';

  return `fiscal_apuracao_documentos_${apuracaoId}_${dateFrom}_${dateTo}.${extension}`;
}


/* ======================================================================
   RESET
   ====================================================================== */

function resetSummary() {
  state.selectedApuracaoId = null;
  state.currentDocumentsEntrada = [];
  state.currentDocumentsSaida = [];

  markSelectedApuracaoRow(null);

  if (dom.cardIcmsDebit) dom.cardIcmsDebit.textContent = moneyBR(0);
  if (dom.cardIcmsCredit) dom.cardIcmsCredit.textContent = moneyBR(0);
  if (dom.cardIcmsSt) dom.cardIcmsSt.textContent = moneyBR(0);
  if (dom.cardPisPayable) dom.cardPisPayable.textContent = moneyBR(0);
  if (dom.cardCofinsPayable) dom.cardCofinsPayable.textContent = moneyBR(0);
  if (dom.cardIpiPayable) dom.cardIpiPayable.textContent = moneyBR(0);
  if (dom.cardFcp) dom.cardFcp.textContent = moneyBR(0);

  setBaseLine(dom.cardIcmsDebitBase, 0);
  setBaseLine(dom.cardIcmsCreditBase, 0);
  setBaseLine(dom.cardIcmsStBase, 0);
  setBaseLine(dom.cardPisBase, 0);
  setBaseLine(dom.cardCofinsBase, 0);
  setBaseLine(dom.cardIpiBase, 0);
  setBaseLine(dom.cardFcpBase, 0);

  if (dom.detailApuracaoId) dom.detailApuracaoId.textContent = '-';
  if (dom.detailStatus) dom.detailStatus.textContent = '-';
  if (dom.detailPeriod) dom.detailPeriod.textContent = '-';
  if (dom.detailRegime) dom.detailRegime.textContent = '-';
  if (dom.detailIcmsDebit) dom.detailIcmsDebit.textContent = moneyBR(0);
  if (dom.detailIcmsCredit) dom.detailIcmsCredit.textContent = moneyBR(0);
  if (dom.detailIcmsSt) dom.detailIcmsSt.textContent = moneyBR(0);
  if (dom.detailIcmsPayable) dom.detailIcmsPayable.textContent = moneyBR(0);
  if (dom.detailPisDebit) dom.detailPisDebit.textContent = moneyBR(0);
  if (dom.detailPisCredit) dom.detailPisCredit.textContent = moneyBR(0);
  if (dom.detailCofinsDebit) dom.detailCofinsDebit.textContent = moneyBR(0);
  if (dom.detailCofinsCredit) dom.detailCofinsCredit.textContent = moneyBR(0);
  if (dom.detailIpiDebit) dom.detailIpiDebit.textContent = moneyBR(0);
  if (dom.detailIpiCredit) dom.detailIpiCredit.textContent = moneyBR(0);
  if (dom.detailFcpTotal) dom.detailFcpTotal.textContent = moneyBR(0);
  if (dom.detailGrossDocuments) dom.detailGrossDocuments.textContent = moneyBR(0);

  if (dom.tbodyDocumentsEntrada) {
    dom.tbodyDocumentsEntrada.innerHTML = `
      <tr><td colspan="12" class="fa-empty">Nenhum documento de entrada carregado.</td></tr>
    `;
  }

  if (dom.tbodyDocumentsSaida) {
    dom.tbodyDocumentsSaida.innerHTML = `
      <tr><td colspan="12" class="fa-empty">Nenhum documento de saída carregado.</td></tr>
    `;
  }

  if (dom.tbodyItems) {
    dom.tbodyItems.innerHTML = `
      <tr><td colspan="14" class="fa-empty">Nenhum item carregado.</td></tr>
    `;
  }

  if (dom.tbodyReconciliation) {
    dom.tbodyReconciliation.innerHTML = `
      <tr><td colspan="10" class="fa-empty">Nenhuma divergência carregada.</td></tr>
    `;
  }
}


/* ======================================================================
   RENDER
   ====================================================================== */

function renderApuracoes(rows = []) {
  if (!dom.tbodyApuracoes) return;

  if (!Array.isArray(rows) || !rows.length) {
    dom.tbodyApuracoes.innerHTML = `
      <tr><td colspan="8" class="fa-empty">Nenhuma apuração carregada.</td></tr>
    `;
    return;
  }

  dom.tbodyApuracoes.innerHTML = rows.map(row => {
    const rowId = Number(row.fiscal_apuracao_id);
    const isSelected = rowId === Number(state.selectedApuracaoId);

    return `
      <tr data-apuracao-id="${rowId}" class="${isSelected ? 'is-selected' : ''}">
        <td>${row.fiscal_apuracao_id}</td>
        <td>${row.reference_month ?? '-'}</td>
        <td>${row.reference_year ?? '-'}</td>
        <td>${formatDateBR(row.date_from)}</td>
        <td>${formatDateBR(row.date_to)}</td>
        <td>${escapeHtml(row.regime_type || '')}</td>
        <td>${statusBadge(row.status)}</td>
        <td>
          <button class="fa-btn-action" type="button" data-action="view" data-id="${rowId}">
            Ver
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderSummary(data) {
  const header = data?.header || {};
  const summary = data?.summary || {};
  const bases = resolveTaxBases(summary);

  const resolvedId =
    Number(header.fiscal_apuracao_id) ||
    Number(state.selectedApuracaoId) ||
    null;

  setSelectedApuracaoId(resolvedId);
  markSelectedApuracaoRow(resolvedId);

  if (dom.cardIcmsDebit) dom.cardIcmsDebit.textContent = moneyBR(summary.icms_debit_total);
  if (dom.cardIcmsCredit) dom.cardIcmsCredit.textContent = moneyBR(summary.icms_credit_total);
  if (dom.cardIcmsSt) dom.cardIcmsSt.textContent = moneyBR(summary.icms_st_total);
  if (dom.cardPisPayable) dom.cardPisPayable.textContent = moneyBR(summary.pis_payable_total);
  if (dom.cardCofinsPayable) dom.cardCofinsPayable.textContent = moneyBR(summary.cofins_payable_total);
  if (dom.cardIpiPayable) dom.cardIpiPayable.textContent = moneyBR(summary.ipi_payable_total);
  if (dom.cardFcp) dom.cardFcp.textContent = moneyBR(summary.fcp_total);

  setBaseLine(dom.cardIcmsDebitBase, bases.icmsDebitBase);
  setBaseLine(dom.cardIcmsCreditBase, bases.icmsCreditBase);
  setBaseLine(dom.cardIcmsStBase, bases.icmsStBase);
  setBaseLine(dom.cardPisBase, bases.pisBase);
  setBaseLine(dom.cardCofinsBase, bases.cofinsBase);
  setBaseLine(dom.cardIpiBase, bases.ipiBase);
  setBaseLine(dom.cardFcpBase, bases.fcpBase);

  if (dom.detailApuracaoId) dom.detailApuracaoId.textContent = resolvedId ?? '-';
  if (dom.detailStatus) dom.detailStatus.innerHTML = statusBadge(header.status || '-');
  if (dom.detailPeriod) dom.detailPeriod.textContent = `${formatDateBR(header.date_from)} até ${formatDateBR(header.date_to)}`;
  if (dom.detailRegime) dom.detailRegime.textContent = header.regime_type || '-';
  if (dom.detailIcmsDebit) dom.detailIcmsDebit.textContent = moneyBR(summary.icms_debit_total);
  if (dom.detailIcmsCredit) dom.detailIcmsCredit.textContent = moneyBR(summary.icms_credit_total);
  if (dom.detailIcmsSt) dom.detailIcmsSt.textContent = moneyBR(summary.icms_st_total);
  if (dom.detailIcmsPayable) dom.detailIcmsPayable.textContent = moneyBR(summary.icms_payable_total);
  if (dom.detailPisDebit) dom.detailPisDebit.textContent = moneyBR(summary.pis_debit_total);
  if (dom.detailPisCredit) dom.detailPisCredit.textContent = moneyBR(summary.pis_credit_total);
  if (dom.detailCofinsDebit) dom.detailCofinsDebit.textContent = moneyBR(summary.cofins_debit_total);
  if (dom.detailCofinsCredit) dom.detailCofinsCredit.textContent = moneyBR(summary.cofins_credit_total);
  if (dom.detailIpiDebit) dom.detailIpiDebit.textContent = moneyBR(summary.ipi_debit_total);
  if (dom.detailIpiCredit) dom.detailIpiCredit.textContent = moneyBR(summary.ipi_credit_total);
  if (dom.detailFcpTotal) dom.detailFcpTotal.textContent = moneyBR(summary.fcp_total);
  if (dom.detailGrossDocuments) dom.detailGrossDocuments.textContent = moneyBR(summary.gross_documents_total);
}

function renderDocuments(rows = []) {
  const tbodyEntrada = dom.tbodyDocumentsEntrada;
  const tbodySaida = dom.tbodyDocumentsSaida;

  if (!tbodyEntrada || !tbodySaida) return;

  const { entradaRows, saidaRows } = splitDocumentsByDirection(rows);

  state.currentDocumentsEntrada = entradaRows;
  state.currentDocumentsSaida = saidaRows;

  tbodyEntrada.innerHTML = entradaRows.length
    ? entradaRows.map(row => `
      <tr>
        <td>${row.fiscal_apuracao_document_id ?? '-'}</td>
        <td>${escapeHtml(row.document_type || '')}</td>
        <td>${escapeHtml(row.model || '')}</td>
        <td>${escapeHtml(row.number || '')}</td>
        <td>${formatDateBR(row.issue_date)}</td>
        <td>${buildPartnerButtonCell(row)}</td>
        <td>${moneyBR(row.total_nfe_value)}</td>
        <td>${moneyBR(row.total_icms_value)}</td>
        <td>${moneyBR(row.total_icms_st_value)}</td>
        <td>${moneyBR(row.total_pis_value)}</td>
        <td>${moneyBR(row.total_cofins_value)}</td>
        <td>${moneyBR(row.total_ipi_value)}</td>
      </tr>
    `).join('')
    : `
      <tr><td colspan="12" class="fa-empty">Nenhum documento de entrada carregado.</td></tr>
    `;

  tbodySaida.innerHTML = saidaRows.length
    ? saidaRows.map(row => `
      <tr>
        <td>${row.fiscal_apuracao_document_id ?? '-'}</td>
        <td>${escapeHtml(row.document_type || '')}</td>
        <td>${escapeHtml(row.model || '')}</td>
        <td>${escapeHtml(row.number || '')}</td>
        <td>${formatDateBR(row.issue_date)}</td>
        <td>${buildPartnerButtonCell(row)}</td>
        <td>${moneyBR(row.total_nfe_value)}</td>
        <td>${moneyBR(row.total_icms_value)}</td>
        <td>${moneyBR(row.total_icms_st_value)}</td>
        <td>${moneyBR(row.total_pis_value)}</td>
        <td>${moneyBR(row.total_cofins_value)}</td>
        <td>${moneyBR(row.total_ipi_value)}</td>
      </tr>
    `).join('')
    : `
      <tr><td colspan="12" class="fa-empty">Nenhum documento de saída carregado.</td></tr>
    `;
}

function renderItems(rows = []) {
  if (!dom.tbodyItems) return;

  if (!Array.isArray(rows) || !rows.length) {
    dom.tbodyItems.innerHTML = `
      <tr><td colspan="14" class="fa-empty">Nenhum item carregado.</td></tr>
    `;
    return;
  }

  dom.tbodyItems.innerHTML = rows.map(row => `
    <tr>
      <td>${row.item_number ?? '-'}</td>
      <td>${escapeHtml(row.sku || row.product_code || '')}</td>
      <td>${escapeHtml(row.description || '')}</td>
      <td>${escapeHtml(row.ncm_code || '')}</td>
      <td>${escapeHtml(row.cfop || '')}</td>
      <td>${numberBR(row.quantity, 4)}</td>
      <td>${moneyBR(row.net_value)}</td>
      <td>${moneyBR(row.icms_value)}</td>
      <td>${moneyBR(row.icms_st_value)}</td>
      <td>${moneyBR(row.fcp_value)}</td>
      <td>${moneyBR(row.pis_value)}</td>
      <td>${moneyBR(row.cofins_value)}</td>
      <td>${moneyBR(row.ipi_value)}</td>
      <td>${escapeHtml(row.source_type || '')}</td>
    </tr>
  `).join('');
}

function renderReconciliation(rows = []) {
  if (!dom.tbodyReconciliation) return;

  if (!Array.isArray(rows) || !rows.length) {
    dom.tbodyReconciliation.innerHTML = `
      <tr><td colspan="10" class="fa-empty">Nenhuma divergência carregada.</td></tr>
    `;
    return;
  }

  dom.tbodyReconciliation.innerHTML = rows.map(row => `
    <tr>
      <td>${row.fiscal_apuracao_reconciliation_id ?? '-'}</td>
      <td>${escapeHtml(row.divergence_type || '')}</td>
      <td>${severityBadge(row.severity)}</td>
      <td>${escapeHtml(row.document_key || '')}</td>
      <td>${escapeHtml(row.product_code || row.sku || '')}</td>
      <td>${row.expected_value == null ? '-' : moneyBR(row.expected_value)}</td>
      <td>${row.actual_value == null ? '-' : moneyBR(row.actual_value)}</td>
      <td>${row.difference_value == null ? '-' : moneyBR(row.difference_value)}</td>
      <td>${escapeHtml(row.status || '')}</td>
      <td>${escapeHtml(row.details || '')}</td>
    </tr>
  `).join('');
}


/* ======================================================================
   API
   ====================================================================== */

async function apiCreateApuracao(payload) {
  return fetchJSON(`${API_BASE}/fiscal-apuracao`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

async function apiListApuracoes(filters = {}) {
  const params = new URLSearchParams();

  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.regime_type) params.set('regime_type', filters.regime_type);

  const query = params.toString();
  const url = query
    ? `${API_BASE}/fiscal-apuracao?${query}`
    : `${API_BASE}/fiscal-apuracao`;

  return fetchJSON(url);
}

async function apiGetApuracaoById(id) {
  return fetchJSON(`${API_BASE}/fiscal-apuracao/${id}`);
}

async function apiImportXml(apuracaoId, files, xmlImportMode = XML_IMPORT_MODES.AUTO) {
  const formData = new FormData();

  for (const file of files) {
    formData.append('xmlFiles', file);
  }

  const normalizedMode = normalizeXmlImportMode(xmlImportMode);
  formData.append('xmlImportMode', normalizedMode);
  formData.append('document_direction_override', normalizedMode);

  const response = await fetch(`${API_BASE}/fiscal-apuracao/${apuracaoId}/import-xml`, {
    method: 'POST',
    body: formData
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    console.error('[IMPORT XML] status:', response.status);
    console.error('[IMPORT XML] resposta bruta:', text);
    console.error('[IMPORT XML] resposta parseada:', data);

    throw new Error(
      data?.details ||
      data?.error ||
      data?.raw ||
      `HTTP ${response.status}`
    );
  }

  return data;
}

async function apiRebuildSummary(id) {
  return fetchJSON(`${API_BASE}/fiscal-apuracao/${id}/rebuild-summary`, {
    method: 'POST'
  });
}

async function apiCloseApuracao(id) {
  return fetchJSON(`${API_BASE}/fiscal-apuracao/${id}/close`, {
    method: 'PATCH'
  });
}

async function apiReopenApuracao(id) {
  return fetchJSON(`${API_BASE}/fiscal-apuracao/${id}/reopen`, {
    method: 'PATCH'
  });
}

async function apiDeleteApuracao(id) {
  return fetchJSON(`${API_BASE}/fiscal-apuracao/${id}`, {
    method: 'DELETE'
  });
}


/* ======================================================================
   EXPORTS
   ====================================================================== */

function exportDocumentsToExcel() {
  const exportRows = getExportRows();

  const header = [
    'Direção',
    'ID',
    'Tipo',
    'Modelo',
    'Número',
    'Data',
    'Parceiro',
    'Total NF',
    'ICMS',
    'ICMS ST',
    'PIS',
    'COFINS',
    'IPI'
  ];

  const csvLines = [
    header.join(';'),
    ...exportRows.map(row => [
      `"${String(row.direcao).replaceAll('"', '""')}"`,
      `"${String(row.id).replaceAll('"', '""')}"`,
      `"${String(row.tipo).replaceAll('"', '""')}"`,
      `"${String(row.modelo).replaceAll('"', '""')}"`,
      `"${String(row.numero).replaceAll('"', '""')}"`,
      `"${String(row.data).replaceAll('"', '""')}"`,
      `"${String(row.parceiro).replaceAll('"', '""')}"`,
      `"${String(row.total_nf).replace('.', ',').replaceAll('"', '""')}"`,
      `"${String(row.icms).replace('.', ',').replaceAll('"', '""')}"`,
      `"${String(row.icms_st).replace('.', ',').replaceAll('"', '""')}"`,
      `"${String(row.pis).replace('.', ',').replaceAll('"', '""')}"`,
      `"${String(row.cofins).replace('.', ',').replaceAll('"', '""')}"`,
      `"${String(row.ipi).replace('.', ',').replaceAll('"', '""')}"`
    ].join(';'))
  ];

  const csvContent = '\uFEFF' + csvLines.join('\n');
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });

  downloadBlob(blob, buildExportFilename('csv'));
}

function exportDocumentsToPdf() {
  const exportRows = getExportRows();
  const filters = getCurrentFilters();
  const selectedText = state.selectedApuracaoId ? `#${state.selectedApuracaoId}` : '-';
  const periodText = `${filters.date_from || '-'} até ${filters.date_to || '-'}`;
  const totalDocs = exportRows.length;

  const rowsHtml = exportRows.map(row => `
    <tr>
      <td>${escapeHtml(row.direcao)}</td>
      <td>${escapeHtml(row.id)}</td>
      <td>${escapeHtml(row.tipo)}</td>
      <td>${escapeHtml(row.modelo)}</td>
      <td>${escapeHtml(row.numero)}</td>
      <td>${escapeHtml(row.data)}</td>
      <td>${escapeHtml(row.parceiro)}</td>
      <td>${escapeHtml(moneyBR(row.total_nf))}</td>
      <td>${escapeHtml(moneyBR(row.icms))}</td>
      <td>${escapeHtml(moneyBR(row.icms_st))}</td>
      <td>${escapeHtml(moneyBR(row.pis))}</td>
      <td>${escapeHtml(moneyBR(row.cofins))}</td>
      <td>${escapeHtml(moneyBR(row.ipi))}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Documentos Importados</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 18px;
          font-family: Arial, Helvetica, sans-serif;
          color: #0f172a;
        }
        h1 {
          margin: 0 0 6px 0;
          font-size: 20px;
        }
        .meta {
          margin-bottom: 14px;
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          font-size: 11px;
          text-align: left;
          vertical-align: top;
          word-break: break-word;
        }
        th {
          background: #eff6ff;
          color: #1e3a8a;
        }
        tr:nth-child(even) td {
          background: #f8fafc;
        }
        @media print {
          body { margin: 10mm; }
        }
      </style>
    </head>
    <body>
      <h1>Documentos Importados</h1>
      <div class="meta">
        <div><strong>Apuração:</strong> ${escapeHtml(selectedText)}</div>
        <div><strong>Período:</strong> ${escapeHtml(periodText)}</div>
        <div><strong>Total de documentos:</strong> ${escapeHtml(totalDocs)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Direção</th>
            <th>ID</th>
            <th>Tipo</th>
            <th>Modelo</th>
            <th>Número</th>
            <th>Data</th>
            <th>Parceiro</th>
            <th>Total NF</th>
            <th>ICMS</th>
            <th>ICMS ST</th>
            <th>PIS</th>
            <th>COFINS</th>
            <th>IPI</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <script>
        window.onload = function () {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1280,height=900');

  if (!printWindow) {
    throw new Error('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-up.');
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}


/* ======================================================================
   EVENTS
   ====================================================================== */

async function loadApuracoesAndRender() {
  const filters = getCurrentFilters();
  const rows = await apiListApuracoes(filters);
  renderApuracoes(rows);
  return rows;
}

async function loadApuracaoDetails(id) {
  const normalizedId = Number(id);

  if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
    throw new Error('ID da apuração inválido.');
  }

  setSelectedApuracaoId(normalizedId);
  markSelectedApuracaoRow(normalizedId);

  const data = await apiGetApuracaoById(normalizedId);

  renderSummary(data);
  renderDocuments(data.documents || []);
  renderItems(data.items || []);
  renderReconciliation(data.reconciliation || []);
}

async function handleCreateApuracaoClick() {
  try {
    clearFeedback();

    const { date_from, date_to, regime_type } = validatePeriod();

    setButtonLoading(dom.btnCreateApuracao, 'Criando...', true);

    const result = await apiCreateApuracao({
      date_from,
      date_to,
      regime_type
    });

    if (result.created) {
      setFeedback('Apuração criada com sucesso.', 'success');
    } else {
      setFeedback('Já existia uma apuração para este período. Registro carregado.', 'success');
    }

    await loadApuracoesAndRender();

    if (result?.data?.fiscal_apuracao_id) {
      await loadApuracaoDetails(result.data.fiscal_apuracao_id);
    }
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao criar apuração: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnCreateApuracao, 'Criando...', false);
  }
}

async function handleRefreshClick() {
  try {
    clearFeedback();

    setButtonLoading(dom.btnRefreshList, 'Atualizando...', true);

    const rows = await loadApuracoesAndRender();

    if (Array.isArray(rows) && rows.length) {
      const preferredRow = rows.find(row =>
        Number(row.fiscal_apuracao_id) === Number(state.selectedApuracaoId)
      ) || rows[0];

      if (preferredRow?.fiscal_apuracao_id) {
        await loadApuracaoDetails(preferredRow.fiscal_apuracao_id);
      } else {
        resetSummary();
      }
    } else {
      resetSummary();
    }
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao atualizar lista: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnRefreshList, 'Atualizando...', false);
  }
}

function handleImportXmlClick() {
  try {
    clearFeedback();

    if (!state.selectedApuracaoId) {
      throw new Error('Selecione uma apuração primeiro.');
    }

    dom.xmlFilesInput?.click();
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao iniciar importação: ${error.message}`, 'error');
  }
}

async function handleXmlFilesChange(event) {
  try {
    clearFeedback();

    if (!state.selectedApuracaoId) {
      throw new Error('Selecione uma apuração primeiro.');
    }

    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const xmlImportMode = getSelectedXmlImportMode();

    setButtonLoading(dom.btnImportXml, 'Importando...', true);

    const result = await apiImportXml(state.selectedApuracaoId, files, xmlImportMode);

    await loadApuracoesAndRender();
    await loadApuracaoDetails(state.selectedApuracaoId);

    const duplicateCount = Array.isArray(result?.duplicates) ? result.duplicates.length : 0;
    const failedCount = Array.isArray(result?.failed) ? result.failed.length : 0;
    const importedDocuments = Number(result?.imported_documents || 0);
    const importedItems = Number(result?.imported_items || 0);

    setFeedback(
      `Importação concluída (${getXmlImportModeLabel(xmlImportMode)}). Documentos: ${importedDocuments}. Itens: ${importedItems}. Duplicados: ${duplicateCount}. Falhas: ${failedCount}.`,
      'success'
    );
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao importar XML: ${error.message}`, 'error');
  } finally {
    if (dom.xmlFilesInput) {
      dom.xmlFilesInput.value = '';
    }

    setButtonLoading(dom.btnImportXml, 'Importando...', false);
  }
}

async function handleRebuildSummaryClick() {
  try {
    clearFeedback();

    if (!state.selectedApuracaoId) {
      throw new Error('Selecione uma apuração primeiro.');
    }

    setButtonLoading(dom.btnRebuildSummary, 'Recalculando...', true);

    await apiRebuildSummary(state.selectedApuracaoId);
    await loadApuracoesAndRender();
    await loadApuracaoDetails(state.selectedApuracaoId);

    setFeedback('Resumo recalculado com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao recalcular resumo: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnRebuildSummary, 'Recalculando...', false);
  }
}

async function handleCloseApuracaoClick() {
  try {
    clearFeedback();

    if (!state.selectedApuracaoId) {
      throw new Error('Selecione uma apuração primeiro.');
    }

    setButtonLoading(dom.btnCloseApuracao, 'Fechando...', true);

    await apiCloseApuracao(state.selectedApuracaoId);
    await loadApuracoesAndRender();
    await loadApuracaoDetails(state.selectedApuracaoId);

    setFeedback('Apuração fechada com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao fechar apuração: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnCloseApuracao, 'Fechando...', false);
  }
}

async function handleReopenApuracaoClick() {
  try {
    clearFeedback();

    if (!state.selectedApuracaoId) {
      throw new Error('Selecione uma apuração primeiro.');
    }

    setButtonLoading(dom.btnReopenApuracao, 'Reabrindo...', true);

    await apiReopenApuracao(state.selectedApuracaoId);
    await loadApuracoesAndRender();
    await loadApuracaoDetails(state.selectedApuracaoId);

    setFeedback('Apuração reaberta com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao reabrir apuração: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnReopenApuracao, 'Reabrindo...', false);
  }
}

async function handleDeleteApuracaoClick() {
  try {
    clearFeedback();

    if (!state.selectedApuracaoId) {
      throw new Error('Selecione uma apuração primeiro.');
    }

    const confirmed = window.confirm('Deseja realmente excluir esta apuração?');
    if (!confirmed) return;

    setButtonLoading(dom.btnDeleteApuracao, 'Excluindo...', true);

    await apiDeleteApuracao(state.selectedApuracaoId);

    state.selectedApuracaoId = null;
    resetSummary();
    await loadApuracoesAndRender();

    setFeedback('Apuração excluída com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao excluir apuração: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnDeleteApuracao, 'Excluindo...', false);
  }
}

async function handleApuracoesTableClick(event) {
  const button = event.target.closest('button[data-action="view"]');
  if (!button) return;

  const id = Number(button.dataset.id);
  if (!Number.isFinite(id) || id <= 0) return;

  try {
    clearFeedback();

    setSelectedApuracaoId(id);
    markSelectedApuracaoRow(id);

    await loadApuracaoDetails(id);
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao carregar apuração: ${error.message}`, 'error');
  }
}

function handleXmlImportModeChange() {
  updateXmlImportModeBadge();
}

function handleExportDocsPdfClick() {
  try {
    clearFeedback();
    ensureSelectedApuracaoForExport();
    ensureDocumentsForExport();

    setButtonLoading(dom.btnExportDocsPdf, 'Gerando...', true);
    exportDocumentsToPdf();

    setFeedback('Janela de impressão PDF aberta com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao exportar PDF: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnExportDocsPdf, 'Gerando...', false);
  }
}

function handleExportDocsExcelClick() {
  try {
    clearFeedback();
    ensureSelectedApuracaoForExport();
    ensureDocumentsForExport();

    setButtonLoading(dom.btnExportDocsExcel, 'Gerando...', true);
    exportDocumentsToExcel();

    setFeedback('Arquivo EXCEL exportado com sucesso.', 'success');
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao exportar EXCEL: ${error.message}`, 'error');
  } finally {
    setButtonLoading(dom.btnExportDocsExcel, 'Gerando...', false);
  }
}


/* ======================================================================
   DEFAULT PERIOD
   ====================================================================== */

function setDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, '0');

  if (dom.dateFromInput) {
    dom.dateFromInput.value = `${year}-${month}-01`;
  }

  if (dom.dateToInput) {
    dom.dateToInput.value = `${year}-${month}-${lastDay}`;
  }
}


/* ======================================================================
   INIT
   ====================================================================== */

async function init() {
  try {
    resetSummary();
    clearFeedback();
    setDefaultDates();
    updateXmlImportModeBadge();
    await loadApuracoesAndRender();
  } catch (error) {
    console.error(error);
    setFeedback(`Erro ao inicializar módulo: ${error.message}`, 'error');
  }
}

dom.btnCreateApuracao?.addEventListener('click', handleCreateApuracaoClick);
dom.btnRefreshList?.addEventListener('click', handleRefreshClick);
dom.btnImportXml?.addEventListener('click', handleImportXmlClick);
dom.xmlFilesInput?.addEventListener('change', handleXmlFilesChange);
dom.xmlImportModeSelect?.addEventListener('change', handleXmlImportModeChange);
dom.btnRebuildSummary?.addEventListener('click', handleRebuildSummaryClick);
dom.btnCloseApuracao?.addEventListener('click', handleCloseApuracaoClick);
dom.btnReopenApuracao?.addEventListener('click', handleReopenApuracaoClick);
dom.btnDeleteApuracao?.addEventListener('click', handleDeleteApuracaoClick);
dom.btnExportDocsPdf?.addEventListener('click', handleExportDocsPdfClick);
dom.btnExportDocsExcel?.addEventListener('click', handleExportDocsExcelClick);
dom.tbodyApuracoes?.addEventListener('click', handleApuracoesTableClick);

init();