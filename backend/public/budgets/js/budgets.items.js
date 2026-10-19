// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.items.js — Itens/Produto/Cliente (seleção + tabela) ║
// ║ PRODNEX ERP                                                 ║
// ║ ✅ Suporte a Lote/Validade (productsStockLots)              ║
// ║ ✅ Recalcula resumo de pagamentos ao alterar totais         ║
// ║ ✅ Permite item sem estoque sem solicitação de liberação       ║
// ║ ✅ Compatível com STOCK_SIMPLE sem consultar lotes             ║
// ║ ✅ Suporte a desconto geral do orçamento                    ║
// ║ ✅ HARDEN: sincronismo persistente do desconto geral        ║
// ║ ✅ FIX: metadados de override consistentes na edição        ║
// ║ ✅ FIX: trava anti-duplo clique / reentrada no addItem      ║
// ║ ✅ FIX: busca de preços mais limpa e resiliente             ║
// ╚══════════════════════════════════════════════════════════════╝

import {
  $,
  API_BASE,
  ROUTES,
  state,
  catalogs,
  productPricesCache,
  gradeNameCache,
  safeUpper,
  fmtMoney,
  ensureBudgetDiscountFields,
  initGlobalDiscountInState,
  budgetSettings,
} from './budgets.core.js';
import { authHeaders, fetchSafe, toast } from './budgets.infra.js';
import {
  SINGLE_PRICE_ID,
  isSinglePriceMode,
  applyPriceModeUI,
} from './budgets.priceMode.js';

import {
  isSimpleStockMode,
  requiresStockLot,
} from './budgets.stockMode.js';

import { showCenterModal } from '/public/includes/js/centerAlertModal.js';

/* ──────────────────────────────────────────────────────────────
   Guards
────────────────────────────────────────────────────────────── */
let __addingBudgetItem = false;

/* ──────────────────────────────────────────────────────────────
   Stock helpers
────────────────────────────────────────────────────────────── */
async function getStockOverrideStatus() {
  if (!budgetSettings.allow_out_of_stock) {
    return { ok: true, enabled: false };
  }

  const out = await fetchSafe(`${API_BASE}/api/budgets/stock-override-status`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!out.ok) {
    return { ok: false, enabled: false };
  }

  return {
    ok: true,
    enabled: !!out?.json?.enabled,
  };
}

function getTotalItemInCart(sku, ignoreIndex = null) {
  return (state.editing?.items || [])
    .filter((it, idx) => it.sku === sku && idx !== ignoreIndex)
    .reduce((sum, it) => sum + toNumberSafe(it.quantity, 0), 0);
}

function validateStockForItem({ sku, quantity, stock, lotQty = null, ignoreIndex = null }) {
  const totalInCart = getTotalItemInCart(sku, ignoreIndex);

  const available = lotQty != null
    ? toNumberSafe(lotQty, 0)
    : toNumberSafe(stock, 0);

  if ((totalInCart + quantity) > available) {
    return {
      ok: false,
      message: `Estoque insuficiente (Disponível: ${available}, já no carrinho: ${totalInCart})`,
      available,
      totalInCart,
    };
  }

  return { ok: true, available };
}

