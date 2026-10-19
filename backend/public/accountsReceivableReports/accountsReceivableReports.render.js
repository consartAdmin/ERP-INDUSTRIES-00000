const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '—';
const text = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

export function renderSummary(data = {}) {
  const cards = [
    ['Total vendido', money(data.sales_total)], ['A receber', money(data.receivable_total)],
    ['Recebido', money(data.received_total)], ['Saldo aberto', money(data.outstanding_total)],
    ['Saldo vencido', money(data.overdue_total)], ['Sem conta', Number(data.without_receivable_count || 0)],
    ['Divergências', Number(data.divergent_count || 0)],
  ];
  document.querySelector('#arrSummary').innerHTML = cards.map(([label, value]) => `<article class="arr-card"><span>${label}</span><strong>${value}</strong></article>`).join('');
}

export function renderRows(items = []) {
  document.querySelector('#arrTableBody').innerHTML = items.length ? items.map((row) => `<tr>
    <td>${text(row.order_number || row.order_id)}</td><td>${date(row.issue_date)}</td><td title="${text(row.customer_name)}">${text(row.customer_name)}</td><td>${text(row.nfe_number || '—')}</td>
    <td>${money(row.sale_total)}</td><td>${text(row.invoice_number || '—')}</td><td>${date(row.due_date)}</td><td>${money(row.receivable_value)}</td>
    <td>${money(row.received_value)}</td><td>${money(row.balance)}</td><td class="${Math.abs(Number(row.difference)) > .01 ? 'arr-danger' : ''}">${money(row.difference)}</td>
    <td><span class="arr-status arr-status--${text(String(row.reconciliation_status).toLowerCase())}">${text(row.reconciliation_status)}</span></td></tr>`).join('') : '<tr><td colspan="12" class="arr-empty">Nenhuma venda encontrada.</td></tr>';
}

export function renderPagination(state) {
  document.querySelector('#apTableInfo').textContent = `${state.total} Registro(s)`;
  document.querySelector('#apPageInfo').textContent = `Página ${state.page} de ${state.totalPages}`;
  document.querySelector('#btnPreviousPage').disabled = state.page <= 1 || state.loading;
  document.querySelector('#btnNextPage').disabled = state.page >= state.totalPages || state.loading;
}

export function showMessage(message = '') {
  const box = document.querySelector('#arrMessage'); box.hidden = !message; box.textContent = message;
}
