'use strict';

const PROVIDERS = { ASAAS: 'Asaas', MANUAL: 'Manual', OTHER_API: 'Outra API' };

export const $ = (selector, root = document) => root.querySelector(selector);

export function fmtBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function fmtDate(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Diferença: 0 = conferido, ≠ 0 = divergência, null = sem base (1ª conferência) */
export function diffElement(difference) {
  if (difference === null || difference === undefined) {
    return el('span', 'bab-diff bab-diff--none', 'Saldo inicial');
  }
  const n = Number(difference);
  if (Math.abs(n) < 0.005) return el('span', 'bab-diff bab-diff--ok', '✓ R$ 0,00');
  return el('span', 'bab-diff bab-diff--bad', `⚠ ${n > 0 ? '+' : ''}${fmtBRL(n)}`);
}

export function renderCards(summary, { onCheck }) {
  const box = $('#babCards');
  box.replaceChildren();

  for (const item of summary.items) {
    const card = el('article', 'bab-card');

    const head = el('div', 'bab-card__head');
    head.append(
      el('span', 'bab-card__name', item.name),
      el('span', 'bab-card__badge', PROVIDERS[item.integration_provider] || item.integration_provider || '—'),
    );
    card.append(head, el('span', 'bab-card__label', `Saldo em ${fmtDate(summary.date)}`));

    if (item.current_balance === null) {
      card.append(
        el('span', 'bab-card__value bab-card__value--empty', 'Sem conferência'),
        el('span', 'bab-card__meta', 'Informe o saldo do extrato para iniciar o controle.'),
      );
    } else {
      const value = el('span', 'bab-card__value', fmtBRL(item.current_balance));
      if (item.current_balance < 0) value.classList.add('bab-card__value--negative');
      card.append(value);

      const last = item.last_checkpoint;
      const meta = el('span', 'bab-card__meta');
      meta.append(`Última conferência: ${fmtDate(last.balance_date)} · `, diffElement(last.difference));
      card.append(
        meta,
        el(
          'span',
          'bab-card__meta',
          `Desde então: +${fmtBRL(item.entradas_since_checkpoint)} / −${fmtBRL(item.saidas_since_checkpoint)} (${item.movements_since_checkpoint} mov.)`,
        ),
      );
    }

    const actions = el('div', 'bab-card__actions');
    const btn = el('button', 'btn btn-toolbar btn-sm', '🧾 Conferir saldo');
    btn.type = 'button';
    btn.addEventListener('click', () => onCheck(item.bank_account_id));
    actions.append(btn);
    card.append(actions);

    box.append(card);
  }

  const total = el('article', 'bab-card bab-card--total');
  total.append(
    el('span', 'bab-card__name', 'Total das contas'),
    el('span', 'bab-card__label', `Saldo em ${fmtDate(summary.date)}`),
  );
  const totalValue = el('span', 'bab-card__value', fmtBRL(summary.total_balance));
  if (summary.total_balance < 0) totalValue.classList.add('bab-card__value--negative');
  total.append(totalValue);
  if (summary.accounts_without_checkpoint) {
    total.append(el(
      'span',
      'bab-card__meta',
      `${summary.accounts_without_checkpoint} conta(s) sem conferência não entram no total.`,
    ));
  }
  box.append(total);
}

export function renderTable(rows, { onEdit, onDelete }) {
  const tbody = $('#babTableBody');
  tbody.replaceChildren();

  if (!rows.length) {
    const cell = tbody.insertRow().insertCell();
    cell.colSpan = 8;
    cell.textContent = 'Nenhuma conferência registrada.';
  }

  for (const row of rows) {
    const tr = tbody.insertRow();
    tr.insertCell().textContent = fmtDate(row.balance_date);
    tr.insertCell().textContent = row.bank_account_name;
    tr.insertCell().append(el('span', 'bab-money', fmtBRL(row.balance)));
    tr.insertCell().append(el(
      'span',
      'bab-money',
      row.system_balance === null ? '—' : fmtBRL(row.system_balance),
    ));
    tr.insertCell().append(diffElement(row.difference));
    const notes = tr.insertCell();
    notes.textContent = row.notes || '—';
    if (row.notes) notes.title = row.notes;
    tr.insertCell().textContent = row.created_by || '—';

    const actions = tr.insertCell();
    const edit = el('button', 'btn btn-toolbar btn-sm', '✏️ Editar');
    edit.type = 'button';
    edit.addEventListener('click', () => onEdit(row));
    const remove = el('button', 'btn btn-toolbar btn-sm', '🗑 Excluir');
    remove.type = 'button';
    remove.addEventListener('click', () => onDelete(row));
    actions.append(edit, remove);
  }

  $('#babTableInfo').textContent = `${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`;
}

export function renderAccountOptions(select, accounts, { withAll = false } = {}) {
  const current = select.value;
  select.replaceChildren();
  if (withAll) select.add(new Option('Todas', ''));
  for (const account of accounts) {
    select.add(new Option(account.name, String(account.bank_account_id)));
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}