function toNumberSafe(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;

  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : fallback;
  }

  let s = String(v).trim();
  if (!s) return fallback;

  s = s.replace(/\s/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDiscountType(v) {
  return String(v || 'value').trim().toLowerCase() === 'percent' ? 'percent' : 'value';
}

function getProductStockFromPayload(p = {}) {
  return toNumberSafe(
    p.stock ??
    p.current_stock ??
    p.available_stock ??
    p.qty_available ??
    p.quantity_available ??
    p.saldo ??
    p.estoque ??
    p.estoque_atual ??
    p.stock_quantity ??
    p.on_hand ??
    p.qty_on_hand ??
    p.available ??
    p.stock_total ??
    p.total_stock ??
    0,
    0
  );
}

function getSelectedLotAvailableQty() {
  const lotOpt = $('#lote')?.selectedOptions?.[0];
  return toNumberSafe(lotOpt?.dataset?.qty_available, 0);
}

function applyOverrideMeta(item, {
  token = null,
  reason = null,
  qty = null,
  lotId = null,
} = {}) {
  if (!item) return;

  item.override_stock = true;
  item.override_token = token || null;
  item.override_approved_at = new Date().toISOString();
  item.override_approved_by = 'current_user';
  item.override_reason = reason || item.override_reason || 'Estoque insuficiente';
  item.override_qty = Number.isFinite(Number(qty)) ? Number(qty) : Number(item.quantity || 0);
  item.override_lot_id = lotId ?? item.lot_id ?? null;
}

function clearOverrideMeta(item) {
  if (!item) return;

  item.override_stock = false;
  item.override_token = null;
  item.override_approved_at = null;
  item.override_approved_by = null;
  item.override_reason = null;
  item.override_qty = 0;
  item.override_lot_id = null;
}

function getOutOfStockMode() {
  const mode = String(
    budgetSettings.out_of_stock_mode || 'BLOCK'
  ).trim().toUpperCase();

  return ['BLOCK', 'PASSWORD', 'ALLOW'].includes(mode)
    ? mode
    : 'BLOCK';
}

async function requestStockOverride({
  reason = 'Produto sem estoque',
  sku = '',
  description = '',
  requestedQty = 0,
  availableQty = 0,
  lotId = null,
} = {}) {
  const mode = getOutOfStockMode();

  /*
   * BLOCK:
   * never permits products without stock.
   */
  if (mode === 'BLOCK') {
    return {
      ok: false,
      token: null,
      message:
        'Produto sem estoque bloqueado pelos parâmetros do orçamento.',
    };
  }

  /*
   * ALLOW:
   * permits immediately without displaying the password modal.
   */
  if (mode === 'ALLOW') {
    return {
      ok: true,
      token: null,
      withoutPassword: true,
      message:
        'Produto sem estoque liberado sem senha.',
    };
  }

  /*
   * PASSWORD:
   * keeps the existing password validation.
   */
  const status =
    await getStockOverrideStatus();

  if (!status.ok) {
    return {
      ok: false,
      token: null,
      message:
        'Não foi possível verificar a configuração de liberação de estoque.',
    };
  }

  if (!status.enabled) {
    return {
      ok: false,
      token: null,
      message:
        'A liberação de estoque por senha está desativada.',
    };
  }

  const key = await showCenterModal({
    variant: 'warning',
    title: reason || 'Liberação de estoque',

    message: `
      <div style="display:flex;flex-direction:column;gap:10px">
        ${sku
        ? `<div><b>SKU:</b> ${sku}</div>`
        : ''
      }

        ${description
        ? `<div><b>Produto:</b> ${description}</div>`
        : ''
      }

        ${Number.isFinite(Number(requestedQty))
        ? `<div><b>Qtd solicitada:</b> ${requestedQty}</div>`
        : ''
      }

        ${Number.isFinite(Number(availableQty))
        ? `<div><b>Disponível:</b> ${availableQty}</div>`
        : ''
      }

        <div style="margin-top:6px">
          <b>Informe a chave de liberação:</b>
        </div>

        <input
          id="stockOverrideKeyInput"
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
        label: 'Liberar',
        variant: 'primary',

        action: ({ card }) => {
          const value =
            card.querySelector(
              '#stockOverrideKeyInput'
            )?.value || '';

          return String(value).trim() || null;
        },
      },
    ],
  });

  if (!key) {
    return {
      ok: false,
      token: null,
      message: 'Liberação não informada.',
    };
  }

  const out = await fetchSafe(
    `${API_BASE}/api/budgets/validate-stock-override`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },

      body: JSON.stringify({
        key: String(key).trim(),
        reason,
        sku,
        description,
        requestedQty,
        availableQty,
        lotId,
      }),
    }
  );

  if (!out.ok) {
    return {
      ok: false,
      token: null,

      message:
        out?.json?.error ||
        out?.json?.message ||
        out?.text ||
        'Chave inválida.',
    };
  }

  return {
    ok: !!out?.json?.ok,
    token: out?.json?.token || null,

    message:
      out?.json?.message ||
      'Liberação autorizada.',
  };
}

async function requestStockOverrideBatch({
  items = [],
  key = '',
} = {}) {
  const status = await getStockOverrideStatus();

  if (!status.ok) {
    return {
      ok: false,
      message: 'Não foi possível verificar a configuração de liberação de estoque.',
      overrides: [],
    };
  }

  if (!status.enabled) {
    return {
      ok: false,
      message: 'Liberação de estoque está desativada.',
      overrides: [],
    };
  }

  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      sku: String(item?.sku || '').trim(),

      description: String(
        item?.description ||
        item?.descricao ||
        ''
      ).trim(),

      requestedQty: toNumberSafe(
        item?.requestedQty ??
        item?.requested_qty ??
        item?.quantity,
        0
      ),

      availableQty: toNumberSafe(
        item?.availableQty ??
        item?.available_qty ??
        item?.available ??
        item?.stock_available,
        0
      ),

      lotId:
        item?.lotId ??
        item?.lot_id ??
        null,

      reason:
        item?.reason ||
        (
          item?.lot_id
            ? 'Lote sem saldo disponível'
            : 'Produto sem estoque disponível'
        ),
    }))
    .filter((item) => (
      item.sku &&
      item.requestedQty > 0
    ));

  if (!normalizedItems.length) {
    return {
      ok: false,
      message: 'Nenhum produto informado para liberação.',
      overrides: [],
    };
  }

  const out = await fetchSafe(
    `${API_BASE}/api/budgets/validate-stock-override-batch`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },

      body: JSON.stringify({
        key: String(key || '').trim(),
        items: normalizedItems,
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
      overrides: [],
    };
  }

  return {
    ok: !!out?.json?.ok,
    message:
      out?.json?.message ||
      'Produtos liberados.',

    overrides:
      Array.isArray(out?.json?.overrides)
        ? out.json.overrides
        : [],
  };
}

export function getBlockedStockItems(items = []) {
  /*
   * Stock shortage no longer blocks adding or saving budgets.
   * Also remove incomplete legacy overrides before budgets.actions.js
   * serializes the items. A true override without a token makes the
   * backend attempt JWT validation and return INVALID_TOKEN_FORMAT.
   */
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.override_stock && !item?.override_token) {
      clearOverrideMeta(item);
    }
  }

  return [];
}

function buildOverrideItemKey(sku, lotId) {
  return [
    String(sku || '').trim(),
    lotId == null || lotId === ''
      ? 'NO_LOT'
      : String(lotId),
  ].join('::');
}

export function applyBatchOverridesToItems(
  items = [],
  overrides = []
) {
  const overrideMap = new Map();

  for (const override of overrides) {
    const key = buildOverrideItemKey(
      override?.sku,
      override?.lot_id
    );

    overrideMap.set(key, override);
  }

  let applied = 0;

  for (const item of items) {
    const key = buildOverrideItemKey(
      item?.sku,
      item?.lot_id
    );

    const override = overrideMap.get(key);

    if (!override?.override_token) {
      continue;
    }

    applyOverrideMeta(item, {
      token: override.override_token,

      reason:
        item?.lot_id
          ? 'Lote sem saldo disponível'
          : 'Produto sem estoque disponível',

      qty:
        override.requested_qty ??
        item.quantity,

      lotId:
        override.lot_id ??
        item.lot_id ??
        null,
    });

    applied++;
  }

  return applied;
}

/* ──────────────────────────────────────────────────────────────
   Helpers (date)
────────────────────────────────────────────────────────────── */
function parseDateSafe(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : s;
}

function fmtDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso).slice(0, 10);
  return `${d}/${m}/${y}`;
}

/* ──────────────────────────────────────────────────────────────
   Desconto geral
────────────────────────────────────────────────────────────── */
function ensureDiscountState() {
  if (!state.editing) state.editing = { header: {}, items: [] };
  if (!state.editing.header) state.editing.header = {};
  ensureBudgetDiscountFields(state.editing.header);
}

export function getGlobalDiscountState() {
  ensureDiscountState();

  const type = normalizeDiscountType(
    state.editing?.header?.global_discount_type || 'value'
  );

  const value = Math.max(
    0,
    toNumberSafe(state.editing?.header?.global_discount_value, 0)
  );

  return { type, value };
}

export function syncGlobalDiscountHiddenFields() {
  ensureDiscountState();

  const type = normalizeDiscountType(
    state.editing?.header?.global_discount_type || 'value'
  );

  const value = Math.max(
    0,
    toNumberSafe(state.editing?.header?.global_discount_value, 0)
  );

  if ($('#globalDiscountType')) $('#globalDiscountType').value = type;
  if ($('#globalDiscountValue')) $('#globalDiscountValue').value = String(value);
}

export function calcGlobalDiscountAmount(baseAfterItemDiscounts = 0) {
  const { type, value } = getGlobalDiscountState();
  const base = Math.max(0, Number(baseAfterItemDiscounts || 0));

  if (type === 'percent') {
    return Math.max(0, Math.min(base, base * (value / 100)));
  }

  return Math.max(0, Math.min(base, value));
}

export function openGlobalDiscountModal() {
  ensureDiscountState();
  syncGlobalDiscountHiddenFields();

  const backdrop = $('#globalDiscountModalBackdrop');
  const modal = $('#globalDiscountModal');

  const { type, value } = getGlobalDiscountState();

  if ($('#globalDiscountTypeModal')) $('#globalDiscountTypeModal').value = type;
  if ($('#globalDiscountValueModal')) $('#globalDiscountValueModal').value = Number(value).toFixed(2);

  backdrop?.classList.remove('hidden');
  modal?.classList.remove('hidden');
  backdrop?.setAttribute('aria-hidden', 'false');
}

export function closeGlobalDiscountModal() {
  const backdrop = $('#globalDiscountModalBackdrop');
  const modal = $('#globalDiscountModal');

  backdrop?.classList.add('hidden');
  modal?.classList.add('hidden');
  backdrop?.setAttribute('aria-hidden', 'true');
}

export function applyGlobalDiscountFromModal() {
  ensureDiscountState();

  const type = normalizeDiscountType($('#globalDiscountTypeModal')?.value || 'value');
  const value = Math.max(0, toNumberSafe($('#globalDiscountValueModal')?.value, 0));

  state.editing.header.global_discount_type = type;
  state.editing.header.global_discount_value = value;

  syncGlobalDiscountHiddenFields();
  recalcTotals();

  state.editing.header.global_discount_type = type;
  state.editing.header.global_discount_value = value;
  state.editing.header.global_discount_amount = Math.max(
    0,
    toNumberSafe(state.editing?.header?.global_discount_amount, 0)
  );

  closeGlobalDiscountModal();
}

/* ──────────────────────────────────────────────────────────────
   Cliente (fields)
────────────────────────────────────────────────────────────── */
export function clearCustomerFields() {
  $('#cliBusca') && ($('#cliBusca').value = '');
  $('#cliNome') && ($('#cliNome').value = '');
  $('#cliDoc') && ($('#cliDoc').value = '');
  $('#cliEmail') && ($('#cliEmail').value = '');
  $('#cliTel') && ($('#cliTel').value = '');

  if (!state.editing) state.editing = { header: {}, items: [] };
  if (!state.editing.header) state.editing.header = {};
  state.editing.header.customer_id = null;
  state.editing.header.price_id = null;
  state.editing.header.price_table_name = '';

  const priceSelect = $('#tabela');
  if (priceSelect) {
    priceSelect.innerHTML = '<option value="">Selecione um cliente…</option>';
    priceSelect.disabled = true;
  }

  clearCustomerCreditFields();

  ensureDiscountState();
}

export function fillCustomer(c) {
  if (!state.editing) state.editing = { header: {}, items: [] };
  if (!state.editing.header) state.editing.header = {};

  state.editing.header.customer_id = c.id;

  const legalName =
    c.legal_name ||
    c.name ||
    '';

  const tradeName =
    c.trade_name ||
    c.nome_fantasia ||
    legalName;

  const taxId = (c.tax_id || '').toString();

  $('#cliBusca') && ($('#cliBusca').value = legalName);
  $('#cliNome') && ($('#cliNome').value = tradeName);
  $('#cliDoc') && ($('#cliDoc').value = taxId);
  $('#cliEmail') && ($('#cliEmail').value = c.email || '');
  $('#cliTel') && ($('#cliTel').value = c.phone || '');

  state.editing.header.customer_name = legalName;
  state.editing.header.customer_tax_id = taxId;
  state.editing.header.nome_razao_social = legalName;
  state.editing.header.cnpj_cpf = taxId;

  ensureDiscountState();
}

export async function loadCustomerPriceTable(customerId, { silent = false } = {}) {
  if (!state.editing) state.editing = { header: {}, items: [] };
  if (!state.editing.header) state.editing.header = {};

  if (isSinglePriceMode()) {
    state.editing.header.price_id = SINGLE_PRICE_ID;
    state.editing.header.price_table_name = 'Preço único';
    applyPriceModeUI();

    const sku = $('#prodBusca')?.dataset?.sku;
    if (sku) {
      await loadTablesAndSuggestPriceForProduct({
        sku,
        pid: $('#prodBusca')?.dataset?.pid,
      });
      applyFactorOverCurrentPrice();
    }

    return { price_id: SINGLE_PRICE_ID, name: 'Preço único' };
  }

  state.editing.header.price_id = null;
  state.editing.header.price_table_name = '';

  const select = $('#tabela');
  if (select) {
    select.innerHTML = '<option value="">Carregando tabela do cliente…</option>';
    select.disabled = true;
  }

  if (!customerId) return null;

  const out = await fetchSafe(ROUTES.customerPriceTable(customerId), {
    headers: authHeaders(),
    method: 'GET',
  });

  if (!out.ok) {
    if (select) {
      select.innerHTML = '<option value="">Cliente sem tabela vinculada</option>';
    }

    if (!silent) {
      toast.warn('Tabela de preço', 'Este cliente não possui uma tabela de preços vinculada.');
    }
    return null;
  }

  const assignment = out.json?.data || out.json || {};
  const priceId = Number(assignment.price_id ?? assignment.priceId);

  if (!Number.isSafeInteger(priceId) || priceId <= 0) {
    if (!silent) toast.warn('Tabela de preço', 'Vínculo de tabela de preços inválido.');
    return null;
  }

  state.editing.header.price_id = priceId;
  state.editing.header.price_table_name =
    assignment.name || assignment.description || `Tabela ${priceId}`;

  if (select) {
    const option = document.createElement('option');
    option.value = String(priceId);
    option.textContent = state.editing.header.price_table_name;
    select.innerHTML = '';
    select.appendChild(option);
    select.value = String(priceId);
    select.disabled = true;
  }

  const sku = $('#prodBusca')?.dataset?.sku;
  if (sku) {
    await loadTablesAndSuggestPriceForProduct({
      sku,
      pid: $('#prodBusca')?.dataset?.pid,
    });
    applyFactorOverCurrentPrice();
  }

  return assignment;
}

function formatCustomerCredit(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : 'R$ 0,00';
}

export function clearCustomerCreditFields(value = '—') {
  const limit = $('#customerCreditLimit');
  const used = $('#customerCreditUsed');
  const available = $('#customerCreditAvailable');

  if (limit) limit.value = value;
  if (used) used.value = value;
  if (available) {
    available.value = value;
    available.classList.remove('customer-credit-field--negative');
  }
}

export async function loadCustomerCredit(customerId, { silent = false } = {}) {
  if (!customerId) {
    clearCustomerCreditFields();
    return null;
  }

  clearCustomerCreditFields('Carregando...');

  const out = await fetchSafe(ROUTES.customerCredit(customerId), {
    headers: authHeaders(),
    method: 'GET',
  });

  if (!out.ok) {
    if (out.status === 404) {
      clearCustomerCreditFields('R$ 0,00');
      return null;
    }

    clearCustomerCreditFields('Indisponível');
    if (!silent) {
      toast.warn('Crédito do cliente', 'Não foi possível carregar os limites de crédito.');
    }
    return null;
  }

  const credit = out.json?.data || out.json || {};
  const creditLimit = Number(credit.credit_limit ?? 0);
  const creditUsed = Number(credit.credit_used ?? credit.amount_to_pay ?? 0);
  const creditAvailable = Number(
    credit.credit_available ?? Math.max(creditLimit - creditUsed, 0)
  );

  const limitInput = $('#customerCreditLimit');
  const usedInput = $('#customerCreditUsed');
  const availableInput = $('#customerCreditAvailable');

  if (limitInput) limitInput.value = formatCustomerCredit(creditLimit);
  if (usedInput) usedInput.value = formatCustomerCredit(creditUsed);
  if (availableInput) {
    availableInput.value = formatCustomerCredit(creditAvailable);
    availableInput.classList.toggle(
      'customer-credit-field--negative',
      creditAvailable < 0
    );
  }

  if (!state.editing.header) state.editing.header = {};
  state.editing.header.customer_credit_limit = creditLimit;
  state.editing.header.customer_credit_used = creditUsed;
  state.editing.header.customer_credit_available = creditAvailable;

  return credit;
}

export async function enrichCustomerContactsIfMissing(customerId) {
  const telEmpty = !($('#cliTel')?.value || '').trim();
  const emailEmpty = !($('#cliEmail')?.value || '').trim();
  if (!customerId || (!telEmpty && !emailEmpty)) return;

  const out = await fetchSafe(ROUTES.customerById(customerId), {
    headers: authHeaders(),
    method: 'GET',
  });
  if (!out.ok) return;

  const c = out.json || {};
  const phone = c.phone_number || c.mobile_number || '';
  const email = c.email || '';

  if (telEmpty && phone && $('#cliTel')) $('#cliTel').value = phone;
  if (emailEmpty && email && $('#cliEmail')) $('#cliEmail').value = email;
}

export async function searchCustomerInline(qRaw) {
  const q = (qRaw || '').trim();
  if (q.length < 3) return;

  const out = await fetchSafe(ROUTES.customersSearch(q), {
    headers: authHeaders(),
    method: 'GET',
  });

  if (!out.ok) return;

  const list = out.json?.rows || out.json || [];
  if (!Array.isArray(list) || !list.length) return;

  const first = list[0];
  const customerId = first.customer_id || first.id;

  fillCustomer({
    id: customerId,
    legal_name:
      first.legal_name ||
      first.nome_razao_social ||
      first.trade_name ||
      first.nome_fantasia ||
      '',
    trade_name:
      first.trade_name ||
      first.nome_fantasia ||
      first.legal_name ||
      first.nome_razao_social ||
      '',
    tax_id: first.tax_id || first.cnpj_cpf,
    email: first.email,
    phone: first.phone_number || first.telefone,
  });

  enrichCustomerContactsIfMissing(customerId);

  await Promise.all([
    loadCustomerPriceTable(customerId),
    loadCustomerCredit(customerId),
  ]);
}

/* ──────────────────────────────────────────────────────────────
   Produto inline
────────────────────────────────────────────────────────────── */
export async function searchProductInline(qRaw) {
  const q = (qRaw || '').trim();
  if (q.length < 3) return;

  const out = await fetchSafe(ROUTES.productsSearch(q), {
    headers: authHeaders(),
    method: 'GET',
  });
  if (!out.ok) return;

  const list = out.json?.rows || out.json || [];
  if (!Array.isArray(list) || !list.length) return;

  await applyProductSelection(list[0]);
}

export async function searchProductByManufacturerRef(refRaw, { silent = false } = {}) {
  const ref = String(refRaw || '').trim();
  if (!ref) return null;

  // Rota específica (será a fonte principal quando o backend estiver disponível).
  const direct = await fetchSafe(ROUTES.productByManufacturerRef(ref), {
    headers: authHeaders(),
    method: 'GET',
  });

  if (direct.ok) {
    const product = direct.json?.data || direct.json?.row || direct.json?.product || direct.json;
    if (product && !Array.isArray(product)) {
      await applyProductSelection(product);
      return product;
    }
  }

  // Fallback seguro para instalações onde /api/products/search já pesquisa manufacturer_ref.
  const fallback = await fetchSafe(ROUTES.productsSearch(ref), {
    headers: authHeaders(),
    method: 'GET',
  });

  if (fallback.ok) {
    const list = fallback.json?.rows || fallback.json?.data || fallback.json || [];

    if (Array.isArray(list) && list.length) {
      const exact = list.find((p) =>
        String(
          p?.manufacturer_ref ??
          p?.manufacturerRef ??
          p?.ref_fab ??
          p?.refFab ??
          ''
        ).trim().toUpperCase() === ref.toUpperCase()
      );

      if (exact) {
        await applyProductSelection(exact);
        return exact;
      }
    }
  }

  if (!silent) {
    toast.warn('Ref.Fab.', `Nenhum produto encontrado para a referência “${ref}”.`);
  }

  return null;
}

/* ──────────────────────────────────────────────────────────────
   UI reset (tabela / um / grade / lote)
────────────────────────────────────────────────────────────── */
export function resetTabelaSelect() {
  const sel = $('#tabela');
  if (!sel) return;
  if (isSinglePriceMode()) {
    sel.innerHTML = `<option value="${SINGLE_PRICE_ID}">Preço único</option>`;
    sel.value = String(SINGLE_PRICE_ID);
    sel.disabled = true;
    applyPriceModeUI();
    return;
  }
  sel.innerHTML = '<option value="">Tabela de preço…</option>';
  sel.disabled = true;
}

export function resetUMSelect() {
  const sel = $('#um');
  if (sel) {
    sel.innerHTML = '';
    sel.disabled = true;
  }
}

export function resetGradeSelect() {
  const sel = $('#grade');
  if (sel) {
    sel.innerHTML = '<option value="">Selecione...</option>';
    sel.disabled = true;
  }
}

export function resetLotSelect() {
  const sel = $('#lote');
  if (!sel) return;

  if (isSimpleStockMode()) {
    sel.innerHTML = '<option value="">Controle por lote desativado</option>';
    sel.value = '';
    sel.disabled = true;
    return;
  }

  sel.innerHTML = '<option value="">Selecione...</option>';
  sel.disabled = true;
}

/* ──────────────────────────────────────────────────────────────
   Units / Grades
────────────────────────────────────────────────────────────── */
export async function loadUnitsForProduct({ sku, pid }) {
  const productCode = String(sku || '').trim();
  const productDefaultUnit = safeUpper($('#prodBusca')?.dataset?.unit || 'UN');

  let units = [];

  if (productCode) {
    const url = `${API_BASE}/api/barcodes/active-units?product_code=${encodeURIComponent(productCode)}`;

    console.log('[budgets.items] loading units from:', url);

    const out = await fetchSafe(url, {
      headers: authHeaders(),
      method: 'GET',
    });

    console.log('[budgets.items] units response:', out);

    if (out.ok) {
      const rows = out.json?.rows || out.json?.data || out.json || [];
      const list = Array.isArray(rows) ? rows : [];

      units = list.map((u) => ({
        unit: safeUpper(u.unit || u.unidade || u.um || productDefaultUnit || 'UN'),
        description: u.unit_description || u.description || u.descricao || '',
        fator: Number(u.fator ?? u.factor ?? u.unit_factor ?? 1) || 1,
        standard: !!(u.standard || u.padrao),
        barcode_id: u.barcode_id || null,
        barcode: u.barcode || '',
        weight_kg: toNumberSafe(u.weight_kg ?? u.weightKg, 0),
        product_unit_id: u.product_unit_id || null,
        unit_id: u.unit_id || null,
      }));
    }
  }

  if (!units.length) {
    units = [{
      unit: productDefaultUnit || 'UN',
      description: '',
      fator: 1,
      standard: true,
    }];
  }

  const seen = new Set();

  units = units.filter((u) => {
    const key = `${u.unit}|${u.fator}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!units.some((u) => u.standard)) {
    units[0].standard = true;
  }

  state.currentProduct.units = units;

  const sel = $('#um');
  if (!sel) return;

  sel.innerHTML = '';

  for (const u of units) {
    const opt = document.createElement('option');

    opt.value = u.unit;
    opt.textContent = u.unit;

    opt.dataset.fator = String(u.fator || 1);
    opt.dataset.factor = String(u.fator || 1);
    opt.dataset.barcodeId = u.barcode_id || '';
    opt.dataset.barcode = u.barcode || '';
    opt.dataset.weightKg = String(toNumberSafe(u.weight_kg, 0));
    opt.dataset.productUnitId = u.product_unit_id || '';
    opt.dataset.unitId = u.unit_id || '';

    if (u.standard) opt.selected = true;

    sel.appendChild(opt);
  }

  sel.disabled = false;

  console.log('[budgets.items] final units loaded:', units);
}

function getSelectedProductGradeId() {
  const opt = $('#grade')?.selectedOptions?.[0];
  return (
    opt?.dataset?.productGradeId ||
    $('#grade')?.value ||
    null
  );
}

export async function loadGradesForProduct({ sku, pid }) {
  const sel = $('#grade');
  if (!sel) return;

  sel.innerHTML = '<option value="">Selecione...</option>';
  sel.disabled = true;

  const attempts = [
    ROUTES.productGradesById(pid),
    ROUTES.productGradesBySku(sku),
    `${API_BASE}/api/products-grades?product_id=${encodeURIComponent(pid || '')}`,
    `${API_BASE}/api/products/${encodeURIComponent(pid || '')}/grades`,
  ].filter(Boolean);

  for (const url of attempts) {
    const out = await fetchSafe(url, { headers: authHeaders(), method: 'GET' });
    if (!out.ok) continue;

    const rows = out.json?.rows ?? out.json?.data?.rows ?? out.json?.data ?? out.json ?? [];
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) continue;

    let padraoSelecionado = false;

    list.forEach((g) => {
      const productGradeId =
        g.product_grade_id ||
        g.productGradeId ||
        g.id ||
        '';

      const gradeId = g.grade_id || '';

      const opt = document.createElement('option');
      opt.value = productGradeId;
      opt.dataset.productGradeId = productGradeId;
      opt.dataset.gradeId = gradeId;

      opt.textContent =
        g.grade ||
        g.descricao ||
        g.description ||
        `Grade ${productGradeId || gradeId}`;

      const texto = String(opt.textContent || '').toLowerCase();

      if (!padraoSelecionado && /padr(ã|a)o/.test(texto)) {
        opt.selected = true;
        padraoSelecionado = true;
      }

      sel.appendChild(opt);
    });

    sel.disabled = false;

    sel.onchange = async () => {
      const productCode = $('#prodBusca')?.dataset?.sku || '';
      const productGradeId = getSelectedProductGradeId();

      await loadLotsForProduct({
        sku: productCode,
        productGradeId,
      });
    };

    return;
  }

  sel.innerHTML = '<option value="">Sem grade</option>';
  sel.disabled = true;
}

/* ──────────────────────────────────────────────────────────────
   Lots (productsStockLots) — FEFO (by product_code + product_grade_id)
────────────────────────────────────────────────────────────── */
export async function loadLotsForProduct({ sku, productGradeId = null }) {
  resetLotSelect();

  /*
   * No estoque simples, o lote não faz parte da operação.
   * Além de manter o campo desabilitado, este retorno impede a chamada
   * ao endpoint productsStockLots, que corretamente responde 422 quando
   * PRODUCT_STOCK_MODE = STOCK_SIMPLE.
   */
  if (!requiresStockLot()) {
    if (state.currentProduct) {
      state.currentProduct.lots = [];
    }

    const lotSelect = $('#lote');

    if (lotSelect) {
      lotSelect.innerHTML =
        '<option value="">Controle por lote desativado</option>';
      lotSelect.value = '';
      lotSelect.disabled = true;
    }

    return [];
  }

  const productCode = String(sku || '').trim();
  const gradeId = productGradeId || getSelectedProductGradeId();

  if (!productCode) return [];

  const url =
    `${API_BASE}/api/productsStockLots/by-product-code/${encodeURIComponent(productCode)}` +
    (gradeId ? `?product_grade_id=${encodeURIComponent(gradeId)}` : '');

  console.log('[budgets.items][loadLotsForProduct] request:', {
    productCode,
    gradeId,
    url,
  });

  const out = await fetchSafe(url, {
    headers: authHeaders(),
    method: 'GET',
  });

  if (!out.ok) {
    console.warn('[budgets.items][loadLotsForProduct] failed:', out.status, out.text);
    state.currentProduct.lots = [];
    return [];
  }

  const rows = out.json?.rows || out.json?.data || out.json || [];
  const list = Array.isArray(rows) ? rows : [];

  console.log('[budgets.items][loadLotsForProduct] response:', list);

  const lots = list
    .map((r) => {
      const qtyOnHand = toNumberSafe(r.qty_on_hand, 0);
      const qtyReserved = toNumberSafe(r.qty_reserved, 0);

      const qtyAvailable =
        r.qty_available != null
          ? toNumberSafe(r.qty_available, 0)
          : r.saldo != null
            ? toNumberSafe(r.saldo, 0)
            : r.available != null
              ? toNumberSafe(r.available, 0)
              : qtyOnHand - qtyReserved;

      return {
        lot_id: r.lot_id ?? r.id ?? '',
        lot_code: r.lot_code ?? r.lote ?? r.code ?? '',
        expiry_date: r.expires_at ?? r.expiry_date ?? r.validade ?? null,
        qty_available: qtyAvailable,
        product_grade_id: r.product_grade_id ?? null,
        is_active: r.is_active == null ? true : r.is_active === true || String(r.is_active).toLowerCase() === 'true',
        deleted_at: r.deleted_at ?? null,
      };
    })
    .filter((l) => {
      if (!l.lot_id) return false;
      if (l.is_active === false) return false;
      if (l.deleted_at) return false;

      if (gradeId && l.product_grade_id) {
        return String(l.product_grade_id) === String(gradeId);
      }

      return true;
    });

  lots.sort((a, b) => {
    const da = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.POSITIVE_INFINITY;
    const db = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.POSITIVE_INFINITY;
    return da - db;
  });

  state.currentProduct.lots = lots;

  const sel = $('#lote');
  if (!sel) return lots;

  sel.innerHTML = '<option value="">Selecione...</option>';

  if (!lots.length) {
    sel.disabled = true;
    sel.value = '';

    toast.warn('Estoque', '⚠️ Nenhum lote disponível para esta grade.');
    return lots;
  }

  for (const l of lots) {
    const opt = document.createElement('option');
    opt.value = l.lot_id;

    opt.textContent =
      `${l.lot_code || 'LOTE'}${l.expiry_date ? ' • ' + fmtDateBR(l.expiry_date) : ''}` +
      ` • saldo ${Number(l.qty_available || 0).toFixed(3)}`;

    opt.dataset.lot_code = l.lot_code || '';
    opt.dataset.expiry_date = l.expiry_date || '';
    opt.dataset.qty_available = String(l.qty_available || 0);
    opt.dataset.product_grade_id = l.product_grade_id || '';

    sel.appendChild(opt);
  }

  sel.value = lots[0].lot_id;
  sel.disabled = false;

  return lots;
}

/* ──────────────────────────────────────────────────────────────
   Prices per product
────────────────────────────────────────────────────────────── */
export async function getProductPrices({ sku, pid }) {
  const attempts = [];

  if (pid) {
    attempts.push(ROUTES.productPricesById(pid));
    attempts.push(`${API_BASE}/api/products/${encodeURIComponent(pid)}/prices`);
  }

  if (sku) {
    attempts.push(ROUTES.productPricesBySku(sku));
  }

  const seen = new Set();
  const uniqueAttempts = attempts.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  for (const url of uniqueAttempts) {
    const out = await fetchSafe(url, { headers: authHeaders(), method: 'GET' });
    if (!out.ok) continue;

    const rows =
      out.json?.rows ??
      out.json?.data?.rows ??
      out.json?.data ??
      out.json ??
      [];

    const list = (Array.isArray(rows) ? rows : [])
      .filter((it) => (
        !isSinglePriceMode() ||
        Number(it?.price_id ?? it?.tabela_preco_id ?? it?.id) === SINGLE_PRICE_ID
      ));

    const normalized = {};
    for (const it of list) {
      const priceId = it.price_id ?? it.tabela_preco_id ?? it.id;
      const price = it.sale_price ?? it.preco_venda ?? it.price;

      if (Number.isInteger(Number(priceId)) && Number.isFinite(Number(price))) {
        normalized[String(priceId)] = Number(price);
      }
    }

    if (sku) {
      productPricesCache[sku] = productPricesCache[sku] || {};
      Object.assign(productPricesCache[sku], normalized);
    }

    if (Object.keys(normalized).length) {
      return normalized;
    }
  }

  return {};
}

export function populateTabelaSelectFromPrices(priceMap) {
  resetTabelaSelect();
  const sel = $('#tabela');
  if (!sel) return;

  const assignedId = isSinglePriceMode()
    ? SINGLE_PRICE_ID
    : state.editing?.header?.price_id;

  if (isSinglePriceMode() && state.editing?.header) {
    state.editing.header.price_id = SINGLE_PRICE_ID;
    state.editing.header.price_table_name = 'Preço único';
  }
  if (!assignedId) {
    sel.innerHTML = '<option value="">Cliente sem tabela vinculada</option>';
    return;
  }

  const price = Number(priceMap?.[String(assignedId)]);
  if (!Number.isFinite(price)) {
    sel.innerHTML = `<option value="">${isSinglePriceMode()
      ? 'Produto sem preço único cadastrado'
      : 'Produto sem preço na tabela do cliente'}</option>`;
    return;
  }

  const cat = catalogs.priceTablesById[String(assignedId)];
  const opt = document.createElement('option');
  opt.value = String(assignedId);
  opt.textContent =
    (isSinglePriceMode() ? 'Preço único' : state.editing?.header?.price_table_name) ||
    cat?.name ||
    `Tabela ${assignedId}`;
  sel.innerHTML = '';
  sel.appendChild(opt);
  sel.value = String(assignedId);
  sel.disabled = true;
}

export async function loadTablesAndSuggestPriceForProduct({ sku, pid }) {
  resetTabelaSelect();
  $('#valor') && ($('#valor').value = '0.00');

  const prices = await getProductPrices({ sku, pid });
  populateTabelaSelectFromPrices(prices);

  const sel = $('#tabela');
  if (!sel) return;

  const assignedValue = sel.value || '';
  if (assignedValue) {
    await onTabelaChange();
  }
}

export async function onTabelaChange() {
  const sku = $('#prodBusca')?.dataset?.sku;
  const tabelaId = $('#tabela')?.value || '';
  if (!sku || !tabelaId) return;

  let base = productPricesCache[sku]?.[tabelaId];

  if (!Number.isFinite(base)) {
    const map = await getProductPrices({
      sku,
      pid: $('#prodBusca')?.dataset?.pid,
    });
    base = map?.[tabelaId];
  }

  state.currentProduct.basePriceByTable[tabelaId] = Number(base) || 0;
}

export function getSelectedUnitFactor() {
  const sel = $('#um');
  const fator = Number(sel?.selectedOptions?.[0]?.dataset?.fator || 1);
  return Number.isFinite(fator) ? fator : 1;
}

export function getBasePriceForCurrentSelection() {
  const sku = $('#prodBusca')?.dataset?.sku;
  const tabelaId = $('#tabela')?.value || '';
  if (!sku || !tabelaId) return 0;

  let base = state.currentProduct.basePriceByTable[tabelaId];
  if (!Number.isFinite(base)) base = productPricesCache[sku]?.[tabelaId];
  return Number.isFinite(base) ? base : 0;
}

export function applyFactorOverCurrentPrice() {
  const base = getBasePriceForCurrentSelection();
  const fator = getSelectedUnitFactor();
  const preco = (Number(base) || 0) * (Number(fator) || 1);
  $('#valor') && ($('#valor').value = Number(preco).toFixed(2));
}

/* ──────────────────────────────────────────────────────────────
   Apply product selection (from modal or inline)
────────────────────────────────────────────────────────────── */
export async function applyProductSelection(p) {
  if (!p) return;

  const sku = p.sku || p.product_code || '';
  const unidade = p.unit || p.unidade || 'UN';
  const pid = p.product_id || p.id || '';
  const desc = p.description || p.descricao || '';
  const manufacturerRef =
    p.manufacturer_ref ??
    p.manufacturerRef ??
    p.ref_fab ??
    p.refFab ??
    '';

  const payloadStock = getProductStockFromPayload(p);

  const manufacturerRefInput = $('#manufacturerRef');
  if (manufacturerRefInput) {
    manufacturerRefInput.value = String(manufacturerRef || '');
  }

  $('#prodBusca').value = desc;
  $('#prodBusca').dataset.sku = sku;
  $('#prodBusca').dataset.pid = pid;
  $('#prodBusca').dataset.desc = desc;
  $('#prodBusca').dataset.unit = unidade;
  $('#prodBusca').dataset.stock = String(payloadStock);

  $('#qtd') && ($('#qtd').value = 1);
  $('#desconto') && ($('#desconto').value = '');

  state.currentProduct = {
    sku: '',
    pid: '',
    desc: '',
    manufacturer_ref: '',
    stock_available: 0,
    units: [],
    lots: [],
    basePriceByTable: {},
  };

  await loadUnitsForProduct({ sku, pid });
  await loadGradesForProduct({ sku, pid });

  await new Promise(resolve => setTimeout(resolve, 50));

  const selectedProductGradeId = getSelectedProductGradeId();

  console.log('[GRADE SELECTED]', selectedProductGradeId);

  await loadLotsForProduct({
    sku,
    productGradeId: selectedProductGradeId,
  });

  await loadTablesAndSuggestPriceForProduct({ sku, pid });

  const lots = Array.isArray(state.currentProduct?.lots) ? state.currentProduct.lots : [];

  const lotsTotal = lots.reduce((sum, lot) => {
    return sum + toNumberSafe(lot?.qty_available, 0);
  }, 0);

  const lotsMax = lots.reduce((max, lot) => {
    return Math.max(max, toNumberSafe(lot?.qty_available, 0));
  }, 0);

  let resolvedStock = toNumberSafe(payloadStock, 0);

  if (resolvedStock <= 0 && lotsTotal > 0) {
    resolvedStock = lotsTotal;
  }

  state.currentProduct.stock_available = resolvedStock;
  $('#prodBusca').dataset.stock = String(resolvedStock);

  applyFactorOverCurrentPrice();

  const outOfStockMode =
    getOutOfStockMode();

  if (
    resolvedStock <= 0 &&
    lotsMax <= 0 &&
    outOfStockMode !== 'ALLOW'
  ) {
    toast.warn(
      'Estoque',
      '⚠️ Produto selecionado sem estoque disponível.'
    );
  }
}

/* ──────────────────────────────────────────────────────────────
   Grade name enrich for loaded budgets
────────────────────────────────────────────────────────────── */
export async function enrichMissingGradeNames() {
  if (!state.editing?.items?.length) return;

  const pendentes = state.editing.items.filter(
    (it) => it.grade_id && !it.grade && (it.product_id || it.sku)
  );
  if (!pendentes.length) return;

  const groups = {};
  for (const it of pendentes) {
    const key = it.product_id ? `pid:${it.product_id}` : `sku:${it.sku}`;
    (groups[key] = groups[key] || []).push(it);
  }

  async function loadMapForKey(key) {
    if (gradeNameCache[key]) return gradeNameCache[key];
    let map = {};
    try {
      let rows = [];
      if (key.startsWith('pid:')) {
        const pid = key.slice(4);
        const out = await fetchSafe(ROUTES.productGradesById(pid), {
          headers: authHeaders(),
          method: 'GET',
        });
        if (out.ok) rows = out.json?.rows || out.json?.data || out.json || [];
      }
      if ((!rows || !rows.length) && key.startsWith('sku:')) {
        const sku = key.slice(4);
        const out = await fetchSafe(ROUTES.productGradesBySku(sku), {
          headers: authHeaders(),
          method: 'GET',
        });
        if (out.ok) rows = out.json?.rows || out.json?.data || out.json || [];
      }

      const list = Array.isArray(rows) ? rows : [];
      for (const g of list) {
        const id = Number(g.grade_id ?? g.id);
        const name = g.grade || g.descricao || g.description || `Grade ${id}`;
        if (Number.isFinite(id)) map[id] = name;
      }
    } catch {
      /* silencioso */
    }
    gradeNameCache[key] = map;
    return map;
  }

  for (const [key, items] of Object.entries(groups)) {
    const map = await loadMapForKey(key);
    for (const it of items) {
      const name = map[Number(it.grade_id)];
      if (name) it.grade = name;
    }
  }

  renderItems();
}

/* ──────────────────────────────────────────────────────────────
   Add item (with stock override support)
────────────────────────────────────────────────────────────── */
export async function addItem() {
  if (__addingBudgetItem) return;
  __addingBudgetItem = true;

  try {
    const $prod = $('#prodBusca');
    if (!$prod) return toast.error('Erro', 'Campo de produto não encontrado.');

    const ds = $prod.dataset || {};
    const skuCode = String(ds.sku || '').trim();
    const pid = String(ds.pid || '').trim();
    const descText = String(ds.desc || $prod.value || '').trim();

    if (!skuCode) {
      return toast.warn('Atenção', 'Selecione um produto.');
    }

    const tabelaIdRaw = isSinglePriceMode()
      ? String(SINGLE_PRICE_ID)
      : ($('#tabela')?.value || '');
    if (!tabelaIdRaw) {
      return toast.warn('Atenção', 'Selecione uma tabela de preço.');
    }

    const tabelaId = Number(tabelaIdRaw);

    const $um = $('#um');
    const unit = String((($um && $um.value) || ds.unit || 'UN')).toUpperCase();

    const qtd = Number($('#qtd')?.value || 1);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      return toast.warn('Atenção', 'Quantidade inválida.');
    }

    const unitFactor = getSelectedUnitFactor();
    const selectedUnitOption = $um?.selectedOptions?.[0] || null;
    const selectedBarcodeId =
      Number(selectedUnitOption?.dataset?.barcodeId || 0) || null;
    const selectedWeightKg = toNumberSafe(
      selectedUnitOption?.dataset?.weightKg,
      0,
    );
    const unitPrice = Number($('#valor')?.value || 0);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return toast.warn('Atenção', 'Preço inválido.');
    }

    const descV = Number($('#desconto')?.value || 0);

    const $lote = $('#lote');
    const lotId = String($lote?.value || '').trim();
    const lotAvailableQty = getSelectedLotAvailableQty();

    if (requiresStockLot() && !lotId) {
      return toast.warn('Atenção', 'Selecione um lote para adicionar o produto.');
    }

    const maxDiscountAmount = (qtd * unitPrice) *
      (Number(budgetSettings.max_discount_percent || 0) / 100);
    if (Number.isFinite(descV) && descV > maxDiscountAmount + 0.0001) {
      return toast.warn(
        'Desconto',
        `O desconto máximo permitido é ${budgetSettings.max_discount_percent}%.`
      );
    }

    let overrideStock = false;
    let overrideToken = null;

    const productStock = toNumberSafe(state.currentProduct?.stock_available, Number.NaN);
    const resolvedProductStock = Number.isFinite(productStock)
      ? productStock
      : toNumberSafe(ds.stock, 0);

    if ($lote && !$lote.disabled) {
      if (!lotId) {
        return toast.warn('Atenção', 'Selecione um lote.');
      }

      const lotValidation = validateStockForItem({
        sku: skuCode,
        quantity: qtd,
        stock: resolvedProductStock,
        lotQty: lotAvailableQty,
      });

      if (!lotValidation.ok) {
        const unlock = await requestStockOverride({
          reason: 'Lote insuficiente',
          sku: skuCode,
          description: descText,
          requestedQty: qtd,
          availableQty: lotAvailableQty,
          lotId,
        });

        if (!unlock.ok) {
          return toast.warn('Estoque', lotValidation.message);
        }

        overrideStock = !!unlock.token;
        overrideToken = unlock.token || null;
      }
    } else {
      const stockValidation = validateStockForItem({
        sku: skuCode,
        quantity: qtd,
        stock: resolvedProductStock,
        lotQty: null,
      });

      if (!stockValidation.ok) {
        const unlock = await requestStockOverride({
          reason: 'Estoque insuficiente',
          sku: skuCode,
          description: descText,
          requestedQty: qtd,
          availableQty: resolvedProductStock,
          lotId: null,
        });

        if (!unlock.ok) {
          return toast.warn('Estoque', stockValidation.message);
        }

        overrideStock = !!unlock.token;
        overrideToken = unlock.token || null;
      }
    }

    const lotOpt = $lote?.selectedOptions?.[0];
    const lotCode = String(lotOpt?.dataset?.lot_code || '').trim();
    const expiryDate = String(lotOpt?.dataset?.expiry_date || '').trim() || null;

    const $grade = $('#grade');
    const gradeOpt = $grade?.selectedOptions?.[0] || null;

    const productGradeId =
      $grade && !$grade.disabled
        ? Number(gradeOpt?.dataset?.productGradeId || $grade.value || 0) || null
        : null;

    const gradeId =
      $grade && !$grade.disabled
        ? Number(gradeOpt?.dataset?.gradeId || 0) || null
        : null;

    const gradeTx = (gradeOpt?.textContent || '').trim() || null;

    state.editing.items.push({
      product_id: pid || null,
      sku: skuCode,

      manufacturer_ref:
        String(
          state.currentProduct?.manufacturer_ref ||
          $('#manufacturerRef')?.value ||
          ''
        ).trim(),

      description: descText,

      unit,
      unit_factor: Number(unitFactor) || 1,
      barcode_id: selectedBarcodeId,
      unit_weight_kg: selectedWeightKg,
      weight_kg: selectedWeightKg,

      quantity: qtd,
      unit_price: unitPrice,

      discount_value: Number.isFinite(descV) ? descV : 0,

      grade_id: gradeId,
      product_grade_id: productGradeId,
      grade: gradeTx,

      lot_id: lotId || null,
      lot_code: lotCode || null,

      expiry_date: expiryDate,

      qty_available_lot: lotId ? lotAvailableQty : null,

      price_id: tabelaId,

      stock_available: resolvedProductStock,

      available_units: [...(state.currentProduct.units || [])],

      available_lots: [...(state.currentProduct.lots || [])],

      available_grades: Array.from(
        $('#grade')?.options || []
      ).map(o => ({
        id: o.dataset.productGradeId || o.value,
        product_grade_id: o.dataset.productGradeId || o.value,
        grade_id: o.dataset.gradeId || null,
        name: o.textContent
      })),

      override_stock: overrideStock,
      override_token: overrideToken,
    });

    resetTabelaSelect();
    resetUMSelect();
    resetGradeSelect();
    resetLotSelect();

    const prodBusca = $('#prodBusca');
    if (prodBusca) {
      prodBusca.value = '';
      prodBusca.dataset.sku = '';
      prodBusca.dataset.pid = '';
      prodBusca.dataset.desc = '';
      prodBusca.dataset.unit = '';
      prodBusca.dataset.stock = '';
    }

    const manufacturerRefInput = $('#manufacturerRef');
    if (manufacturerRefInput) manufacturerRefInput.value = '';

    if ($('#qtd')) $('#qtd').value = 1;
    if ($('#valor')) $('#valor').value = '';
    if ($('#desconto')) $('#desconto').value = '';

    state.currentProduct = {
      sku: '',
      pid: '',
      desc: '',
      stock_available: 0,
      units: [],
      lots: [],
      basePriceByTable: {},
    };

    renderItems();
    recalcTotals();
  } catch (err) {
    console.error(err);
    toast.error('Erro', 'Erro ao adicionar item');
  } finally {
    __addingBudgetItem = false;
  }
}

