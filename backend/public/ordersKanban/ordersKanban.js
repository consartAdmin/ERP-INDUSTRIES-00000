// ╔══════════════════════════════════════════════════════════════════════╗
// ║ 📦 ordersKanban.js – Frontend Kanban de Pedidos / Entregas CONSART  ║
// ║ API: /api/orders-kanban/...                                          ║
// ║ ✅ Usa centerAlertModal.js para alertas, detalhes e confirmação       ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { openOrdersKanbanPendenciasModal } from '/public/modalsSearch/ordersKanbanModalPendencia.js';
import { openBudgetsModal } from '/public/modalsSearch/budgetsModal.js';
import { openOrdersKanbanEditCardModal } from '/public/modalsSearch/ordersKanbanModalEditCard.js';

const originFallback = `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}`;
const API_BASE = (window.apiBase && window.apiBase.trim()) || originFallback;
const API_ROOT = `${API_BASE}/api/orders-kanban`;

console.log('[ordersKanban] API_ROOT =', API_ROOT);

let columnsCache = [];
let cardsCache = [];

const els = {
  selectColuna: document.getElementById('selectColunaKanban'),
  selectFiltroPendencias: document.getElementById('selectFiltroPendencias'),
  contadorFinalizados: document.getElementById('contadorFinalizados'),
  btnCriarCard: document.getElementById('btnCriarCard'),
  btnImportarOrcamento: document.getElementById('btnImportarOrcamento'),
  formCriarCard: document.getElementById('formCriarCard'),

  inputCliente: document.getElementById('campoCliente'),
  btnBuscarCliente: document.getElementById('btnBuscarCliente'),
  hiddenClienteId: document.getElementById('clienteIdReal'),
  inputNumeroSeparacao: document.getElementById('numeroSeparacao'),
  inputObservacao: document.getElementById('observacao'),

  kanbanContainer: document.getElementById('kanbanBoard'),
  btnBaixarPdfPendencias: document.getElementById('btnBaixarTodasPendenciasPdf'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toastError(title, message) {
  showCenterModal({
    variant: 'error',
    title,
    message: escapeHtml(message || 'Erro inesperado.'),
    timeoutMs: 6000
  });
}

function setLoading(on) {
  if (!els.kanbanContainer) return;
  els.kanbanContainer.classList.toggle('is-loading', !!on);
}

function normText(s) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapPendenciasUiToApi(value) {
  const v = normText(value || 'todas');

  if (v.includes('abert') || v.includes('pend')) return 'pendentes';
  if (v.includes('concl') || v.includes('finaliz') || v.includes('comp') || v.includes('done')) return 'concluidas';

  return 'todas';
}

async function httpGet(path) {
  const res = await fetch(`${API_ROOT}${path}`);
  const text = await res.text();

  if (!res.ok) {
    throw new Error(`GET ${path} => ${res.status} ${res.statusText} | ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function httpPost(path, body) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`POST ${path} => ${res.status} ${res.statusText} | ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function httpPatch(path, body) {
  const res = await fetch(`${API_ROOT}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`PATCH ${path} => ${res.status} ${res.statusText} | ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function httpDelete(path) {
  const res = await fetch(`${API_ROOT}${path}`, { method: 'DELETE' });

  if (res.status === 204) return true;

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`DELETE ${path} => ${res.status} ${res.statusText} | ${text}`);
  }

  return true;
}

async function refreshPendingsCounter() {
  if (!els.contadorFinalizados) return;

  const colunaId = Number(els.selectColuna?.value || 0) || '';
  const pendUi = els.selectFiltroPendencias?.value || 'todas';
  const pendencias = mapPendenciasUiToApi(pendUi);

  const params = new URLSearchParams();

  if (colunaId) params.set('coluna_id', colunaId);

  params.set('pendencias', pendencias);

  const data = await httpGet(`/pendings/count?${params.toString()}`);
  const total = data?.total ?? 0;

  const label =
    pendencias === 'pendentes'
      ? 'Abertas'
      : pendencias === 'concluidas'
        ? 'Concluídas'
        : 'Pendências';

  els.contadorFinalizados.textContent = `${label}: ${total}`;
}

document.addEventListener('DOMContentLoaded', () => {
  wireCustomerSearchButton();
  wireFormEvents();
  wireImportBudgetButton();
  wirePdfButton();

  reloadKanban().catch((err) => {
    console.error('[KANBAN] Erro inicial:', err);
    toastError('Erro ao carregar Kanban', err.message);
  });
});

function wireFormEvents() {
  if (els.formCriarCard) {
    els.formCriarCard.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      try {
        await criarNovoCard();
        await reloadKanban();
      } catch (err) {
        console.error('[KANBAN] erro ao criar card:', err);
        toastError('Erro ao criar card', err.message);
      }
    });
  }

  if (els.btnCriarCard) {
    els.btnCriarCard.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      els.formCriarCard?.requestSubmit();
    });
  }

  els.selectColuna?.addEventListener('change', async () => {
    renderBoard();

    try {
      await refreshPendingsCounter();
    } catch (err) {
      console.warn('[KANBAN] erro ao atualizar contador:', err);
    }
  });

  els.selectFiltroPendencias?.addEventListener('change', async () => {
    renderBoard();

    try {
      await refreshPendingsCounter();
    } catch (err) {
      console.warn('[KANBAN] erro ao atualizar contador:', err);
    }
  });
}

function wirePdfButton() {
  if (!els.btnBaixarPdfPendencias) return;

  els.btnBaixarPdfPendencias.addEventListener('click', () => {
    const colunaId = Number(els.selectColuna?.value || 0) || '';
    const pendUi = els.selectFiltroPendencias?.value || 'todas';
    const pendencias = mapPendenciasUiToApi(pendUi);

    const params = new URLSearchParams();

    if (colunaId) params.set('coluna_id', colunaId);

    params.set('pendencias', pendencias);

    const url = `${API_ROOT}/pendings/pdf?${params.toString()}`;
    window.open(url, '_blank');
  });
}

function baixarPdfSeparacao(card) {
  try {
    const separationNumber = String(card?.separation_number || '').trim();

    if (!separationNumber) {
      toastError(
        'Separação inválida',
        'Este card não possui número de separação.'
      );
      return;
    }

    const url = `${API_ROOT}/cards/${card.card_id}/separation-pdf`;
    window.open(url, '_blank');
  } catch (err) {
    console.error('[KANBAN] erro ao baixar PDF separação:', err);
    toastError('Erro ao baixar PDF', err.message);
  }
}

async function reloadKanban() {
  setLoading(true);

  try {
    const [columns, cards] = await Promise.all([
      httpGet('/columns'),
      httpGet('/cards'),
    ]);

    columnsCache = Array.isArray(columns) ? columns : [];
    cardsCache = Array.isArray(cards) ? cards : [];

    preencherSelectColuna(columnsCache);
    renderBoard();

    await refreshPendingsCounter();
  } finally {
    setLoading(false);
  }
}

function preencherSelectColuna(columns) {
  if (!els.selectColuna) return;

  const current = els.selectColuna.value;

  els.selectColuna.innerHTML = '';

  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'Todas as colunas';
  els.selectColuna.appendChild(optAll);

  columns
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.status;
      els.selectColuna.appendChild(o);
    });

  if (current && [...els.selectColuna.options].some((o) => o.value === current)) {
    els.selectColuna.value = current;
  }
}

