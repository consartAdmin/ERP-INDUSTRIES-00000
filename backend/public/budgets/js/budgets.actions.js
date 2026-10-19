// ╔══════════════════════════════════════════════════════════════════════╗
// ║ budgets.actions.js — Ações (save/pdf/to-order)                      ║
// ║ PRODNEX ERP | Frontend (ESM)                                        ║
// ║ ✅ Salva header + itens                                              ║
// ║ ✅ Salva payments após budget                                        ║
// ║ ✅ Protege estado local se backend recarregar vazio                  ║
// ║ ✅ Recarrega resumo de pagamentos                                    ║
// ║ ✅ Compat legado formaPagamento/condicaoPagamento                    ║
// ║ ✅ Suporte a desconto geral do orçamento                             ║
// ║ ✅ HARDEN: rehydrate persistente do desconto geral                   ║
// ║ ✅ FIX: não sobrescreve desconto do state pelos hidden inputs        ║
// ║ ✅ FIX: limpa override inválido de item sem liberação                ║
// ║ ✅ NOVO: liberação em lote de múltiplos itens                        ║
// ║ ✅ FIX CRÍTICO: remove probing de múltiplos PUTs no save             ║
// ║ ✅ FIX: trava anti reentrada no save                                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { $, ROUTES, state, budgetSettings, fmtMoney } from './budgets.core.js';
import { authHeaders, fetchSafe, handleAuthFail, toast } from './budgets.infra.js';
import { SINGLE_PRICE_ID, isSinglePriceMode } from './budgets.priceMode.js';
import {
  recalcTotals,
  renderItems,
  syncGlobalDiscountHiddenFields,
} from './budgets.items.js';
import { onPaymentMethodChange } from './budgets.catalogs.js';
import { showCenterModal } from '/public/includes/js/centerAlertModal.js';
import { Modal } from '/public/includes/js/modal.js';
import {
  persistBudgetPaymentsIfPossible,
  loadBudgetPaymentsForEditor,
  renderBudgetPayments,
  renderBudgetPaymentInstallments,
  updatePaymentsSummaryUI,
  validatePaymentsBeforeSave
} from './budgets.payments.js';

import {
  canTransformBudgetToOrder,
} from './budgets.nfeIssuanceMode.js';

let __savingBudget = false;

async function askBudgetActionKey({
  actionLabel = 'executar esta ação',
  inputId = 'budgetActionKeyInput',
} = {}) {
  return await showCenterModal({
    variant: 'warning',
    title: 'Chave obrigatória',
    message: `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>Informe a <b>chave do orçamento</b> para ${actionLabel}:</div>
        <input id="${inputId}" type="password"
          style="height:34px;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.18);outline:none"
          placeholder="Digite a chave..." />
      </div>
    `,
    buttons: [
      { label: 'Cancelar', variant: 'cancel', action: () => null },
      {
        label: 'Confirmar',
        variant: 'primary',
        action: ({ card }) => {
          const v = card.querySelector(`#${inputId}`)?.value || '';
          const key = String(v).trim();
          return key || null;
        }
      }
    ]
  });
}

function sanitizeOverrideFields(items = []) {
  return items.map((it) => {
    const row = { ...it };

    row.override_stock = !!row.override_stock;

    if (!row.override_stock) {
      row.override_token = null;
      row.override_approved_at = null;
      row.override_approved_by = null;
      row.override_reason = null;
      row.override_qty = null;
      row.override_lot_id = null;
    } else {
      row.override_qty = Number(row.quantity || 0);
      row.override_lot_id = row.lot_id ?? null;
    }

    return row;
  });
}

function parseOverrideValidationError(msg) {
  const text = String(msg || '');

  const skuMatch = text.match(/SKU\s+([A-Z0-9_-]+)/i);
  const disponivelMatch = text.match(/Dispon[ií]vel:\s*([0-9.,-]+)/i);
  const solicitadoMatch = text.match(/Solicitado:\s*([0-9.,-]+)/i);

  return {
    sku: skuMatch?.[1] || null,
    available: disponivelMatch?.[1] ?? null,
    requested: solicitadoMatch?.[1] ?? null,
    isStockError: /Sem estoque para SKU/i.test(text),
    isInvalidOverride: /Override de estoque inv[aá]lido/i.test(text),
    isTokenExpired: /TOKEN_EXPIRED/i.test(text),
    raw: text,
  };
}

function getConfiguredOutOfStockMode() {
  const mode = String(
    budgetSettings?.out_of_stock_mode || ''
  ).trim().toUpperCase();

  if (['BLOCK', 'PASSWORD', 'ALLOW'].includes(mode)) {
    return mode;
  }

  // Compatibilidade com configurações antigas que possuíam apenas booleano.
  return budgetSettings?.allow_out_of_stock === true
    ? 'PASSWORD'
    : 'BLOCK';
}

function clearStockOverridesFromState() {
  const items = Array.isArray(state.editing?.items)
    ? state.editing.items
    : [];

  for (const item of items) {
    item.override_stock = false;
    item.override_token = null;
    item.override_approved_at = null;
    item.override_approved_by = null;
    item.override_reason = null;
    item.override_qty = null;
    item.override_lot_id = null;
  }
}

function getExistingBudgetKey() {
  const h = state?.editing?.header || {};

  return (
    h.budget_key ||
    h.security_key ||
    h.access_key ||
    h.copy_key ||
    h.to_order_key ||
    $('#budgetKey')?.value ||
    null
  );
}