/* ──────────────────────────────────────────────────────────────
   Items table render/edit
────────────────────────────────────────────────────────────── */
function getPriceTableNameById(id) {
  const cat = catalogs.priceTablesById?.[String(id)];
  return cat?.name || `Tabela ${id}`;
}

function buildTabelaOptionsForItem(it) {
  const sku = String(it?.sku || '').trim();
  const map = sku ? (productPricesCache[sku] || {}) : {};
  const ids = Object.keys(map);

  const fixedPriceId = isSinglePriceMode()
    ? SINGLE_PRICE_ID
    : Number(state.editing?.header?.price_id ?? it?.price_id);
  const listIds = Number.isFinite(fixedPriceId)
    ? [fixedPriceId]
    : (ids.length
      ? ids.map((x) => Number(x)).filter(Number.isFinite)
      : (catalogs.priceTables || []).map((t) => Number(t.id)).filter(Number.isFinite));

  const uniq = Array.from(new Set(listIds));
  const selected = it?.price_id != null ? String(it.price_id) : '';

  const opts = ['<option value="">—</option>'];
  for (const id of uniq) {
    const name = getPriceTableNameById(id);
    const sel = selected === String(id) ? 'selected' : '';
    opts.push(`<option value="${id}" ${sel}>${name}</option>`);
  }
  return opts.join('');
}

