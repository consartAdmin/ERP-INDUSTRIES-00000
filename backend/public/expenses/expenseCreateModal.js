// ╔══════════════════════════════════════════════════════════════════════╗
// ║ expenseCreateModal.js — Modal Criar/Editar Despesa (ESM)             ║
// ║ Path: public/expenses/expenseCreateModal.js                          ║
// ║ PRODNEX ERP | Frontend (ESM)                                         ║
// ║                                                                      ║
// ║ ✔ Compatível com id="fornBusca" no HTML                             ║
// ║ ✔ Não gera mais erro el.vendor is null                               ║
// ║ ✔ Busca fornecedor via modal                                         ║
// ║ ✔ Seguro contra null                                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { openSuppliersModalSearch } from '/public/modalsSearch/suppliersModalSearch.js';

/* =========================================================
   Helpers
========================================================= */

function parseMoneyInputBR(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const norm = s.replace(/\./g, '').replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v) {
  const s = String(v ?? '').toLowerCase();
  return ['true','1','yes','sim','y'].includes(s);
}

/* =========================================================
   Factory
========================================================= */

export function createExpenseCreateModal({
  onCreate,
  onUpdate,
  onDelete,
  onAfterSave = async () => {},
  onAfterDelete = async () => {},
} = {}) {

  if (typeof onCreate !== 'function') throw new Error('onCreate é obrigatório');
  if (typeof onUpdate !== 'function') throw new Error('onUpdate é obrigatório');
  if (typeof onDelete !== 'function') throw new Error('onDelete é obrigatório');

  /* =========================================================
     DOM (seguro contra null)
  ========================================================= */

  const el = {
    modalLayer: document.getElementById('modalLayer'),
    modalTitle: document.getElementById('modalTitle'),
    modalSub: document.getElementById('modalSub'),
    btnClose: document.getElementById('btnClose'),
    btnCancel: document.getElementById('btnCancel'),
    btnSave: document.getElementById('btnSave'),
    btnDelete: document.getElementById('btnDelete'),
    form: document.getElementById('formExpense'),

    id: document.getElementById('id'),
    expense_id: document.getElementById('expense_id'),
    name: document.getElementById('name'),
    description: document.getElementById('description'),
    value: document.getElementById('value'),
    due_date: document.getElementById('due_date'),
    competence_month: document.getElementById('competence_month'),
    competence_year: document.getElementById('competence_year'),
    category: document.getElementById('category'),
    cost_center: document.getElementById('cost_center'),

    // ⚠️ AGORA USANDO fornBusca
    vendor: document.getElementById('fornBusca'),
    btnVendorPick: document.getElementById('btnFornBusca'),

    recurrence_type: document.getElementById('recurrence_type'),
    status: document.getElementById('status'),
    paid_date: document.getElementById('paid_date'),
    payment_method: document.getElementById('payment_method'),
    account_payable_id: document.getElementById('account_payable_id'),
    is_active: document.getElementById('is_active'),
    payload: document.getElementById('payload'),
  };

  if (!el.modalLayer || !el.form) {
    throw new Error('Modal HTML não encontrado.');
  }

  let mode = 'create';

  /* =========================================================
     Core
  ========================================================= */

  function open() {
    el.modalLayer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    el.modalLayer.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function resetDefaults() {
    el.form.reset();
    el.id.value = '';
    el.expense_id.value = '';
    el.is_active.value = 'true';
    el.status.value = 'PENDING';
    el.recurrence_type.value = 'MONTHLY';
    el.payload.value = '';

    if (el.vendor) el.vendor.value = '';
  }

  function openCreate() {
    mode = 'create';
    el.modalTitle.textContent = 'Nova Despesa';
    el.modalSub.textContent = 'Preencha os campos e salve.';
    el.btnDelete.classList.add('hidden');
    resetDefaults();
    open();
    setTimeout(() => el.name?.focus?.(), 0);
  }

  function openEdit(row = {}) {
    mode = 'edit';
    el.btnDelete.classList.remove('hidden');

    el.modalTitle.textContent = `Editar Despesa #${row.id ?? ''}`;
    el.modalSub.textContent = 'Altere os campos e salve.';

    fillForm(row);
    open();
  }

  function fillForm(row = {}) {
    el.id.value = row.id ?? '';
    el.expense_id.value = row.expense_id ?? '';
    el.name.value = row.name ?? '';
    el.description.value = row.description ?? '';
    el.value.value = row.value ?? '';
    el.due_date.value = row.due_date ? String(row.due_date).slice(0,10) : '';
    el.competence_month.value = row.competence_month ?? '';
    el.competence_year.value = row.competence_year ?? '';
    el.category.value = row.category ?? '';
    el.cost_center.value = row.cost_center ?? '';
    if (el.vendor) el.vendor.value = row.vendor ?? '';
    el.recurrence_type.value = row.recurrence_type || 'MONTHLY';
    el.status.value = row.status || 'PENDING';
    el.paid_date.value = row.paid_date ? String(row.paid_date).slice(0,10) : '';
    el.payment_method.value = row.payment_method ?? '';
    el.account_payable_id.value = row.account_payable_id ?? '';
    el.is_active.value = String(!!row.is_active);
    el.payload.value = row.payload ? JSON.stringify(row.payload, null, 2) : '';
  }

  function readFormPayload() {
    return {
      name: el.name.value.trim(),
      description: el.description.value.trim() || null,
      value: parseMoneyInputBR(el.value.value),
      due_date: el.due_date.value || null,
      competence_month: parseIntOrNull(el.competence_month.value),
      competence_year: parseIntOrNull(el.competence_year.value),
      category: el.category.value.trim() || null,
      cost_center: el.cost_center.value.trim() || null,
      vendor: el.vendor?.value?.trim() || null,
      recurrence_type: el.recurrence_type.value,
      status: el.status.value,
      paid_date: el.paid_date.value || null,
      payment_method: el.payment_method.value.trim() || null,
      account_payable_id: parseIntOrNull(el.account_payable_id.value),
      is_active: parseBool(el.is_active.value),
      payload: el.payload.value ? JSON.parse(el.payload.value) : null,
    };
  }

  /* =========================================================
     Supplier Picker
  ========================================================= */

  async function pickSupplier() {
    const supplier = await openSuppliersModalSearch();
    if (!supplier) return;
    if (el.vendor) el.vendor.value = supplier.name || '';
  }

  /* =========================================================
     Events
  ========================================================= */

  function bind() {
    el.btnClose?.addEventListener('click', close);
    el.btnCancel?.addEventListener('click', close);
    el.modalLayer?.addEventListener('click', e => {
      if (e.target === el.modalLayer) close();
    });

    el.form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = readFormPayload();

      if (!payload.name) return alert('Informe o nome.');
      if (!payload.value) return alert('Informe valor válido.');
      if (!payload.due_date) return alert('Informe vencimento.');

      el.btnSave.disabled = true;

      try {
        if (!el.id.value) {
          await onCreate(payload);
        } else {
          await onUpdate(Number(el.id.value), payload);
        }
        close();
        await onAfterSave();
      } catch (err) {
        alert(err.message);
      } finally {
        el.btnSave.disabled = false;
      }
    });

    el.btnDelete?.addEventListener('click', async () => {
      if (!el.id.value) return;
      if (!confirm('Confirma excluir?')) return;

      await onDelete(Number(el.id.value));
      close();
      await onAfterDelete();
    });

    // 🔎 botão fornecedor
    el.btnVendorPick?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        pickSupplier();
    });

    // double click no input
    el.vendor?.addEventListener('dblclick', (e) => {
      e.preventDefault();
      pickSupplier();
    });

    // Enter no campo
    el.vendor?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      pickSupplier();
    });

    // ESC fecha
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !el.modalLayer.classList.contains('hidden')) close();
    });
  }

  bind();

  return {
    openCreate,
    openEdit,
    close,
  };
}