async function resolveBudgetActionKey(actionLabel) {
  const existingKey = getExistingBudgetKey();
  if (existingKey && String(existingKey).trim()) {
    return String(existingKey).trim();
  }

  return await askBudgetActionKey({ actionLabel });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function hasMeaningfulPayments(list) {
  return Array.isArray(list) && list.some((row) => {
    const methodId =
      row?.payment_method_id ??
      row?.paymentMethods_id ??
      row?.payment_method ??
      null;

    const amount = Number(row?.amount || 0);
    return methodId != null || amount > 0;
  });
}

function restorePaymentsSnapshot(snapshot) {
  state.editing = state.editing || {};
  state.editing.payments = Array.isArray(snapshot?.payments) ? deepClone(snapshot.payments) : [];
  state.editing.payment_installments = Array.isArray(snapshot?.payment_installments)
    ? deepClone(snapshot.payment_installments)
    : [];
}

function normalizeDiscountType(value) {
  return String(value || 'value').trim().toLowerCase() === 'percent' ? 'percent' : 'value';
}

function normalizeNumber(value, def = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number(def);
}

function ensureEditingHeader() {
  if (!state.editing) {
    state.editing = { header: {}, items: [], payments: [], payment_installments: [] };
  }

  if (!state.editing.header) {
    state.editing.header = {};
  }

  state.editing.header.global_discount_type = normalizeDiscountType(
    state.editing.header.global_discount_type || $('#globalDiscountType')?.value || 'value'
  );

  if (!Number.isFinite(Number(state.editing.header.global_discount_value))) {
    state.editing.header.global_discount_value = normalizeNumber($('#globalDiscountValue')?.value, 0);
  } else {
    state.editing.header.global_discount_value = normalizeNumber(state.editing.header.global_discount_value, 0);
  }

  if (!Number.isFinite(Number(state.editing.header.global_discount_amount))) {
    state.editing.header.global_discount_amount = 0;
  } else {
    state.editing.header.global_discount_amount = normalizeNumber(state.editing.header.global_discount_amount, 0);
  }
}

function syncDiscountStateFromHiddenInputs() {
  ensureEditingHeader();

  const hiddenType = $('#globalDiscountType')?.value || 'value';
  const hiddenValue = $('#globalDiscountValue')?.value || 0;

  state.editing.header.global_discount_type = normalizeDiscountType(hiddenType);
  state.editing.header.global_discount_value = Math.max(0, normalizeNumber(hiddenValue, 0));
}

function syncDiscountHiddenInputsFromState() {
  ensureEditingHeader();

  const hiddenType = $('#globalDiscountType');
  const hiddenValue = $('#globalDiscountValue');

  if (hiddenType) hiddenType.value = normalizeDiscountType(state.editing.header.global_discount_type);
  if (hiddenValue) hiddenValue.value = String(Math.max(0, normalizeNumber(state.editing.header.global_discount_value, 0)));
}

function refreshDiscountStateAfterTotals() {
  ensureEditingHeader();

  state.editing.header.global_discount_type = normalizeDiscountType(state.editing.header.global_discount_type);
  state.editing.header.global_discount_value = Math.max(0, normalizeNumber(state.editing.header.global_discount_value, 0));
  state.editing.header.global_discount_amount = Math.max(0, normalizeNumber(state.editing.header.global_discount_amount, 0));
}

function recalcAndSyncBudgetTotals() {
  ensureEditingHeader();
  syncDiscountHiddenInputsFromState();
  syncGlobalDiscountHiddenFields();
  recalcTotals();
  refreshDiscountStateAfterTotals();
  syncDiscountHiddenInputsFromState();
}

function toNumberFromPtBr(value, def = 0) {
  const raw = String(value ?? '').trim();
  if (!raw) return def;

  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : def;
}

function buildBulkOverrideListHtml(items = []) {
  return items.map((it) => {
    const available = Number(it.availableQty || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });

    const requested = Number(it.requestedQty || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });

    const reasonLabel =
      it.reason === 'TOKEN_EXPIRED'
        ? 'Token expirado'
        : (it.reason || 'Estoque insuficiente');

    return `
      <div style="padding:8px 0;border-bottom:1px solid rgba(0,0,0,.08)">
        <div><b>SKU:</b> ${it.sku || ''}</div>
        <div><b>Produto:</b> ${it.description || ''}</div>
        <div><b>Qtd solicitada:</b> ${requested} &nbsp; | &nbsp; <b>Disponível:</b> ${available}</div>
        <div><b>Motivo:</b> ${reasonLabel}</div>
      </div>
    `;
  }).join('');
}

async function requestBulkOverride(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return {
      ok: false,
      message: 'Nenhum item informado para liberação.',
      items: [],
    };
  }

  const uniqueItems = [];
  const seen = new Set();

  for (const item of items) {
    const sku = String(item?.sku || '').trim();
    const lotId = item?.lot_id ?? null;

    if (!sku) continue;

    const itemKey = `${sku}::${lotId ?? ''}`;

    if (seen.has(itemKey)) continue;

    seen.add(itemKey);

    uniqueItems.push({
      sku,

      description: String(
        item?.description || ''
      ).trim(),

      requestedQty: Number(
        item?.requestedQty ??
        item?.quantity ??
        0
      ),

      availableQty: Number(
        item?.availableQty ??
        item?.available_qty ??
        0
      ),

      lotId,

      lot_id: lotId,

      reason:
        item?.reason ||
        (
          lotId
            ? 'Quantidade maior que o saldo do lote'
            : 'Produto sem estoque disponível'
        ),
    });
  }

  if (!uniqueItems.length) {
    return {
      ok: false,
      message: 'Nenhum item válido informado para liberação.',
      items: [],
    };
  }

  const listHtml = buildBulkOverrideListHtml(
    uniqueItems
  );

  const key = await showCenterModal({
    variant: 'warning',

    title: 'Liberação de Estoque',

    message: `
      <div style="
        display:flex;
        flex-direction:column;
        gap:10px;
      ">
        <div>
          Os itens abaixo precisam de autorização:
        </div>

        <div style="
          max-height:260px;
          overflow:auto;
          padding:10px;
          border:1px solid rgba(0,0,0,.08);
          border-radius:10px;
          background:#fff;
        ">
          ${listHtml}
        </div>

        <input
          id="bulkOverrideKey"
          type="password"
          placeholder="Digite a chave..."
          autocomplete="off"
          style="
            width:100%;
            height:38px;
            padding:8px 10px;
            border-radius:8px;
            border:1px solid rgba(0,0,0,.18);
            outline:none;
          "
        />
      </div>
    `,

    buttons: [
      {
        label: 'Cancelar',
        variant: 'cancel',
        action: () => null,
      },

      {
        label: 'Liberar todos',
        variant: 'primary',

        action: ({ card }) => {
          const input = card.querySelector(
            '#bulkOverrideKey'
          );

          return String(
            input?.value || ''
          ).trim() || null;
        },
      },
    ],
  });

  if (!key) {
    return {
      ok: false,
      message: 'Liberação não informada.',
      items: [],
    };
  }

  const base = (
    window.API_BASE ||
    window.apiBase ||
    window.location.origin
  ).replace(/\/$/, '');

  const out = await fetchSafe(
    `${base}/api/budgets/validate-stock-override-batch`,
    {
      method: 'POST',

      headers: authHeaders({
        'Content-Type': 'application/json',
      }),

      body: JSON.stringify({
        key: String(key).trim(),

        items: uniqueItems.map((item) => ({
          sku: item.sku,
          description: item.description,
          requestedQty: item.requestedQty,
          availableQty: item.availableQty,
          lotId: item.lot_id,
          reason: item.reason,
        })),
      }),
    }
  );

  if (!out.ok) {
    return {
      ok: false,

      message:
        out?.json?.error ||
        out?.json?.message ||
        out?.text ||
        'Não foi possível liberar os produtos.',

      items: [],
    };
  }

  const overrides = Array.isArray(
    out?.json?.overrides
  )
    ? out.json.overrides
    : [];

  return {
    ok: true,

    items: overrides.map((override) => ({
      sku: override?.sku,
      lot_id: override?.lot_id ?? null,

      token:
        override?.override_token ||
        override?.token ||
        null,
    })),

    message:
      out?.json?.message ||
      `${overrides.length} item(ns) liberado(s).`,
  };
}

