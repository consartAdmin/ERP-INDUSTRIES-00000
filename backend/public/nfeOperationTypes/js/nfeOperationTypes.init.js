import * as api from './nfeOperationTypes.api.js';

const $ = (id) => document.getElementById(id);
let rows = [];
const escapeHtml = (value) => { const el = document.createElement('div'); el.textContent = String(value ?? ''); return el.innerHTML; };

function setModalOpen(open) {
  const modal = $('opModal');
  if (!modal) return;
  modal.hidden = !open;
  modal.classList.toggle('is-open', open);
  modal.setAttribute('aria-hidden', String(!open));
  modal.style.display = open ? 'flex' : 'none';
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) requestAnimationFrame(() => $('opCode')?.focus());
}

function openForm(row = {}) {
  $('opId').value = row.operation_type_id || '';
  $('opCode').value = row.code || '';
  $('opName').value = row.name || '';
  $('opNature').value = row.nature_operation || '';
  $('opCfopInternal').value = row.cfop_internal || '';
  $('opCfopInterstate').value = row.cfop_interstate || '';
  $('opReceivable').checked = Boolean(row.generates_receivable);
  $('opStock').checked = row.moves_stock !== false;
  $('opEnabled').checked = row.active !== false;
  $('opTitle').textContent = row.operation_type_id ? `Editar ${row.code}` : 'Nova operação';
  setModalOpen(true);
}

async function load() {
  try {
    const result = await api.list({ q: $('opSearch').value.trim(), active: $('opActive').value, limit: Number($('apRowsPerPage')?.value || 50), offset: 0 });
    rows = result.rows || [];
    $('opBody').innerHTML = rows.map((o) => `<tr><td>${o.operation_type_id}</td><td>${escapeHtml(o.code)}</td><td>${escapeHtml(o.name)}</td><td>${escapeHtml(o.nature_operation)}</td><td>${escapeHtml(o.cfop_internal || '—')}</td><td>${escapeHtml(o.cfop_interstate || '—')}</td><td>${o.generates_receivable ? 'Sim' : 'Não'}</td><td>${o.moves_stock ? 'Sim' : 'Não'}</td><td>${o.active ? 'Ativa' : 'Inativa'}</td><td><div class="op-actions"><button type="button" class="btn btn-sm" data-edit="${o.operation_type_id}">✏️</button><button type="button" class="btn btn-sm op-delete" data-delete="${o.operation_type_id}">🗑️</button></div></td></tr>`).join('');
    if ($('apTableInfo')) $('apTableInfo').textContent = `${Number(result.total || rows.length)} registro(s) encontrado(s)`;
  } catch (error) { window.alert(error.message); }
}

function bindEvents() {
  $('opNew')?.addEventListener('click', (event) => { event.preventDefault(); openForm(); });
  document.querySelectorAll('[data-op-close]').forEach((el) => el.addEventListener('click', (event) => { event.preventDefault(); setModalOpen(false); }));
  $('opFilter')?.addEventListener('submit', (event) => { event.preventDefault(); load(); });
  $('opBody')?.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    if (editButton) {
      event.preventDefault();
      const operation = rows.find((row) => Number(row.operation_type_id) === Number(editButton.dataset.edit));
      if (operation) openForm(operation);
      return;
    }

    const deleteButton = event.target.closest('[data-delete]');
    if (!deleteButton) return;
    event.preventDefault();

    const operation = rows.find((row) => Number(row.operation_type_id) === Number(deleteButton.dataset.delete));
    if (!operation || !window.confirm(`Excluir permanentemente a operação ${operation.code} — ${operation.name}?`)) return;

    try {
      await api.remove(operation.operation_type_id);
      await load();
    } catch (error) {
      window.alert(error.message);
    }
  });
  $('opForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = { code: $('opCode').value.trim(), name: $('opName').value.trim(), nature_operation: $('opNature').value.trim(), cfop_internal: $('opCfopInternal').value.trim() || null, cfop_interstate: $('opCfopInterstate').value.trim() || null, generates_receivable: $('opReceivable').checked, moves_stock: $('opStock').checked, active: $('opEnabled').checked };
    try { const id = Number($('opId').value); id ? await api.update(id, body) : await api.create(body); setModalOpen(false); await load(); }
    catch (error) { window.alert(error.message); }
  });
  $('apRowsPerPage')?.addEventListener('change', load);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('opModal')?.hidden) setModalOpen(false); });
}

bindEvents();
load();
