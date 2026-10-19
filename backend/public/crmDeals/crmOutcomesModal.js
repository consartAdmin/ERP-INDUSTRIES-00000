// ╔══════════════════════════════════════════════════════════════════════╗
// ║ crmOutcomesModal.js — Modal Outcomes (CRM Reativação | CONSART)      ║
// ║ - Abre lista por outcome: CONVERSION | LOSS | NO_SUCCESS_CONTACT     ║
// ║ - Busca via API: GET /api/crm/reativacao/outcomes?outcome=...         ║
// ║ - Filtro local (search) + KPIs no topo                               ║
// ║ ✅ CONSART: usa apiUrl() + fetchJSON() (token)                        ║
// ║ ✅ Evita /api/api e remove dependência do param apiBase              ║
// ║ ✅ Evita duplicar handlers (single bind)                              ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { apiUrl } from './config.js';
import { fetchJSON } from './fetchJSON.js';

export { openCrmOutcomesModal };

const OUTCOME_LABEL = {
  CONVERSION: 'Convertidos',
  LOSS: 'Perdidos',
  NO_SUCCESS_CONTACT: 'Sem êxito',
};

const OUTCOME_BADGE = {
  CONVERSION: 'Conversão Venda',
  LOSS: 'Queda de Venda',
  NO_SUCCESS_CONTACT: 'Sem Êxito no Contato',
};

const fmtMoney = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return String(iso);
  }
};

let _boundGlobalEsc = false;

