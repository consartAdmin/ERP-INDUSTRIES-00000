// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.lookups.js — Lookups                           ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API_BASE } from './reportsProductsStock.utils.js';
import { fetchJSON } from './reportsProductsStock.api.js';

/**
 * Extrai uma lista de diferentes formatos possíveis da API.
 */
function extractRows(response) {
  const data = response?.data ?? response;

  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data)) return data;

  return [];
}

/**
 * Retorna o primeiro valor válido encontrado.
 */
function firstValue(row, fields) {
  for (const field of fields) {
    const value = row?.[field];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return value;
    }
  }

  return null;
}

/**
 * Normaliza grupos, subgrupos, fabricantes e marcas.
 */
function normalizeLookupRows(rows, idFields, nameFields = []) {
  return rows
    .map(row => {
      const id = firstValue(row, idFields);

      const name = firstValue(row, [
        ...nameFields,
        'name',
        'nome',
        'description',
        'descricao',
      ]);

      return {
        id,
        name: String(name ?? '').trim(),
      };
    })
    .filter(row => row.id !== null && row.name !== '');
}

/**
 * Sugestões de fornecedores.
 */
export async function loadSuppliersSuggest(q) {
  const search = String(q ?? '').trim();

  if (search.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: search,
    limit: '20',
  });

  const response = await fetchJSON(
    `${API_BASE}/api/suppliers?${params.toString()}`,
  );

  return extractRows(response)
    .map(row => ({
      id: firstValue(row, [
        'id',
        'supplier_id',
        'fornecedor_id',
        'product_supplier_id',
      ]),

      name: String(
        firstValue(row, [
          'name',
          'nome',
          'company_name',
          'trade_name',
          'corporate_name',
          'razao_social',
          'nome_fantasia',
        ]) ?? '',
      ).trim(),
    }))
    .filter(row => row.id !== null && row.name !== '');
}

/**
 * Carrega os grupos de produtos.
 *
 * Backend:
 * GET /api/products/products-groups
 */
export async function loadGroups() {
  const response = await fetchJSON(
    `${API_BASE}/api/products/products-groups`,
  );

  return normalizeLookupRows(
    extractRows(response),
    [
      'product_group_id',
      'group_id',
      'id',
    ],
  );
}

/**
 * Carrega os subgrupos vinculados ao grupo selecionado.
 *
 * Backend:
 * GET /api/products/products-subgroups?group_id=123
 */
export async function loadSubgroups(groupId) {
  if (
    groupId === undefined ||
    groupId === null ||
    String(groupId).trim() === ''
  ) {
    return [];
  }

  const params = new URLSearchParams({
    group_id: String(groupId),
  });

  const response = await fetchJSON(
    `${API_BASE}/api/products/products-subgroups?${params.toString()}`,
  );

  return normalizeLookupRows(
    extractRows(response),
    [
      'product_subgroup_id',
      'subgroup_id',
      'id',
    ],
  );
}

/**
 * Carrega fabricantes para preencher o filtro visual "Marca".
 *
 * Atenção: o backend usa o nome legado:
 * GET /api/products/products-manufactures
 */
export async function loadBrands() {
  const response = await fetchJSON(
    `${API_BASE}/api/products/products-manufactures`,
  );

  return normalizeLookupRows(
    extractRows(response),
    [
      'product_manufacturer_id',
      'manufacturer_id',
      'manufacture_id',
      'brand_id',
      'id',
    ],
    [
      'manufacturer_name',
      'manufacture_name',
      'brand_name',
    ],
  );
}