async function applyPriceByTableToItem(it) {
  const sku = String(it?.sku || '').trim();
  const tabelaId = it?.price_id != null ? String(it.price_id) : '';
  if (!sku || !tabelaId) return;

  if (!productPricesCache[sku] || !Object.keys(productPricesCache[sku]).length) {
    await getProductPrices({ sku, pid: it.product_id });
  }

  const base = Number(productPricesCache[sku]?.[tabelaId] || 0);
  const fator = Number(it.unit_factor || 1) || 1;
  it.unit_price = (Number(base) || 0) * fator;
}

function buildGradeOptionsForItem(it) {
  const list = Array.isArray(it.available_grades) ? it.available_grades : [];

  const selectedProductGradeId =
    it.product_grade_id != null ? String(it.product_grade_id) : '';

  const selectedGradeId =
    it.grade_id != null ? String(it.grade_id) : '';

  const opts = ['<option value="">—</option>'];

  if (list.length) {
    for (const g of list) {
      const productGradeId = String(
        g.product_grade_id ??
        g.productGradeId ??
        g.id ??
        ''
      );

      const gradeId = String(
        g.grade_id ??
        g.gradeId ??
        ''
      );

      const name = g.name ?? g.grade ?? g.description ?? g.descricao ?? 'Grade';

      const selected =
        selectedProductGradeId
          ? selectedProductGradeId === productGradeId
          : selectedGradeId === gradeId;

      opts.push(`
        <option
          value="${productGradeId}"
          data-product-grade-id="${productGradeId}"
          data-grade-id="${gradeId}"
          ${selected ? 'selected' : ''}
        >
          ${name}
        </option>
      `);
    }
  } else if (it.grade) {
    opts.push(`
      <option
        value="${it.product_grade_id || ''}"
        data-product-grade-id="${it.product_grade_id || ''}"
        data-grade-id="${it.grade_id || ''}"
        selected
      >
        ${it.grade}
      </option>
    `);
  }

  return opts.join('');
}

