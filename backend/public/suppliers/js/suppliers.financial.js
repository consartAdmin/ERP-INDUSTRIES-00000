import { qs, showToast } from './suppliers.utils.js';
import { openChartAccountsModalSearch } from '/public/modalsSearch/chartAccountsModalSearch.js';

const ENDPOINTS = Object.freeze({
  categories: '/api/accounts-receivable/cash-categories',
  subcategories: '/api/accounts-receivable/cash-subcategories',
});

const cache = {
  categories: [],
  subcategories: [],
};

function rowsFromResponse(json) {
  const data = json?.data ?? json;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function fetchRows(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || json?.message || `Erro ao consultar ${url}.`);
  }
  return rowsFromResponse(json);
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

function replaceOptions(select, placeholder, rows, valueGetter, labelGetter) {
  if (!select) return;
  select.replaceChildren(new Option(placeholder, ''));
  rows.forEach((row) => {
    const value = valueGetter(row);
    if (value === null || value === undefined || value === '') return;
    select.add(new Option(labelGetter(row), String(value)));
  });
}

function isActive(row) {
  return row?.is_active !== false && row?.active !== false;
}

export function syncSupplierSubcategories(selectedValue = null) {
  const categorySelect = qs('#cash_category_id');
  const subcategorySelect = qs('#cash_subcategory_id');
  if (!categorySelect || !subcategorySelect) return;

  const categoryId = String(categorySelect.value || '');
  const available = cache.subcategories.filter((row) => {
    const rowCategoryId = firstValue(row, ['categoria_id', 'category_id', 'cash_category_id']);
    return isActive(row) && categoryId && String(rowCategoryId) === categoryId;
  });

  replaceOptions(
    subcategorySelect,
    categoryId ? 'Selecione...' : 'Selecione uma categoria...',
    available,
    (row) => firstValue(row, ['id', 'subcategory_id', 'cash_subcategory_id']),
    (row) => String(firstValue(row, ['nome', 'name', 'description']) || 'Subcategoria')
  );

  subcategorySelect.disabled = !categoryId;
  if (selectedValue !== null && selectedValue !== undefined) {
    subcategorySelect.value = String(selectedValue);
  }
}

export async function initializeSupplierFinancialFields() {
  const categorySelect = qs('#cash_category_id');
  if (!categorySelect) return;

  categorySelect.disabled = true;

  try {
    const [categories, subcategories] = await Promise.all([
      fetchRows(ENDPOINTS.categories),
      fetchRows(ENDPOINTS.subcategories),
    ]);

    cache.categories = categories.filter(isActive);
    cache.subcategories = subcategories;

    replaceOptions(
      categorySelect,
      'Selecione...',
      cache.categories,
      (row) => firstValue(row, ['id', 'category_id', 'cash_category_id']),
      (row) => String(firstValue(row, ['nome', 'name', 'description']) || 'Categoria')
    );

    syncSupplierSubcategories(null);
  } catch (error) {
    console.error('[suppliers:financial] Erro:', error);
    await showToast(error.message || 'Erro ao carregar a classificação financeira.', 'error');
  } finally {
    categorySelect.disabled = false;
  }
}

export function clearSupplierChartAccount() {
  const idInput = qs('#chart_account_id');
  const displayInput = qs('#chart_account_display');
  if (idInput) idInput.value = '';
  if (displayInput) displayInput.value = '';
}

export async function searchSupplierChartAccount() {
  const idInput = qs('#chart_account_id');
  const displayInput = qs('#chart_account_display');
  if (!idInput || !displayInput) return;

  try {
    const selected = await openChartAccountsModalSearch({
      query: displayInput.value || '',
      onlyPosting: true,
      onlyActive: true,
    });

    if (!selected) return;

    const id = firstValue(selected, ['id', 'chart_account_id']);
    if (!id) throw new Error('A conta selecionada não possui um ID válido.');

    const code = firstValue(selected, ['code', 'codigo']);
    const description = firstValue(selected, ['description', 'descricao', 'name', 'nome']);
    idInput.value = String(id);
    displayInput.value = [code, description].filter(Boolean).join(' - ');
  } catch (error) {
    console.error('[suppliers:chart-account-search] Erro:', error);
    await showToast(error.message || 'Erro ao selecionar a conta contábil.', 'error');
  }
}
