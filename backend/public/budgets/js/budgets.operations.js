// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.operations.js — Operações fiscais ativas do orçamento      ║
// ╚══════════════════════════════════════════════════════════════════════╝

import {
  $,
  state,
} from './budgets.core.js';

import {
  fetchSafe,
  handleAuthFail,
  toast,
} from './budgets.infra.js';

let loaded = false;
let loadingPromise = null;
let cachedOperations = [];

/* =====================================================================
   HELPERS
===================================================================== */

function getSavedOperationTypeId() {
  return String(
    state.editing?.header?.operation_type_id ??
    '',
  ).trim();
}

function selectDefaultResaleOperation(
  operations = [],
) {
  const select =
    $('#budgetOperationTypeId');

  if (!select) {
    return;
  }

  /*
   * Do not replace an operation already selected
   * or loaded from an existing budget.
   */
  if (select.value) {
    return;
  }

  const defaultOperation =
    operations.find(
      (operation) =>
        String(operation.code || '')
          .trim()
          .toUpperCase() ===
        'REVENDA_MG',
    );

  if (!defaultOperation) {
    console.warn(
      '[BUDGET][OPERATION] Operação REVENDA_MG não encontrada.',
    );

    return;
  }

  setBudgetOperationType(
    defaultOperation.operation_type_id,
  );

  select.dispatchEvent(
    new Event('change', {
      bubbles: true,
    }),
  );
}

function applySelectedOrDefaultOperation(
  operations = [],
) {
  const select =
    $('#budgetOperationTypeId');

  if (!select) {
    return;
  }

  const savedOperationTypeId =
    getSavedOperationTypeId();

  if (savedOperationTypeId) {
    const optionExists =
      Array.from(select.options).some(
        (option) =>
          option.value ===
          savedOperationTypeId,
      );

    if (optionExists) {
      setBudgetOperationType(
        savedOperationTypeId,
      );

      return;
    }

    console.warn(
      '[BUDGET][OPERATION] Operação salva não está disponível:',
      savedOperationTypeId,
    );
  }

  selectDefaultResaleOperation(
    operations,
  );
}

function renderOperationOptions(
  operations = [],
) {
  const select =
    $('#budgetOperationTypeId');

  if (!select) {
    return;
  }

  select.innerHTML =
    '<option value="">Selecione...</option>';

  for (const operation of operations) {
    const option =
      document.createElement('option');

    option.value = String(
      operation.operation_type_id,
    );

    option.textContent =
      `${operation.code} — ${operation.name}`;

    option.dataset.code =
      operation.code || '';

    option.dataset.cfopInternal =
      operation.cfop_internal || '';

    option.dataset.cfopInterstate =
      operation.cfop_interstate || '';

    option.dataset.generatesReceivable =
      String(
        Boolean(
          operation.generates_receivable,
        ),
      );

    option.dataset.movesStock =
      String(
        Boolean(
          operation.moves_stock,
        ),
      );

    select.appendChild(option);
  }
}

/* =====================================================================
   LOAD
===================================================================== */

export async function loadBudgetOperationTypes({
  force = false,
} = {}) {
  const select =
    $('#budgetOperationTypeId');

  if (!select) {
    return [];
  }

  /*
   * Reuse cached operations, but apply the default
   * again when opening another new budget.
   */
  if (
    loaded &&
    !force &&
    cachedOperations.length
  ) {
    renderOperationOptions(
      cachedOperations,
    );

    applySelectedOrDefaultOperation(
      cachedOperations,
    );

    return cachedOperations;
  }

  if (
    loadingPromise &&
    !force
  ) {
    return loadingPromise;
  }

  loadingPromise =
    (async () => {
      const out =
        await fetchSafe(
          '/api/nfe-operation-types?active=true&limit=500&offset=0',
          {
            method: 'GET',
          },
        );

      if (
        handleAuthFail(
          out.status,
          out.text,
        )
      ) {
        return [];
      }

      if (!out.ok) {
        throw new Error(
          out.json?.message ||
          out.json?.error ||
          'Não foi possível carregar as operações fiscais.',
        );
      }

      const rows =
        Array.isArray(out.json?.rows)
          ? out.json.rows
          : [];

      cachedOperations = rows;

      renderOperationOptions(
        rows,
      );

      /*
       * Existing budget:
       * preserves the saved operation.
       *
       * New budget:
       * automatically selects REVENDA_MG.
       */
      applySelectedOrDefaultOperation(
        rows,
      );

      loaded = true;

      return rows;
    })();

  try {
    return await loadingPromise;
  } catch (error) {
    toast.error(
      'Operação fiscal',
      error.message,
    );

    return [];
  } finally {
    loadingPromise = null;
  }
}

/* =====================================================================
   SET VALUE
===================================================================== */

export function setBudgetOperationType(
  operationTypeId,
) {
  const value =
    operationTypeId == null
      ? ''
      : String(operationTypeId);

  const select =
    $('#budgetOperationTypeId');

  if (select) {
    select.value = value;
  }

  if (state.editing?.header) {
    state.editing.header.operation_type_id =
      value
        ? Number(value)
        : null;
  }
}

/* =====================================================================
   EVENTS
===================================================================== */

export function bindBudgetOperationType() {
  const select =
    $('#budgetOperationTypeId');

  if (
    !select ||
    select.dataset.operationBound === '1'
  ) {
    return;
  }

  select.dataset.operationBound = '1';

  select.addEventListener(
    'change',
    () => {
      if (state.editing?.header) {
        state.editing.header.operation_type_id =
          Number(select.value) ||
          null;
      }
    },
  );
}