function buildUnitOptionsForItem(it) {
  const list = Array.isArray(it.available_units) ? it.available_units : [];

  const selected = String(it.unit || 'UN').toUpperCase();

  const opts = [];

  if (list.length) {
    for (const u of list) {
      const unit = String(u.unit || u.unidade || 'UN').toUpperCase();
      const fator = Number(u.fator ?? u.factor ?? 1) || 1;

      opts.push(`
        <option value="${unit}"
                data-factor="${fator}"
                data-fator="${fator}"
                data-barcode-id="${u.barcode_id || ''}"
                data-weight-kg="${toNumberSafe(u.weight_kg ?? u.weightKg, 0)}"
                ${selected === unit ? 'selected' : ''}>
          ${unit}
        </option>
      `);
    }
  } else {
    opts.push(`
      <option value="${selected}" data-factor="${it.unit_factor || 1}" data-fator="${it.unit_factor || 1}" selected>
        ${selected}
      </option>
    `);
  }

  return opts.join('');
}

function buildLotOptionsForItem(it) {
  const list = Array.isArray(it.available_lots) ? it.available_lots : [];

  const selected = it.lot_id != null ? String(it.lot_id) : '';

  const opts = ['<option value="">—</option>'];

  if (list.length) {
    for (const l of list) {
      const lotId = String(l.lot_id ?? l.id ?? '');
      const lotCode = l.lot_code ?? l.code ?? l.lote ?? '';
      const expiry = l.expiry_date ?? l.expires_at ?? l.validade ?? '';
      const qty = Number(l.qty_available ?? l.qty_on_hand ?? l.saldo ?? 0) || 0;

      const label = `${lotCode || 'LOTE'}${expiry ? ' • ' + fmtDateBR(expiry) : ''}`;

      opts.push(`
        <option value="${lotId}"
                data-lot-code="${lotCode}"
                data-lot_code="${lotCode}"
                data-expiry="${expiry}"
                data-expiry_date="${expiry}"
                data-qty="${qty}"
                data-qty_available="${qty}"
                ${selected === lotId ? 'selected' : ''}>
          ${label}
        </option>
      `);
    }
  } else if (it.lot_code) {
    const label = `${it.lot_code}${it.expiry_date ? ' • ' + fmtDateBR(it.expiry_date) : ''}`;

    opts.push(`
      <option value="${it.lot_id || ''}"
              data-lot-code="${it.lot_code || ''}"
              data-expiry="${it.expiry_date || ''}"
              data-qty="${it.qty_available_lot || 0}"
              selected>
        ${label}
      </option>
    `);
  }

  return opts.join('');
}

