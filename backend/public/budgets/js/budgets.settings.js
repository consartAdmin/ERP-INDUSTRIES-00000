import {
  $,
  ROUTES,
  state,
  budgetSettings,
} from './budgets.core.js';

import {
  authHeaders,
  fetchSafe,
  toast,
} from './budgets.infra.js';

const OUT_OF_STOCK_MODES = Object.freeze({
  BLOCK: 'BLOCK',
  PASSWORD: 'PASSWORD',
  ALLOW: 'ALLOW',
});

const VALID_OUT_OF_STOCK_MODES = new Set(
  Object.values(OUT_OF_STOCK_MODES)
);

function normalizeOutOfStockMode(value, legacyAllow = null) {
  const normalized = String(value || '').trim().toUpperCase();

  if (VALID_OUT_OF_STOCK_MODES.has(normalized)) {
    return normalized;
  }

  if (legacyAllow === true) return OUT_OF_STOCK_MODES.ALLOW;
  if (legacyAllow === false) return OUT_OF_STOCK_MODES.BLOCK;

  return OUT_OF_STOCK_MODES.BLOCK;
}

function applySettingsToEditor() {
  const unitPrice = $('#valor');

  if (unitPrice) {
    unitPrice.readOnly =
      !budgetSettings.allow_manual_unit_price;

    unitPrice.classList.toggle(
      'field-readonly',
      !budgetSettings.allow_manual_unit_price
    );

    unitPrice.title =
      budgetSettings.allow_manual_unit_price
        ? 'Preço manual permitido'
        : 'Preço definido pela tabela vinculada ao cliente';
  }

  const discount = $('#desconto');

  if (discount) {
    discount.dataset.maxPercent = String(
      budgetSettings.max_discount_percent
    );

    discount.title =
      `Desconto máximo: ${budgetSettings.max_discount_percent
      }%`;
  }

  const requireStockLot = $('#settingRequireStockLot');

  if (requireStockLot) {
    const featureControlsLot = state.stockMode?.loaded === true;
    const requireLot = featureControlsLot
      ? state.stockMode?.requireLot === true
      : !!budgetSettings.require_stock_lot;

    requireStockLot.checked = requireLot;
    requireStockLot.disabled = featureControlsLot;
    requireStockLot.title = featureControlsLot
      ? `Controlado por PRODUCT_STOCK_MODE (${state.stockMode?.mode || 'N/D'}).`
      : 'Configuração legada de exigência de lote.';
  }

  const button = $('#btnBudgetSettings');

  button?.classList.toggle(
    'hidden',
    !budgetSettings.can_manage
  );
}

function fillModal() {
  const outOfStockMode =
    $('#settingOutOfStockMode');

  if (outOfStockMode) {
    outOfStockMode.value =
      normalizeOutOfStockMode(
        budgetSettings.out_of_stock_mode,
        budgetSettings.allow_out_of_stock
      );
  }

  const requireStockLot =
    $('#settingRequireStockLot');

  if (requireStockLot) {
    const featureControlsLot = state.stockMode?.loaded === true;

    requireStockLot.checked = featureControlsLot
      ? state.stockMode?.requireLot === true
      : !!budgetSettings.require_stock_lot;

    requireStockLot.disabled = featureControlsLot;
    requireStockLot.title = featureControlsLot
      ? `Controlado por PRODUCT_STOCK_MODE (${state.stockMode?.mode || 'N/D'}).`
      : 'Configuração legada de exigência de lote.';
  }

  const allowManualUnitPrice =
    $('#settingAllowManualUnitPrice');

  if (allowManualUnitPrice) {
    allowManualUnitPrice.checked =
      !!budgetSettings.allow_manual_unit_price;
  }

  const maxDiscountPercent =
    $('#settingMaxDiscountPercent');

  if (maxDiscountPercent) {
    maxDiscountPercent.value = String(
      budgetSettings.max_discount_percent ?? 0
    );
  }
}

function openModal() {
  if (!budgetSettings.can_manage) {
    toast.warn(
      'Acesso restrito',
      'Somente administradores podem alterar os parâmetros.'
    );

    return;
  }

  fillModal();

  $('#budgetSettingsBackdrop')
    ?.classList.remove('hidden');

  $('#budgetSettingsModal')
    ?.classList.remove('hidden');
}

function closeModal() {
  $('#budgetSettingsBackdrop')
    ?.classList.add('hidden');

  $('#budgetSettingsModal')
    ?.classList.add('hidden');
}

