// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: inventoryImportXls.js                                         ║
// ║ MODULE: Inventory                                                   ║
// ║ DESCRIPTION: Importação XLS/XLSX para inventário                    ║
// ║ PRODNEX ERP                                                         ║
// ║                                                                      ║
// ║ ✅ Upload de planilha (.xls / .xlsx)                                ║
// ║ ✅ POST /api/inventories/import-xls                                 ║
// ║ ✅ Download de modelo CSV de referência                             ║
// ║ ✅ Modelo simplificado por BARCODE + separador ';'                  ║
// ║ ✅ Mantém barcode como TEXTO para evitar notação científica          ║
// ║ ✅ Backend completa produto/unidade/localização/lote                ║
// ║ ✅ Dispara evento window: inventory:xls-imported                    ║ 
// ║ ✅ Compatível com inventário atual aberto                           ║
// ║ ✅ Tratamento de erro robusto + logs detalhados                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE =
  (typeof window !== 'undefined' && (window.apiBase || window.location.origin)) || '';

const ENDPOINT = `${API_BASE}/api/inventories/import-xls`;
const CSV_SEPARATOR = ';';
const DEBUG_IMPORT_XLS = true;

const TEMPLATE_HEADERS = [
  'barcode',
  'qtd',
  'obs',
];

const TEMPLATE_ROWS = [
  ['sep=;'],
  TEMPLATE_HEADERS,

  // IMPORTANTE:
  // ="789..." força o Excel a tratar o barcode como TEXTO.
  ['="7891234567890"', '10', 'Contagem corredor A'],
  ['="2009638330600"', '5', 'Produto interno / balança'],
];

function $(id) {
  return document.getElementById(id);
}

function log(...args) {
  if (DEBUG_IMPORT_XLS) {
    console.log('[inventoryImportXls]', ...args);
  }
}

function warn(...args) {
  console.warn('[inventoryImportXls]', ...args);
}

function error(...args) {
  console.error('[inventoryImportXls]', ...args);
}

function safeStr(value, max = 500) {
  return String(value ?? '').slice(0, max);
}

function onlyDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function isXlsFile(file) {
  const name = String(file?.name || '').toLowerCase();
  return name.endsWith('.xls') || name.endsWith('.xlsx');
}

function isAllowedImportFile(file) {
  if (!file) return false;

  const name = String(file.name || '').toLowerCase();

  return (
    name.endsWith('.xls') ||
    name.endsWith('.xlsx')
  );
}

function normalizeErrorList(data) {
  if (Array.isArray(data?.errors)) return data.errors;
  if (Array.isArray(data?.warnings)) return data.warnings;
  if (Array.isArray(data?.skipped)) return data.skipped;
  return [];
}

function escapeCsvCell(value) {
  const str = String(value ?? '');

  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function buildCsvContent(rows) {
  return rows
    .map((row) => row.map(escapeCsvCell).join(CSV_SEPARATOR))
    .join('\r\n');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function downloadInventoryTemplateCsv() {
  const csv = buildCsvContent(TEMPLATE_ROWS);

  // BOM para Excel abrir UTF-8 corretamente.
  const content = `\uFEFF${csv}`;

  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8;',
  });

  downloadBlob(blob, 'modelo_importacao_inventario.csv');
}

function buildResultMessage(data) {
  const inventoryId =
    data?.inventory_id ??
    data?.inventoryId ??
    data?.id ??
    '';

  const inventoryCode =
    data?.inventory_code ??
    data?.inventoryCode ??
    data?.code ??
    '';

  const inserted =
    Number(
      data?.imported_items ??
      data?.inserted ??
      data?.created_count ??
      data?.success_count ??
      0
    ) || 0;

  const skipped =
    Number(
      data?.skipped_items ??
      data?.skipped_count ??
      data?.skipped?.length ??
      0
    ) || 0;

  const errorItems =
    Number(
      data?.error_items ??
      data?.errors_count ??
      data?.errors?.length ??
      0
    ) || 0;

  const errs = normalizeErrorList(data);

  let msg = 'Importação concluída!\n';

  if (inventoryId) {
    msg += `Inventário ID: ${inventoryId}\n`;
  }

  if (inventoryCode) {
    msg += `Inventário: ${inventoryCode}\n`;
  }

  msg += `Itens inseridos: ${inserted}\n`;
  msg += `Ignorados: ${skipped}\n`;
  msg += `Erros: ${errorItems}`;

  if (errs.length) {
    const lines = errs.slice(0, 30).map((err) => {
      if (typeof err === 'string') return safeStr(err, 250);

      const line =
        err?.line ??
        err?.row ??
        err?.row_number ??
        '';

      const barcode =
        err?.barcode ??
        err?.ean ??
        err?.codigo_barras ??
        '';

      const barcodeTxt = barcode ? `Barcode ${barcode}: ` : '';
      const lineTxt = line ? `Linha ${line}: ` : '';

      const reason =
        err?.error ||
        err?.reason ||
        err?.message ||
        err?.detail ||
        JSON.stringify(err);

      return safeStr(`${lineTxt}${barcodeTxt}${reason}`, 280);
    });

    msg += `\n\nOcorrências:\n- ${lines.join('\n- ')}`;
  }

  return msg;
}