function applyOverrideTokenToStateItem(item, token, reason = null) {
  if (!item) return;

  item.override_stock = true;
  item.override_token = token || null;
  item.override_approved_at = new Date().toISOString();
  item.override_approved_by = 'current_user';
  item.override_reason =
    reason ||
    (item.lot_id ? 'Quantidade maior que o saldo do lote' : 'Produto sem estoque disponível');
  item.override_qty = Number(item.quantity || 0);
  item.override_lot_id = item.lot_id ?? null;
}

function getAllPendingOverrideItemsFromState(
  firstParsedError = null
) {
  const items = Array.isArray(state.editing?.items)
    ? state.editing.items
    : [];

  return items
    .map((item) => {
      const requestedQty = Number(
        item?.quantity || 0
      );

      /*
       * hasLot is created here.
       * It is only a local boolean variable used inside this function.
       */
      const hasLot =
        item?.lot_id !== null &&
        item?.lot_id !== undefined &&
        String(item.lot_id).trim() !== '';

      const availableQty = hasLot
        ? Number(
          item?.qty_available_lot ??
          item?.lot_available_qty ??
          item?.available_lot ??
          0
        )
        : Number(
          item?.stock_available ??
          item?.available_stock ??
          item?.qty_available ??
          item?.current_stock ??
          item?.stock ??
          0
        );

      const tokenProblem =
        !!firstParsedError?.sku &&
        String(firstParsedError.sku).trim() ===
        String(item?.sku || '').trim();

      const hasValidLocalToken =
        item?.override_stock === true &&
        !!item?.override_token;

      const insufficientStock =
        requestedQty > availableQty;

      /*
       * Item does not need a new token.
       */
      if (
        !insufficientStock &&
        !tokenProblem
      ) {
        return null;
      }

      /*
       * Keep an existing valid token, except when the backend
       * has explicitly rejected that same SKU.
       */
      if (
        hasValidLocalToken &&
        !tokenProblem
      ) {
        return null;
      }

      return {
        sku: String(item?.sku || '').trim(),

        description: String(
          item?.description || ''
        ).trim(),

        requestedQty,

        availableQty,

        lot_id:
          hasLot
            ? item.lot_id
            : null,

        reason:
          firstParsedError?.isTokenExpired &&
            tokenProblem
            ? 'TOKEN_EXPIRED'
            : (
              hasLot
                ? 'Quantidade maior que o saldo do lote'
                : 'Produto sem estoque disponível'
            ),
      };
    })
    .filter((item) => (
      item &&
      item.sku &&
      Number.isFinite(item.requestedQty) &&
      item.requestedQty > 0
    ));
}

export function setPrintEnabled(enabled) {
  const btn = document.getElementById('btnImprimir');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.title = enabled ? 'Gerar PDF do orçamento' : 'Salve o orçamento para habilitar a impressão';
}

async function persistBudgetShippingIfPossible(budgetId) {
  if (!budgetId) return;

  const h = state.editing?.header || {};
  const shipping = state.editing?.shipping || {};

  const payload = {
    ...shipping,
    ...h,
    freight_value: Number($('#frete')?.value || h.freight_value || shipping.freight_value || 0),
    freight_mode: Number(h.freight_mode ?? shipping.freight_mode ?? 9),
  };

  const out = await fetchSafe(ROUTES.budgetShippingByBudgetId(budgetId), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });

  if (!out.ok) {
    throw new Error(out.json?.error || out.json?.message || out.text || 'Erro ao salvar frete.');
  }

  state.editing.shipping = out.json?.data || payload;
}

