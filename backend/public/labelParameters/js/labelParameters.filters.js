import { $ } from './labelParameters.utils.js';

export function readFilters() {
  const params = new URLSearchParams();
  const active = $('#filterActive')?.value;
  if (active === 'true' || active === 'false') params.set('active', active);
  return params;
}

export function readLabelSearch() {
  return $('#filterLabelName')?.value?.trim()?.toLocaleLowerCase('pt-BR') || '';
}