function detectCurrentInventoryId() {
  const id1 = window?.inventoryState?.currentId;
  if (id1) return String(id1);

  const id2 = window?.currentInventoryId;
  if (id2) return String(id2);

  const id3 = localStorage.getItem('inventory.currentId');
  if (id3) return String(id3);

  const inputCandidates = [
    'inventory_id',
    'inventoryId',
    'currentInventoryId',
    'inputInventoryId',
  ];

  for (const id of inputCandidates) {
    const el = $(id);
    const value = String(el?.value || '').trim();
    if (value) return value;
  }

  return '';
}

async function parseResponseJson(res) {
  const text = await res.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      raw: text,
      message: safeStr(text, 1000),
    };
  }
}

function appendSafeDebugFields(form, file) {
  const currentInventoryId = detectCurrentInventoryId();

  if (currentInventoryId) {
    form.append('inventory_id', currentInventoryId);
  }

  form.append('generate_pdf', 'true');
  form.append('barcode_normalize', 'digits');
  form.append('source_module', 'inventoryImportXls');
  form.append('original_filename', file?.name || '');
}

async function postImportXls(file) {
  if (!file) {
    throw new Error('Nenhum arquivo selecionado.');
  }

  if (!isAllowedImportFile(file)) {
    throw new Error('Selecione um arquivo .xls ou .xlsx.');
  }

  const form = new FormData();
  form.append('file', file);
  appendSafeDebugFields(form, file);

  log('POST import:', {
    endpoint: ENDPOINT,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    currentInventoryId: detectCurrentInventoryId(),
  });

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    body: form,
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';

  log('response:', {
    status: res.status,
    ok: res.ok,
    contentType,
  });

  if (contentType.includes('application/pdf')) {
    const blob = await res.blob();

    downloadBlob(
      blob,
      `relatorio-importacao-inventario-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );

    return {
      ok: true,
      pdf_downloaded: true,
      message: 'PDF da importação gerado com sucesso.',
    };
  }

  const data = await parseResponseJson(res);

  log('response data:', data);

  if (!res.ok || data?.ok === false) {
    const baseMessage =
      data?.error ||
      data?.message ||
      data?.raw ||
      `Falha ao importar XLS (HTTP ${res.status}).`;

    const errs = normalizeErrorList(data);

    const details = errs.length
      ? `\n\n- ${errs
          .slice(0, 30)
          .map((e) =>
            safeStr(
              typeof e === 'string'
                ? e
                : e?.error ||
                    e?.reason ||
                    e?.message ||
                    e?.detail ||
                    JSON.stringify(e),
              250
            )
          )
          .join('\n- ')}`
      : '';

    throw new Error(`${baseMessage}${details}`);
  }

  return data;
}

function setLoading(isLoading) {
  const btn = $('btnImportInventoryXls');

  if (!btn) return;

  btn.disabled = !!isLoading;
  btn.dataset.loading = isLoading ? '1' : '0';
  btn.textContent = isLoading ? 'Importando...' : 'Importar XLS';
}

function resetFileInput(input) {
  if (!input) return;
  input.value = '';
}

function wireImportButton() {
  const btn = $('btnImportInventoryXls');
  const input = $('inputImportInventoryXls');

  if (!btn || !input) {
    warn('Botão ou input de importação não encontrado.', {
      btn: !!btn,
      input: !!input,
    });
    return;
  }

  btn.addEventListener('click', () => {
    input.click();
  });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    resetFileInput(input);

    if (!file) return;

    if (!isXlsFile(file)) {
      alert('Selecione um arquivo .xls ou .xlsx');
      return;
    }

    try {
      setLoading(true);

      const data = await postImportXls(file);

      window.dispatchEvent(
        new CustomEvent('inventory:xls-imported', {
          detail: data,
        })
      );

      if (data?.pdf_downloaded) {
        alert('Importação concluída e PDF baixado com sucesso.');
      } else {
        alert(buildResultMessage(data));
      }
    } catch (err) {
      error('Import XLS error:', err);
      alert(safeStr(err?.message || 'Erro ao importar XLS.', 2000));
    } finally {
      setLoading(false);
    }
  });
}

function wireTemplateButton() {
  const btn = $('btnDownloadInventoryTemplate');

  if (!btn) {
    warn('Botão de modelo de importação não encontrado.');
    return;
  }

  btn.addEventListener('click', () => {
    downloadInventoryTemplateCsv();
  });
}

function wireUI() {
  wireImportButton();
  wireTemplateButton();
}

document.addEventListener('DOMContentLoaded', wireUI);