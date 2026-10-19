// ╔════════════════════════════════════════════════════════════════════╗
// ║ debts.paymentCash.js — Pagamento → Movimentações (caixa)           ║
// ║ Conta, Categoria, Subcategoria, Conta Contábil e Anexos da SAÍDA   ║
// ║ que o backend cria junto com cada pagamento de dívida              ║
// ╚════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE, fetchJSON } from './debts.api.js';
import {
  fetchBankAccounts,
  populateBankAccountSelect,
} from '/public/cashMoviments/js/cashMoviments.bankAccounts.js';
import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';

const ALLOWED_FILES = /\.(pdf|xml|png|jpe?g|webp)$/i;

const $ = (id) => document.getElementById(id);

let initPromise = null;
let selectedFiles = [];

function fillSelect(select, rows, placeholder = 'Selecione...') {
  if (!select) return;
  select.innerHTML = '';

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = placeholder;
  select.appendChild(empty);

  rows.forEach((row) => {
    const option = document.createElement('option');
    option.value = String(row.id);
    option.textContent = row.nome ?? row.name ?? String(row.id);
    select.appendChild(option);
  });
}

async function loadSubcategories(categoryId, selectedId = '') {
  const select = $('payment_cash_subcategory');
  if (!select) return;

  if (!categoryId) {
    fillSelect(select, []);
    return;
  }

  try {
    const rows = await fetchJSON(
      `${API_BASE}/caixa/subcategorias?categoria_id=${encodeURIComponent(categoryId)}`
    );
    fillSelect(select, Array.isArray(rows) ? rows : []);
    if (selectedId) select.value = String(selectedId);
  } catch (error) {
    console.warn('[debts][caixa] subcategorias', error);
    fillSelect(select, []);
  }
}

function renderFiles() {
  const label = $('payment_cash_files_label');
  if (!label) return;

  label.textContent = selectedFiles.length
    ? selectedFiles.map((file) => file.name).join(', ')
    : 'Nenhum arquivo';
  label.title = label.textContent;
  label.style.color = selectedFiles.length ? '#0f2747' : '#64748b';
  label.style.fontWeight = selectedFiles.length ? '600' : '';
}

function addFiles(fileList) {
  const files = [...(fileList || [])];
  const valid = files.filter((file) => ALLOWED_FILES.test(file.name));

  if (valid.length < files.length) {
    window.alert('Formato não permitido. Use PDF, XML, PNG, JPG, JPEG ou WEBP.');
  }

  selectedFiles = [...selectedFiles, ...valid];
  renderFiles();
}

function bindEvents() {
  $('payment_cash_category')?.addEventListener('change', (event) => {
    loadSubcategories(event.target.value);
  });

  $('payment_cash_chart_search')?.addEventListener('click', async () => {
    const conta = await openChartAccountsModalSearch({ onlyPosting: true, onlyActive: true });
    if (!conta) return;

    $('payment_cash_chart_id').value = conta.id ?? '';
    $('payment_cash_chart_label').value = `${conta.code ?? ''} - ${conta.description ?? ''}`;
  });

  const fileInput = $('payment_cash_files');
  $('payment_cash_files_btn')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  $('payment_cash_files_clear')?.addEventListener('click', () => {
    selectedFiles = [];
    renderFiles();
  });

  const drop = $('payment_cash_files_box');
  drop?.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('is-dragover');
  });
  drop?.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
  drop?.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('is-dragover');
    addFiles(event.dataTransfer?.files);
  });
}

/** Carrega Contas e Categorias uma única vez. */
export function initPaymentCashFields() {
  initPromise ??= (async () => {
    bindEvents();

    try {
      const accounts = await fetchBankAccounts();
      populateBankAccountSelect($('payment_cash_account'), accounts);
    } catch (error) {
      console.warn('[debts][caixa] contas', error);
    }

    try {
      const categories = await fetchJSON(`${API_BASE}/caixa/categorias`);
      fillSelect($('payment_cash_category'), Array.isArray(categories) ? categories : []);
    } catch (error) {
      console.warn('[debts][caixa] categorias', error);
    }
  })();

  return initPromise;
}

/** Pré-preenche com a última SAÍDA desta dívida ou do mesmo credor. */
export async function applyPaymentCashDefaults(debtId) {
  await initPaymentCashFields();

  selectedFiles = [];
  renderFiles();

  let defaults = {};
  try {
    const res = await fetchJSON(`${API_BASE}/debts/${debtId}/payments/cash-defaults`);
    defaults = res?.data || {};
  } catch (error) {
    console.warn('[debts][caixa] padrões', error);
  }

  await setPaymentCashValues(defaults);
}

/** Preenche Conta, Categoria, Subcategoria e Conta Contábil do modal. */
export async function setPaymentCashValues(defaults = {}) {
  await initPaymentCashFields();

  const account = $('payment_cash_account');
  if (account) account.value = defaults.bank_account_id ? String(defaults.bank_account_id) : '';

  const category = $('payment_cash_category');
  if (category) category.value = defaults.category_id ? String(defaults.category_id) : '';
  await loadSubcategories(category?.value, defaults.subcategory_id || '');

  $('payment_cash_chart_id').value = defaults.chart_account_id || '';
  $('payment_cash_chart_label').value = defaults.chart_account_id
    ? `${defaults.chart_account_code ?? ''} - ${defaults.chart_account_description ?? ''}`
    : '';
}

/** Escolhas do modal que vão para a SAÍDA do caixa. */
export function getPaymentCashPayload() {
  return {
    bank_account_id: $('payment_cash_account')?.value || null,
    category_id: $('payment_cash_category')?.value || null,
    subcategory_id: $('payment_cash_subcategory')?.value || null,
    chart_account_id: $('payment_cash_chart_id')?.value || null,
  };
}

export function hasPaymentCashFiles() {
  return selectedFiles.length > 0;
}

// Mesmo endpoint do cadastro em Movimentações (upload passa pelo servidor;
// o PUT direto no bucket esbarra no CORS do navegador). O arquivo fica na
// pasta debts/ do bucket e é vinculado à movimentação do pagamento.
async function uploadOne(movId, file) {
  const formData = new FormData();
  formData.append('movId', String(movId));
  formData.append('basePrefix', 'debts');
  formData.append('arquivo', file, file.name);

  const res = await fetch(`${API_BASE}/upload/anexo`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.details || body?.detail || body?.message || body?.error || '';
    throw new Error(`Falha ao enviar ${file.name} (${res.status})${detail ? `: ${detail}` : ''}`);
  }

  return res.json().catch(() => null);
}

/**
 * Envia os anexos escolhidos para a movimentação do pagamento
 * (POST /api/upload/anexo, o mesmo do cadastro em Movimentações).
 * @returns {Promise<{ sent: number, failed: string[] }>}
 */
export async function uploadPaymentCashFiles(movId) {
  const files = selectedFiles;
  const failed = [];

  for (const file of files) {
    try {
      await uploadOne(movId, file);
    } catch (error) {
      console.error('[debts][caixa] anexo', file.name, error);
      failed.push(file.name);
    }
  }

  selectedFiles = [];
  renderFiles();

  return { sent: files.length - failed.length, failed };
}