export async function saveBudget() {
  if (__savingBudget) return;
  __savingBudget = true;

  try {
    console.log('[budgets] saveBudget(); selectedId =', state.selectedId);

    if (!state.editing) {
      return toast.error('Erro', 'Editor não inicializado. Clique em "Novo orçamento" antes de salvar.');
    }

    ensureEditingHeader();
    recalcAndSyncBudgetTotals();

    if (!state.editing?.header?.customer_id) {
      return toast.warn('Atenção', 'Escolha um cliente antes de salvar o orçamento.');
    }

    if (isSinglePriceMode() && !state.selectedId) {
      state.editing.header.price_id = SINGLE_PRICE_ID;
      state.editing.header.price_table_name = 'Preço único';
    }

    if (!isSinglePriceMode() && !state.editing?.header?.price_id) {
      return toast.warn(
        'Tabela de preço',
        'O cliente selecionado não possui uma tabela de preços vinculada.'
      );
    }

    if (!state.editing.items || state.editing.items.length === 0) {
      return toast.warn('Atenção', 'Inclua pelo menos um item antes de salvar.');
    }

    const subtotal = Number(state.editing.header.subtotal || 0);
    const totalDiscount = Number(state.editing.header.total_discount || 0);
    const maximumDiscount = subtotal * (Number(budgetSettings.max_discount_percent || 0) / 100);
    if (totalDiscount > maximumDiscount + 0.0001) {
      return toast.warn(
        'Desconto',
        `O desconto total excede o máximo permitido de ${budgetSettings.max_discount_percent}%.`
      );
    }

    try {
      const paymentValidation = validatePaymentsBeforeSave({ strict: false });
      if (!paymentValidation.ok) {
        return toast.warn('Pagamentos', paymentValidation.message || 'Revise os pagamentos.');
      }
    } catch (e) {
      console.warn('[budgets] validatePaymentsBeforeSave error:', e?.message || e);
    }

    async function tryPersistOnce() {
      const payload = collectPayload();

      console.log('[budgets][save] items override snapshot=', payload.items.map((it) => ({
        sku: it.sku,
        quantity: it.quantity,
        lot_id: it.lot_id ?? null,
        override_stock: !!it.override_stock,
        override_token: it.override_stock ? (it.override_token ?? null) : null,
      })));

      const url = state.selectedId ? ROUTES.budgetById(state.selectedId) : ROUTES.budgets;
      const method = state.selectedId ? 'PUT' : 'POST';

      return await fetchSafe(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
    }

    let out = await tryPersistOnce();

    if (!out.ok) {
      if (handleAuthFail(out.status, out.text)) return;

      const msg =
        out.json?.erro ||
        out.json?.error ||
        out.json?.message ||
        out.text ||
        `Código ${out.status}`;

      const parsed = parseOverrideValidationError(msg);

      const needsOverrideRetry =
        parsed.sku &&
        (parsed.isStockError || parsed.isInvalidOverride || parsed.isTokenExpired);

      if (!needsOverrideRetry) {
        console.error('[budgets] SAVE_ERR', out.status, out.text);
        return toast.error('Falha ao salvar', String(msg).slice(0, 420));
      }

      const outOfStockMode = getConfiguredOutOfStockMode();

      if (outOfStockMode === 'ALLOW') {
        // ALLOW never asks for a password. Remove stale tokens and try once
        // more, because an old token may have been rejected by the backend.
        clearStockOverridesFromState();
        renderItems();

        out = await tryPersistOnce();

        if (!out.ok) {
          if (handleAuthFail(out.status, out.text)) return;

          const allowMsg =
            out.json?.erro ||
            out.json?.error ||
            out.json?.message ||
            out.text ||
            `Código ${out.status}`;

          console.error('[budgets] ALLOW_MODE_BACKEND_REJECTED', out.status, out.text);
          return toast.error(
            'Configuração de estoque',
            `O modo está definido como ALLOW, mas o backend recusou o estoque: ${String(allowMsg).slice(0, 300)}`
          );
        }
      } else if (outOfStockMode === 'BLOCK') {
        // BLOCK refuses the operation and must never display the password modal.
        clearStockOverridesFromState();
        renderItems();
        return toast.warn(
          'Estoque bloqueado',
          String(msg).slice(0, 420)
        );
      }

      if (!out.ok && outOfStockMode === 'PASSWORD') {
      const pendingItems =
        getAllPendingOverrideItemsFromState(parsed);

      if (!pendingItems.length) {
        return toast.error(
          'Falha ao salvar',
          'O backend informou falta de estoque, mas nenhum item foi identificado para liberação.'
        );
      }

      console.log(
        '[budgets][bulk-override] itens pendentes=',
        pendingItems
      );

      const unlockAll =
        await requestBulkOverride(pendingItems);

      if (!unlockAll.ok) {
        return toast.warn('Estoque', unlockAll.message || 'Não foi possível renovar a liberação.');
      }

      for (const result of unlockAll.items || []) {
        const targets = (state.editing.items || []).filter(
          (it) =>
            String(it.sku || '').trim() === String(result.sku || '').trim() &&
            String(it.lot_id ?? '') === String(result.lot_id ?? '')
        );

        for (const target of targets) {
          applyOverrideTokenToStateItem(target, result.token);
        }
      }

      const itemsWithoutToken =
        pendingItems.filter((pending) => {
          return !(state.editing.items || []).some(
            (item) =>
              String(item?.sku || '').trim() ===
              String(pending?.sku || '').trim() &&
              String(item?.lot_id ?? '') ===
              String(pending?.lot_id ?? '') &&
              item?.override_stock === true &&
              !!item?.override_token
          );
        });

      if (itemsWithoutToken.length) {
        console.error(
          '[budgets][bulk-override] itens sem token=',
          itemsWithoutToken
        );

        return toast.error(
          'Liberação incompleta',
          `${itemsWithoutToken.length} produto(s) não receberam o token de liberação.`
        );
      }

      renderItems();
      recalcTotals();

      toast.success('Liberação', unlockAll.message || 'Itens liberados com sucesso.');

      out = await tryPersistOnce();

      if (!out.ok) {
        if (handleAuthFail(out.status, out.text)) return;

        const retryMsg =
          out.json?.erro ||
          out.json?.error ||
          out.json?.message ||
          out.text ||
          `Código ${out.status}`;

        console.error('[budgets] SAVE_ERR_AFTER_BULK_OVERRIDE', out.status, out.text);
        return toast.error('Falha ao salvar', String(retryMsg).slice(0, 420));
      }
      }
    }

    const js = out.json || {};
    const budgetId = js.id || js.budget_id || state.selectedId || null;

    if (!state.selectedId && budgetId) {
      state.selectedId = budgetId;
    }

    if (budgetId) {
      await persistBudgetShippingIfPossible(budgetId);
    }

    $('#numero') && ($('#numero').value = String(js.number || js.budget_number || state.selectedId || ''));

    if (budgetId) {
      const paymentsSnapshot = {
        payments: deepClone(state.editing?.payments || []),
        payment_installments: deepClone(state.editing?.payment_installments || []),
      };

      console.log('[budgets][save] payments before persist:', paymentsSnapshot.payments);

      try {
        await persistBudgetPaymentsIfPossible(budgetId, {
          auto_generate_installments: true
        });

        await loadBudgetPaymentsForEditor(budgetId);

        const backendCameEmpty =
          !hasMeaningfulPayments(state.editing?.payments) &&
          hasMeaningfulPayments(paymentsSnapshot.payments);

        if (backendCameEmpty) {
          console.warn('[budgets][save] backend returned empty payments after save; restoring local snapshot.');
          restorePaymentsSnapshot(paymentsSnapshot);
        }

        await renderBudgetPayments();
        await renderBudgetPaymentInstallments();
        updatePaymentsSummaryUI();
      } catch (e) {
        console.error('[budgets] SAVE_PAYMENTS_ERR', e);

        restorePaymentsSnapshot(paymentsSnapshot);
        await renderBudgetPayments();
        await renderBudgetPaymentInstallments();
        updatePaymentsSummaryUI();

        return toast.error(
          'Orçamento salvo, mas pagamentos falharam',
          String(e?.message || e || 'Falha ao salvar pagamentos.').slice(0, 420)
        );
      }
    }

    setPrintEnabled(!!state.selectedId);
    updatePaymentsSummaryUI();

    const paymentValidationAfter = (() => {
      try {
        return validatePaymentsBeforeSave({ strict: false });
      } catch {
        return null;
      }
    })();

    if (paymentValidationAfter && !paymentValidationAfter.is_balanced) {
      toast.warn(
        'Orçamento salvo',
        `✅ Orçamento salvo, mas os pagamentos ainda têm diferença de R$ ${Number(paymentValidationAfter.difference || 0).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`
      );
      return;
    }

    toast.success('Tudo certo!', '✅ Orçamento salvo com sucesso.');
  } finally {
    __savingBudget = false;
  }
}

export function collectPayload() {
  ensureEditingHeader();

  recalcAndSyncBudgetTotals();

  const h = state.editing?.header || {};
  const issueDate = $('#dtEmissao')?.value || new Date().toISOString().slice(0, 10);

  const dueRaw = $('#dataVencimento')?.value || '';
  const payment_due_date = dueRaw || null;

  const globalDiscountType =
    normalizeDiscountType(
      h.global_discount_type ||
      $('#globalDiscountType')?.value ||
      'value'
    );

  const globalDiscountValue = Math.max(0, normalizeNumber(
    h.global_discount_value ??
    $('#globalDiscountValue')?.value ??
    0,
    0
  ));

  const globalDiscountAmount = Math.max(0, normalizeNumber(
    h.global_discount_amount ?? 0,
    0
  ));

  const items = sanitizeOverrideFields(state.editing?.items || []).map((it) => ({
    product_id: it.product_id ?? null,

    sku: it.sku,

    manufacturer_ref:
      it.manufacturer_ref ??
      it.manufacturerRef ??
      it.ref_fab ??
      it.refFab ??
      '',

    description: it.description,
    unit: it.unit,
    unit_factor: Number(it.unit_factor || 1) || 1,

    quantity: Number(it.quantity || 0),
    unit_price: Number(it.unit_price || 0),
    discount_value: Number(it.discount_value || 0),

    grade_id: it.grade_id ?? null,
    grade: it.grade || '',

    price_id: it.price_id ?? null,
    commission_id: it.commission_id ?? null,

    tabela_preco_id: it.price_id ?? null,

    lot_id: it.lot_id ?? null,
    lot_code: it.lot_code ?? null,
    expiry_date: it.expiry_date ?? it.lot_expiration ?? null,

    override_stock: !!it.override_stock,
    override_token: it.override_stock ? (it.override_token ?? null) : null,
  }));

  return {
    customer_id: h.customer_id,
    price_id: h.price_id ?? null,
    customer_name: h.customer_name,
    customer_tax_id: h.customer_tax_id,
    issue_date: issueDate,
    status: $('#status')?.value || 'ABERTO',
    operation_type_id: Number($('#budgetOperationTypeId')?.value) || null,
    notes: $('#obs')?.value || '',
    freight_value: Number($('#frete')?.value || 0),

    global_discount_type: globalDiscountType,
    global_discount_value: globalDiscountValue,
    global_discount_amount: globalDiscountAmount,

    subtotal: Number(h.subtotal || 0),
    items_discount_total: Number(h.items_discount_total || 0),
    total_discount: Number(h.total_discount || 0),
    total_amount: Number(h.total_amount || 0),

    payment_method_id: $('#formaPagamento')?.value || h.payment_method_id || null,
    payment_form_id: $('#formaPagamento')?.value || h.payment_form_id || null,
    payment_term_id: $('#condicaoPagamento')?.value || h.payment_term_id || null,
    payment_due_date,

    payment_condition_label:
      h.payment_condition_label ||
      $('#condicaoPagamento')?.selectedOptions?.[0]?.textContent ||
      '',

    items,

    nome_razao_social: h.nome_razao_social || h.customer_name || $('#cliNome')?.value || '',
    cnpj_cpf: h.cnpj_cpf || h.customer_tax_id || $('#cliDoc')?.value || '',
    email: h.email || $('#cliEmail')?.value || '',
    phone: h.phone || $('#cliTel')?.value || '',

    seller_id: h.seller_id || $('#sellerId')?.value || null,
  };
}

// Nome vindo do servidor ("<número> - <cliente>.pdf"); filename* (UTF-8) tem prioridade
function filenameFromContentDisposition(header, fallback) {
  const value = String(header || '');
  const encoded = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (encoded) {
    try { return decodeURIComponent(encoded[1].trim()); } catch { /* usa o próximo */ }
  }
  const plain = value.match(/filename\s*=\s*"?([^";]+)"?/i);
  return plain ? plain[1].trim() : fallback;
}

