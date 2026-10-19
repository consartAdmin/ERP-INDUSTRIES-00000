// ╔══════════════════════════════════════════════════════════════════════╗
// ║ usoConsumo.js — Frontend Uso e Consumo                              ║
// ║ Path: backend/public/usoConsumo/usoConsumo.js                       ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { openBudgetsModal } from '/public/modalsSearch/budgetsModal.js';

const API_BASE = window.location.origin;
const API = `${API_BASE}/api/uso-consumo`;
const $ = (id) => document.getElementById(id);
let selectedBudget = null;

const safe = (value, fallback = '-') => value === null || value === undefined || value === '' ? fallback : String(value);
const escapeHtml = (value) => safe(value, '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const moneyBR = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateBR = (value) => { const date = new Date(value); return value && !Number.isNaN(date.getTime()) ? date.toLocaleString('pt-BR') : '-'; };
const getBudgetId = (row = {}) => row.budget_id || row.budgetId || row.id || row.orcamento_id || '';
const getBudgetNumber = (row = {}) => row.number || row.budget_number || row.numero || row.codigo || getBudgetId(row) || '-';
const getBudgetCustomer = (row = {}) => row.customer_name || row.nome_fantasia || row.customer || row.cliente_nome || row.razao_social || '-';
const getBudgetTotal = (row = {}) => row.total_amount || row.total || row.valor_total || row.total_geral || 0;

function toast(message, type = 'info') {
  if (window.centerAlertModal) return window.centerAlertModal({ title: type === 'error' ? 'Atenção' : 'Uso e Consumo', message, type });
  window.alert(message);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  let json;
  try { json = await response.json(); } catch { json = {}; }
  if (!response.ok || !json.ok) throw new Error(json.message || `Erro HTTP ${response.status}.`);
  return json;
}

function openUsoConsumoModal() {
  const modal = $('modalUsoConsumo');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('is-open');
  document.body.classList.add('uc-modal-open');
  window.setTimeout(() => $('budgetId')?.focus(), 0);
}

function closeUsoConsumoModal() {
  const modal = $('modalUsoConsumo');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('is-open');
  document.body.classList.remove('uc-modal-open');
}

function renderSelectedBudget(row) {
  const box = $('selectedBudgetBox');
  if (!box) return;
  if (!row) {
    selectedBudget = null; box.classList.add('hidden');
    $('selectedBudgetTitle').textContent = '-'; $('selectedBudgetCustomer').textContent = '-'; $('selectedBudgetTotal').textContent = moneyBR(0);
    return;
  }
  selectedBudget = row;
  const id = getBudgetId(row);
  $('budgetId').value = id;
  $('selectedBudgetTitle').textContent = `#${id} — ${getBudgetNumber(row)}`;
  $('selectedBudgetCustomer').textContent = getBudgetCustomer(row);
  $('selectedBudgetTotal').textContent = moneyBR(getBudgetTotal(row));
  box.classList.remove('hidden');
}

function openBudgetSearchModal() {
  openBudgetsModal({ onSelect: (budget) => { renderSelectedBudget(budget); toast('Orçamento importado.', 'success'); } });
}

async function findBudgetById() {
  const id = $('budgetId')?.value?.trim();
  if (!id) return openBudgetSearchModal();
  try {
    const url = new URL(`${API_BASE}/api/budgets`); url.searchParams.set('q', id); url.searchParams.set('limit', '10');
    const json = await request(url);
    const rows = json.data || json.rows || json.budgets || [];
    const found = rows.find((row) => String(getBudgetId(row)) === id) || rows[0];
    if (!found) throw new Error('Nenhum orçamento encontrado com esse ID.');
    renderSelectedBudget(found); toast('Orçamento localizado.', 'success');
  } catch (error) { console.error(error); toast(error.message, 'error'); }
}

function getPayload() { return { budgetId: $('budgetId')?.value?.trim(), cfop: $('cfop')?.value?.trim(), department: $('department')?.value?.trim(), responsible: $('responsible')?.value?.trim(), reason: $('reason')?.value?.trim() }; }
function validatePayload(p) { return !p.budgetId ? 'Informe ou importe o orçamento.' : !p.cfop ? 'Informe o CFOP.' : !p.department ? 'Informe o departamento.' : !p.responsible ? 'Informe o responsável.' : !p.reason ? 'Informe o motivo.' : null; }

async function finishBudget() {
  const payload = getPayload(); const validation = validatePayload(payload);
  if (validation) return toast(validation, 'error');
  if (!window.confirm(`Confirmar finalização do orçamento ${payload.budgetId}?\n\nCFOP: ${payload.cfop}`)) return;
  const button = $('btnFinish'); button.disabled = true; button.textContent = 'Finalizando...';
  try {
    const json = await request(`${API}/finish-budget/${encodeURIComponent(payload.budgetId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cfop: payload.cfop, department: payload.department, responsible: payload.responsible, reason: payload.reason }) });
    toast(json.message || 'Orçamento finalizado.', 'success'); clearForm(); closeUsoConsumoModal(); await loadRows();
  } catch (error) { console.error(error); toast(error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Finalizar como Uso e Consumo'; }
}

function clearForm() {
  $('budgetId').value = ''; $('cfop').value = '5.949'; $('department').value = ''; $('responsible').value = ''; $('reason').value = ''; renderSelectedBudget(null);
}

function normalizeNfeStatus(row) { return String(row.nfe_status || (row.invoice_id ? 'PENDENTE' : 'NÃO EMITIDA')).trim().toUpperCase(); }
function statusClass(status) { return status === 'AUTORIZADA' ? 'is-success' : status === 'REJEITADA' ? 'is-error' : ['PROCESSANDO', 'PENDENTE'].includes(status) ? 'is-warning' : 'is-muted'; }

function actionButtons(row) {
  const id = escapeHtml(row.uso_consumo_id);
  const status = normalizeNfeStatus(row);
  const buttons = [];

  if (!row.invoice_id) {
    buttons.push(`
      <button
        class="uc-action is-primary"
        data-action="emit"
        data-id="${id}"
      >
        Emitir NF-e
      </button>
    `);
  }

  if (row.invoice_id) {
    buttons.push(`
      <button
        class="uc-action"
        data-action="status"
        data-id="${id}"
      >
        Atualizar
      </button>
    `);
  }

  if (status === 'REJEITADA') {
    buttons.push(`
      <button
        class="uc-action is-danger"
        data-action="retry"
        data-id="${id}"
      >
        Reenviar
      </button>
    `);
  }

  if (row.xml_url) {
    buttons.push(`
      <a
        class="uc-action"
        href="${escapeHtml(row.xml_url)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        XML
      </a>
    `);
  }

  if (status === 'AUTORIZADA') {
    const danfeConsartUrl =
      `${API}/${encodeURIComponent(
        row.uso_consumo_id
      )}/nfe/danfe-consart`;

    buttons.push(`
      <a
        class="uc-action is-success"
        href="${danfeConsartUrl}"
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir DANFE personalizado da Consart"
      >
        Imprimir DANFE
      </a>
    `);
  }

  return buttons.join(' ') || '-';
}

async function hydrateNfeData(rows) {
  const needsDetails = rows.some((row) =>
    !Object.prototype.hasOwnProperty.call(row, 'invoice_id')
  );

  if (!needsDetails) return rows;

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const id = row.uso_consumo_id;
      if (!id) return row;
      const detail = await request(`${API}/${encodeURIComponent(id)}`);
      return { ...row, ...(detail.data?.header || {}) };
    })
  );

  return results.map((result, index) =>
    result.status === 'fulfilled' ? result.value : rows[index]
  );
}

async function loadRows() {
  const tbody = $('rows'); const q = $('search')?.value?.trim() || '';
  tbody.innerHTML = '<tr><td colspan="11">Carregando...</td></tr>';
  try {
    const url = new URL(API); if (q) url.searchParams.set('q', q);
    const json = await request(url);
    const rows = await hydrateNfeData(json.data || []);
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="11">Nenhum registro encontrado.</td></tr>'; return; }
    tbody.innerHTML = rows.map((row) => {
      const nfeStatus = normalizeNfeStatus(row);
      return `<tr><td>${escapeHtml(row.uso_consumo_id)}</td><td>${escapeHtml(row.number)}</td><td>${escapeHtml(row.budget_id)}</td><td>${escapeHtml(row.department)}</td><td>${escapeHtml(row.responsible)}</td><td>${escapeHtml(row.cfop)}</td><td>${moneyBR(row.total_amount)}</td><td>${escapeHtml(row.nfe_number)}</td><td><span class="uc-status ${statusClass(nfeStatus)}">${escapeHtml(nfeStatus)}</span></td><td>${dateBR(row.created_at)}</td><td><div class="uc-row-actions">${actionButtons(row)}</div></td></tr>`;
    }).join('');
  } catch (error) { console.error(error); tbody.innerHTML = `<tr><td colspan="11">${escapeHtml(error.message)}</td></tr>`; }
}

async function fiscalAction(action, id, button) {
  const config = {
    emit: { method: 'POST', path: `${id}/emit-nfe`, confirm: `Emitir a NF-e do registro ${id}?`, loading: 'Emitindo...' },
    retry: { method: 'POST', path: `${id}/nfe/retry`, confirm: `Reenviar a NF-e rejeitada do registro ${id}?`, loading: 'Reenviando...' },
    status: { method: 'GET', path: `${id}/nfe/status`, loading: 'Consultando...' },
  }[action];
  if (!config || (config.confirm && !window.confirm(config.confirm))) return;
  const original = button.textContent; button.disabled = true; button.textContent = config.loading;
  try {
    const json = await request(`${API}/${config.path}`, { method: config.method, ...(config.method === 'POST' ? { headers: { 'Content-Type': 'application/json' } } : {}) });
    toast(json.message || 'Operação realizada com sucesso.', 'success'); await loadRows();
  } catch (error) { console.error(error); toast(error.message, 'error'); }
  finally { if (button.isConnected) { button.disabled = false; button.textContent = original; } }
}

function bindEvents() {
  $('btnNewUsoConsumo')?.addEventListener('click', () => { clearForm(); openUsoConsumoModal(); });
  $('btnCloseUsoConsumo')?.addEventListener('click', closeUsoConsumoModal);
  $('modalUsoConsumo')?.addEventListener('click', (event) => { if (event.target === $('modalUsoConsumo')) closeUsoConsumoModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && $('modalUsoConsumo')?.getAttribute('aria-hidden') === 'false') closeUsoConsumoModal(); });
  $('btnOpenBudgetsModal')?.addEventListener('click', openBudgetSearchModal);
  $('btnFindBudget')?.addEventListener('click', findBudgetById);
  $('btnRemoveBudget')?.addEventListener('click', () => renderSelectedBudget(null));
  $('btnFinish')?.addEventListener('click', finishBudget);
  $('btnClear')?.addEventListener('click', clearForm);
  $('btnSearch')?.addEventListener('click', loadRows);
  $('budgetId')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); findBudgetById(); } });
  $('search')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); loadRows(); } });
  $('rows')?.addEventListener('click', (event) => { const button = event.target.closest('button[data-action][data-id]'); if (button) fiscalAction(button.dataset.action, button.dataset.id, button); });
}

document.addEventListener('DOMContentLoaded', () => { bindEvents(); loadRows(); });