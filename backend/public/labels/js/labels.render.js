import { state } from './labels.state.js';
import { $, escapeHtml } from './labels.utils.js';

export function buildUnitKey(unit, index = 0) {
  return `${unit?.unitCode || 'UN'}__${unit?.barCode || ''}__${index}`;
}

export function selectedUnit(item) {
  return item?.units?.find((unit, index) => buildUnitKey(unit, index) === item.selectedUnitKey) || item?.units?.[0] || null;
}

export function syncSearchDisplay() {
  const input = $('#labelsQuery');
  if (!input || String($('#labelsMode')?.value).toUpperCase() !== 'SEARCH') return;
  if (!state.manualItems.length) {
    input.value = '';
    input.placeholder = 'Clique em “Buscar produto” para selecionar…';
  } else if (state.manualItems.length === 1) {
    const item = state.manualItems[0];
    input.value = `${item.productCode} — ${item.description}`;
  } else {
    input.value = `${state.manualItems.length} produto(s) selecionado(s)`;
  }
}

export function renderItems(payload) {
  const tbody = $('#tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!state.manualItems.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum produto selecionado ainda.</td></tr>';
    return;
  }

  state.manualItems.forEach((item, index) => {
    const unit = selectedUnit(item);
    const options = item.units.map((entry, unitIndex) => {
      const key = buildUnitKey(entry, unitIndex);
      return `<option value="${escapeHtml(key)}" ${key === item.selectedUnitKey ? 'selected' : ''}>${escapeHtml(entry.unitLabel)}</option>`;
    }).join('');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(item.productCode)}</td>
      <td>${item.units.length > 1
        ? `<select class="c-input labels-table__unit-select" data-index="${index}">${options}</select>`
        : escapeHtml(unit?.unitLabel || '-')}</td>
      <td>${escapeHtml(unit?.barCode || item.barCode || '')}</td>
      <td>${escapeHtml(item.description)}</td>
      <td><input type="number" min="1" step="1" class="labels-table__qty-input" data-index="${index}" value="${item.labelsPerProduct}"></td>
      <td><button type="button" class="labels-row-remove" data-index="${index}">Remover</button></td>`;
    tbody.appendChild(row);
  });

  tbody.querySelectorAll('.labels-row-remove').forEach((button) => {
    button.addEventListener('click', () => {
      state.manualItems.splice(Number(button.dataset.index), 1);
      syncSearchDisplay();
      renderItems(payload);
    });
  });
  tbody.querySelectorAll('.labels-table__qty-input').forEach((input) => {
    input.addEventListener('input', () => {
      const item = state.manualItems[Number(input.dataset.index)];
      if (item) item.labelsPerProduct = Math.max(1, Number(input.value) || 1);
    });
  });
  tbody.querySelectorAll('.labels-table__unit-select').forEach((select) => {
    select.addEventListener('change', () => {
      const item = state.manualItems[Number(select.dataset.index)];
      if (item) item.selectedUnitKey = select.value;
      renderItems(payload);
    });
  });
}

export function setLoading(loading) {
  state.loading = loading;
  const button = $('#btnGenerateLabels');
  if (!button) return;
  button.disabled = loading;
  button.dataset.originalText ||= button.textContent;
  button.textContent = loading ? 'Gerando...' : button.dataset.originalText;
}

