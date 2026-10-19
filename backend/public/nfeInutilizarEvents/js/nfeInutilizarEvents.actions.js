// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeInutilizarEvents.actions.js — Ações, binds e fluxo do módulo     ║
// ║ MODULE: NF-e Inutilização de Numeração                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { state } from './nfeInutilizarEvents.state.js';
import { getElements } from './nfeInutilizarEvents.utils.js';
import {
  consultarInutilizacao,
  createInutilizacao,
  getInutilizacaoById,
  listInutilizacoes,
} from './nfeInutilizarEvents.api.js';
import {
  applyCnpjMask,
  applyDefaultYear,
  buildFilterParams,
  buildPayload,
  resetFilters,
  resetForm,
  updateJustificationCounter,
  updateSummary,
} from './nfeInutilizarEvents.form.js';
import { validatePayload } from './nfeInutilizarEvents.validation.js';
import {
  renderDetails,
  renderDetailsError,
  renderTable,
  setDetailLoading,
  setFeedback,
  setRefreshLoading,
  setSubmitLoading,
  setTableStatus,
  setTotalRows,
} from './nfeInutilizarEvents.render.js';

/* =======================================================================
 * Listagem
 * ======================================================================= */
export async function loadList(el, params = new URLSearchParams()) {
  try {
    state.loading = true;
    setRefreshLoading(el, true);
    setTableStatus(el, 'Carregando registros...');
    setFeedback(el, 'Buscando inutilizações...', 'info');

    const result = await listInutilizacoes(params);
    state.items = Array.isArray(result?.data) ? result.data : [];

    renderTable(el);
    setTableStatus(
      el,
      state.items.length
        ? `${state.items.length} registro(s) carregado(s).`
        : 'Nenhum registro encontrado.'
    );
    setFeedback(el, 'Lista atualizada com sucesso.', 'success');
  } catch (error) {
    console.error('[nfeInutilizarEvents.actions] loadList error:', error);
    state.items = [];
    renderTable(el);
    setTotalRows(el, 0);
    setTableStatus(el, 'Falha ao carregar registros.');
    setFeedback(el, error?.message || 'Erro ao carregar inutilizações.', 'error');
  } finally {
    state.loading = false;
    setRefreshLoading(el, false);
  }
}

/* =======================================================================
 * Detalhes
 * ======================================================================= */
export async function loadDetails(el, id) {
  if (!id) return;

  setDetailLoading(el, true);

  if (el.detailTitleBadge) {
    el.detailTitleBadge.textContent = `Registro #${id}`;
  }

  try {
    const result = await getInutilizacaoById(id);
    renderDetails(el, result?.data || null);
  } catch (error) {
    console.error('[nfeInutilizarEvents.actions] loadDetails error:', error);
    renderDetailsError(el, id, error);
  } finally {
    state.loadingDetail = false;
  }
}

/* =======================================================================
 * Consulta de status na SEFAZ / provider
 * ======================================================================= */
async function consultStatus(el, id, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Consultando...';

  try {
    setFeedback(el, `Consultando status do registro #${id}...`, 'warning');

    await consultarInutilizacao(id);
    await loadList(el, buildFilterParams(el));
    await loadDetails(el, id);

    setFeedback(el, `Consulta do registro #${id} concluída.`, 'success');
  } catch (error) {
    console.error('[nfeInutilizarEvents.actions] consultar error:', error);
    setFeedback(el, error?.message || 'Falha ao consultar status.', 'error');
    await loadDetails(el, id);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

/* =======================================================================
 * Submit da nova inutilização
 * ======================================================================= */
async function handleSubmit(el, event) {
  event.preventDefault();

  if (state.submitting) return;

  const payload = buildPayload(el);
  const errors = validatePayload(payload);

  if (errors.length) {
    setFeedback(el, errors.join(' '), 'error');
    return;
  }

  try {
    setSubmitLoading(el, true);
    setFeedback(el, 'Enviando inutilização...', 'info');

    const result = await createInutilizacao(payload);

    setFeedback(el, result?.message || 'Inutilização enviada com sucesso.', 'success');

    await loadList(el);

    if (result?.data?.id) {
      state.selectedId = result.data.id;
    }
  } catch (error) {
    console.error('[nfeInutilizarEvents.actions] create error:', error);

    const message =
      error?.payload?.error ||
      error?.payload?.message ||
      (Array.isArray(error?.payload?.errors)
        ? error.payload.errors.join(' ')
        : '') ||
      error?.message ||
      'Erro ao enviar inutilização.';

    setFeedback(el, message, 'error');
  } finally {
    setSubmitLoading(el, false);
  }
}

/* =======================================================================
 * Binds
 * ======================================================================= */
function bindFormEvents(el) {
  el.companyCnpj?.addEventListener('input', () => applyCnpjMask(el.companyCnpj));
  el.filterCompanyCnpj?.addEventListener('input', () => applyCnpjMask(el.filterCompanyCnpj));

  el.numberStart?.addEventListener('input', () => updateSummary(el));
  el.numberEnd?.addEventListener('input', () => updateSummary(el));

  el.justification?.addEventListener('input', () => updateJustificationCounter(el));

  el.formInutilizacao?.addEventListener('submit', (event) => handleSubmit(el, event));

  el.btnLimparForm?.addEventListener('click', () => {
    resetForm(el);
    setFeedback(el, 'Formulário limpo.', 'info');
  });
}

function bindFilterEvents(el) {
  el.formFiltros?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadList(el, buildFilterParams(el));
  });

  el.btnRefresh?.addEventListener('click', async () => {
    await loadList(el, buildFilterParams(el));
  });

  el.btnLimparFiltros?.addEventListener('click', async () => {
    resetFilters(el);
    setFeedback(el, 'Filtros limpos.', 'info');
    await loadList(el);
  });
}

// Delegação no tbody: o bind é feito uma vez e sobrevive aos re-renders.
function bindTableEvents(el) {
  el.tbodyInutilizacoes?.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const id = Number.parseInt(button.dataset.id, 10);
    if (!Number.isFinite(id)) return;

    state.selectedId = id;

    if (button.dataset.action === 'view') {
      await loadDetails(el, id);
    } else if (button.dataset.action === 'consult') {
      await consultStatus(el, id, button);
    }
  });
}

/* =======================================================================
 * Init
 * ======================================================================= */
export async function initNfeInutilizarEventsActions() {
  const el = getElements();

  bindFormEvents(el);
  bindFilterEvents(el);
  bindTableEvents(el);

  applyDefaultYear(el);
  updateSummary(el);
  updateJustificationCounter(el);
  setFeedback(el, 'Pronto para operação.', 'info');
  setTableStatus(el, 'Inicializando módulo...');

  await loadList(el);
}