function renderBoard() {
  if (!els.kanbanContainer) return;

  els.kanbanContainer.innerHTML = '';

  if (!columnsCache.length) {
    const msg = document.createElement('p');
    msg.textContent = 'Nenhuma coluna configurada para o Kanban.';
    msg.style.padding = '16px';
    msg.style.color = 'var(--muted)';
    els.kanbanContainer.appendChild(msg);
    return;
  }

  const filtroId = Number(els.selectColuna?.value || 0) || null;

  const cols = (
    filtroId
      ? columnsCache.filter((c) => Number(c.id) === filtroId)
      : columnsCache.slice()
  ).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  cols.forEach((col) => {
    const cards = cardsCache
      .filter((c) => {
        const cid = Number(c.column_id);

        if (!Number.isNaN(cid) && cid === Number(col.id)) return true;

        if (
          !cid &&
          c.status &&
          col.status &&
          String(c.status).toLowerCase() === String(col.status).toLowerCase()
        ) {
          return true;
        }

        return false;
      })
      .sort((a, b) => (a.card_id ?? 0) - (b.card_id ?? 0));

    const colEl = document.createElement('div');
    colEl.className = 'ok-kanban-column';
    colEl.dataset.columnId = col.id;

    const header = document.createElement('div');
    header.className = 'ok-kanban-column-header';
    header.innerHTML = `
      <div class="ok-kanban-column-title">
        ${escapeHtml(col.status)}
        <span>${cards.length} card(s)</span>
      </div>
      <span class="ok-kanban-column-badge">${cards.length}</span>
    `;

    const list = document.createElement('div');
    list.className = 'ok-kanban-list';

    cards.forEach((card) => {
      list.appendChild(createCardElement(card));
    });

    colEl.appendChild(header);
    colEl.appendChild(list);
    els.kanbanContainer.appendChild(colEl);

    if (window.Sortable) {
      new Sortable(list, {
        group: 'orders-kanban',
        animation: 150,
        ghostClass: 'ok-card-ghost',
        onEnd(evt) {
          const cardEl = evt.item;
          const newColEl = cardEl.closest('.ok-kanban-column');

          if (!newColEl) return;

          const cardId = Number(cardEl.dataset.cardId);
          const columnId = Number(newColEl.dataset.columnId);

          if (!cardId || !columnId) return;

          moveCard(cardId, columnId);
        }
      });
    }
  });
}