export async function openPdf(id) {
  const budgetId = Number(id);

  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    return toast.error('Erro', 'ID do orçamento inválido.');
  }

  try {
    const response = await fetch(ROUTES.printPdf(budgetId), {
      method: 'GET',
      headers: authHeaders({ Accept: 'application/pdf' }),
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');

      if (handleAuthFail(response.status, errorText)) return;

      throw new Error(
        errorText || `Não foi possível gerar o PDF do orçamento #${budgetId}.`
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/pdf')) {
      const errorText = await response.text().catch(() => '');
      throw new Error(errorText || 'O servidor não retornou um arquivo PDF.');
    }

    const filename = filenameFromContentDisposition(
      response.headers.get('content-disposition'),
      `${budgetId}.pdf`
    );

    const pdfBlob = await response.blob();
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // Download direto: numa aba com blob o navegador ignora o nome do arquivo
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
  } catch (error) {
    console.error('[budgets][pdf] Falha ao gerar PDF:', error);
    toast.error(
      'Erro ao gerar PDF',
      error?.message || `Não foi possível gerar o PDF do orçamento #${budgetId}.`
    );
  }
}

export async function transformToOrder(id) {
  if (!canTransformBudgetToOrder()) {
    return toast.warn(
      'Ação indisponível',
      'A configuração atual de emissão de NF-e não permite transformar orçamento em pedido.'
    );
  }

  const key = await resolveBudgetActionKey(
    'transformar o orçamento em pedido'
  );

  if (!key) {
    return toast.warn('Atenção', 'Transformação cancelada. Chave não informada.');
  }

  const out = await fetchSafe(ROUTES.toOrder(id), {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'x-budget-key': key,
      'x-budget-to-order-key': key,
    }),
    body: JSON.stringify({ key }),
  });

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return;

    const apiErr = (out.json?.error || out.json?.erro || '').toString().toUpperCase();
    if (out.status === 403 || apiErr === 'KEY_REQUIRED' || apiErr === 'INVALID_KEY') {
      return toast.warn('Chave inválida', 'A chave informada é inválida ou não foi enviada.');
    }

    const msg = out.json?.message || out.json?.error || out.text || 'Não foi possível transformar em pedido.';
    return toast.error('Falha', String(msg).slice(0, 420));
  }

  toast.success('Pedido criado', '✅ Transformado em pedido. Indo para pedidos...');

  try {
    const m = await import('./budgets.list.js');
    await m.fetchBudgets();
  } catch { }

  setTimeout(() => {
    window.location.href = '../orders/orders.html';
  }, 700);
}