export async function loadBudgetSettings() {
  const out = await fetchSafe(
    ROUTES.budgetSettings,
    {
      method: 'GET',
      headers: authHeaders(),
    }
  );

  if (!out.ok) {
    applySettingsToEditor();
    return budgetSettings;
  }

  const data =
    out.json?.data ||
    out.json ||
    {};

  const outOfStockMode =
    normalizeOutOfStockMode(
      data.out_of_stock_mode,
      data.allow_out_of_stock
    );

  Object.assign(budgetSettings, {
    out_of_stock_mode:
      outOfStockMode,

    /*
     * Mantido temporariamente para compatibilidade
     * com as demais partes do módulo.
     */
    allow_out_of_stock:
      outOfStockMode !==
      OUT_OF_STOCK_MODES.BLOCK,

    require_stock_lot:
      state.stockMode?.loaded === true
        ? state.stockMode?.requireLot === true
        : !!data.require_stock_lot,

    allow_manual_unit_price:
      data.allow_manual_unit_price !== false,

    max_discount_percent:
      Math.min(
        100,
        Math.max(
          0,
          Number(
            data.max_discount_percent ?? 100
          )
        )
      ),

    can_manage:
      !!data.can_manage,
  });

  applySettingsToEditor();

  return budgetSettings;
}

async function saveSettings() {
  const outOfStockMode =
    normalizeOutOfStockMode(
      $('#settingOutOfStockMode')?.value
    );

  const maxDiscount = Number(
    $('#settingMaxDiscountPercent')?.value
  );

  if (
    !Number.isFinite(maxDiscount) ||
    maxDiscount < 0 ||
    maxDiscount > 100
  ) {
    return toast.warn(
      'Parâmetros',
      'O desconto máximo deve estar entre 0% e 100%.'
    );
  }

  const payload = {
    out_of_stock_mode:
      outOfStockMode,

    /*
     * Compatibilidade temporária com o backend antigo.
     * Pode ser removido quando toda a API utilizar
     * somente out_of_stock_mode.
     */
    allow_out_of_stock:
      outOfStockMode !==
      OUT_OF_STOCK_MODES.BLOCK,

    // Compatibilidade do endpoint antigo. A fonte de verdade é
    // PRODUCT_STOCK_MODE; o valor enviado aqui é apenas o espelho atual.
    require_stock_lot:
      state.stockMode?.loaded === true
        ? state.stockMode?.requireLot === true
        : !!$('#settingRequireStockLot')?.checked,

    allow_manual_unit_price:
      !!$('#settingAllowManualUnitPrice')?.checked,

    max_discount_percent:
      maxDiscount,
  };

  const out = await fetchSafe(
    ROUTES.budgetSettings,
    {
      method: 'PUT',

      headers: authHeaders({
        'Content-Type': 'application/json',
      }),

      body: JSON.stringify(payload),
    }
  );

  if (!out.ok) {
    return toast.error(
      'Parâmetros',
      out.json?.error ||
      out.json?.message ||
      'Não foi possível salvar os parâmetros.'
    );
  }

  const responseData =
    out.json?.data ||
    out.json ||
    payload;

  const savedMode =
    normalizeOutOfStockMode(
      responseData.out_of_stock_mode,
      responseData.allow_out_of_stock
    );

  Object.assign(
    budgetSettings,
    responseData,
    {
      out_of_stock_mode:
        savedMode,

      allow_out_of_stock:
        savedMode !==
        OUT_OF_STOCK_MODES.BLOCK,

      require_stock_lot:
        state.stockMode?.loaded === true
          ? state.stockMode?.requireLot === true
          : !!responseData.require_stock_lot,

      can_manage: true,
    }
  );

  applySettingsToEditor();
  closeModal();

  toast.success(
    'Parâmetros',
    'Configurações globais atualizadas.'
  );
}

export function initBudgetSettings() {
  $('#btnBudgetSettings')
    ?.addEventListener(
      'click',
      openModal
    );

  $('#btnCloseBudgetSettings')
    ?.addEventListener(
      'click',
      closeModal
    );

  $('#btnCancelBudgetSettings')
    ?.addEventListener(
      'click',
      closeModal
    );

  $('#budgetSettingsBackdrop')
    ?.addEventListener(
      'click',
      closeModal
    );

  $('#btnSaveBudgetSettings')
    ?.addEventListener(
      'click',
      saveSettings
    );

  return loadBudgetSettings();
}
