// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cashMoviments.events.js — Bind de eventos                           ║
// ║ PRODNEX ERP | Caixa (Frontend ESM)                                  ║
// ║ ✅ Sem dependências circulares                                       ║
// ║ ✅ Centraliza chamadas de recarregarLista()                          ║
// ║ ✅ Abas compatíveis com tabs.css                                     ║
// ║ ✅ Delegação segura para Editar/Excluir                              ║
// ║ ✅ Proteção contra inicialização duplicada                           ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { state } from './cashMoviments.state.js';

import {
  recarregarLista,
  onPagAnterior,
  onPagProxima,
  toggleMovementSelection,
  toggleAllMovementsOnPage,
  excluirMovimentacoesSelecionadas,
} from './cashMoviments.list.js';

import {
  onCreateSubmit,
} from './cashMoviments.create.js?v=8';

import { openBatchEditModal } from './cashMoviments.batchEdit.js';
import { isCmvSubcategory } from './cashMoviments.editModal.js';

import { applyAnoMes } from './cashMoviments.filters.js';

import {
  carregarSubcategoriasFiltro,
  encadearSubcategorias,
} from './cashMoviments.categories.js';

import {
  onAbrirRelatorioPdf,
  onBaixarZipPeriodo,
} from './cashMoviments.reports.js';

import {
  onTabelaClick,
  fecharModalEditar,
  onSubmitEdicao,
} from './cashMoviments.editModal.js';

// Impede que todos os listeners sejam registrados mais de uma vez.
let eventsBound = false;

