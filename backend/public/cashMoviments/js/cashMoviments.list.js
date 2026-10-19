// ╔══════════════════════════════════════════════════════════════════════╗
// ║ cash.list.js — Listagem/paginação/ordenação + resumo                ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { API, PATH_MOV, PAGE_SIZE } from './cashMoviments.config.js';
import { state } from './cashMoviments.state.js';

import {
  LE, L,
  fmtBRL, fmtDateTimeLocal,
  badgeAnexo,
  normalizeRow,
} from './cashMoviments.utils.js';

import { buildQueryFromFilters } from './cashMoviments.filters.js';
import { actionIconSvg, actionIconsHtml } from '/public/includes/js/actionIcons.js';
import { atualizarBadgeAnexo } from './cashMoviments.attachments.js';

function getPageSize(dom) {
  const selectedSize = Number(dom?.elRowsPerPage?.value);
  return Number.isInteger(selectedSize) && selectedSize > 0
    ? selectedSize
    : PAGE_SIZE;
}

const selectedMovementIds = new Set();

let paginationBusy = false;

export function getSelectedMovementIds() {
  return [...selectedMovementIds];
}

export function clearMovementSelection(dom) {
  selectedMovementIds.clear();
  atualizarInterfaceSelecao(dom);
}

export function atualizarInterfaceSelecao(dom) {
  if (!dom?.elTabelaBody) return;

  const checkboxes = [
    ...dom.elTabelaBody.querySelectorAll('.movement-row-checkbox'),
  ];

  checkboxes.forEach((checkbox) => {
    const id = Number(checkbox.dataset.id);
    const selected = selectedMovementIds.has(id);

    checkbox.checked = selected;
    checkbox.closest('tr')?.classList.toggle('is-selected', selected);
  });

  const totalDaPagina = checkboxes.length;

  const selecionadosDaPagina = checkboxes.filter((checkbox) => {
    return selectedMovementIds.has(Number(checkbox.dataset.id));
  }).length;

  if (dom.elSelecionarTodas) {
    dom.elSelecionarTodas.checked =
      totalDaPagina > 0 &&
      selecionadosDaPagina === totalDaPagina;

    dom.elSelecionarTodas.indeterminate =
      selecionadosDaPagina > 0 &&
      selecionadosDaPagina < totalDaPagina;

    dom.elSelecionarTodas.disabled = totalDaPagina === 0;
  }

  if (dom.elBtnExcluirSelecionados) {
    const totalSelecionados = selectedMovementIds.size;

    dom.elBtnExcluirSelecionados.disabled = totalSelecionados === 0;
    dom.elBtnExcluirSelecionados.textContent =
      `🗑️ selecionados (${totalSelecionados})`;
  }

  if (dom.elBtnEditarSelecionados) {
    const totalSelecionados = selectedMovementIds.size;

    dom.elBtnEditarSelecionados.disabled = totalSelecionados === 0;
    dom.elBtnEditarSelecionados.textContent =
      `✏️ Editar selecionados (${totalSelecionados})`;
  }
}

export function toggleMovementSelection(dom, id, checked) {
  const movementId = Number(id);

  if (!Number.isInteger(movementId) || movementId <= 0) return;

  if (checked) {
    selectedMovementIds.add(movementId);
  } else {
    selectedMovementIds.delete(movementId);
  }

  atualizarInterfaceSelecao(dom);
}

export function toggleAllMovementsOnPage(dom, checked) {
  if (!dom?.elTabelaBody) return;

  const checkboxes = dom.elTabelaBody.querySelectorAll(
    '.movement-row-checkbox'
  );

  checkboxes.forEach((checkbox) => {
    const id = Number(checkbox.dataset.id);

    if (!Number.isInteger(id) || id <= 0) return;

    if (checked) {
      selectedMovementIds.add(id);
    } else {
      selectedMovementIds.delete(id);
    }
  });

  atualizarInterfaceSelecao(dom);
}

