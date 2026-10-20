// ╔════════════════════════════════════════════════════════════╗
// ║ pcpRawMaterials.js — Cadastro de Matérias-primas (PCP)     ║
// ╚════════════════════════════════════════════════════════════╝

import {
  pcpApi, escapeHtml, fmtNum, fmtMoney, fmtDateTime, activeBadge, showMessage, notify,
  paginate, bindPagination, renderPagination,
} from '/public/pcp/js/pcp.common.js';
import { Modal } from '/public/includes/js/modal.js';

const $ = (id) => document.getElementById(id);
const PAGER = { info: 'rmTableInfo', pageInfo: 'rmPageInfo', prev: 'rmPrevPage', next: 'rmNextPage', size: 'rmRowsPerPage' };
const state = { rows: [], page: 1, pageSize: 50 };

const SOURCE_LABEL = { INICIAL: 'Saldo inicial', AJUSTE: 'Ajuste', NFE: 'Nota de entrada', OP: 'Ordem de produção' };

const isLow = (r) => Number(r.min_stock) > 0 && Number(r.stock_qty) < Number(r.min_stock);

function filtered() {
  const q = $('search').value.trim().toLowerCase();
  const all = $('includeInactive').checked;
  const low = $('onlyLow').checked;
  return state.rows.filter((r) =>
    (all || r.is_active) &&
    (!low || isLow(r)) &&
    (!q || `${r.code} ${r.description}`.toLowerCase().includes(q)));
}

function render() {
  const pg = paginate(filtered(), state);
  $('tableBody').innerHTML = pg.slice.length ? pg.slice.map((r) => `
    <tr>
      <td><strong>${escapeHtml(r.code)}</strong></td>
      <td>${escapeHtml(r.description)}</td>
      <td class="center">${escapeHtml(r.unit)}</td>
      <td class="num${isLow(r) ? ' pcp-text-danger' : ''}">${fmtNum(r.stock_qty, 4)}</td>
      <td class="num">${fmtNum(r.min_stock, 4)}</td>
      <td class="num">${fmtMoney(r.average_cost)}</td>
      <td class="num">${fmtMoney(r.last_cost)}</td>
      <td class="center">${activeBadge(r.is_active)}</td>
      <td class="center">
        <div class="pcp-action-group">
          <button type="button" class="btn btn-toolbar btn-sm pcp-action-button" data-edit="${r.raw_material_id}" title="Editar">✎</button>
          <button type="button" class="btn btn-clean btn-sm pcp-action-button" data-delete="${r.raw_material_id}">Excluir</button>
        </div>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="9" class="pcp-table-empty">Nenhuma matéria-prima encontrada.</td></tr>';
  renderPagination(PAGER, pg, state, 'matérias-primas');
}

async function load() {
  try {
    state.rows = await pcpApi('/raw-materials') || [];
    render();
  } catch (e) {
    $('tableBody').innerHTML = `<tr><td colspan="9" class="pcp-table-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

function renderHistory(row) {
  const movements = row?.movements || [];
  $('historyBox').hidden = !row;
  if (!row) return;
  $('averageCost').textContent = fmtMoney(row.average_cost);
  $('movementsBody').innerHTML = movements.length ? movements.map((m) => `
    <tr>
      <td>${fmtDateTime(m.created_at)}</td>
      <td>${escapeHtml(SOURCE_LABEL[m.source] || m.source)}</td>
      <td>${escapeHtml([m.reference, m.notes].filter(Boolean).join(' · '))}</td>
      <td class="num">${fmtNum(m.quantity, 4)}</td>
      <td class="num">${m.unit_cost === null ? '—' : fmtMoney(m.unit_cost)}</td>
      <td class="num">${fmtNum(m.balance_after, 4)}</td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="pcp-table-empty">Nenhuma movimentação.</td></tr>';
}

function fill(row = null) {
  $('form').reset();
  showMessage($('formMessage'), '');
  $('modalTitle').textContent = row ? `Editar ${row.code}` : 'Nova matéria-prima';
  $('rawMaterialId').value = row?.raw_material_id || '';
  $('code').value = row?.code || '';
  $('description').value = row?.description || '';
  $('unit').value = row?.unit || 'UN';
  $('ncm').value = row?.ncm || '';
  $('lastCost').value = row?.last_cost ?? 0;
  $('stockQty').value = row ? Number(row.stock_qty) : 0;
  $('minStock').value = row ? Number(row.min_stock) : 0;
  $('notes').value = row?.notes || '';
  $('isActive').checked = row ? row.is_active : true;
  renderHistory(row);
}

async function openModal(id = null) {
  if (!id) {
    fill();
    Modal.open('modal', { focusSelector: '#description' });
    return;
  }
  try {
    fill(await pcpApi(`/raw-materials/${id}`));
    Modal.open('modal', { focusSelector: '#description' });
  } catch (err) {
    notify('error', 'Não foi possível abrir', err.message);
  }
}

async function save(e) {
  e.preventDefault();
  const id = $('rawMaterialId').value;
  const body = {
    code: $('code').value,
    description: $('description').value,
    unit: $('unit').value,
    ncm: $('ncm').value,
    last_cost: $('lastCost').value,
    stock_qty: $('stockQty').value,
    min_stock: $('minStock').value,
    adjustment_reason: $('adjustmentReason').value,
    notes: $('notes').value,
    is_active: $('isActive').checked,
  };
  try {
    await pcpApi(id ? `/raw-materials/${id}` : '/raw-materials', { method: id ? 'PUT' : 'POST', body });
    Modal.close('modal');
    notify('success', 'Matéria-prima salva');
    load();
  } catch (err) {
    showMessage($('formMessage'), err.message);
  }
}

async function remove(id) {
  const row = state.rows.find((r) => r.raw_material_id === id);
  if (!confirm(`Excluir a matéria-prima ${row?.code}?`)) return;
  try {
    const res = await pcpApi(`/raw-materials/${id}`, { method: 'DELETE' });
    if (res?.deactivated) notify('info', 'Matéria-prima inativada', 'Ela é usada em fichas técnicas ou OPs, então foi apenas inativada.');
    load();
  } catch (err) {
    notify('error', 'Não foi possível excluir', err.message);
  }
}

Modal.setup();
$('btnNew').addEventListener('click', () => openModal());
$('form').addEventListener('submit', save);
$('search').addEventListener('input', () => { state.page = 1; render(); });
$('onlyLow').addEventListener('change', () => { state.page = 1; render(); });
$('includeInactive').addEventListener('change', () => { state.page = 1; render(); });
$('tableBody').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');
  if (edit) openModal(Number(edit.dataset.edit));
  if (del) remove(Number(del.dataset.delete));
});
bindPagination(state, PAGER, render);
load();