function createCardElement(card) {
  const el = document.createElement('article');

  el.className = card.is_urgent ? 'ok-card ok-card-urgent' : 'ok-card';
  el.dataset.cardId = card.card_id;

  const urgenteChip = card.is_urgent
    ? '<span class="ok-card-chip ok-chip-urgent">URGENTE</span>'
    : '';

  el.innerHTML = `
    <div class="ok-card-header">
      <div class="ok-card-title">
        ${escapeHtml(card.customer_name || 'Cliente não informado')}
      </div>
      <div class="ok-card-chip-group">${urgenteChip}</div>
    </div>

    <div class="ok-card-body">
      <div>
        <span class="ok-mini-label">CNPJ/CPF:</span>
        <span>${escapeHtml(card.customer_tax_id || '-')}</span>
      </div>

      <div>
        <span class="ok-mini-label">Nº separação:</span>
        <span>${escapeHtml(card.separation_number || '-')}</span>
      </div>

      <div>
        <span class="ok-mini-label">Observações:</span>
        <span>${escapeHtml(card.note || '—')}</span>
      </div>
    </div>

    <div class="ok-card-footer">
      <button type="button" class="btn btn-sm btn-flat js-pendencias" title="Pendências">
        📌
      </button>

      <button type="button" class="btn btn-sm btn-flat js-editar" title="Editar card">
        ✏️
      </button>

      <button type="button" class="btn btn-sm btn-flat js-detalhes" title="Detalhes do cliente">
        👤
      </button>

      <button type="button" class="btn btn-sm btn-flat js-pdf-separacao" title="PDF separação">
        📄
      </button>

      <button type="button" class="btn btn-sm btn-primary js-urgente" title="Urgente">
        ${card.is_urgent ? 'Tirar Urgente' : '🚨'}
      </button>

      <button type="button" class="btn btn-sm btn-secondary js-finalizar" title="Finalizar">
        ✅
      </button>

      <button type="button" class="btn btn-sm btn-danger js-excluir" title="Excluir">
        🗑️
      </button>
    </div>
  `;

  el.querySelector('.js-pendencias')?.addEventListener('click', () => {
    const pendUi = els.selectFiltroPendencias?.value || 'todas';
    const pendencias = mapPendenciasUiToApi(pendUi);

    openOrdersKanbanPendenciasModal({
      apiRoot: API_ROOT,
      apiBase: window.apiBase || '',
      card,
      pendencias,
      onChanged: reloadKanban,
      toastError
    });
  });

  el.querySelector('.js-editar')?.addEventListener('click', () => {
    openOrdersKanbanEditCardModal({
      apiRoot: API_ROOT,
      apiBase: window.apiBase || '',
      card,
      onSaved: reloadKanban,
      toastError
    });
  });
  el.querySelector('.js-detalhes')?.addEventListener('click', () => mostrarDetalhesCliente(card));
  el.querySelector('.js-pdf-separacao')?.addEventListener('click', () => baixarPdfSeparacao(card));
  el.querySelector('.js-urgente')?.addEventListener('click', () => toggleUrgente(card));
  el.querySelector('.js-finalizar')?.addEventListener('click', () => finalizarCard(card));
  el.querySelector('.js-excluir')?.addEventListener('click', () => excluirCard(card));

  return el;
}