export async function excluirMovimentacoesSelecionadas(dom) {
  const ids = getSelectedMovementIds();

  if (!ids.length) {
    window.alert('Selecione pelo menos uma movimentação.');
    return;
  }

  const confirmed = window.confirm(
    `Deseja excluir permanentemente ${ids.length} ` +
    `${ids.length === 1 ? 'movimentação selecionada' : 'movimentações selecionadas'}?\n\n` +
    'Essa operação não poderá ser desfeita.'
  );

  if (!confirmed) return;

  const button = dom.elBtnExcluirSelecionados;
  const originalText = button?.textContent || '';

  try {
    if (button) {
      button.disabled = true;
      button.textContent = '⏳ Excluindo...';
    }

    const response = await fetch(`${API}/${PATH_MOV}/lote`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error ||
        result.message ||
        `Falha ao excluir movimentações: ${response.status}`
      );
    }

    selectedMovementIds.clear();

    const totalExcluido = Number(result.deleted || ids.length);

    /*
     * Se todos os registros da página forem excluídos e não for a primeira
     * página, volta uma página para evitar uma página vazia.
     */
    const quantidadeLinhas =
      dom.elTabelaBody?.querySelectorAll('tr').length || 0;

    if (
      state.paginaAtual > 1 &&
      totalExcluido >= quantidadeLinhas
    ) {
      state.paginaAtual--;
    }

    await recarregarLista(dom);

    window.alert(
      `${totalExcluido} ` +
      `${totalExcluido === 1 ? 'movimentação foi excluída' : 'movimentações foram excluídas'} com sucesso.`
    );
  } catch (error) {
    LE('[CAIXA][DELETE_BATCH]', error);

    window.alert(
      error?.message ||
      'Não foi possível excluir as movimentações selecionadas.'
    );

    atualizarInterfaceSelecao(dom);
  } finally {
    if (button && !selectedMovementIds.size) {
      button.textContent = '🗑️ Excluir selecionados (0)';
      button.disabled = true;
    } else if (button) {
      button.textContent = originalText;
      atualizarInterfaceSelecao(dom);
    }
  }
}

export async function recarregarLista(dom) {
  if (state.carregandoMovs) {
    try { state.movsAbortCtrl?.abort(); } catch { }
  }

  state.carregandoMovs = true;
  state.movsAbortCtrl = new AbortController();

  try {
    const pageSize = getPageSize(dom);
    const params = buildQueryFromFilters(dom, { list: true });

    params.set('page', String(state.paginaAtual));
    params.set('limit', String(pageSize));
    params.set('pageSize', String(pageSize));
    params.set(
      'offset',
      String((state.paginaAtual - 1) * pageSize)
    );

    let url = `${API}/${PATH_MOV}?${params.toString()}`;

    let r = await fetch(url, { signal: state.movsAbortCtrl.signal });

    // fallback: se orderBy não existe no backend
    if (!r.ok) {
      const p2 = new URLSearchParams(params);
      p2.delete('orderBy');
      url = `${API}/${PATH_MOV}?${p2.toString()}`;
      r = await fetch(url, { signal: state.movsAbortCtrl.signal });
      if (!r.ok) throw new Error(`Falha ao listar: ${r.status}`);
    }

    const data = await r.json().catch(() => ({}));

    const rows = Array.isArray(data.items) ? data.items
      : Array.isArray(data.rows) ? data.rows
        : [];

    state.totalRegistros = Number(data.total || rows.length || 0);

    if (dom.elTableInfo) {
      dom.elTableInfo.textContent =
        `${state.totalRegistros} ${state.totalRegistros === 1
          ? 'registro'
          : 'registros'
        }`;
    }

    renderTabela(dom, rows);
    renderPaginacao(dom);

    if (
      dom.elTotalMovimentacoesFiltradas ||
      dom.elResumoEntradas ||
      dom.elResumoSaidas ||
      dom.elResumoSaldo
    ) {
      await carregarResumo(dom);
    }

    // Correct
    if (document.getElementById('tab-movs')?.classList.contains('is-active')) {
      window.__fitMovsHeight?.();
    }
  }
  catch (e) {
    if (e?.name !== 'AbortError') {
      LE(e);
      renderTabela(dom, []);
      renderPaginacao(dom);

      if (dom.elResumoEntradas) dom.elResumoEntradas.textContent = '—';
      if (dom.elResumoSaidas) dom.elResumoSaidas.textContent = '—';
      if (dom.elResumoSaldo) dom.elResumoSaldo.textContent = '—';
      if (dom.elTotalMovimentacoesFiltradas) {
        dom.elTotalMovimentacoesFiltradas.textContent = '—';
      }
    }
  } finally {
    state.carregandoMovs = false;
  }
}

