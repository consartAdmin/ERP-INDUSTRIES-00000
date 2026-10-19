// ╔══════════════════════════════════════════════════════════════════════╗
// ║ bankAccountsBalance.init.js — Saldos Bancários (conferências)        ║
// ║ PRODNEX ERP | Frontend (ESM)                                         ║
// ║ - Cards: saldo atual de cada conta + total                           ║
// ║ - Histórico de conferências (extrato × sistema × diferença)          ║
// ║ - Modal "Conferir saldo" com prévia do saldo calculado pelo sistema  ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import * as api from './bankAccountsBalance.api.js';
import {
  $, fmtBRL, fmtDate, todayIso,
  renderCards, renderTable, renderAccountOptions,
} from './bankAccountsBalance.render.js';

const state = {
  accounts: [],
  preview: null, // resultado de /calculate para a conta/data do modal
  previewSeq: 0,
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function notify(variant, title, message) {
  return showCenterModal({ variant, title: escapeHtml(title), message: escapeHtml(message) });
}

/* =========================================================================
   CARREGAMENTO
========================================================================= */

async function loadSummary() {
  try {
    const { data } = await api.getSummary();
    state.accounts = data.items;
    renderCards(data, { onCheck: (accountId) => openModal({ bank_account_id: accountId }) });
    renderAccountOptions($('#babFilterAccount'), state.accounts, { withAll: true });
    renderAccountOptions($('#babAccount'), state.accounts);
  } catch (error) {
    $('#babCards').textContent = 'Não foi possível carregar os saldos.';
    notify('error', 'Erro ao carregar saldos', error.message);
  }
}

async function loadCheckpoints() {
  const params = new URLSearchParams();
  const accountId = $('#babFilterAccount').value;
  const from = $('#babFilterFrom').value;
  const to = $('#babFilterTo').value;
  if (accountId) params.set('bank_account_id', accountId);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  try {
    const { data } = await api.listCheckpoints(params);
    renderTable(data, { onEdit: (row) => openModal(row), onDelete: removeCheckpoint });
  } catch (error) {
    renderTable([], { onEdit() {}, onDelete() {} });
    notify('error', 'Erro ao listar conferências', error.message);
  }
}

async function reloadAll() {
  await loadSummary();
  await loadCheckpoints();
}

/* =========================================================================
   MODAL
========================================================================= */

let escapeHandler = null;

function openModal(record = {}) {
  const modal = $('#babModal');
  const editing = Boolean(record.id);

  $('#babModalTitle').textContent = editing ? 'Editar Conferência de Saldo' : 'Conferir Saldo';
  $('#babId').value = record.id || '';
  $('#babAccount').value = String(record.bank_account_id || state.accounts[0]?.bank_account_id || '');
  $('#babAccount').disabled = editing; // conta não muda na edição
  $('#babDate').value = record.balance_date || todayIso();
  $('#babDate').max = todayIso();
  $('#babBalance').value = record.balance != null ? Number(record.balance).toFixed(2) : '';
  $('#babNotes').value = record.notes || '';

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  escapeHandler = (event) => { if (event.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escapeHandler);

  refreshPreview();
  setTimeout(() => $('#babBalance').focus(), 30);
}

function closeModal() {
  const modal = $('#babModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  if (escapeHandler) document.removeEventListener('keydown', escapeHandler);
  escapeHandler = null;
}

/** Busca no servidor o saldo que o sistema calcula para conta/data */
async function refreshPreview() {
  const box = $('#babPreview');
  const bankAccountId = $('#babAccount').value;
  const date = $('#babDate').value;
  state.preview = null;

  if (!bankAccountId || !date) { box.replaceChildren(); return; }

  const seq = ++state.previewSeq;
  box.textContent = 'Calculando saldo do sistema...';

  try {
    const { data } = await api.calculateBalance({
      bankAccountId,
      date,
      excludeId: $('#babId').value || null,
    });
    if (seq !== state.previewSeq) return;
    state.preview = data;
    renderPreview();
  } catch (error) {
    if (seq !== state.previewSeq) return;
    box.textContent = `Não foi possível calcular o saldo: ${error.message}`;
  }
}

function renderPreview() {
  const box = $('#babPreview');
  const data = state.preview;
  if (!data) return;
  box.replaceChildren();

  if (data.balance === null) {
    const strong = document.createElement('strong');
    strong.textContent = 'Primeira conferência desta conta. ';
    box.append(
      strong,
      `O saldo informado será o ponto de partida: a partir de ${fmtDate(data.date)} `
      + 'o sistema soma as entradas e subtrai as saídas do Caixa.',
    );
    return;
  }

  const base = data.base_checkpoint;
  const line1 = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = fmtBRL(data.balance);
  line1.append(`Saldo calculado pelo sistema em ${fmtDate(data.date)}: `, strong);

  const line2 = document.createElement('div');
  line2.textContent = `Base: conferência de ${fmtDate(base.balance_date)} (${fmtBRL(base.balance)}) `
    + `+ ${fmtBRL(data.entradas)} entradas − ${fmtBRL(data.saidas)} saídas `
    + `(${data.movements} movimentações).`;

  box.append(line1, line2);

  const typed = $('#babBalance').value;
  if (typed !== '') {
    const diff = Math.round((Number(typed) - data.balance) * 100) / 100;
    const line3 = document.createElement('div');
    line3.className = `bab-preview__diff bab-diff ${Math.abs(diff) < 0.005 ? 'bab-diff--ok' : 'bab-diff--bad'}`;
    line3.textContent = Math.abs(diff) < 0.005
      ? '✓ Extrato e sistema conferem.'
      : `⚠ Diferença: ${diff > 0 ? '+' : ''}${fmtBRL(diff)} (extrato − sistema). `
        + 'Verifique movimentações faltando ou duplicadas no Caixa.';
    box.append(line3);
  }
}

async function submitForm(event) {
  event.preventDefault();

  const id = $('#babId').value;
  const payload = {
    bank_account_id: Number($('#babAccount').value) || null,
    balance_date: $('#babDate').value,
    balance: $('#babBalance').value,
    notes: $('#babNotes').value.trim() || null,
  };

  if (!payload.bank_account_id) return notify('warning', 'Conta obrigatória', 'Selecione a conta bancária.');
  if (!payload.balance_date) return notify('warning', 'Data obrigatória', 'Informe a data da conferência.');
  if (payload.balance_date > todayIso()) return notify('warning', 'Data inválida', 'A data não pode ser futura.');
  if (payload.balance === '' || !Number.isFinite(Number(payload.balance))) {
    return notify('warning', 'Saldo obrigatório', 'Informe o saldo mostrado no extrato do banco.');
  }
  payload.balance = Number(payload.balance);

  const submit = document.querySelector('button[form="babForm"]');
  submit.disabled = true;
  try {
    const { data } = id
      ? await api.updateCheckpoint(id, payload)
      : await api.createCheckpoint(payload);
    closeModal();
    await reloadAll();

    const diff = data.difference === null ? null : Number(data.difference);
    if (diff === null) {
      notify('success', 'Saldo inicial registrado', `${data.bank_account_name}: ${fmtBRL(data.balance)} em ${fmtDate(data.balance_date)}.`);
    } else if (Math.abs(diff) < 0.005) {
      notify('success', 'Saldo conferido', `${data.bank_account_name}: extrato e sistema conferem.`);
    } else {
      notify('warning', 'Conferência com diferença', `${data.bank_account_name}: diferença de ${fmtBRL(diff)} entre o extrato e o sistema.`);
    }
  } catch (error) {
    notify('error', 'Erro ao salvar conferência', error.message);
  } finally {
    submit.disabled = false;
  }
}

async function removeCheckpoint(row) {
  const confirmed = await showCenterModal({
    variant: 'warning',
    title: 'Excluir conferência',
    message: `Excluir a conferência de <b>${escapeHtml(row.bank_account_name)}</b> em `
      + `<b>${fmtDate(row.balance_date)}</b> (${escapeHtml(fmtBRL(row.balance))})?`,
    okText: 'Sim, excluir',
    closeText: 'Cancelar',
  });
  if (confirmed !== true) return;

  try {
    await api.deleteCheckpoint(row.id);
    await reloadAll();
  } catch (error) {
    notify('error', 'Erro ao excluir conferência', error.message);
  }
}

/* =========================================================================
   EVENTOS
========================================================================= */

function bindEvents() {
  document.querySelectorAll('#babModal [data-modal-close]').forEach((node) => {
    node.addEventListener('click', closeModal);
  });
  $('#babForm').addEventListener('submit', submitForm);
  $('#babAccount').addEventListener('change', refreshPreview);
  $('#babDate').addEventListener('change', refreshPreview);
  $('#babBalance').addEventListener('input', renderPreview);

  $('#babNew').addEventListener('click', () => openModal({
    bank_account_id: Number($('#babFilterAccount').value) || undefined,
  }));

  $('#babFilterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    loadCheckpoints();
  });
  $('#babFilterClear').addEventListener('click', () => {
    $('#babFilterAccount').value = '';
    $('#babFilterFrom').value = '';
    $('#babFilterTo').value = '';
    loadCheckpoints();
  });
}

async function init() {
  bindEvents();
  await reloadAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
