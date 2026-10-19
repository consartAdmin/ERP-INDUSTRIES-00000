// ╔════════════════════════════════════════════════════════════╗
// ║ pcpMrp.js — Necessidade de materiais (MRP simples)         ║
// ╚════════════════════════════════════════════════════════════╝

import {
  pcpApi, escapeHtml, fmtNum, fmtMoney, fmtDate,
  paginate, bindPagination, renderPagination,
} from '/public/pcp/js/pcp.common.js';

const $ = (id) => document.getElementById(id);
const PAGER = { info: 'mrpTableInfo', pageInfo: 'mrpPageInfo', prev: 'mrpPrevPage', next: 'mrpNextPage', size: 'mrpRowsPerPage' };
const state = { rows: [], page: 1, pageSize: 50 };

function filtered() {
  const q = $('search').value.trim().toLowerCase();
  const only = $('onlyShortage').checked;
  return state.rows.filter((r) =>
    (!only || Number(r.qty_to_buy) > 0) &&
    (!q || `${r.component_code} ${r.description || ''}`.toLowerCase().includes(q)));
}

function render() {
  const rows = filtered();
  const pg = paginate(rows, state);
  $('tableBody').innerHTML = pg.slice.length ? pg.slice.map((r) => {
    const buy = Number(r.qty_to_buy);
    return `<tr>
      <td><strong>${escapeHtml(r.component_code)}</strong></td>
      <td>${escapeHtml(r.description || '—')}</td>
      <td class="num">${fmtNum(r.qty_needed, 4)}</td>
      <td class="num">${fmtNum(r.stock_qty, 4)}</td>
      <td class="num">${fmtNum(r.stock_min, 4)}</td>
      <td class="num">${buy > 0 ? `<span class="pcp-badge pcp-badge--shortage">${fmtNum(buy, 4)}</span>` : '0'}</td>
      <td class="num">${fmtMoney(buy * Number(r.cost_price))}</td>
      <td class="num">${r.orders_count}</td>
      <td class="center">${fmtDate(r.first_due_date)}</td>
    </tr>`;
  }).join('')
    : `<tr><td colspan="9" class="pcp-table-empty">${$('onlyShortage').checked
      ? 'Nada a comprar: o estoque cobre as OPs abertas.'
      : 'Nenhuma OP aberta com materiais.'}</td></tr>`;
  renderPagination(PAGER, pg, state, 'componentes');
  const total = rows.reduce((s, r) => s + Number(r.qty_to_buy) * Number(r.cost_price), 0);
  $('mrpTotal').textContent = fmtMoney(total);
}

async function load() {
  try {
    state.rows = await pcpApi('/mrp') || [];
    render();
  } catch (e) {
    $('tableBody').innerHTML = `<tr><td colspan="9" class="pcp-table-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

function exportCsv() {
  const head = ['componente', 'descricao', 'necessario', 'estoque', 'estoque_minimo', 'comprar', 'custo_unitario', 'ops', 'primeira_entrega'];
  const num = (v) => String(Number(v) || 0).replace('.', ',');
  const lines = filtered().map((r) => [
    r.component_code, (r.description || '').replaceAll(';', ','), num(r.qty_needed), num(r.stock_qty),
    num(r.stock_min), num(r.qty_to_buy), num(r.cost_price), r.orders_count, fmtDate(r.first_due_date),
  ].join(';'));
  const blob = new Blob(['﻿' + [head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mrp-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('btnRefresh').addEventListener('click', load);
$('btnExport').addEventListener('click', exportCsv);
$('search').addEventListener('input', () => { state.page = 1; render(); });
$('onlyShortage').addEventListener('change', () => { state.page = 1; render(); });
bindPagination(state, PAGER, render);
load();
