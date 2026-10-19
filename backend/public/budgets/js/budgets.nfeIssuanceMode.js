// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.nfeIssuanceMode.js — NFE_ISSUANCE_SOURCE          ║
// ║ PRODNEX ERP | ESM                                           ║
// ╚══════════════════════════════════════════════════════════════╝

'use strict';

import { $, ROUTES, state } from './budgets.core.js';
import { authHeaders, fetchSafe } from './budgets.infra.js';

export const NFE_ISSUANCE_MODES = Object.freeze({
  BUDGET_ONLY: 'BUDGET_ONLY',
  ORDER_ONLY: 'ORDER_ONLY',
  BOTH: 'BOTH',
});

function normalizeFeature(payload = {}) {
  const feature =
    payload?.feature ??
    payload?.data?.feature ??
    payload?.data ??
    payload;

  const rawOptionCode =
    feature?.optionCode ??
    feature?.option_code ??
    feature?.default_value?.optionCode ??
    feature?.default_value ??
    NFE_ISSUANCE_MODES.BOTH;

  const optionCode = String(rawOptionCode)
    .replace(/^"|"$/g, '')
    .trim()
    .toUpperCase();

  const config =
    feature?.config ??
    feature?.option_config ??
    {};

  const mode = Object.values(NFE_ISSUANCE_MODES).includes(optionCode)
    ? optionCode
    : NFE_ISSUANCE_MODES.BOTH;

  return {
    mode,

    issueFromBudget:
      config.issue_from_budget ??
      mode !== NFE_ISSUANCE_MODES.ORDER_ONLY,

    issueFromOrder:
      config.issue_from_order ??
      mode !== NFE_ISSUANCE_MODES.BUDGET_ONLY,

    allowBudgetToOrder:
      config.allow_budget_to_order ??
      mode !== NFE_ISSUANCE_MODES.BUDGET_ONLY,
  };
}

export function canIssueNfeFromBudget() {
  return state.nfeIssuanceMode?.issueFromBudget === true;
}

export function canIssueNfeFromOrder() {
  return state.nfeIssuanceMode?.issueFromOrder === true;
}

export function canTransformBudgetToOrder() {
  return state.nfeIssuanceMode?.allowBudgetToOrder === true;
}

function setElementVisible(element, visible) {
  if (!element) return;

  element.hidden = !visible;
  element.setAttribute(
    'aria-hidden',
    visible ? 'false' : 'true',
  );

  if (visible) {
    element.style.removeProperty('display');
  } else {
    element.style.setProperty(
      'display',
      'none',
      'important',
    );
  }
}

export function applyNfeIssuanceModeUI() {
  const allowIssueFromBudget =
    canIssueNfeFromBudget();

  const allowBudgetToOrder =
    canTransformBudgetToOrder();

  /*
   * Botão principal:
   * "Transformar em Pedido"
   */
  setElementVisible(
    $('#btnTransformarPedido'),
    allowBudgetToOrder,
  );

  /*
   * Botão principal:
   * "Emitir NF-e"
   */
  setElementVisible(
    $('#btnGenerateNfe'),
    allowIssueFromBudget,
  );

  /*
   * Botão dentro da prévia:
   * "Emitir NF-e"
   */
  setElementVisible(
    $('#btnIssueNfe'),
    allowIssueFromBudget,
  );

  /*
   * Botões de "Transformar em pedido"
   * existentes nas linhas da listagem.
   */
  document
    .querySelectorAll('[data-act="order"]')
    .forEach((button) => {
      setElementVisible(
        button,
        allowBudgetToOrder,
      );
    });
}

export async function initBudgetNfeIssuanceMode() {
  let resolved = {
    mode: NFE_ISSUANCE_MODES.BOTH,
    issueFromBudget: true,
    issueFromOrder: true,
    allowBudgetToOrder: true,
  };

  try {
    const out = await fetchSafe(
      ROUTES.nfeIssuanceSource,
      {
        method: 'GET',
        headers: authHeaders(),
        cache: 'no-store',
      },
    );

    if (out.ok) {
      resolved = normalizeFeature(out.json);
    } else {
      console.warn(
        '[budgets][nfe-issuance-mode] Resolver indisponível; usando BOTH.',
      );
    }
  } catch (error) {
    console.warn(
      '[budgets][nfe-issuance-mode] Falha ao resolver:',
      error?.message || error,
    );
  }

  state.nfeIssuanceMode = {
    ...resolved,
    loaded: true,
  };

  applyNfeIssuanceModeUI();

  console.log(
    '[budgets][nfe-issuance-mode]',
    state.nfeIssuanceMode,
  );

  return state.nfeIssuanceMode;
}