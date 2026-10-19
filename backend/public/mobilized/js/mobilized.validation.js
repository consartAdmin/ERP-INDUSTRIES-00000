'use strict';

export function validateMobilized(payload) {
  if (!payload.title) return 'Título é obrigatório.';
  return null;
}

export function validateItem(payload) {
  if (!payload.description) return 'Descrição do item é obrigatória.';
  if (payload.quantity < 0) return 'A quantidade não pode ser negativa.';
  return null;
}

