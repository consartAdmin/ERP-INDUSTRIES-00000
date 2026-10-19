'use strict';

import { listCashDocumentTypes } from './accountsReceivable.api.js';
import { $ } from './accountsReceivable.utils.js';

const SELECTS = [
  { selector: '#arDocumentTypeId', placeholder: 'Selecione...' },
  { selector: '#receive_document_type_id', placeholder: '(opcional)' },
];

function rowsFrom(response) {
  if (Array.isArray(response)) return response;

  for (const key of ['rows', 'items', 'data', 'documentTypes']) {
    if (Array.isArray(response?.[key])) return response[key];
  }

  return [];
}

function fillSelect(select, rows, placeholder) {
  if (!select) return;

  const selectedValue = String(select.value ?? '');
  select.replaceChildren(new Option(placeholder, ''));

  rows
    .filter((row) => row && row.is_active !== false && row.id != null && row.name)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR', {
      sensitivity: 'base',
    }))
    .forEach((row) => select.add(new Option(row.name, String(row.id))));

  select.value = selectedValue;
}

function showLoadError() {
  for (const { selector } of SELECTS) {
    const select = $(selector);
    if (select) {
      select.replaceChildren(new Option('Erro ao carregar tipos', ''));
    }
  }
}

export async function initCashDocumentTypeSelects() {
  try {
    const response = await listCashDocumentTypes();
    const rows = rowsFrom(response);

    for (const { selector, placeholder } of SELECTS) {
      fillSelect($(selector), rows, placeholder);
    }
  } catch (error) {
    showLoadError();
    throw error;
  }
}
