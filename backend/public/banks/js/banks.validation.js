'use strict';
export function validateBank(data) {
  if (!String(data.name || '').trim()) throw new Error('Informe o nome do banco.');
  if (String(data.name).trim().length > 150) throw new Error('O nome deve ter no máximo 150 caracteres.');
  if (data.code && String(data.code).trim().length > 10) throw new Error('O código deve ter no máximo 10 caracteres.');
  return true;
}