export async function reloadBudgetByIdIntoEditor(id) {
  if (!id) return;

  const out = await fetchSafe(ROUTES.budgetById(id), {
    headers: authHeaders(),
    method: 'GET'
  });

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return;
    toast.error('Erro', 'Não foi possível recarregar o orçamento.');
    return;
  }

  const b = out.json || {};

  console.log('[budgets][reload][raw backend]', b);
  console.log('[budgets][reload][discount fields]', {
    global_discount_type: b.global_discount_type,
    global_discount_value: b.global_discount_value,
    global_discount_amount: b.global_discount_amount,
    total_discount: b.total_discount,
    total_amount: b.total_amount,
  });

  state.editing = state.editing || {
    header: {},
    items: [],
    payments: [],
    payment_installments: [],
  };

  const previousHeader = state.editing.header || {};

  state.editing.header = {
    ...previousHeader,
    ...b,

    global_discount_type: normalizeDiscountType(
      b.global_discount_type ??
      previousHeader.global_discount_type ??
      'value'
    ),

    global_discount_value: Math.max(
      0,
      normalizeNumber(
        b.global_discount_value ??
        previousHeader.global_discount_value ??
        0,
        0
      )
    ),

    global_discount_amount: Math.max(
      0,
      normalizeNumber(
        b.global_discount_amount ??
        previousHeader.global_discount_amount ??
        0,
        0
      )
    ),

    subtotal: Math.max(
      0,
      normalizeNumber(
        b.subtotal ??
        previousHeader.subtotal ??
        0,
        0
      )
    ),

    items_discount_total: Math.max(
      0,
      normalizeNumber(
        b.items_discount_total ??
        previousHeader.items_discount_total ??
        0,
        0
      )
    ),

    total_discount: Math.max(
      0,
      normalizeNumber(
        b.total_discount ??
        previousHeader.total_discount ??
        0,
        0
      )
    ),

    total_amount: Math.max(
      0,
      normalizeNumber(
        b.total_amount ??
        previousHeader.total_amount ??
        0,
        0
      )
    ),

    freight_value: Math.max(
      0,
      normalizeNumber(
        b.freight_value ??
        previousHeader.freight_value ??
        0,
        0
      )
    ),
  };

  $('#dtEmissao') && ($('#dtEmissao').value = String(b.issue_date || '').slice(0, 10));
  $('#status') && ($('#status').value = b.status || 'ABERTO');
  if ($('#budgetOperationTypeId')) {
    $('#budgetOperationTypeId').value = String(b.operation_type_id || '');
  }
  $('#obs') && ($('#obs').value = b.notes || '');

  $('#numero') && ($('#numero').value = String(b.budget_id || b.id || ''));

  $('#cliBusca') && ($('#cliBusca').value = b.customer_name || b.nome_razao_social || '');
  $('#cliNome') && ($('#cliNome').value = b.customer_name || b.nome_razao_social || '');
  $('#cliDoc') && ($('#cliDoc').value = b.customer_tax_id || b.cnpj_cpf || '');
  $('#cliTel') && ($('#cliTel').value = b.phone || '');
  $('#cliEmail') && ($('#cliEmail').value = b.email || '');
  $('#sellerId') && ($('#sellerId').value = b.seller_id || '');

  if ($('#frete')) {
    $('#frete').value = String(
      Math.max(0, normalizeNumber(b.freight_value ?? state.editing.header.freight_value ?? 0, 0))
    );
  }

  if ($('#globalDiscountType')) {
    $('#globalDiscountType').value = state.editing.header.global_discount_type;
  }

  if ($('#globalDiscountValue')) {
    $('#globalDiscountValue').value = String(state.editing.header.global_discount_value);
  }

  state.editing.items = (b.items || []).map((it) => ({
    product_id: it.product_id ?? it.pid ?? it.id ?? null,
    sku: it.sku,
    description: it.description,
    unit: it.unit,
    unit_factor: Number(it.unit_factor || 1) || 1,
    quantity: Number(it.quantity || 0),
    unit_price: Number(it.unit_price || 0),
    discount_value: Number(it.discount_value || 0),
    grade_id: it.grade_id ?? it.product_grade_id ?? null,
    grade: it.grade ?? it.grade_name ?? '',
    price_id: it.price_id ?? it.tabela_preco_id ?? null,
    commission_id: it.commission_id ?? null,
    lot_id: it.lot_id ?? null,
    lot_code: it.lot_code ?? null,
    expiry_date: it.expiry_date ?? it.lot_expiration ?? null,
    override_stock: !!it.override_stock,
    override_token: it.override_token ?? null,
  }));

  const pmId = b.payment_method_id ?? b.paymentMethods_id ?? b.payment_form_id ?? null;
  if (pmId != null) {
    const forma = $('#formaPagamento');
    if (forma) {
      forma.value = String(pmId);
      try {
        onPaymentMethodChange();
      } catch { }
    }
  }

  const paymentTermId = b.payment_term_id ?? null;
  if (paymentTermId != null) {
    const cond = $('#condicaoPagamento');
    if (cond) {
      cond.value = String(paymentTermId);
    }
  }

  syncDiscountHiddenInputsFromState();
  syncGlobalDiscountHiddenFields();

  renderItems();
  recalcTotals();

  refreshDiscountStateAfterTotals();
  syncDiscountHiddenInputsFromState();
  syncGlobalDiscountHiddenFields();
  updatePaymentsSummaryUI();

  try {
    const paymentsSnapshot = {
      payments: deepClone(state.editing?.payments || []),
      payment_installments: deepClone(state.editing?.payment_installments || []),
    };

    await loadBudgetPaymentsForEditor(id);

    const backendCameEmpty =
      !hasMeaningfulPayments(state.editing?.payments) &&
      hasMeaningfulPayments(paymentsSnapshot.payments);

    if (backendCameEmpty) {
      restorePaymentsSnapshot(paymentsSnapshot);
    }

    await renderBudgetPayments();
    await renderBudgetPaymentInstallments();
    updatePaymentsSummaryUI();
  } catch (e) {
    console.warn('[budgets] reload payments error:', e?.message || e);
  }
}