export function bindEvents(dom) {
  if (eventsBound) {
    console.warn('[CAIXA][EVENTS] Eventos já inicializados.');
    return;
  }

  if (!dom) {
    console.error('[CAIXA][EVENTS] Objeto DOM não informado.');
    return;
  }

  eventsBound = true;

  console.log('[CAIXA][EVENTS] bindEvents inicializado');

  // ────────────────────────────────────────────────────────────────────
  // ABAS
  // ────────────────────────────────────────────────────────────────────
  const tabsContainer = document.querySelector('.tabs');

  tabsContainer?.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const selectedTab = event.target.closest('.tab');

    if (
      !selectedTab ||
      !tabsContainer.contains(selectedTab) ||
      selectedTab.disabled
    ) {
      return;
    }

    const selectedPanelId = selectedTab.getAttribute('aria-controls');

    if (!selectedPanelId) {
      console.error(
        '[CAIXA][TABS] A aba não possui o atributo aria-controls.',
        selectedTab
      );
      return;
    }

    const selectedPanel = document.getElementById(selectedPanelId);

    if (!selectedPanel) {
      console.error(
        `[CAIXA][TABS] Painel não encontrado: #${selectedPanelId}`
      );
      return;
    }

    tabsContainer.querySelectorAll('.tab').forEach((tab) => {
      const isActive = tab === selectedTab;

      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    document.querySelectorAll('.tab-panel').forEach((panel) => {
      const isActive = panel === selectedPanel;

      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    });

    if (selectedPanelId === 'tab-movs') {
      requestAnimationFrame(() => {
        window.__fitMovsHeight?.();
      });
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // CREATE
  // ────────────────────────────────────────────────────────────────────
  dom.elFormCreate?.addEventListener('submit', async (event) => {
    await onCreateSubmit(dom, event);
  });

  dom.elBtnNova?.addEventListener('click', () => {
    dom.elDataHora?.focus();
  });

  // ────────────────────────────────────────────────────────────────────
  // FILTROS / LISTAGEM
  // ────────────────────────────────────────────────────────────────────
  dom.elBtnFiltros?.addEventListener('click', async (event) => {
    event.preventDefault();

    state.paginaAtual = 1;
    await recarregarLista(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // PAGINAÇÃO
  // ────────────────────────────────────────────────────────────────────
  dom.elPagAnt?.addEventListener('click', async (event) => {
    event.preventDefault();
    await onPagAnterior(dom);
  });

  dom.elPagProx?.addEventListener('click', async (event) => {
    event.preventDefault();
    await onPagProxima(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // PAGINAÇÃO
  // ────────────────────────────────────────────────────────────────────
  dom.elPagAnt?.addEventListener('click', async (event) => {
    event.preventDefault();
    await onPagAnterior(dom);
  });

  dom.elPagProx?.addEventListener('click', async (event) => {
    event.preventDefault();
    await onPagProxima(dom);
  });

  dom.elRowsPerPage?.addEventListener('change', async (event) => {
    event.preventDefault();

    const pageSize = Number(event.currentTarget.value);

    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      console.error(
        '[CAIXA][PAGINATION] Quantidade de linhas inválida:',
        pageSize
      );
      return;
    }

    state.paginaAtual = 1;
    await recarregarLista(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // MODAL DE EDIÇÃO
  // ────────────────────────────────────────────────────────────────────
  dom.elBtnFecharModal?.addEventListener('click', (event) => {
    event.preventDefault();
    fecharModalEditar(dom);
  });

  dom.elBtnCancelarEdicao?.addEventListener('click', (event) => {
    event.preventDefault();
    fecharModalEditar(dom);
  });

  dom.elFormEdit?.addEventListener('submit', async (event) => {
    await onSubmitEdicao(dom, event);
  });

  // Esc é tratado pelo modal.js; aqui só limpa o formulário quando ele fecha.
  dom.modal?.addEventListener('modal:close', () => {
    if (state.movEmEdicao || window.__movIdEdicao) fecharModalEditar(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // SELEÇÃO E EXCLUSÃO EM LOTE
  // ────────────────────────────────────────────────────────────────────
  dom.elSelecionarTodas?.addEventListener('change', (event) => {
    toggleAllMovementsOnPage(dom, event.currentTarget.checked);
  });

  dom.elTabelaBody?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('.movement-row-checkbox');

    if (!checkbox) return;

    toggleMovementSelection(
      dom,
      checkbox.dataset.id,
      checkbox.checked
    );
  });

  dom.elBtnExcluirSelecionados?.addEventListener('click', async (event) => {
    event.preventDefault();
    await excluirMovimentacoesSelecionadas(dom);
  });

  dom.elBtnEditarSelecionados?.addEventListener('click', async (event) => {
    event.preventDefault();
    await openBatchEditModal(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // AÇÕES DA TABELA — EDITAR / EXCLUIR
  // ────────────────────────────────────────────────────────────────────
  document.addEventListener('click', async (event) => {
    if (!(event.target instanceof Element)) return;

    const actionButton = event.target.closest(
      '#corpoTabelaMovimentacoes button[data-act]'
    );

    if (!actionButton) return;

    event.preventDefault();
    event.stopPropagation();

    const action = actionButton.dataset.act;
    const id = Number(actionButton.dataset.id);

    console.log('[CAIXA][EVENTS] Ação detectada:', {
      action,
      id,
    });

    if (!Number.isInteger(id) || id <= 0) {
      console.error(
        '[CAIXA][EVENTS] ID inválido:',
        actionButton.dataset.id
      );

      window.alert('Não foi possível identificar a movimentação.');
      return;
    }

    try {
      await onTabelaClick(dom, event);
    } catch (error) {
      console.error(
        '[CAIXA][EVENTS] Erro ao processar ação da tabela:',
        error
      );

      window.alert('Não foi possível executar a ação selecionada.');
    }
  });

  // ────────────────────────────────────────────────────────────────────
  // FILTRO Q — ENTER + DEBOUNCE
  // ────────────────────────────────────────────────────────────────────
  dom.elFiltroQ?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;

    event.preventDefault();

    state.paginaAtual = 1;
    await recarregarLista(dom);
  });

  let qTimer = null;

  dom.elFiltroQ?.addEventListener('input', () => {
    window.clearTimeout(qTimer);

    qTimer = window.setTimeout(async () => {
      state.paginaAtual = 1;
      await recarregarLista(dom);
    }, 400);
  });

  // ────────────────────────────────────────────────────────────────────
  // ANO/MÊS — APLICA DE/ATÉ E RECARREGA
  // ────────────────────────────────────────────────────────────────────
  dom.elFiltroAno?.addEventListener('change', async () => {
    applyAnoMes(dom);

    state.paginaAtual = 1;
    await recarregarLista(dom);
  });

  dom.elFiltroMesSel?.addEventListener('change', async () => {
    applyAnoMes(dom);

    state.paginaAtual = 1;
    await recarregarLista(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // PERÍODO (date-range-field) — "Aplicar" no calendário RECARREGA
  // ────────────────────────────────────────────────────────────────────
  dom.elFiltroPeriodo?.addEventListener('range-change', async () => {
    state.paginaAtual = 1;
    await recarregarLista(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // MODAL DE OBSERVAÇÃO — CADASTRO
  // ────────────────────────────────────────────────────────────────────
  const fecharObs = () => {
    dom.modalObs?.setAttribute('hidden', '');
  };

  dom.elBtnObsAbrir?.addEventListener('click', (event) => {
    event.preventDefault();

    if (dom.elObsModal) {
      dom.elObsModal.value = dom.elObsHidden?.value || '';
    }

    dom.modalObs?.removeAttribute('hidden');
    dom.elObsModal?.focus();
  });

  dom.elBtnObsFecharX?.addEventListener('click', (event) => {
    event.preventDefault();
    fecharObs();
  });

  dom.elBtnObsCancelar?.addEventListener('click', (event) => {
    event.preventDefault();
    fecharObs();
  });

  dom.elBtnObsSalvar?.addEventListener('click', (event) => {
    event.preventDefault();

    if (dom.elObsHidden) {
      dom.elObsHidden.value = dom.elObsModal?.value || '';
    }

    fecharObs();
  });

  // ────────────────────────────────────────────────────────────────────
  // CATEGORIA / SUBCATEGORIA — CADASTRO E EDIÇÃO
  // ────────────────────────────────────────────────────────────────────
  dom.elCategoria?.addEventListener('change', async () => {
    await encadearSubcategorias(
      dom,
      dom.elCategoria,
      dom.elSubcategoria
    );
  });

  dom.elEditCategoria?.addEventListener('change', async () => {
    await encadearSubcategorias(
      dom,
      dom.elEditCategoria,
      dom.elEditSubcategoria
    );
  });

  // Dedutível no PIS/COFINS: C.M.V (compra para revenda) sugere "Sim".
  const sugerirPisCofins = (subSelect, pisSelect) => {
    if (!subSelect || !pisSelect) return;
    const name = subSelect.selectedOptions?.[0]?.textContent || '';
    pisSelect.value = isCmvSubcategory(name) ? 'true' : 'false';
  };

  dom.elSubcategoria?.addEventListener('change', () => {
    sugerirPisCofins(dom.elSubcategoria, dom.elIsPisCofinsCreditable);
  });

  dom.elEditSubcategoria?.addEventListener('change', () => {
    sugerirPisCofins(dom.elEditSubcategoria, dom.elEditIsPisCofinsCreditable);
  });

  // ────────────────────────────────────────────────────────────────────
  // FILTRO DE SUBCATEGORIA
  // ────────────────────────────────────────────────────────────────────
  dom.elFiltroCat?.addEventListener('change', async () => {
    await carregarSubcategoriasFiltro(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // RELATÓRIO / ZIP
  // ────────────────────────────────────────────────────────────────────
  dom.elBtnRelatorio?.addEventListener('click', async (event) => {
    event.preventDefault();
    await onAbrirRelatorioPdf(dom);
  });

  dom.elBtnZip?.addEventListener('click', async (event) => {
    event.preventDefault();
    await onBaixarZipPeriodo(dom);
  });

  // ────────────────────────────────────────────────────────────────────
  // ORDENAÇÃO
  // ────────────────────────────────────────────────────────────────────
  dom.thSort?.forEach((th) => {
    th.style.cursor = 'pointer';

    th.addEventListener('click', async () => {
      const column = th.getAttribute('data-sort');

      if (!column) return;

      const [currentColumn, currentDirection] = String(
        state.orderBy || ''
      ).split(/\s+/);

      const newDirection =
        currentColumn === column &&
          String(currentDirection).toUpperCase() === 'DESC'
          ? 'ASC'
          : 'DESC';

      state.orderBy = `${column} ${newDirection}`;
      state.paginaAtual = 1;

      await recarregarLista(dom);
    });
  });
}