function ensureModal() {
  let modal = document.getElementById('crm-outcomes-modal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'crm-outcomes-modal';
  modal.className = 'crm-omodal hidden';
  modal.innerHTML = `
    <div class="crm-omodal__dialog" role="dialog" aria-modal="true" aria-label="Outcomes">
      <header class="crm-omodal__header">
        <div class="crm-omodal__title">
          <h3 id="crm-omodal-title">Outcomes</h3>
          <span class="crm-omodal__badge" id="crm-omodal-badge">—</span>
        </div>
        <button class="crm-omodal__close" id="crm-omodal-close" type="button">Fechar</button>
      </header>

      <div class="crm-omodal__body">
        <div class="crm-omodal__toolbar">
          <div class="crm-omodal__search">
            <input id="crm-omodal-search" type="text" placeholder="Buscar por cliente, vendedor, tag, observação..." />
          </div>

          <div class="crm-omodal__kpis">
            <div class="crm-omodal__kpi">
              <div class="label">Leads</div>
              <div class="value" id="crm-omodal-kpi-count">0</div>
            </div>
            <div class="crm-omodal__kpi">
              <div class="label">Total estimado</div>
              <div class="value" id="crm-omodal-kpi-total">R$ 0,00</div>
            </div>
          </div>
        </div>

        <div id="crm-omodal-content"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.classList.add('hidden');

  // ✅ bind 1x
  modal.querySelector('#crm-omodal-close')?.addEventListener('click', close);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  if (!_boundGlobalEsc) {
    _boundGlobalEsc = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const m = document.getElementById('crm-outcomes-modal');
      if (m && !m.classList.contains('hidden')) m.classList.add('hidden');
    });
  }

  return modal;
}

function normalizeText(v) {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeOutcome(outcome) {
  const o = String(outcome || '').trim().toUpperCase();
  if (o === 'CONVERSION' || o === 'LOSS' || o === 'NO_SUCCESS_CONTACT') return o;
  return o || 'LOSS';
}

function buildTable(rows) {
  const wrap = document.createElement('div');

  if (!rows.length) {
    wrap.innerHTML = `<div class="crm-omodal__empty">Nenhum lead encontrado para este outcome.</div>`;
    return wrap;
  }

  const table = document.createElement('table');
  table.className = 'crm-otable';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Vendedor</th>
        <th>Valor</th>
        <th>Tag</th>
        <th>Próxima ação</th>
        <th>Últ. atividade</th>
        <th>Data outcome</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');

  rows.forEach((r) => {
    const tr = document.createElement('tr');

    const customer = r.customer_name || r.customer || r.nome_cliente || '—';
    const seller = r.seller_name || r.seller || r.vendedor || '—';
    const value = r.estimated_value ?? r.value ?? r.valor ?? 0;
    const tag = r.tag || r.status || '—';
    const next = r.next_step || r.nextStep || r.observacao || '—';
    const last = r.last_activity_date || r.lastActivityDate || r.updated_at || null;
    const outcomeAt = r.outcome_at || r.outcomeAt || r.created_at || null;

    tr.innerHTML = `
      <td>
        <div style="font-weight:800">${escapeHtml(customer)}</div>
        <div class="muted">${escapeHtml(r.customer_tax_id || r.cnpj_cpf || '')}</div>
      </td>
      <td>${escapeHtml(seller)}</td>
      <td style="font-weight:800">${fmtMoney(value)}</td>
      <td><span class="pill">${escapeHtml(tag)}</span></td>
      <td class="muted">${escapeHtml(next)}</td>
      <td class="muted">${fmtDate(last)}</td>
      <td class="muted">${fmtDate(outcomeAt)}</td>
    `;

    tbody.appendChild(tr);
  });

  wrap.appendChild(table);
  return wrap;
}

async function fetchOutcomes({ sellerId, outcome, signal }) {
  // ✅ backend: GET /api/crm/reativacao/outcomes?outcome=...&sellerId=...
  const url = new URL(apiUrl('/crm/reativacao/outcomes'));
  url.searchParams.set('outcome', normalizeOutcome(outcome));

  if (sellerId && sellerId !== 'all') {
    url.searchParams.set('sellerId', String(sellerId));
  }

  // ✅ token + padrão CONSART
  const res = await fetchJSON(url.toString(), { method: 'GET', signal });

  if (!res?.ok) throw new Error(res?.error || 'OUTCOMES_LIST_ERROR');
  return Array.isArray(res.data) ? res.data : [];
}

/**
 * Open modal listing all leads for a given outcome.
 * @param {Object} params
 * @param {string|number} params.sellerId - current seller filter or "all"
 * @param {"CONVERSION"|"LOSS"|"NO_SUCCESS_CONTACT"} params.outcome
 */
async function openCrmOutcomesModal({ sellerId = 'all', outcome }) {
  const modal = ensureModal();

  const title = modal.querySelector('#crm-omodal-title');
  const badge = modal.querySelector('#crm-omodal-badge');
  const content = modal.querySelector('#crm-omodal-content');
  const kpiCount = modal.querySelector('#crm-omodal-kpi-count');
  const kpiTotal = modal.querySelector('#crm-omodal-kpi-total');
  const search = modal.querySelector('#crm-omodal-search');

  const oc = normalizeOutcome(outcome);

  title.textContent = `Leads — ${OUTCOME_LABEL[oc] || 'Outcomes'}`;
  badge.textContent = OUTCOME_BADGE[oc] || oc;

  modal.classList.remove('hidden');

  content.innerHTML = `<div class="crm-omodal__empty">Carregando leads...</div>`;
  kpiCount.textContent = '0';
  kpiTotal.textContent = 'R$ 0,00';
  search.value = '';

  // ✅ abort de requests anteriores (se o usuário clicar rápido)
  if (modal._abortCtrl) {
    try { modal._abortCtrl.abort(); } catch {}
  }
  modal._abortCtrl = new AbortController();

  let rows = [];
  try {
    rows = await fetchOutcomes({ sellerId, outcome: oc, signal: modal._abortCtrl.signal });
  } catch (err) {
    content.innerHTML = `
      <div class="crm-omodal__empty">
        Não foi possível carregar os leads deste outcome.<br/>
        <span class="muted">(${escapeHtml(err.message)})</span>
      </div>
    `;
    return;
  }

  const render = (q = '') => {
    const nq = normalizeText(q);

    const filtered = !nq
      ? rows
      : rows.filter((r) => {
          const blob = normalizeText(
            [
              r.customer_name, r.customer, r.nome_cliente,
              r.seller_name, r.seller, r.vendedor,
              r.tag, r.status, r.next_step, r.nextStep, r.observacao,
              r.customer_tax_id, r.cnpj_cpf,
            ].join(' ')
          );
          return blob.includes(nq);
        });

    const total = filtered.reduce(
      (acc, r) => acc + Number(r.estimated_value ?? r.value ?? r.valor ?? 0),
      0
    );

    kpiCount.textContent = String(filtered.length);
    kpiTotal.textContent = fmtMoney(total);

    content.innerHTML = '';
    content.appendChild(buildTable(filtered));
  };

  // initial render
  render('');

  // ✅ não duplica handler
  search.oninput = () => render(search.value);
}