/* =========================================================================
   Desconto geral — modal / bind / aplicar
   ========================================================================= */

function getGlobalDiscountEls() {
  return {
    openBtn: $('#btnGlobalDiscountModal'),
    modal: $('#globalDiscountModal'),
    saveBtn: $('#btnGlobalDiscountSave'),
    typeInput: $('#globalDiscountTypeModal'),
    valueInput: $('#globalDiscountValueModal'),
    hiddenType: $('#globalDiscountType'),
    hiddenValue: $('#globalDiscountValue'),
    totalGlobalDiscount: $('#totalGlobalDiscount'),
  };
}

function openGlobalDiscountModal() {
  ensureEditingHeader();

  const els = getGlobalDiscountEls();
  if (!els.modal) return;

  const currentType =
    state.editing?.header?.global_discount_type ||
    els.hiddenType?.value ||
    'value';

  const currentValue = Number(
    state.editing?.header?.global_discount_value ??
    els.hiddenValue?.value ??
    0
  ) || 0;

  if (els.typeInput) els.typeInput.value = normalizeDiscountType(currentType);
  if (els.valueInput) els.valueInput.value = String(Math.max(0, currentValue));

  Modal.setup();
  Modal.open(els.modal, { focusSelector: '#globalDiscountValueModal' });

  setTimeout(() => els.valueInput?.select?.(), 30);
}

function closeGlobalDiscountModal() {
  Modal.close('globalDiscountModal');
}

function applyGlobalDiscountFromModal() {
  ensureEditingHeader();

  const els = getGlobalDiscountEls();
  const type = normalizeDiscountType(els.typeInput?.value || 'value');
  const value = Number(els.valueInput?.value || 0);

  if (!['value', 'percent'].includes(type)) {
    return toast.warn('Desconto geral', 'Tipo de desconto inválido.');
  }

  if (!Number.isFinite(value) || value < 0) {
    return toast.warn('Desconto geral', 'Informe um valor válido para o desconto.');
  }

  state.editing.header.global_discount_type = type;
  state.editing.header.global_discount_value = Math.max(0, value);

  if (els.hiddenType) els.hiddenType.value = type;
  if (els.hiddenValue) els.hiddenValue.value = String(Math.max(0, value));

  syncGlobalDiscountHiddenFields();
  recalcTotals();
  refreshDiscountStateAfterTotals();
  renderItems();
  updatePaymentsSummaryUI();

  if (els.totalGlobalDiscount) {
    els.totalGlobalDiscount.textContent = Number(
      state.editing?.header?.global_discount_amount || 0
    ).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  closeGlobalDiscountModal();

  toast.success('Desconto geral', '✅ Desconto geral aplicado com sucesso.');
}

export function bindGlobalDiscountActions() {
  const els = getGlobalDiscountEls();

  // modal.js cuida do X, Cancelar, backdrop e ESC (data-modal-close)
  Modal.setup();

  if (els.openBtn && !els.openBtn.dataset.bound) {
    els.openBtn.addEventListener('click', openGlobalDiscountModal);
    els.openBtn.dataset.bound = '1';
  }

  if (els.saveBtn && !els.saveBtn.dataset.bound) {
    els.saveBtn.addEventListener('click', applyGlobalDiscountFromModal);
    els.saveBtn.dataset.bound = '1';
  }

  if (els.valueInput && !els.valueInput.dataset.bound) {
    els.valueInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyGlobalDiscountFromModal();
      }
    });
    els.valueInput.dataset.bound = '1';
  }
}

/* ──────────────────────────────────────────────────────────────
  Copiar orçamento — modal de seleção de produtos
────────────────────────────────────────────────────────────── */
function escapeCopyHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}

