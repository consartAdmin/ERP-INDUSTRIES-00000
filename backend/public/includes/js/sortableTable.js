// ╔══════════════════════════════════════════════════════════════════════╗
// ║ sortableTable.js — Ordenação reutilizável de tabelas (ESM)         ║
// ║ PRODNEX ERP                                                        ║
// ║ - Alterna ASC/DESC                                                 ║
// ║ - Atualiza ícones e aria-sort                                      ║
// ║ - Compatível com paginação e ordenação feita pelo backend          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

const VALID_DIRECTIONS = new Set(['asc', 'desc']);

const DEFAULT_ICONS = Object.freeze({
  none: '↕',
  asc: '↑',
  desc: '↓',
});

function resolveElement(value, name) {
  const element = typeof value === 'string'
    ? document.querySelector(value)
    : value;

  if (!(element instanceof HTMLElement)) {
    throw new TypeError(`[sortableTable] ${name} não foi encontrado.`);
  }

  return element;
}

function normalizeColumn(value) {
  return String(value ?? '').trim();
}

function normalizeDirection(value, fallback = 'asc') {
  const direction = String(value ?? '').trim().toLowerCase();
  return VALID_DIRECTIONS.has(direction) ? direction : fallback;
}

/**
 * Ativa a ordenação nos cabeçalhos que possuam `data-sort-column`.
 *
 * HTML esperado:
 * <th data-sort-column="id" aria-sort="none">
 *   <button type="button" data-sort-button>
 *     ID <span data-sort-icon>↕</span>
 *   </button>
 * </th>
 *
 * @param {object} options
 * @param {HTMLTableElement|string} options.table Tabela ou seletor CSS.
 * @param {string} [options.defaultColumn=''] Coluna inicialmente selecionada.
 * @param {'asc'|'desc'} [options.defaultDirection='asc'] Direção inicial.
 * @param {string[]} [options.allowedColumns] Colunas permitidas no frontend.
 * @param {boolean} [options.sortOnInit=false] Executa onSort na inicialização.
 * @param {(state: {column: string, direction: 'asc'|'desc', previousColumn: string, event: Event|null}) => (void|Promise<void>)} options.onSort
 * @param {(error: unknown) => void} [options.onError]
 * @param {{none?: string, asc?: string, desc?: string}} [options.icons]
 * @returns {{getState: Function, setSort: Function, reset: Function, refresh: Function, destroy: Function}}
 */
export function createSortableTable(options = {}) {
  const {
    table,
    defaultColumn = '',
    defaultDirection = 'asc',
    allowedColumns,
    sortOnInit = false,
    onSort,
    onError = (error) => console.error('[sortableTable]', error),
    icons = {},
  } = options;

  const tableElement = resolveElement(table, 'A tabela');

  if (typeof onSort !== 'function') {
    throw new TypeError('[sortableTable] A opção onSort deve ser uma função.');
  }

  const allowed = Array.isArray(allowedColumns)
    ? new Set(allowedColumns.map(normalizeColumn).filter(Boolean))
    : null;

  const sortIcons = { ...DEFAULT_ICONS, ...icons };
  const abortController = new AbortController();

  let currentColumn = normalizeColumn(defaultColumn);
  let currentDirection = normalizeDirection(defaultDirection);
  let busy = false;
  let destroyed = false;

  function getHeaders() {
    return [...tableElement.querySelectorAll('thead th[data-sort-column]')];
  }

  function validateColumn(column) {
    if (!column) {
      throw new Error('[sortableTable] A coluna de ordenação está vazia.');
    }

    if (allowed && !allowed.has(column)) {
      throw new Error(`[sortableTable] Coluna não permitida: ${column}`);
    }

    const exists = getHeaders().some(
      (header) => normalizeColumn(header.dataset.sortColumn) === column,
    );

    if (!exists) {
      throw new Error(`[sortableTable] Cabeçalho não encontrado: ${column}`);
    }
  }

  function updateVisualState() {
    for (const header of getHeaders()) {
      const column = normalizeColumn(header.dataset.sortColumn);
      const active = column === currentColumn;
      const direction = active ? currentDirection : 'none';
      const button = header.querySelector('[data-sort-button]');
      const icon = header.querySelector('[data-sort-icon]');

      header.setAttribute('aria-sort', direction === 'none' ? 'none' : `${direction}ending`);
      header.classList.toggle('is-sorted', active);

      if (button instanceof HTMLButtonElement) {
        button.classList.toggle('is-sorted', active);
        button.dataset.sortDirection = direction;
        button.disabled = busy;
      }

      if (icon) {
        icon.textContent = sortIcons[direction];
      }
    }
  }

  function getState() {
    return Object.freeze({
      column: currentColumn,
      direction: currentDirection,
    });
  }

  async function applySort(column, direction, event = null, notify = true) {
    if (destroyed || busy) return getState();

    const nextColumn = normalizeColumn(column);
    const nextDirection = normalizeDirection(direction, currentDirection);
    validateColumn(nextColumn);

    const previousColumn = currentColumn;
    currentColumn = nextColumn;
    currentDirection = nextDirection;
    busy = true;
    updateVisualState();

    try {
      if (notify) {
        await onSort({
          column: currentColumn,
          direction: currentDirection,
          previousColumn,
          event,
        });
      }
    } catch (error) {
      onError(error);
    } finally {
      busy = false;
      updateVisualState();
    }

    return getState();
  }

  function handleClick(event) {
    const button = event.target.closest('[data-sort-button]');
    if (!button || !tableElement.contains(button)) return;

    const header = button.closest('th[data-sort-column]');
    if (!header) return;

    const column = normalizeColumn(header.dataset.sortColumn);
    const direction = column === currentColumn
      ? (currentDirection === 'asc' ? 'desc' : 'asc')
      : 'asc';

    void applySort(column, direction, event, true);
  }

  tableElement.addEventListener('click', handleClick, {
    signal: abortController.signal,
  });

  updateVisualState();

  if (sortOnInit && currentColumn) {
    queueMicrotask(() => void applySort(
      currentColumn,
      currentDirection,
      null,
      true,
    ));
  }

  return Object.freeze({
    getState,

    setSort(column, direction = 'asc', { notify = true } = {}) {
      return applySort(column, direction, null, notify);
    },

    reset({ notify = false } = {}) {
      const previousColumn = currentColumn;
      currentColumn = normalizeColumn(defaultColumn);
      currentDirection = normalizeDirection(defaultDirection);
      updateVisualState();

      if (notify && currentColumn) {
        return applySort(currentColumn, currentDirection, null, true);
      }

      return Promise.resolve(Object.freeze({
        ...getState(),
        previousColumn,
      }));
    },

    refresh() {
      updateVisualState();
      return getState();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      abortController.abort();
    },
  });
}

export default createSortableTable;