let __enrichingItemOptions = false;

async function ensureItemOptionsLoaded(it) {
  if (!it) return;

  const sku = String(it.sku || '').trim();
  const pid = String(it.product_id || '').trim();

  // 1) UNIDADES
  if ((!Array.isArray(it.available_units) || it.available_units.length <= 1) && sku) {
    const out = await fetchSafe(
      `${API_BASE}/api/barcodes/active-units?product_code=${encodeURIComponent(sku)}`,
      { headers: authHeaders(), method: 'GET' }
    );

    const rows = out.ok ? (out.json?.rows || out.json?.data || out.json || []) : [];
    const list = Array.isArray(rows) ? rows : [];

    if (list.length) {
      const seen = new Set();

      it.available_units = list
        .map((u) => ({
          unit: safeUpper(u.unit || u.unidade || u.um || it.unit || 'UN'),
          description: u.unit_description || u.description || u.descricao || '',
          fator: Number(u.fator ?? u.factor ?? u.unit_factor ?? it.unit_factor ?? 1) || 1,
          standard: !!(u.standard || u.padrao),
          barcode_id: u.barcode_id || null,
          barcode: u.barcode || '',
          weight_kg: toNumberSafe(u.weight_kg ?? u.weightKg, 0),
          product_unit_id: u.product_unit_id || null,
          unit_id: u.unit_id || null,
        }))
        .filter((u) => {
          const key = `${u.unit}|${u.fator}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
  }

  if (!Array.isArray(it.available_units) || !it.available_units.length) {
    it.available_units = [{
      unit: safeUpper(it.unit || 'UN'),
      description: '',
      fator: Number(it.unit_factor || 1) || 1,
      standard: true,
    }];
  }

  // 2) GRADES
  if ((!Array.isArray(it.available_grades) || !it.available_grades.length) && (sku || pid)) {
    const attempts = [
      pid ? ROUTES.productGradesById(pid) : null,
      sku ? ROUTES.productGradesBySku(sku) : null,
      pid ? `${API_BASE}/api/products-grades?product_id=${encodeURIComponent(pid)}` : null,
      sku ? `${API_BASE}/api/products-grades?product_code=${encodeURIComponent(sku)}` : null,
    ].filter(Boolean);

    for (const url of attempts) {
      const out = await fetchSafe(url, { headers: authHeaders(), method: 'GET' });
      if (!out.ok) continue;

      const rows = out.json?.rows || out.json?.data || out.json || [];
      const list = Array.isArray(rows) ? rows : [];
      if (!list.length) continue;

      it.available_grades = list.map((g) => {
        const productGradeId = g.product_grade_id || g.productGradeId || g.id || '';
        const gradeId = g.grade_id || g.gradeId || '';
        const name =
          g.grade ||
          g.name ||
          g.descricao ||
          g.description ||
          `Grade ${productGradeId || gradeId || ''}`;

        return {
          id: productGradeId,
          product_grade_id: productGradeId,
          grade_id: gradeId,
          name,
          grade: name,
          description: name,
        };
      });

      break;
    }
  }

  if (!Array.isArray(it.available_grades) || !it.available_grades.length) {
    const fallbackName = it.grade || it.grade_name || 'Padrão';

    it.available_grades = [{
      id: it.product_grade_id || '',
      product_grade_id: it.product_grade_id || '',
      grade_id: it.grade_id || '',
      name: fallbackName,
      grade: fallbackName,
      description: fallbackName,
    }];
  }

  // 2.1) RESTAURA product_grade_id / grade_id / grade
  let resolvedProductGradeId = it.product_grade_id || null;

  if (Array.isArray(it.available_grades) && it.available_grades.length) {
    const found =
      it.available_grades.find((g) =>
        resolvedProductGradeId &&
        String(g.product_grade_id || g.id || '') === String(resolvedProductGradeId)
      ) ||
      it.available_grades.find((g) =>
        it.grade_id &&
        String(g.grade_id || '') === String(it.grade_id)
      ) ||
      it.available_grades.find((g) =>
        it.grade &&
        String(g.name || g.grade || g.description || '').trim().toUpperCase() ===
        String(it.grade || '').trim().toUpperCase()
      ) ||
      it.available_grades.find((g) =>
        String(g.name || g.grade || g.description || '').trim().toUpperCase() === 'PADRÃO'
      ) ||
      it.available_grades[0];

    if (found) {
      resolvedProductGradeId = found.product_grade_id || found.id || resolvedProductGradeId || null;

      it.product_grade_id = resolvedProductGradeId;
      it.grade_id = found.grade_id || it.grade_id || null;
      it.grade = found.name || found.grade || found.description || it.grade || 'Padrão';
    }
  }

  // 3) LOTES
  const shouldReloadLots =
    requiresStockLot() &&
    (
      !Array.isArray(it.available_lots) ||
      !it.available_lots.length
    );

  if (!requiresStockLot()) {
    it.available_lots = [];
    it.lot_id = null;
    it.lot_code = null;
    it.expiry_date = null;
    it.qty_available_lot = null;
  }

  if (shouldReloadLots && sku) {
    const attempts = [];

    if (resolvedProductGradeId) {
      attempts.push(
        `${API_BASE}/api/productsStockLots/by-product-code/${encodeURIComponent(sku)}?product_grade_id=${encodeURIComponent(resolvedProductGradeId)}`
      );
    }

    attempts.push(
      `${API_BASE}/api/productsStockLots/by-product-code/${encodeURIComponent(sku)}`
    );

    for (const url of attempts) {
      console.log('[budgets.items][ensureItemOptionsLoaded][lots] request:', {
        sku,
        product_id: pid,
        grade_id: it.grade_id,
        product_grade_id: resolvedProductGradeId,
        url,
      });

      const out = await fetchSafe(url, {
        headers: authHeaders(),
        method: 'GET',
      });

      if (!out.ok) {
        console.warn('[budgets.items][ensureItemOptionsLoaded][lots] failed:', {
          status: out.status,
          text: out.text,
          url,
        });
        continue;
      }

      const rows = out.json?.rows || out.json?.data || out.json || [];
      const list = Array.isArray(rows) ? rows : [];

      const lots = list
        .map((r) => {
          const qtyOnHand = toNumberSafe(r.qty_on_hand, 0);
          const qtyReserved = toNumberSafe(r.qty_reserved, 0);

          const qtyAvailable =
            r.qty_available != null
              ? toNumberSafe(r.qty_available, 0)
              : r.saldo != null
                ? toNumberSafe(r.saldo, 0)
                : r.available != null
                  ? toNumberSafe(r.available, 0)
                  : qtyOnHand - qtyReserved;

          return {
            lot_id: r.lot_id ?? r.id ?? '',
            lot_code: r.lot_code ?? r.lote ?? r.code ?? '',
            expiry_date: r.expires_at ?? r.expiry_date ?? r.validade ?? null,
            qty_available: qtyAvailable,
            product_grade_id: r.product_grade_id ?? null,
            is_active: r.is_active == null ? true : r.is_active === true || String(r.is_active).toLowerCase() === 'true',
            deleted_at: r.deleted_at ?? null,
          };
        })
        .filter((l) => {
          if (!l.lot_id) return false;
          if (l.is_active === false) return false;
          if (l.deleted_at) return false;

          if (resolvedProductGradeId && l.product_grade_id) {
            return String(l.product_grade_id) === String(resolvedProductGradeId);
          }

          return true;
        });

      if (lots.length) {
        it.available_lots = lots;
        break;
      }
    }
  }

  if (!Array.isArray(it.available_lots)) {
    it.available_lots = [];
  }

  // 3.1) RESTAURA LOTE SE EXISTIR
  if (it.lot_id && it.available_lots.length) {
    const foundLot = it.available_lots.find(
      (l) => String(l.lot_id) === String(it.lot_id)
    );

    if (foundLot) {
      it.lot_id = foundLot.lot_id || it.lot_id;
      it.lot_code = foundLot.lot_code || it.lot_code || null;
      it.expiry_date = foundLot.expiry_date || it.expiry_date || null;
      it.qty_available_lot = foundLot.qty_available ?? it.qty_available_lot ?? null;
    }
  }

  // 3.2) SE NÃO TINHA LOTE SALVO, NÃO FORÇA SELEÇÃO
  if (!it.lot_id) {
    it.lot_code = null;
    it.expiry_date = null;
    it.qty_available_lot = null;
  }
}

async function enrichItemsOptionsAfterRender() {
  if (__enrichingItemOptions) return;

  const items = state.editing?.items || [];
  if (!items.length) return;

  __enrichingItemOptions = true;

  try {
    let changed = false;

    for (const it of items) {
      const beforeUnits = Array.isArray(it.available_units) ? it.available_units.length : 0;
      const beforeGrades = Array.isArray(it.available_grades) ? it.available_grades.length : 0;
      const beforeLots = Array.isArray(it.available_lots) ? it.available_lots.length : 0;

      await ensureItemOptionsLoaded(it);

      const afterUnits = Array.isArray(it.available_units) ? it.available_units.length : 0;
      const afterGrades = Array.isArray(it.available_grades) ? it.available_grades.length : 0;
      const afterLots = Array.isArray(it.available_lots) ? it.available_lots.length : 0;

      if (
        afterUnits !== beforeUnits ||
        afterGrades !== beforeGrades ||
        afterLots !== beforeLots
      ) {
        changed = true;
      }
    }

    if (changed) {
      renderItems();
      recalcTotals();
    }
  } catch (err) {
    console.warn('[budgets.items][enrichItemsOptionsAfterRender] erro:', err);
  } finally {
    __enrichingItemOptions = false;
  }
}

export function renderItems() {
  const tbody = $('#productsTableBody');

  if (!tbody) {
    console.error(
      '[budgets.items] Elemento #productsTableBody não encontrado no HTML.',
    );
    return;
  }

  if (!state.editing) return;

  tbody.innerHTML = '';

  state.editing.items.forEach((it, idx) => {
    const qty = toNumberSafe(it.quantity, 0);
    const unitPrice = toNumberSafe(it.unit_price, 0);
    const discount = toNumberSafe(it.discount_value, 0);
    const total = Math.max(0, qty * unitPrice - discount);

    const tr = document.createElement('tr');

    tr.innerHTML = `
  <td>${it.sku || ''}</td>

  <td>${it.manufacturer_ref || ''}</td>

  <td>${it.description || ''}</td>

  <td>
        <select class="tbl-select" data-idx="${idx}" data-f="g">
          ${buildGradeOptionsForItem(it)}
        </select>
      </td>

      <td>
        <select class="tbl-select" data-idx="${idx}" data-f="u">
          ${buildUnitOptionsForItem(it)}
        </select>
      </td>

      <td>
        <select class="tbl-select" data-idx="${idx}" data-f="l">
          ${buildLotOptionsForItem(it)}
        </select>
      </td>

      <td>
        <select class="tbl-select" data-idx="${idx}" data-f="t" ${state.editing?.header?.price_id ? 'disabled' : ''}>
          ${buildTabelaOptionsForItem(it)}
        </select>
      </td>

      <td>
        <input
          class="tbl-input"
          data-idx="${idx}"
          data-f="q"
          type="number"
          min="1"
          step="1"
          value="${qty}"
        />
      </td>

      <td>
        <input
          class="tbl-input tbl-input--readonly"
          data-idx="${idx}"
          data-f="p"
          type="number"
          step="0.01"
          min="0"
          value="${unitPrice.toFixed(2)}"
          readonly
          tabindex="-1"
        />
      </td>

      <td>
        <input
          class="tbl-input"
          data-idx="${idx}"
          data-f="d"
          type="number"
          step="0.01"
          min="0"
          value="${discount.toFixed(2)}"
        />
      </td>

      <td>${fmtMoney(total)}</td>

      <td class="col-acoes">
        <button
        type="button"
        class="btn btn-icon"
        data-remove="${idx}"
        title="Excluir item"
        aria-label="Excluir item"
      >
      🗑️
    </button>
   </td>
    `;

    tbody.appendChild(tr);
  });

  /*
   * Quantity is updated only after the user finishes typing.
   * Other editable fields continue updating immediately.
   */
  tbody.oninput = (event) => {
    const element =
      event.target.closest('[data-idx]');

    if (!element) return;

    // Do not update quantity for every typed digit.
    if (element.dataset.f === 'q') {
      return;
    }

    onItemEdit(event);
  };

  /*
   * Runs when the quantity field loses focus
   * or its value is committed.
   */
  tbody.onchange = onItemEdit;

  /*
   * Pressing Enter commits the quantity.
   */
  tbody.onkeydown = (event) => {
    const element =
      event.target.closest('[data-idx]');

    if (
      element?.dataset.f === 'q' &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
      element.blur();
    }
  };

  tbody.onclick = (e) => {
    const el = e.target.closest('[data-remove]');
    if (!el) return;

    const i = Number(el.dataset.remove);
    if (!Number.isInteger(i)) return;

    state.editing.items.splice(i, 1);

    renderItems();
    recalcTotals();
  };

  setTimeout(() => {
    enrichItemsOptionsAfterRender().catch((err) => {
      console.warn('[budgets][items] erro ao enriquecer opções dos itens:', err);
    });
  }, 0);
}

async function onItemEdit(e) {
  const el = e.target.closest('[data-idx]');
  if (!el) return;

  const i = Number(el.dataset.idx);
  const f = el.dataset.f;
  const it = state.editing.items?.[i];

  if (!it) return;

  // ─────────────────────────────────────────────
  // QTD
  // ─────────────────────────────────────────────
  if (f === 'q') {
    const oldQty = Number(it.quantity || 0);
    const newQty = Math.max(0, Number(el.value || 0));

    const lotQty = it.lot_id ? toNumberSafe(it.qty_available_lot, null) : null;

    const stockValidation = validateStockForItem({
      sku: it.sku,
      quantity: newQty,
      stock: it.stock_available,
      lotQty,
      ignoreIndex: i,
    });

    if (!stockValidation.ok) {
      const overrideReason = it.lot_id
        ? 'Lote insuficiente na edição do item'
        : 'Estoque insuficiente na edição do item';

      const unlock = await requestStockOverride({
        reason: overrideReason,
        sku: it.sku,
        description: it.description,
        requestedQty: newQty,
        availableQty: it.lot_id
          ? toNumberSafe(it.qty_available_lot, 0)
          : toNumberSafe(it.stock_available, 0),
        lotId: it.lot_id || null,
      });

      if (!unlock.ok) {
        toast.warn('Estoque insuficiente', `${it.description} - ${stockValidation.message}`);
        el.value = oldQty;
        return;
      }

      if (unlock.token) {
        applyOverrideMeta(it, {
          token: unlock.token,
          reason: overrideReason,
          qty: newQty,
          lotId: it.lot_id || null,
        });
      } else {
        clearOverrideMeta(it);
      }

    }

    it.quantity = newQty;

    renderItems();
    recalcTotals();
    return;
  }

  // ─────────────────────────────────────────────
  // DESCONTO ITEM
  // ─────────────────────────────────────────────
  if (f === 'd') {
    const requestedDiscount = Math.max(0, Number(el.value || 0));
    const maxDiscount = (Number(it.quantity || 0) * Number(it.unit_price || 0)) *
      (Number(budgetSettings.max_discount_percent || 0) / 100);

    if (requestedDiscount > maxDiscount + 0.0001) {
      toast.warn('Desconto', `O desconto máximo permitido é ${budgetSettings.max_discount_percent}%.`);
      el.value = Number(it.discount_value || 0).toFixed(2);
      return;
    }

    it.discount_value = requestedDiscount;

    renderItems();
    recalcTotals();
    return;
  }

  // ─────────────────────────────────────────────
  // TABELA DE PREÇO
  // ─────────────────────────────────────────────
  if (f === 't') {
    const v = el.value ? Number(el.value) : null;

    it.price_id = Number.isFinite(v) ? v : null;

    await applyPriceByTableToItem(it);

    renderItems();
    recalcTotals();
    return;
  }

  // ─────────────────────────────────────────────
  // GRADE
  // ─────────────────────────────────────────────
  if (f === 'g') {
    const opt = el.selectedOptions?.[0];

    it.product_grade_id = opt?.dataset?.productGradeId || el.value || null;
    it.grade_id = opt?.dataset?.gradeId || null;
    it.grade = opt?.textContent?.trim() || '';

    it.lot_id = null;
    it.lot_code = null;
    it.expiry_date = null;
    it.qty_available_lot = null;

    const productCode = String(it.sku || '').trim();
    const productGradeId = String(el.value || '').trim();

    if (
      requiresStockLot() &&
      productCode &&
      productGradeId
    ) {
      const url =
        `${API_BASE}/api/productsStockLots/by-product-code/${encodeURIComponent(productCode)}` +
        `?product_grade_id=${encodeURIComponent(productGradeId)}`;

      const out = await fetchSafe(url, {
        headers: authHeaders(),
        method: 'GET',
      });

      const rows = out.ok ? (out.json?.rows || out.json?.data || out.json || []) : [];
      const list = Array.isArray(rows) ? rows : [];

      it.available_lots = list
        .map((r) => {
          const qtyOnHand = toNumberSafe(r.qty_on_hand, 0);
          const qtyReserved = toNumberSafe(r.qty_reserved, 0);

          const qtyAvailable =
            r.qty_available != null
              ? toNumberSafe(r.qty_available, 0)
              : r.saldo != null
                ? toNumberSafe(r.saldo, 0)
                : r.available != null
                  ? toNumberSafe(r.available, 0)
                  : qtyOnHand - qtyReserved;

          return {
            lot_id: r.lot_id ?? null,
            lot_code: r.lot_code ?? '',
            expiry_date: r.expires_at ?? r.expiry_date ?? null,
            qty_available: qtyAvailable,
            product_grade_id: r.product_grade_id ?? null,
            is_active: r.is_active == null ? true : r.is_active === true || String(r.is_active).toLowerCase() === 'true',
            deleted_at: r.deleted_at ?? null,
          };
        })
        .filter((lot) => {
          if (!lot.lot_id) return false;
          if (lot.is_active === false) return false;
          if (lot.deleted_at) return false;

          if (productGradeId && lot.product_grade_id) {
            return String(lot.product_grade_id) === String(productGradeId);
          }

          return true;
        });
    } else {
      it.available_lots = [];
    }

    renderItems();
    recalcTotals();
    return;
  }

  // ─────────────────────────────────────────────
  // UNIDADE DE MEDIDA
  // ─────────────────────────────────────────────
  if (f === 'u') {
    const opt = el.selectedOptions?.[0];

    const factor =
      Number(
        opt?.dataset?.factor ||
        opt?.dataset?.fator ||
        1
      ) || 1;

    it.unit = String(el.value || 'UN').toUpperCase();
    it.unit_factor = factor;
    it.barcode_id = Number(opt?.dataset?.barcodeId || 0) || null;
    it.unit_weight_kg = toNumberSafe(opt?.dataset?.weightKg, 0);
    it.weight_kg = it.unit_weight_kg;

    await applyPriceByTableToItem(it);

    renderItems();
    recalcTotals();
    return;
  }

  // ─────────────────────────────────────────────
  // LOTE
  // ─────────────────────────────────────────────
  if (f === 'l') {
    const opt = el.selectedOptions?.[0];

    const oldLotId = it.lot_id || null;
    const oldLotCode = it.lot_code || null;
    const oldExpiry = it.expiry_date || null;
    const oldQtyAvailable = it.qty_available_lot ?? null;

    const newLotId = el.value || null;
    const newLotCode =
      opt?.dataset?.lotCode ||
      opt?.dataset?.lot_code ||
      '';

    const newExpiry =
      opt?.dataset?.expiry ||
      opt?.dataset?.expiry_date ||
      null;

    const newQtyAvailable = toNumberSafe(
      opt?.dataset?.qty ||
      opt?.dataset?.qty_available ||
      0,
      0
    );

    if (newLotId) {
      const stockValidation = validateStockForItem({
        sku: it.sku,
        quantity: Number(it.quantity || 0),
        stock: it.stock_available,
        lotQty: newQtyAvailable,
        ignoreIndex: i,
      });

      if (!stockValidation.ok) {
        const unlock = await requestStockOverride({
          reason: 'Lote insuficiente na troca do lote',
          sku: it.sku,
          description: it.description,
          requestedQty: Number(it.quantity || 0),
          availableQty: newQtyAvailable,
          lotId: newLotId,
        });

        if (!unlock.ok) {
          toast.warn('Estoque insuficiente', `${it.description} - ${stockValidation.message}`);

          it.lot_id = oldLotId;
          it.lot_code = oldLotCode;
          it.expiry_date = oldExpiry;
          it.qty_available_lot = oldQtyAvailable;

          renderItems();
          return;
        }

        if (unlock.token) {
          applyOverrideMeta(it, {
            token: unlock.token,
            reason: 'Lote insuficiente na troca do lote',
            qty: Number(it.quantity || 0),
            lotId: newLotId,
          });
        } else {
          clearOverrideMeta(it);
        }

      }
    }

    it.lot_id = newLotId;
    it.lot_code = newLotCode || null;
    it.expiry_date = newExpiry;
    it.qty_available_lot = newLotId ? newQtyAvailable : null;

    renderItems();
    recalcTotals();
    return;
  }
}

/* ──────────────────────────────────────────────────────────────
   Totals
────────────────────────────────────────────────────────────── */
export function recalcTotals() {
  if (!state.editing) return;

  initGlobalDiscountInState();
  syncGlobalDiscountHiddenFields();

  const subtotal = state.editing.items.reduce((s, it) => {
    const qty = Math.max(0, toNumberSafe(it.quantity, 0));
    const unitPrice = Math.max(0, toNumberSafe(it.unit_price, 0));
    return s + (qty * unitPrice);
  }, 0);

  const descontosItens = state.editing.items.reduce((s, it) => {
    return s + Math.max(0, toNumberSafe(it.discount_value, 0));
  }, 0);

  const baseAfterItemDiscounts = Math.max(0, subtotal - descontosItens);

  const descontoGeral = calcGlobalDiscountAmount(baseAfterItemDiscounts);
  const frete = Math.max(0, toNumberSafe($('#frete')?.value, 0));

  const total = Math.max(0, baseAfterItemDiscounts - descontoGeral + frete);

  $('#subtotal') && ($('#subtotal').textContent = fmtMoney(subtotal));
  $('#totdesc') && ($('#totdesc').textContent = fmtMoney(descontosItens));
  $('#totalGlobalDiscount') && ($('#totalGlobalDiscount').textContent = fmtMoney(descontoGeral));
  $('#totalGeral') && ($('#totalGeral').textContent = fmtMoney(total));

  if (state.editing?.header) {
    state.editing.header.global_discount_type = normalizeDiscountType(
      state.editing.header.global_discount_type || $('#globalDiscountType')?.value || 'value'
    );
    state.editing.header.global_discount_value = Math.max(
      0,
      toNumberSafe(state.editing.header.global_discount_value ?? $('#globalDiscountValue')?.value, 0)
    );
    state.editing.header.freight_value = frete;
    state.editing.header.subtotal = subtotal;
    state.editing.header.items_discount_total = descontosItens;
    state.editing.header.global_discount_amount = descontoGeral;
    state.editing.header.total_discount = descontosItens + descontoGeral;
    state.editing.header.total_amount = total;
  }

  import('./budgets.payments.js')
    .then((m) => m.updatePaymentsSummaryUI?.())
    .catch(() => { });
}