function fmtCopyQty(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

async function fetchBudgetItemsForCopy(budgetId) {
  const out = await fetchSafe(ROUTES.budgetById(budgetId), {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return null;
    toast.error('Erro', 'Não foi possível carregar os produtos do orçamento.');
    return null;
  }

  const items = Array.isArray(out.json?.items) ? out.json.items : [];
  return items.filter((it) => Number(it?.budget_item_id) > 0);
}

// Built on demand and appended to <body>: in budgets.html the markup
// ended up inside other blocks and never showed when copying from the list.
function ensureCopyBudgetModal() {
  let modal = document.getElementById('copyBudgetModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'copyBudgetModal';
  modal.className = 'modal copy-budget-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">
      <section class="modal__panel modal-width-7" role="dialog" aria-modal="true"
        aria-labelledby="copyBudgetModalTitle" tabindex="-1">
        <header class="modal__header modal-header-color-3">
          <div>
            <h2 id="copyBudgetModalTitle" class="modal__title">Copiar orçamento</h2>
            <p class="modal__subtitle">Marque os produtos que irão para o novo orçamento.</p>
          </div>
          <button type="button" class="modal__close" data-modal-close
            title="Fechar" aria-label="Fechar">&times;</button>
        </header>

        <div class="modal__body modal-section">
          <div class="copy-budget-table-wrap">
            <table class="table table-zebra table-zebra-hover table-sticky-head">
              <thead>
                <tr>
                  <th class="copy-budget-col-check">
                    <input type="checkbox" id="copyBudgetSelectAll" title="Marcar/desmarcar todos"
                      aria-label="Marcar ou desmarcar todos os produtos" checked />
                  </th>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th class="num">Qtd</th>
                  <th class="num">Vlr. unit.</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody id="copyBudgetItemsBody"></tbody>
            </table>
          </div>
          <p class="copy-budget-summary" id="copyBudgetSummary"></p>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <button type="button" class="btn btn-cancel btn-sm" data-modal-close>Cancelar</button>
          <button type="button" class="btn btn-save btn-sm" id="btnCopyBudgetConfirm">Copiar</button>
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(modal);
  return modal;
}

// Resolves with the checked budget_item_id list, or null when cancelled.
function pickItemsToCopy(budgetId, items) {
  const modal = ensureCopyBudgetModal();
  const body = $('#copyBudgetItemsBody');
  const selectAll = $('#copyBudgetSelectAll');
  const summary = $('#copyBudgetSummary');
  const confirmBtn = $('#btnCopyBudgetConfirm');
  const title = $('#copyBudgetModalTitle');

  if (!modal || !body || !selectAll || !confirmBtn) {
    const ok = window.confirm(`Deseja copiar o orçamento #${budgetId}?`);
    return Promise.resolve(ok ? items.map((it) => Number(it.budget_item_id)) : null);
  }

  if (title) title.textContent = `Copiar orçamento #${budgetId}`;

  body.innerHTML = items.map((it) => {
    const qty = Number(it.quantity || 0);
    const unitPrice = Number(it.unit_price || 0);
    const total = Math.max(0, qty * unitPrice - Number(it.discount_value || 0));

    return `
      <tr data-item-id="${Number(it.budget_item_id)}">
        <td class="copy-budget-col-check">
          <input type="checkbox" class="copy-budget-item-check" checked
            aria-label="Copiar ${escapeCopyHtml(it.description)}" />
        </td>
        <td>${escapeCopyHtml(it.product_code ?? it.sku ?? '')}</td>
        <td>${escapeCopyHtml(it.description)}</td>
        <td class="num">${fmtCopyQty(qty)} ${escapeCopyHtml(it.unit_code ?? '')}</td>
        <td class="num">${fmtMoney(unitPrice)}</td>
        <td class="num">${fmtMoney(total)}</td>
      </tr>
    `;
  }).join('');

  const getChecks = () => [...body.querySelectorAll('.copy-budget-item-check')];

  const refresh = () => {
    const checks = getChecks();
    const checkedCount = checks.filter((c) => c.checked).length;

    checks.forEach((c) => {
      c.closest('tr')?.classList.toggle('is-unchecked', !c.checked);
    });

    selectAll.checked = checkedCount === checks.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checks.length;
    confirmBtn.disabled = checkedCount === 0;

    if (summary) {
      summary.textContent = `${checkedCount} de ${checks.length} produto(s) selecionado(s).`;
    }
  };

  return new Promise((resolve) => {
    let result = null;

    const onSelectAll = () => {
      getChecks().forEach((c) => { c.checked = selectAll.checked; });
      refresh();
    };

    const onBodyClick = (e) => {
      const row = e.target.closest('tr[data-item-id]');
      if (!row) return;

      // Clicking anywhere on the row toggles its checkbox.
      if (!e.target.classList.contains('copy-budget-item-check')) {
        const check = row.querySelector('.copy-budget-item-check');
        if (check) check.checked = !check.checked;
      }

      refresh();
    };

    const onConfirm = () => {
      const ids = getChecks()
        .filter((c) => c.checked)
        .map((c) => Number(c.closest('tr')?.dataset.itemId))
        .filter((v) => Number.isFinite(v) && v > 0);

      if (!ids.length) {
        toast.warn('Atenção', 'Selecione ao menos um produto para copiar.');
        return;
      }

      result = ids;
      Modal.close(modal);
    };

    const onClose = () => {
      selectAll.removeEventListener('change', onSelectAll);
      body.removeEventListener('click', onBodyClick);
      confirmBtn.removeEventListener('click', onConfirm);
      modal.removeEventListener('modal:close', onClose);
      body.innerHTML = '';
      resolve(result);
    };

    selectAll.addEventListener('change', onSelectAll);
    body.addEventListener('click', onBodyClick);
    confirmBtn.addEventListener('click', onConfirm);
    modal.addEventListener('modal:close', onClose);

    refresh();
    Modal.setup();
    Modal.open(modal, { focusSelector: '#btnCopyBudgetConfirm' });
  });
}

export async function copyBudget(id) {
  const budgetId = Number(id);
  if (!Number.isFinite(budgetId) || budgetId <= 0) {
    return toast.error('Erro', 'ID do orçamento inválido.');
  }

  const items = await fetchBudgetItemsForCopy(budgetId);
  if (!items) return;

  let itemIds = null;

  if (items.length) {
    itemIds = await pickItemsToCopy(budgetId, items);
    if (!itemIds) return;
  } else {
    const confirmed = window.confirm(`Deseja copiar o orçamento #${budgetId}?`);
    if (!confirmed) return;
  }

  const key = await resolveBudgetActionKey('copiar o orçamento');
  if (!key) {
    return toast.warn('Atenção', 'Cópia cancelada. Chave não informada.');
  }

  const out = await fetchSafe(ROUTES.copyBudget(budgetId), {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'x-budget-key': key,
      'x-budget-copy-key': key,
    }),
    body: JSON.stringify(itemIds ? { key, item_ids: itemIds } : { key }),
  });

  if (!out.ok) {
    if (handleAuthFail(out.status, out.text)) return;

    const apiErr = (out.json?.error || out.json?.erro || '').toString().toUpperCase();
    if (out.status === 403 || apiErr === 'KEY_REQUIRED' || apiErr === 'INVALID_KEY') {
      return toast.warn('Chave inválida', 'A chave informada é inválida ou não foi enviada.');
    }

    const msg =
      out?.json?.message ||
      out?.json?.error ||
      out?.text ||
      'Não foi possível copiar o orçamento.';

    return toast.error('Erro ao copiar', String(msg).slice(0, 240));
  }

  const data = out.json || {};
  const newId =
    data.new_budget_id ??
    data.id ??
    data.budget_id ??
    null;

  if (!newId) {
    return toast.error('Erro', 'A cópia foi criada, mas o novo ID não foi retornado.');
  }

  toast.success('Orçamento', `✅ Orçamento copiado com sucesso. Novo orçamento #${newId}.`);

  try {
    const m = await import('./budgets.list.js');
    await m.fetchBudgets();
  } catch { }

  try {
    const editor = await import('./budgets.editor.js');
    if (typeof editor.openEditor === 'function') {
      return editor.openEditor(newId);
    }
  } catch { }

  state.selectedId = Number(newId);
  return reloadBudgetByIdIntoEditor(newId);
}