// ─── Importar orçamento → card na primeira coluna ─────────────────────
function wireImportBudgetButton() {
  els.btnImportarOrcamento?.addEventListener('click', (ev) => {
    ev.preventDefault();
    openBudgetsModal({
      subtitle: 'Selecione um orçamento para criar um card no Kanban.',
      onSelect: (budget) => importarOrcamento(budget)
    });
  });
}

async function importarOrcamento(budget) {
  const budgetId = Number(budget?.budget_id ?? budget?.id);
  if (!budgetId) {
    toastError('Orçamento inválido', 'Não foi possível identificar o orçamento selecionado.');
    return;
  }

  try {
    const res = await fetch(`${API_ROOT}/cards/from-budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget_id: budgetId })
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toastError('Não foi possível importar', data.erro || `Erro ${res.status} ao importar o orçamento.`);
      return;
    }

    await reloadKanban();

    showCenterModal({
      variant: 'success',
      title: 'Orçamento importado',
      message: escapeHtml(`Orçamento ${budgetId} — ${budget.customer_name || 'cliente'} adicionado ao Kanban.`),
      timeoutMs: 3500
    });
  } catch (err) {
    console.error('[KANBAN] erro ao importar orçamento:', err);
    toastError('Erro ao importar orçamento', err.message);
  }
}

async function criarNovoCard() {
  const customerId = els.hiddenClienteId?.value;
  const separation = els.inputNumeroSeparacao?.value?.trim() || null;
  const note = els.inputObservacao?.value?.trim() || '';

  if (!customerId) {
    toastError('Cliente obrigatório', 'Selecione um cliente para criar o card.');
    return;
  }

  const primeiraColuna = columnsCache[0];
  const status = primeiraColuna?.status || 'Em Separação';

  await httpPost('/cards', {
    customer_id: Number(customerId),
    separation_number: separation,
    note,
    status
  });

  if (els.inputObservacao) els.inputObservacao.value = '';
  if (els.inputNumeroSeparacao) els.inputNumeroSeparacao.value = '';
}

async function moveCard(cardId, columnId) {
  try {
    await httpPatch(`/cards/${cardId}/move`, { column_id: columnId });
    await reloadKanban();
  } catch (err) {
    console.error('[KANBAN] erro ao mover card:', err);
    toastError('Erro ao mover card', err.message);
  }
}

async function toggleUrgente(card) {
  try {
    await httpPatch(`/cards/${card.card_id}/urgent`, {
      is_urgent: !card.is_urgent
    });

    await reloadKanban();
  } catch (err) {
    console.error('[KANBAN] erro ao alterar urgência:', err);
    toastError('Erro ao alterar urgência', err.message);
  }
}

async function finalizarCard(card) {
  try {
    const data = await httpGet(`/cards/${card.card_id}/pendings?pendencias=pendentes`);

    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data?.pendings)
          ? data.pendings
          : [];

    const pendenciasAbertas = rows.filter((p) => {
      const status = normText(p.status || p.situacao || '');
      return !status.includes('concl') && !status.includes('finaliz') && !status.includes('done');
    });

    if (pendenciasAbertas.length > 0) {
      await showCenterModal({
        variant: 'warning',
        title: 'Card com pendências',
        message: `
          <div style="line-height:1.7; text-align:left">
            Este card possui <strong>${pendenciasAbertas.length}</strong> pendência(s) aberta(s).
            <br><br>
            Finalize as pendências antes de concluir o card.
          </div>
        `,
        timeoutMs: null,
        buttons: [{ label: 'OK', variant: 'ok' }]
      });

      return;
    }

    const result = await showCenterModal({
      variant: 'warning',
      title: 'Finalizar card',
      message: `
        <div style="line-height:1.6; text-align:left">
          Deseja finalizar o card <strong>#${escapeHtml(card.card_id)}</strong>?
          <br><br>
          Cliente: <strong>${escapeHtml(card.customer_name || '-')}</strong>
        </div>
      `,
      timeoutMs: null,
      buttons: [
        { label: 'Cancelar', variant: 'cancel', action: () => false },
        { label: 'Finalizar', variant: 'success', action: () => true }
      ]
    });

    if (!result) return;

    await httpPatch(`/cards/${card.card_id}/finish`);

    await showCenterModal({
      variant: 'success',
      title: 'Card finalizado',
      message: 'O card foi finalizado com sucesso.',
      timeoutMs: 2500
    });

    await reloadKanban();
  } catch (err) {
    console.error('[KANBAN] erro ao finalizar card:', err);
    toastError('Erro ao finalizar card', err.message);
  }
}

async function excluirCard(card) {
  const result = await showCenterModal({
    variant: 'warning',
    title: 'Excluir card',
    message: `
      <div style="line-height:1.6; text-align:left">
        Deseja realmente excluir o card <strong>#${escapeHtml(card.card_id)}</strong>?
        <br><br>
        Cliente: <strong>${escapeHtml(card.customer_name || '-')}</strong>
        <br>
        Nº Separação: <strong>${escapeHtml(card.separation_number || '-')}</strong>
      </div>
    `,
    timeoutMs: null,
    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => false
      },
      {
        label: 'Excluir',
        variant: 'danger',
        action: () => true
      }
    ]
  });

  if (!result) return;

  try {
    await httpDelete(`/cards/${card.card_id}`);

    await showCenterModal({
      variant: 'success',
      title: 'Card excluído',
      message: 'O card foi excluído com sucesso.',
      timeoutMs: 2500
    });

    await reloadKanban();
  } catch (err) {
    console.error('[KANBAN] erro ao excluir card:', err);
    toastError('Erro ao excluir card', err.message);
  }
}

function mostrarDetalhesCliente(card) {
  showCenterModal({
    variant: 'info',
    title: 'Detalhes do cliente',
    message: `
      <div style="line-height:1.7; text-align:left">
        <strong>Cliente:</strong> ${escapeHtml(card.customer_name || '-')}<br>
        <strong>CNPJ/CPF:</strong> ${escapeHtml(card.customer_tax_id || '-')}<br>
        <strong>Nº Separação:</strong> ${escapeHtml(card.separation_number || '-')}<br>
        <strong>Observações:</strong> ${escapeHtml(card.note || '—')}
      </div>
    `,
    timeoutMs: null,
    buttons: [
      {
        label: 'Fechar',
        variant: 'close'
      }
    ]
  });
}

function wireCustomerSearchButton() {
  if (!els.inputCliente || !els.hiddenClienteId || !els.btnBuscarCliente) return;

  els.btnBuscarCliente.addEventListener('click', async () => {
    try {
      const mod = await import('/public/modalsSearch/customersModalSearch.js');

      if (typeof mod.openCustomersModalSearch !== 'function') return;

      mod.openCustomersModalSearch({
        apiBase: window.apiBase || '',
        onPick(customer) {
          els.inputCliente.value = `${customer.trade_name || customer.legal_name || ''} (${customer.tax_id || ''})`;
          els.hiddenClienteId.value = customer.customer_id ?? customer.id ?? '';
        }
      });
    } catch (err) {
      console.error('[KANBAN] erro ao abrir modal de clientes:', err);
      toastError('Erro ao abrir busca de clientes', err.message);
    }
  });
}