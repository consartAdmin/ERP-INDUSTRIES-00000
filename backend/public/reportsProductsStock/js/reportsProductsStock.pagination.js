// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.pagination.js — Paginação e footer             ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { getEls, qsa } from './reportsProductsStock.dom.js';
import { fmtNumber, fmtMoney, fmtInt } from './reportsProductsStock.utils.js';
import { state } from './reportsProductsStock.state.js';

export function setFooter({ total = null, page = null, pages = null, sumStock = null, sumCost = null } = {}) {
  const els = getEls();

  if (els.lblTotalItens) {
    els.lblTotalItens.textContent = Number.isFinite(Number(total)) ? `${Number(total)} item(ns)` : '— item(ns)';
  }

  if (els.lblPagina) {
    els.lblPagina.textContent =
      Number.isFinite(Number(page)) && Number.isFinite(Number(pages))
        ? `Página ${Number(page)} de ${Number(pages)}`
        : 'Página — de —';
  }

  if (els.lblTotEstoque) {
    els.lblTotEstoque.textContent = `Total estoque: ${Number.isFinite(Number(sumStock)) ? fmtNumber(sumStock) : '—'}`;
  }

  if (els.lblTotCusto) {
    els.lblTotCusto.textContent = `Total (custo): ${Number.isFinite(Number(sumCost)) ? fmtMoney(sumCost) : '—'}`;
  }
}

export function renderPagination({ total, page, limit, onPageChange }) {
  const els = getEls();
  if (!els.paginacao) return;

  state.page = page;
  state.limit = limit;

  const pages = Math.max(Math.ceil((total || 0) / (limit || 1)), 1);

  const mk = (p, label = p, disabled = false, current = false) => `
    <button class="btn btn-toolbar btn-sm pg ${current ? 'is-active' : ''}"
      data-p="${p}" ${disabled ? 'disabled' : ''} type="button">${label}</button>
  `;

  let html = '';
  html += mk(1, '« Primeiro', page === 1);
  html += mk(Math.max(1, page - 1), '‹ Anterior', page === 1);

  const win = 5;
  let start = Math.max(1, page - Math.floor(win / 2));
  let end = Math.min(pages, start + win - 1);
  start = Math.max(1, end - win + 1);

  for (let p = start; p <= end; p++) html += mk(p, String(p), false, p === page);

  html += mk(Math.min(pages, page + 1), 'Próxima ›', page === pages);
  html += mk(pages, 'Última »', page === pages);

  els.paginacao.innerHTML = html;

  qsa('button.pg', els.paginacao).forEach(btn => {
    btn.addEventListener('click', () => {
      const p = fmtInt(btn.dataset.p, 1);
      if (p !== state.page && typeof onPageChange === 'function') {
        onPageChange(p);
      }
    });
  });

  setFooter({ total: Number(total) || 0, page: state.page, pages });
}