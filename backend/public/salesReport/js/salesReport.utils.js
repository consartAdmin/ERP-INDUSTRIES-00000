'use strict';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function safeTrim(value) {
  return String(value ?? '').trim();
}

export function moneyBR(value) {
  const number = Number(value || 0);
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function normalizeIdLike(inputValue, datasetValue) {
  const datasetId = safeTrim(datasetValue);
  if (datasetId) return datasetId;

  const rawValue = safeTrim(inputValue);
  if (!rawValue) return '';

  const match = rawValue.match(/^(\d+)\s*[-–]/);
  return match?.[1] || rawValue;
}

export function appendCell(row, value) {
  const cell = document.createElement('td');
  cell.textContent = String(value ?? '');
  row.appendChild(cell);
  return cell;
}

export function buildQuery(filters = {}, extra = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value !== null && value !== undefined && value !== '') {
      params.append(key, String(value));
    }
  }

  return params.toString();
}
