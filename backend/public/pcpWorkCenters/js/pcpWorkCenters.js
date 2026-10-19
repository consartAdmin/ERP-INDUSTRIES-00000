// ╔════════════════════════════════════════════════════════════╗
// ║ pcpWorkCenters.js — Cadastro de Centros de Trabalho (PCP)  ║
// ╚════════════════════════════════════════════════════════════╝

import {
  pcpApi, escapeHtml, fmtNum, fmtMoney, activeBadge, showMessage, notify,
  paginate, bindPagination, renderPagination,
} from '/public/pcp/js/pcp.common.js';

const $ = (id) => document.getElementById(id);
const PAGER = { info: 'wcTableInfo', pageInfo: 'wcPageInfo', prev: 'wcPrevPage', next: 'wcNextPage', size: 'wcRowsPerPage' };
const state = { rows: [], page: 1, pageSize: 50 };

function filtered() {
  const q = $('search').value.trim().toLowerCase();
  const all = $('includeInactive').checked;
  return state.rows.filter((r) =>
    (all || r.is_active) &&
    (!q || `${r.code} ${r.name}`.toLowerCase().includes(q)));
}

function render() {
  const pg = paginate(filtered(), state);
  $('tableBody').innerHTML = pg.slice.length ? pg.slice.map((r) => `
    <tr>
      <td><strong>${escapeHtml(r.code)}</strong></td>
      <td>${escapeHtml(r.name)}</td>
      <td class="num">${fmtMoney(r.hourly_cost)}</td>
      <td class="num">${fmtNum(r.capacity_hours_day, 2)}</td>
      <td class="center">${activeBadge(r.is_active)}</td>
      <td class="center">
        <div class="pcp-action-group">
          <button type="button" class="btn btn-toolbar btn-sm pcp-action-button" data-edit="${r.work_center_id}" title="Editar">✎</button>
          <button type="button" class="btn btn-clean btn-sm pcp-action-button" data-delete="${r.work_center_id}">Excluir</button>
        </div>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="pcp-table-empty">Nenhum centro de trabalho cadastrado.</td></tr>';
  renderPagination(PAGER, pg, state, 'centros');
}

async function load() {
  try {
    state.rows = await pcpApi('/work-centers') || [];
    render();
  } catch (e) {
    $('tableBody').innerHTML = `<tr><td colspan="6" class="pcp-table-error">${escapeHtml(e.message)}</td></tr>`;
  }
}

function openModal(row = null) {
  $('form').reset();
  showMessage($('formMessage'), '');
  $('modalTitle').textContent = row ? `Editar ${row.code}` : 'Novo centro de trabalho';
  $('workCenterId').value = row?.work_center_id || '';
  $('code').value = row?.code || '';
  $('name').value = row?.name || '';
  $('hourlyCost').value = row?.hourly_cost ?? 0;
  $('capacity').value = row?.capacity_hours_day ?? 8;
  $('notes').value = row?.notes || '';
  $('isActive').checked = row ? row.is_active : true;
  $('modal').showModal();
  $('code').focus();
}

async function save(e) {
  e.preventDefault();
  const id = $('workCenterId').value;
  const body = {
    code: $('code').value,
    name: $('name').value,
    hourly_cost: $('hourlyCost').value,
    capacity_hours_day: $('capacity').value,
    notes: $('notes').value,
    is_active: $('isActive').checked,
  };
  try {
    await pcpApi(id ? `/work-centers/${id}` : '/work-centers', { method: id ? 'PUT' : 'POST', body });
    $('modal').close();
    notify('success', 'Centro de trabalho salvo');
    load();
  } catch (err) {
    showMessage($('formMessage'), err.message);
  }
}

async function remove(id) {
  const row = state.rows.find((r) => r.work_center_id === id);
  if (!confirm(`Excluir o centro de trabalho ${row?.code}?`)) return;
  try {
    const res = await pcpApi(`/work-centers/${id}`, { method: 'DELETE' });
    if (res?.deactivated) notify('info', 'Centro inativado', 'Ele é usado em roteiros ou apontamentos, então foi apenas inativado.');
    load();
  } catch (err) {
    notify('error', 'Não foi possível excluir', err.message);
  }
}

$('btnNew').addEventListener('click', () => openModal());
$('btnClose').addEventListener('click', () => $('modal').close());
$('btnCancel').addEventListener('click', () => $('modal').close());
$('form').addEventListener('submit', save);
$('search').addEventListener('input', () => { state.page = 1; render(); });
$('includeInactive').addEventListener('change', () => { state.page = 1; render(); });
$('tableBody').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-delete]');
  if (edit) openModal(state.rows.find((r) => r.work_center_id === Number(edit.dataset.edit)));
  if (del) remove(Number(del.dataset.delete));
});
bindPagination(state, PAGER, render);
load();
