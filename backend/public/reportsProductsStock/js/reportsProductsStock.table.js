// ╔══════════════════════════════════════════════════════════════════════╗
// ║ reportsProductsStock.table.js — Tabela                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { qs } from './reportsProductsStock.dom.js';
import { fmtMoney, fmtNumber, sanitize } from './reportsProductsStock.utils.js';

export function mapRow(r) {
  const id = r.product_id ?? r.id ?? r.produto_id ?? null;
  const code = r.product_code ?? r.code ?? r.sku ?? '';
  const desc = r.description ?? r.descricao ?? '';
  const cost = Number(r.cost_price ?? r.cost ?? r.preco_custo ?? 0);
  const stock = Number(r.stock_qty ?? r.stock ?? r.estoque ?? 0);

  const costOk = Number.isFinite(cost) ? cost : 0;
  const stockOk = Number.isFinite(stock) ? stock : 0;

  return {
    id,
    code,
    desc,
    cost: costOk,
    stock: stockOk,
    total: costOk * stockOk,
  };
}

export function sortRows(rows, order) {
  const out = [...(rows || [])];
  const byText = (a, b, k, dir = 1) => String(a[k] || '').localeCompare(String(b[k] || ''), 'pt-BR') * dir;
  const byNum = (a, b, k, dir = 1) => ((Number(a[k]) || 0) - (Number(b[k]) || 0)) * dir;

  switch (order) {
    case 'description_desc': out.sort((a, b) => byText(a, b, 'desc', -1)); break;
    case 'stock_desc': out.sort((a, b) => byNum(a, b, 'stock', -1)); break;
    case 'stock_asc': out.sort((a, b) => byNum(a, b, 'stock', 1)); break;
    case 'cost_desc': out.sort((a, b) => byNum(a, b, 'cost', -1)); break;
    case 'cost_asc': out.sort((a, b) => byNum(a, b, 'cost', 1)); break;
    case 'total_desc': out.sort((a, b) => byNum(a, b, 'total', -1)); break;
    case 'total_asc': out.sort((a, b) => byNum(a, b, 'total', 1)); break;
    default: out.sort((a, b) => byText(a, b, 'desc', 1)); break;
  }

  return out;
}

export function renderTable(rows) {
  const tbody = qs('#tableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!rows?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum item encontrado.</td></tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-id">${sanitize(r.id ?? '')}</td>
      <td class="col-code">${sanitize(r.code || '')}</td>
      <td class="col-desc">${sanitize(r.desc || '')}</td>
      <td class="col-cost text-right">${fmtMoney(r.cost)}</td>
      <td class="col-stock text-right">${fmtNumber(r.stock)}</td>
      <td class="col-total text-right">${fmtMoney(r.total)}</td>
    `;
    tbody.appendChild(tr);
  }
}