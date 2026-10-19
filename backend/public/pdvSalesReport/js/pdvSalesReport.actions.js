import { buildCsvUrl, buildPdfUrl, fetchReport } from './pdvSalesReport.api.js';
import { buildQueryParams, clearFilters, elements } from './pdvSalesReport.form.js';
import { showError } from './pdvSalesReport.modal.js';
import { renderActiveTab, renderSummary, renderTabSelection } from './pdvSalesReport.render.js';
import { getCurrentTab, setCurrentTab, setReportData } from './pdvSalesReport.state.js';
import { isValidTab, validateFilters } from './pdvSalesReport.validation.js';

export async function loadReport() {
  try {
    const params = buildQueryParams();
    validateFilters(params);
    const data = await fetchReport(params);
    setReportData(data);
    renderSummary(data.summary);
    renderActiveTab();
  } catch (error) {
    console.error('[pdvSalesReport] loadReport error:', error);
    showError(error.message || 'Erro ao carregar o relatório de vendas PDV.');
  }
}

export function resetFilters() {
  clearFilters();
  return loadReport();
}

export function setActiveTab(tabKey) {
  if (!isValidTab(tabKey)) return;
  setCurrentTab(tabKey);
  renderTabSelection(tabKey);
  renderActiveTab();
}

export function openPdf(mode) {
  window.open(buildPdfUrl(buildQueryParams(), mode), '_blank', 'noopener');
}

export function exportCsvCurrentView() {
  const viewByTab = { day: 'day', customer: 'customer', product: 'coupon' };
  window.open(
    buildCsvUrl(buildQueryParams(), viewByTab[getCurrentTab()] || 'day'),
    '_blank',
    'noopener'
  );
}

/**
 * Obtém o nome do ZIP enviado pelo backend.
 */
function getDownloadFilename(response) {
  const disposition = response.headers.get('Content-Disposition');

  if (!disposition) {
    return `xmls-pdv-${new Date().toISOString().slice(0, 10)}.zip`;
  }

  const utf8Match = disposition.match(
    /filename\*=UTF-8''([^;]+)/i
  );

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const filenameMatch = disposition.match(
    /filename="?([^";]+)"?/i
  );

  return filenameMatch?.[1] ||
    `xmls-pdv-${new Date().toISOString().slice(0, 10)}.zip`;
}

/**
 * Extrai uma mensagem de erro da resposta do backend.
 */
async function getResponseError(response) {
  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json().catch(() => null);

    if (data?.details) {
      return `${data.error || 'Erro no servidor'}: ${data.details}`;
    }

    return (
      data?.error ||
      data?.message ||
      'Não foi possível baixar os XMLs.'
    );
  }

  return (
    (await response.text().catch(() => '')) ||
    'Não foi possível baixar os XMLs.'
  );
}

/**
 * Baixa os XMLs autorizados de acordo com os filtros atuais.
 */
export async function downloadXmls() {
  const button = elements.btnDownloadXmls;

  if (!button) {
    console.error(
      '[PDV XML] Botão #btn-download-xmls não encontrado.'
    );

    return;
  }

  const originalContent = button.innerHTML;

  try {
    button.disabled = true;
    button.innerHTML = '⏳ Preparando XMLs...';

    const params = new URLSearchParams();

    const startDate = elements.filterDateStart?.value?.trim();
    const endDate = elements.filterDateEnd?.value?.trim();
    const month = elements.filterMonth?.value?.trim();
    const year = elements.filterYear?.value?.trim();

    if (startDate) {
      params.set('startDate', startDate);
    }

    if (endDate) {
      params.set('endDate', endDate);
    }

    if (month) {
      params.set('month', month);
    }

    if (year) {
      params.set('year', year);
    }

    const queryString = params.toString();

    const url = queryString
      ? `/api/reports/pdv-sales/xml?${queryString}`
      : '/api/reports/pdv-sales/xml';

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/zip'
      },
      credentials: 'same-origin'
    });

    if (!response.ok) {
      throw new Error(await getResponseError(response));
    }

    const zipBlob = await response.blob();

    if (!zipBlob.size) {
      throw new Error(
        'O servidor retornou um arquivo ZIP vazio.'
      );
    }

    const filename = getDownloadFilename(response);
    const objectUrl = URL.createObjectURL(zipBlob);
    const downloadLink = document.createElement('a');

    try {
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();
    } finally {
      downloadLink.remove();

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    }
  } catch (error) {
    console.error('[PDV XML] Erro:', error);

    window.alert(
      error instanceof Error
        ? error.message
        : 'Erro ao baixar os XMLs.'
    );
  } finally {
    button.disabled = false;
    button.innerHTML = originalContent;
  }
}