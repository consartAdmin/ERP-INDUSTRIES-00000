// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.utils.js — Funções auxiliares                            ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function currentYear() {
  return new Date().getFullYear();
}

export function currentMonth() {
  return new Date().getMonth() + 1;
}

export function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function intFmt(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

export function qs(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function errorMessage(error, fallback = 'Ocorreu um erro inesperado.') {
  return error instanceof Error && error.message ? error.message : fallback;
}