export async function carregarResumo(dom) {
  try {
    const params = buildQueryFromFilters(dom);
    const r = await fetch(`${API}/summary?${params.toString()}`);
    if (!r.ok) throw new Error('Sem /summary no backend');

    const sum = await r.json();

    const totalEntradas = Number(sum.total_entradas || 0);
    const totalSaidas = Number(sum.total_saidas || 0);
    const totalFiltrado = totalEntradas + totalSaidas;

    if (dom.elResumoEntradas) dom.elResumoEntradas.textContent = fmtBRL(totalEntradas);
    if (dom.elResumoSaidas) dom.elResumoSaidas.textContent = fmtBRL(totalSaidas);
    if (dom.elResumoSaldo) dom.elResumoSaldo.textContent = fmtBRL(sum.saldo || 0);
    if (dom.elTotalMovimentacoesFiltradas) {
      dom.elTotalMovimentacoesFiltradas.textContent = fmtBRL(totalFiltrado);
    }

  } catch (e) {
    L('Resumo indisponível:', e.message);
    if (dom.elTotalMovimentacoesFiltradas) {
      dom.elTotalMovimentacoesFiltradas.textContent = '—';
    }
  }
}

export function renderTabela(dom, items) {
  if (!dom.elTabelaBody) return;

  dom.elTabelaBody.innerHTML = '';

  (items || []).forEach(raw => {
    const row = normalizeRow(raw);

    const contaLabel = row.conta_nome
      || (row.conta_id != null ? state.ACCS.getName(row.conta_id) : '')
      || String(raw.conta_nome ?? raw.conta_caixa_nome ?? raw.conta ?? raw.banco ?? raw.carteira ?? raw.conta_caixa ?? '');

    const catLabel = row.categoria_nome
      || (row.categoria_id != null ? (state.CATS.getCatName(row.categoria_id) || String(row.categoria_id)) : '')
      || String(raw.categoria_nome ?? raw.categoria_desc ?? raw.categoria_texto ?? raw.categoria ?? '');

    const subLabel = row.subcategoria_nome
      || (row.subcategoria_id != null
        ? (state.CATS.getSubName(row.categoria_id, row.subcategoria_id) || String(row.subcategoria_id))
        : '')
      || String(raw.subcategoria_nome ?? raw.subcategoria_desc ?? raw.subcategoria_texto ?? raw.subcategoria ?? '');

    // A API já devolve código e descrição da conta contábil pelo JOIN
    // em "chartOfAccounts", então basta montar o rótulo com o que veio.
    const chartAccountLabel =
      raw.chart_account_code && raw.chart_account_description
        ? `${raw.chart_account_code} - ${raw.chart_account_description}`
        : '';

    const total = Number(row.valor || 0)
      + Number(row.multa || 0)
      + Number(row.juros || 0)
      + Number(row.encargos || 0);

    const tr = document.createElement('tr');
    tr.dataset.id = row.id;

    tr.innerHTML = `
  <td data-label="Selecionar" class="table-cell-select">
    <input
      type="checkbox"
      class="movement-row-checkbox"
      data-id="${row.id}"
      aria-label="Selecionar movimentação ${row.id}"
      title="Selecionar esta movimentação"
      ${selectedMovementIds.has(Number(row.id)) ? 'checked' : ''}
    />
  </td>
  <td data-label="Nº Doc">${row.numero_doc || ''}</td>
  <td data-label="Tipo">${row.tipo || ''}</td>

  <td
  data-label="Nome"
  title="${String(row.nome || '').replace(/"/g, '&quot;')}"
>
  ${String(row.nome || '').slice(0, 30)}${String(row.nome || '').length > 30 ? '…' : ''}
</td>

  <td
  data-label="Data"
  title="${fmtDateTimeLocal(row.data_hora)}"
>
  ${fmtDateTimeLocal(row.data_hora).split(',')[0]}
</td>

  <td data-label="Total"><strong>${fmtBRL(total)}</strong></td>
  <td data-label="Multa">${fmtBRL(row.multa)}</td>
  <td data-label="Juros">${fmtBRL(row.juros)}</td>
  <td data-label="Encargos">${fmtBRL(row.encargos)}</td>
  <td data-label="Valor">${fmtBRL(row.valor)}</td>
<td data-label="Conta">${contaLabel}</td>

<td
  data-label="Plano de Contas"
  title="${String(chartAccountLabel || '').replace(/"/g, '&quot;')}"
>
  ${chartAccountLabel || ''}
</td>

<td data-label="Categoria">
  ${catLabel || ''}
</td>

<td data-label="Subcategoria">
  ${subLabel || ''}
</td>
  <td data-label="Observação" class="observation-cell">
  ${row.observacao
        ? `
      <span
        class="action-icon action-icon--document hover-mouse-shows hover-shows-bottom hover-shows-width-md"
        tabindex="0"
        aria-label="Visualizar observação"
        data-hover-text="${String(row.observacao)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}"
      >${actionIconSvg('document')}</span>
    `
        : '—'
      }
</td>
  <td data-label="Anexos" class="col-anexo">${badgeAnexo('loading')}</td>
<td data-label="Ações" class="col-acoes">
  ${actionIconsHtml([
    { action: 'edit', title: 'Editar movimentação', attrs: { 'data-act': 'edit', 'data-id': row.id } },
    { action: 'delete', title: 'Excluir movimentação', attrs: { 'data-act': 'del', 'data-id': row.id } },
  ])}
</td>
`;

    dom.elTabelaBody.appendChild(tr);

    // Badge anexos
    const cell = tr.querySelector('.col-anexo');

    if (row.anexos && Array.isArray(row.anexos)) {
      const c = row.anexos.length;
      cell.innerHTML = c > 0 ? badgeAnexo('ok', c) : badgeAnexo('none');
    } else if (row.id) {
      atualizarBadgeAnexo(row.id, cell);
    } else {
      cell.innerHTML = badgeAnexo('none');
    }
  });

  atualizarInterfaceSelecao(dom);
}

