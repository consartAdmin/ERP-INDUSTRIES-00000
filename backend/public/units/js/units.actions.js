// ╔════════════════════════════════════════════════════════════╗
// ║ units.actions.js — Ações de Unidades                          ║
// ╚════════════════════════════════════════════════════════════╝

import { state, setState } from './units.state.js';
import { listUnits, createUnit, updateUnit, deleteUnit } from './units.api.js';
import { getFormData, validateForm, setFormMessage } from './units.form.js';
import { openNewUnitModal, openEditUnitModal, closeUnitModal } from './units.modal.js';
import { renderTable, renderError } from './units.render.js';

function normalizeText(value) {
  return String(value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function getRowId(row) {
  return Number(row?.id ?? row?.unit_id);
}

function applyClientFilter() {
  const query = normalizeText(state.search);

  state.filteredRows = state.rows.filter((row) => {
    const active = row?.is_active !== false;

    if (!state.includeInactive && !active) return false;
    if (!query) return true;

    const unit = normalizeText(row?.unit);
    const description = normalizeText(row?.description);

    return unit.includes(query) || description.includes(query);
  });

  state.page = 1;
  renderTable();
}

export async function loadUnits() {
  setState({ loading: true });

  try {
    const rows = await listUnits({
      search: state.search,
      includeInactive: state.includeInactive,
    });

    state.rows = Array.isArray(rows) ? rows.map((row) => ({
      ...row,
      id: row?.id ?? row?.unit_id,
      unit: String(row?.unit ?? row?.sigla ?? row?.unidade ?? '').trim().toUpperCase(),
      description: row?.description ?? row?.descricao ?? '',
      fator: row?.fator ?? row?.factor ?? 1,
      is_active:
        row?.is_active === false || row?.is_active === 0 || row?.is_active === 'false' || row?.is_active === '0'
          ? false
          : true,
    })) : [];

    applyClientFilter();

    console.info('[INFO] [units] Unidades carregadas:', state.rows.length);
  } catch (err) {
    console.error('[ERR] [units] Erro ao carregar unidades:', err);
    renderError(err.message);
  } finally {
    setState({ loading: false });
  }
}

export function handleSearch(value) {
  setState({ search: String(value ?? '') });
  applyClientFilter();
}

export function handleIncludeInactive(checked) {
  setState({ includeInactive: Boolean(checked) });
  loadUnits();
}

export function handlePreviousPage() {
  if (state.page <= 1) return;
  state.page -= 1;
  renderTable();
}

export function handleNextPage() {
  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  if (state.page >= totalPages) return;

  state.page += 1;
  renderTable();
}

export function handlePageSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return;

  state.pageSize = size;
  state.page = 1;
  renderTable();
}

export function handleNew() {
  openNewUnitModal();
}

export function handleEditById(id) {
  const row = state.rows.find((item) => getRowId(item) === Number(id));

  if (!row) {
    setFormMessage('Unidade não encontrada. Atualize a lista e tente novamente.');
    return;
  }

  openEditUnitModal(row);
}

export async function handleSave(event) {
  event?.preventDefault();

  if (state.saving) return;

  const validation = validateForm();

  if (!validation.valid) {
    setFormMessage(validation.message, 'error');
    return;
  }

  setState({ saving: true });

  const button = state.refs.saveButton;
  const originalText = button?.textContent || 'Salvar';

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Salvando...';
    }

    if (state.editingId) {
      await updateUnit(state.editingId, validation.value);
      console.info('[INFO] [units] Unidade atualizada:', state.editingId);
    } else {
      await createUnit(validation.value);
      console.info('[INFO] [units] Unidade criada:', validation.value.unit);
    }

    closeUnitModal();
    await loadUnits();
  } catch (err) {
    console.error('[ERR] [units] Erro ao salvar unidade:', err);
    setFormMessage(err.message || 'Não foi possível salvar a unidade.', 'error');
  } finally {
    setState({ saving: false });

    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}


export async function handleDeleteById(id) {
  if (state.deleting) return;

  const numericId = Number(id);
  const row = state.rows.find((item) => getRowId(item) === numericId);

  if (!row) {
    window.alert('Unidade não encontrada. Atualize a lista e tente novamente.');
    return;
  }

  const unitName = String(row?.unit || '').trim();
  const description = String(row?.description || '').trim();
  const label = description ? `${unitName} — ${description}` : unitName;

  const confirmed = window.confirm(
    `Deseja realmente excluir a unidade "${label}"?\n\n` +
    'Se esta unidade estiver sendo utilizada por produtos, o sistema poderá impedir a exclusão.'
  );

  if (!confirmed) return;

  setState({ deleting: true });

  try {
    await deleteUnit(numericId);
    console.info('[INFO] [units] Unidade excluída:', numericId);
    await loadUnits();
  } catch (err) {
    console.error('[ERR] [units] Erro ao excluir unidade:', err);

    const message =
      err?.status === 409
        ? 'Não foi possível excluir esta unidade porque ela está sendo utilizada em outros registros.'
        : err?.message || 'Não foi possível excluir a unidade.';

    window.alert(message);
  } finally {
    setState({ deleting: false });
  }
}
