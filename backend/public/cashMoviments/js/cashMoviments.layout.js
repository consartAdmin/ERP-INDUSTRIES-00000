// ╔══════════════════════════════════════════════════════════════════════╗
// ║ caixa.layout.js — Ajuste de altura/scroll da tabela                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export function fitMovsHeight() {
  const wrapper = document.querySelector('.movs-card .tabela-wrapper');
  if (!wrapper) return;

  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const cardTop = wrapper.getBoundingClientRect().top;
  const margin = 24;

  const target = Math.max(200, vh - cardTop - margin);
  wrapper.style.maxHeight = `${target}px`;
  wrapper.style.overflow = 'auto';
}

export function ensureFitMovsHeightGlobal() {
  // mantém compatibilidade com seu código/HTML
  window.__fitMovsHeight = fitMovsHeight;
}