export function renderPaginacao(dom) {
  const pageSize = getPageSize(dom);

  const totalPages = Math.max(
    1,
    Math.ceil(state.totalRegistros / pageSize)
  );

  /*
   * Corrige automaticamente a página atual caso uma exclusão ou
   * alteração dos filtros reduza a quantidade total de páginas.
   */
  if (state.paginaAtual > totalPages) {
    state.paginaAtual = totalPages;
  }

  if (dom.elInfoPagina) {
    dom.elInfoPagina.textContent =
      `Página ${state.paginaAtual} de ${totalPages}`;
  }

  if (dom.elPagAnt) {
    dom.elPagAnt.disabled =
      state.paginaAtual <= 1 ||
      state.totalRegistros === 0;
  }

  if (dom.elPagProx) {
    dom.elPagProx.disabled =
      state.paginaAtual >= totalPages ||
      state.totalRegistros === 0;
  }

  if (dom.elTableInfo) {
    dom.elTableInfo.textContent =
      `${state.totalRegistros} ${state.totalRegistros === 1
        ? 'registro'
        : 'registros'
      }`;
  }
}

export async function onPagAnterior(dom) {
  if (paginationBusy || state.paginaAtual <= 1) return;

  paginationBusy = true;

  try {
    if (dom.elPagAnt) dom.elPagAnt.disabled = true;
    if (dom.elPagProx) dom.elPagProx.disabled = true;

    state.paginaAtual -= 1;

    await recarregarLista(dom);
  } catch (error) {
    /*
     * Restaura a página quando a requisição falhar.
     */
    state.paginaAtual += 1;
    throw error;
  } finally {
    paginationBusy = false;
    renderPaginacao(dom);
  }
}

export async function onPagProxima(dom) {
  if (paginationBusy) return;

  const pageSize = getPageSize(dom);

  const totalPages = Math.max(
    1,
    Math.ceil(state.totalRegistros / pageSize)
  );

  if (state.paginaAtual >= totalPages) return;

  paginationBusy = true;

  try {
    if (dom.elPagAnt) dom.elPagAnt.disabled = true;
    if (dom.elPagProx) dom.elPagProx.disabled = true;

    state.paginaAtual += 1;

    await recarregarLista(dom);
  } catch (error) {
    /*
     * Restaura a página quando a requisição falhar.
     */
    state.paginaAtual -= 1;
    throw error;
  } finally {
    paginationBusy = false;
    renderPaginacao(dom);
  }
}
