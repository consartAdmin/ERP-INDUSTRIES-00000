'use strict';

import {
  listCashCategories,
  listCashSubcategories,
} from './accountsReceivable.api.js';

import { $ } from './accountsReceivable.utils.js';

const SELECT_PAIRS = [
  {
    category: '#arCategoryId',
    subcategory: '#arSubcategoryId',
    placeholder: 'Selecione...',
  },
  {
    category: '#receive_categoria',
    subcategory: '#receive_subcategoria',
    placeholder: '(opcional)',
  },
];

let categories = [];
let subcategories = [];

function rowsFrom(response, keys) {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
  }

  return [];
}

function activeRows(rows) {
  return rows.filter((row) => row && row.is_active !== false);
}

function sortByName(rows) {
  return [...rows].sort((a, b) =>
    String(a.name ?? '').localeCompare(String(b.name ?? ''), 'pt-BR', {
      sensitivity: 'base',
    })
  );
}

function replaceOptions(select, rows, placeholder, selectedValue = '') {
  if (!select) return;

  const normalizedSelectedValue = String(selectedValue ?? '');
  select.replaceChildren(new Option(placeholder, ''));

  for (const row of sortByName(rows)) {
    if (row.id == null || !row.name) continue;
    select.add(new Option(row.name, String(row.id)));
  }

  select.value = normalizedSelectedValue;
}

function subcategoriesFor(categoryId) {
  const normalizedCategoryId = String(categoryId ?? '');

  if (!normalizedCategoryId) return [];

  return subcategories.filter(
    (subcategory) =>
      String(subcategory.category_id ?? subcategory.categoryId ?? '') ===
      normalizedCategoryId
  );
}

function fillSubcategories(pair, selectedValue = '') {
  const categorySelect = $(pair.category);
  const subcategorySelect = $(pair.subcategory);

  replaceOptions(
    subcategorySelect,
    subcategoriesFor(categorySelect?.value),
    pair.placeholder,
    selectedValue
  );

  if (subcategorySelect) {
    subcategorySelect.disabled = !categorySelect?.value;
  }
}

function bindPair(pair) {
  const categorySelect = $(pair.category);

  if (!categorySelect || categorySelect.dataset.cashCategoriesBound === 'true') {
    return;
  }

  categorySelect.dataset.cashCategoriesBound = 'true';
  categorySelect.addEventListener('change', () => fillSubcategories(pair));
}

function showLoadError() {
  for (const pair of SELECT_PAIRS) {
    const categorySelect = $(pair.category);
    const subcategorySelect = $(pair.subcategory);

    if (categorySelect) {
      categorySelect.replaceChildren(
        new Option('Erro ao carregar categorias', '')
      );
    }

    if (subcategorySelect) {
      subcategorySelect.replaceChildren(
        new Option('Selecione uma categoria', '')
      );
      subcategorySelect.disabled = true;
    }
  }
}

export async function initCashCategorySelects() {
  let categoriesResponse;
  let subcategoriesResponse;

  try {
    [categoriesResponse, subcategoriesResponse] = await Promise.all([
      listCashCategories(),
      listCashSubcategories(),
    ]);
  } catch (error) {
    showLoadError();
    throw error;
  }

  categories = activeRows(
    rowsFrom(categoriesResponse, ['rows', 'items', 'data', 'categories'])
  );

  subcategories = activeRows(
    rowsFrom(subcategoriesResponse, [
      'rows',
      'items',
      'data',
      'subcategories',
    ])
  );

  for (const pair of SELECT_PAIRS) {
    const categorySelect = $(pair.category);
    const selectedCategory = categorySelect?.value ?? '';
    const selectedSubcategory = $(pair.subcategory)?.value ?? '';

    replaceOptions(
      categorySelect,
      categories,
      pair.placeholder,
      selectedCategory
    );

    fillSubcategories(pair, selectedSubcategory);
    bindPair(pair);
  }
}

export function refreshCashSubcategorySelect(categorySelector) {
  const pair = SELECT_PAIRS.find(({ category }) => category === categorySelector);
  if (pair) fillSubcategories(pair, $(pair.subcategory)?.value ?? '');
}
