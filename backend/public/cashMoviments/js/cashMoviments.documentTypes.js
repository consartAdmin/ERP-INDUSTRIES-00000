// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.documentTypes.js — Tipos de documento do Caixa       ║
// ║ PRODNEX ERP | Selects dinâmicos                                     ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const API_BASE = String(
  window.API_BASE ||
  window.apiBase ||
  window.location.origin
).replace(/\/$/, '');

const DOCUMENT_TYPES_ENDPOINT =
  `${API_BASE}/api/cash-document-types?activeOnly=true`;

let documentTypesCache = [];

/**
 * Converte diferentes formatos de resposta da API em array.
 */
function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;

  return [];
}

/**
 * Renderiza os tipos de documento dentro de um select.
 */
export function populateDocumentTypeSelect(
  select,
  rows,
  {
    selectedValue = '',
    placeholder = 'Selecione...',
  } = {}
) {
  if (!select) return;

  const previousValue =
    selectedValue !== null && selectedValue !== undefined
      ? String(selectedValue)
      : String(select.value || '');

  select.replaceChildren();

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  placeholderOption.selected = !previousValue;

  select.appendChild(placeholderOption);

  rows.forEach((row) => {
    const id = Number.parseInt(row?.id, 10);
    const name = String(row?.name ?? '').trim();

    if (!Number.isInteger(id) || id <= 0 || !name) {
      return;
    }

    const option = document.createElement('option');
    option.value = String(id);
    option.textContent = name;

    if (String(id) === previousValue) {
      option.selected = true;
    }

    select.appendChild(option);
  });

  select.disabled = false;
}

/**
 * Busca no backend somente tipos de documento ativos.
 */
export async function fetchCashDocumentTypes({ force = false } = {}) {
  if (!force && documentTypesCache.length) {
    return documentTypesCache;
  }

  const response = await fetch(DOCUMENT_TYPES_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(
      payload?.error ||
      `Erro HTTP ${response.status} ao carregar tipos de documento.`
    );
  }

  documentTypesCache = normalizeRows(payload)
    .filter((row) => row?.is_active !== false)
    .sort((a, b) =>
      String(a?.name ?? '').localeCompare(
        String(b?.name ?? ''),
        'pt-BR',
        { sensitivity: 'base' }
      )
    );

  return documentTypesCache;
}

/**
 * Carrega os selects de cadastro e edição.
 */
export async function loadCashDocumentTypeSelects({
  selectedCreateId = '',
  selectedEditId = '',
  force = false,
} = {}) {
  const createSelect = document.querySelector('#tipoDocumentoFiscal');
  const editSelect = document.querySelector('#edit_tipoDocumento');

  [createSelect, editSelect].forEach((select) => {
    if (!select) return;

    select.disabled = true;
    select.replaceChildren();

    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Carregando...';
    option.selected = true;

    select.appendChild(option);
  });

  try {
    const rows = await fetchCashDocumentTypes({ force });

    populateDocumentTypeSelect(createSelect, rows, {
      selectedValue: selectedCreateId,
    });

    populateDocumentTypeSelect(editSelect, rows, {
      selectedValue: selectedEditId,
    });

    return rows;
  } catch (error) {
    console.error(
      '[cashMoviments.documentTypes] Erro ao carregar tipos:',
      error
    );

    [createSelect, editSelect].forEach((select) => {
      if (!select) return;

      select.disabled = false;
      select.replaceChildren();

      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Erro ao carregar';
      option.selected = true;

      select.appendChild(option);
    });

    return [];
  }
}

/**
 * Define o tipo selecionado no cadastro.
 */
export function setCreateDocumentType(documentTypeId) {
  const select = document.querySelector('#tipoDocumentoFiscal');

  if (select) {
    select.value = documentTypeId
      ? String(documentTypeId)
      : '';
  }
}

/**
 * Define o tipo selecionado no modal de edição.
 */
export function setEditDocumentType(documentTypeId) {
  const select = document.querySelector('#edit_tipoDocumento');

  if (select) {
    select.value = documentTypeId
      ? String(documentTypeId)
      : '';
  }
}