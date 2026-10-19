// ╔══════════════════════════════════════════════════════════════╗
// ║ budgets.editor.js — Editor (tabs, binds, open/close, hydrate) ║
// ║ + Auto-import Vendedor via /api/me/seller (login)             ║
// ║ + Auto-import Vendedor via /api/seller-for-customer (cliente) ║
// ║ + Manual override via botão "Vendedor" (não sobrescreve)      ║
// ║ + NOVO: Copiar Orçamento                                      ║
// ║ + Compatível com pagamento antigo e novo modelo               ║
// ║ + Suporte a budgetsPayments / budgetsPaymentInstallments      ║
// ║ + FIX: protege binds duplicados no editor                     ║
// ║ PRODNEX ERP | Frontend (ESM)                                  ║
// ╚══════════════════════════════════════════════════════════════╝

import { $, ROUTES, state, debounce } from './budgets.core.js';
import { authHeaders, fetchSafe, handleAuthFail, toast } from './budgets.infra.js';
import { onPaymentMethodChange } from './budgets.catalogs.js';
import {
  resetTabelaSelect,
  resetUMSelect,
  resetGradeSelect,
  applyProductSelection,
  renderItems,
  recalcTotals,
  searchCustomerInline,
  searchProductInline,
  searchProductByManufacturerRef,
  clearCustomerFields,
  fillCustomer,
  loadCustomerPriceTable,
  loadCustomerCredit,
  enrichCustomerContactsIfMissing,
  applyFactorOverCurrentPrice,
  onTabelaChange,
} from './budgets.items.js';
import { setPrintEnabled, saveBudget, openPdf, transformToOrder, copyBudget } from './budgets.actions.js';
import { setupObsModal } from './budgets.modals.js';
import { applyPriceModeToNewBudget } from './budgets.priceMode.js';

import { openProductsModalSearch } from '/public/modalsSearch/productsModalSearch.js';
import { openCustomersModalSearch } from '/public/modalsSearch/customersModalSearch.js';
import { openOrdersDeliveryModal } from '/public/modalsSearch/ordersDeliveryModal.js';

import { openRentabilityBudgetsModal } from './modals/rentabilityBudgetsModal.js';

import {
  setNfePreviewBudgetId,
} from './budgets.nfePreview.js';

import { openTransportersModalSearch } from '/public/modalsSearch/transportersModalSearch.js';
import { openSellersModalSearch } from '/public/modalsSearch/sellersModalSearch.js';
import {
  bindBudgetOperationType,
  loadBudgetOperationTypes,
  setBudgetOperationType,
} from './budgets.operations.js';

/* ──────────────────────────────────────────────────────────────
  Seller helpers (DOM + state)
  IMPORTANT:
  - seller_id no backend pode ser varchar (ex.: "VEN_001"), então aqui é STRING.
  - "manual override" marca state.editing.header.seller_manual = true
────────────────────────────────────────────────────────────── */
function getApiBase() {
  return (window.apiBase || window.API_BASE || window.location.origin).replace(/\/$/, '');
}

/*
 * Data de hoje (America/Sao_Paulo) no formato YYYY-MM-DD.
 *
 * Usa o mesmo fuso do backend (todayInSaoPaulo), para que a "Data" do
 * orçamento bata com a data-base usada na geração das parcelas.
 */
function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function bindOnce(el, key, eventName, handler, options) {
  if (!el) return;
  const dsKey = `bound${key}`;
  if (el.dataset?.[dsKey] === '1') return;
  el.addEventListener(eventName, handler, options);
  if (el.dataset) el.dataset[dsKey] = '1';
}

function calculateBudgetGrossWeight() {
  const items = Array.isArray(state.editing?.items)
    ? state.editing.items
    : [];

  const total = items.reduce((sum, item) => {
    const quantity = Number(item?.quantity || 0);
    const unitWeight = Number(
      item?.unit_weight_kg ??
      item?.weight_kg ??
      0
    );

    if (!Number.isFinite(quantity) || !Number.isFinite(unitWeight)) {
      return sum;
    }

    return sum + (Math.max(0, quantity) * Math.max(0, unitWeight));
  }, 0);

  return Number(total.toFixed(3));
}

/* ──────────────────────────────────────────────────────────────
  Payment helpers (LEGADO + NOVO MODELO)
  - Mantém compatibilidade com #formaPagamento, #condicaoPagamento,
    #dataVencimento caso ainda existam no HTML.
  - Também prepara state.editing.payments e state.editing.payment_installments
  - Integra com budgets.payments.js de forma dinâmica e segura
────────────────────────────────────────────────────────────── */
let __budgetsPaymentsModulePromise = null;

async function loadBudgetsPaymentsModule() {
  try {
    if (!__budgetsPaymentsModulePromise) {
      __budgetsPaymentsModulePromise = import('./budgets.payments.js');
    }
    return await __budgetsPaymentsModulePromise;
  } catch (e) {
    console.warn('[budgets][payments] módulo budgets.payments.js não disponível:', e?.message || e);
    return null;
  }
}

function ensureEditingShape() {
  state.editing = state.editing || {};
  state.editing.header = state.editing.header || {};
  state.editing.items = Array.isArray(state.editing.items) ? state.editing.items : [];
  state.editing.payments = Array.isArray(state.editing.payments) ? state.editing.payments : [];
  state.editing.payment_installments = Array.isArray(state.editing.payment_installments)
    ? state.editing.payment_installments
    : [];
}

function normalizePaymentText(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/* ──────────────────────────────────────────────────────────────
  LEGADO: formaPagamento (fallback)
────────────────────────────────────────────────────────────── */
function setDefaultPaymentMethodPixVistaLegacy() {
  const forma = document.getElementById('formaPagamento');
  if (!forma) return false;

  const options = Array.from(forma.options || []);
  if (!options.length) return false;

  const target = options.find((opt) => {
    const text = normalizePaymentText(opt.textContent || opt.label || '');
    const value = normalizePaymentText(opt.value || '');

    return (
      text === 'PIX A VISTA' ||
      text.includes('PIX A VISTA') ||
      value === 'PIX A VISTA' ||
      value === 'PIX_A_VISTA' ||
      value === 'PIXAVISTA'
    );
  });

  if (!target) return false;

  forma.value = String(target.value);
  forma.dispatchEvent(new Event('change', { bubbles: true }));

  ensureEditingShape();
  state.editing.header.payment_method_id = String(target.value);

  try {
    onPaymentMethodChange();
  } catch { }

  return true;
}

function applyDefaultPaymentMethodForNewBudgetLegacy() {
  const applied = setDefaultPaymentMethodPixVistaLegacy();
  if (applied) return;

  setTimeout(() => setDefaultPaymentMethodPixVistaLegacy(), 120);
  setTimeout(() => setDefaultPaymentMethodPixVistaLegacy(), 300);
  setTimeout(() => setDefaultPaymentMethodPixVistaLegacy(), 700);
  setTimeout(() => setDefaultPaymentMethodPixVistaLegacy(), 1200);
}

/* ──────────────────────────────────────────────────────────────
  NOVO MODELO: wrapper seguro para budgets.payments.js
────────────────────────────────────────────────────────────── */
async function initPaymentsEditorUI() {
  const m = await loadBudgetsPaymentsModule();
  if (!m?.initBudgetPaymentsEditor) return;
  await m.initBudgetPaymentsEditor();
}

async function resetPaymentsEditorState() {
  ensureEditingShape();

  const m = await loadBudgetsPaymentsModule();
  if (m?.resetBudgetPaymentsState) {
    await m.resetBudgetPaymentsState();
    ensureEditingShape();
    return;
  }

  state.editing.payments = [];
  state.editing.payment_installments = [];
}

async function renderPaymentsEditorUI() {
  ensureEditingShape();

  const m = await loadBudgetsPaymentsModule();
  if (m?.renderBudgetPayments) {
    await m.renderBudgetPayments();
  }
  if (m?.renderBudgetPaymentInstallments) {
    await m.renderBudgetPaymentInstallments();
  }
}

async function applyDefaultPaymentsForNewBudget() {
  ensureEditingShape();

  const m = await loadBudgetsPaymentsModule();

  if (m?.applyDefaultPixCashPaymentForNewBudget) {
    await m.applyDefaultPixCashPaymentForNewBudget();
    ensureEditingShape();
    return true;
  }

  applyDefaultPaymentMethodForNewBudgetLegacy();
  return false;
}

async function loadPaymentsForBudgetEditor(budgetId) {
  ensureEditingShape();

  const m = await loadBudgetsPaymentsModule();
  if (m?.loadBudgetPaymentsForEditor) {
    await m.loadBudgetPaymentsForEditor(budgetId);
    ensureEditingShape();
    return true;
  }

  try {
    const base = getApiBase();

    const [paymentsOut, installmentsOut] = await Promise.all([
      fetchSafe(`${base}/api/budgets-payments/budget/${encodeURIComponent(budgetId)}`, {
        headers: authHeaders(),
        method: 'GET',
      }),
      fetchSafe(`${base}/api/budgets-payment-installments/budget/${encodeURIComponent(budgetId)}`, {
        headers: authHeaders(),
        method: 'GET',
      }),
    ]);

    if (paymentsOut.ok) {
      const pj = paymentsOut.json || {};
      state.editing.payments = Array.isArray(pj.rows) ? pj.rows : [];
    } else {
      state.editing.payments = [];
    }

    if (installmentsOut.ok) {
      const ij = installmentsOut.json || {};
      state.editing.payment_installments = Array.isArray(ij.rows) ? ij.rows : [];
    } else {
      state.editing.payment_installments = [];
    }

    return true;
  } catch (e) {
    console.warn('[budgets][payments] fallback load error:', e?.message || e);
    state.editing.payments = [];
    state.editing.payment_installments = [];
    return false;
  }
}

function setSellerOnHeader({ seller_id, seller_name } = {}) {
  ensureEditingShape();

  const sid = seller_id == null ? '' : String(seller_id).trim();
  const sname = seller_name == null ? '' : String(seller_name).trim();

  state.editing.header.seller_id = sid || null;
  state.editing.header.seller_name = sname || '';

  const elId = document.getElementById('sellerId');
  if (elId) elId.value = state.editing.header.seller_id || '';

  const elName = document.getElementById('sellerName');
  if (elName) elName.value = state.editing.header.seller_name || '';
}

function clearSellerOnHeader() {
  setSellerOnHeader({ seller_id: null, seller_name: '' });
  ensureEditingShape();
  state.editing.header.seller_manual = false;
}

function isSellerLockedByManualChoice() {
  const h = state.editing?.header || {};
  return !!h.seller_manual;
}

function syncCopyButtonState() {
  const btnCopiar = $('#btnCopiarOrcamento');
  const enabled = !!state.selectedId;

  if (!btnCopiar) return;

  btnCopiar.disabled = !enabled;
  btnCopiar.style.opacity = enabled ? '1' : '0.6';
  btnCopiar.style.cursor = enabled ? 'pointer' : 'not-allowed';
  btnCopiar.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  btnCopiar.title = enabled
    ? 'Copiar orçamento atual'
    : 'Abra ou salve um orçamento para copiar';
}

/**
 * Auto pick seller from LOGIN:
 * GET /api/me/seller  -> { ok:true, seller:{ seller_id, name/nickname } }
 */
async function autoPickSellerFromLogin({ force = false } = {}) {
  try {
    ensureEditingShape();

    if (!force && (state.editing.header.seller_id || isSellerLockedByManualChoice())) return;

    const url = `${getApiBase()}/api/me/seller`;
    console.log('[budgets][seller] autoPickLogin URL:', url);

    const out = await fetchSafe(url, { headers: authHeaders(), method: 'GET' });

    if (!out.ok) {
      if (handleAuthFail(out.status, out.text)) return;
      console.warn('[budgets][seller] autoPickLogin failed:', out.status, out.text);
      return;
    }

    const j = out.json || {};
    const s = j.seller || j.data?.seller || {};

    const seller_id = s.seller_id ?? j.seller_id ?? null;
    const seller_name = s.nickname ?? s.name ?? j.seller_name ?? '';

    if (!seller_id) return;

    setSellerOnHeader({ seller_id, seller_name });
  } catch (e) {
    console.warn('[budgets][seller] autoPickLogin error:', e?.message || e);
  }
}

/**
 * Auto pick seller based on customer_id:
 * GET /api/seller-for-customer?customer_id=...&active=1&limit=1&offset=0&orderBy=created_at DESC
 */
async function autoPickSellerByCustomer(customerId, { force = false } = {}) {
  const cid = String(customerId || '').trim();
  if (!cid) return;

  ensureEditingShape();

  const current = state.editing.header.seller_id ?? null;
  if (!force && (current || isSellerLockedByManualChoice())) return;

  const url =
    `${getApiBase()}/api/seller-for-customer` +
    `?customer_id=${encodeURIComponent(cid)}&active=1&limit=1&offset=0&orderBy=${encodeURIComponent('created_at DESC')}`;

  try {
    console.log('[budgets][seller] autoPickCustomer URL:', url);

    const out = await fetchSafe(url, {
      headers: authHeaders(),
      method: 'GET',
    });

    if (!out.ok) {
      if (handleAuthFail(out.status, out.text)) return;
      console.warn('[budgets][seller] autoPickCustomer failed:', out.status, out.text);
      return;
    }

    const j = out.json || {};
    const row = Array.isArray(j.items) ? j.items[0] : (Array.isArray(j.data) ? j.data[0] : null);

    if (!row?.seller_id) {
      console.log('[budgets][seller] no active link for customer', cid);
      return;
    }

    setSellerOnHeader({
      seller_id: row.seller_id,
      seller_name: row.seller_name || '',
    });

    toast?.success?.('Vendedor', `✅ Importado automaticamente: ${row.seller_name || 'Vendedor'}`);
  } catch (e) {
    console.warn('[budgets][seller] autoPickCustomer error:', e?.message || e);
  }
}

/**
 * Manual seller picker: modal padrão Buscar Vendedor (modals.css / modal.js).
 * NOTE: marks seller_manual=true to prevent auto overwrite
 */
function openSellerPicker() {
  ensureEditingShape();

  openSellersModalSearch({
    apiBase: getApiBase(),
    headers: authHeaders(),
    onPick: (seller) => {
      const chosenId = seller?.seller_id ?? seller?.id ?? seller?.user_id ?? null;
      const chosenName = seller?.nickname || seller?.name || seller?.nome || '';

      if (!chosenId) return toast.error('Vendedor', 'Vendedor selecionado sem ID.');

      ensureEditingShape();
      setSellerOnHeader({ seller_id: chosenId, seller_name: chosenName });
      state.editing.header.seller_manual = true;

      toast.success('Vendedor', `✅ Selecionado: ${chosenName || 'Vendedor'}`);
    },
    opts: {
      title: 'Buscar Vendedor',
      placeholder: 'Digite nome, apelido ou documento do vendedor...',
      limit: 50,
    },
  });
}

/* ──────────────────────────────────────────────────────────────
  Copy budget
────────────────────────────────────────────────────────────── */
async function copyCurrentBudget() {
  if (!state.selectedId) {
    return toast.warn('Atenção', 'Salve ou abra um orçamento existente antes de copiar.');
  }

  return copyBudget(state.selectedId);
}

/* ──────────────────────────────────────────────────────────────
  Tabs
────────────────────────────────────────────────────────────── */
export function activateTab(which) {
  const isList = which === 'list';

  const listPanel = document.querySelector('[data-panel="list"]');
  const editorPanel = document.querySelector('[data-panel="editor"]');

  console.log('[budgets][tabs]', {
    which,
    listPanel,
    editorPanel,
    editorInsideList: Boolean(
      editorPanel?.closest('[data-panel="list"]')
    ),
  });

  document.querySelectorAll('.tab').forEach((btn) => {
    const active = btn.dataset.tab === which;

    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (listPanel) {
    listPanel.classList.toggle('hidden', !isList);
    listPanel.hidden = !isList;
    listPanel.setAttribute(
      'aria-hidden',
      isList ? 'false' : 'true'
    );

    listPanel.style.setProperty(
      'display',
      isList ? 'block' : 'none',
      'important'
    );
  }

  if (editorPanel) {
    editorPanel.classList.toggle('hidden', isList);
    editorPanel.hidden = isList;
    editorPanel.setAttribute(
      'aria-hidden',
      isList ? 'true' : 'false'
    );

    editorPanel.style.setProperty(
      'display',
      isList ? 'none' : 'block',
      'important'
    );
  }

  if (!isList && editorPanel) {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  }
}

export function bindTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    bindOnce(btn, 'tabClick', 'click', () => activateTab(btn.dataset.tab));
  });
}

async function openImportBudgetsModal() {
  ensureEditingShape();

  const customerId = state.editing?.header?.customer_id;

  if (!customerId) {
    return toast.warn('Importar Orçamentos', 'Selecione um cliente antes de importar orçamentos.');
  }

  const modal = document.getElementById('importBudgetsModal');
  const backdrop = document.getElementById('importBudgetsBackdrop');
  const tbody = document.getElementById('importBudgetsTableBody');
  const searchInput =
    document.getElementById('importBudgetsSearch') ||
    modal?.querySelector('input[type="search"], input[type="text"]');

  if (!modal || !backdrop || !tbody) {
    console.error('[budgets][import] Modal de importação não encontrado no HTML.');
    return toast.error('Importar Orçamentos', 'Modal de importação não encontrado no HTML.');
  }

  modal.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  backdrop.setAttribute('aria-hidden', 'false');

  async function loadImportBudgets(q = '') {
    tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:14px;">Carregando...</td>
        </tr>
      `;

    const params = new URLSearchParams({
      status: 'ABERTO',
      operation_type_id: null,
      limit: '1000',
    });

    if (q.trim()) {
      params.set('q', q.trim());
      params.set('search', q.trim());
    }

    const out = await fetchSafe(`${getApiBase()}/api/budgets?${params.toString()}`, {
      method: 'GET',
      headers: authHeaders(),
    });

    if (!out.ok) {
      tbody.innerHTML = '';
      return toast.error('Erro', 'Não foi possível buscar os orçamentos.');
    }

    let rows = out.json?.rows || out.json?.data || out.json?.items || [];

    const localQ = q.trim().toLowerCase();

    // Fallback caso o backend ainda não filtre por q/search
    if (localQ) {
      rows = rows.filter((b) => {
        const text = [
          b.id,
          b.budget_id,
          b.customer_name,
          b.customer_email,
          b.email,
          b.status,
          b.total_amount,
          b.total,
          b.issue_date,
        ]
          .join(' ')
          .toLowerCase();

        return text.includes(localQ);
      });
    }

    if (!rows.length) {
      tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center;padding:14px;">
              Nenhum orçamento encontrado.
            </td>
          </tr>
        `;
      return;
    }

    tbody.innerHTML = rows.map((b) => `
        <tr>
          <td>
            <input type="checkbox" class="chkImportBudget" value="${b.id || b.budget_id}">
          </td>
          <td>${b.id || b.budget_id}</td>
          <td>${String(b.issue_date || '').slice(0, 10)}</td>
          <td>${escapeHtml(b.customer_name || '')}</td>
          <td>${Number(b.total_amount || b.total || 0).toFixed(2)}</td>
          <td>${escapeHtml(b.status || '')}</td>
        </tr>
      `).join('');
  }

  await loadImportBudgets(searchInput?.value || '');

  if (searchInput && !searchInput.dataset.boundImportBudgetsSearch) {
    const handleSearch = debounce(async () => {
      await loadImportBudgets(searchInput.value || '');
    }, 350);

    searchInput.addEventListener('input', handleSearch);

    searchInput.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      await loadImportBudgets(searchInput.value || '');
    });

    searchInput.dataset.boundImportBudgetsSearch = '1';
  }

  searchInput?.focus();
}

function closeImportBudgetsModal() {
  const modal = document.getElementById('importBudgetsModal');
  const backdrop = document.getElementById('importBudgetsBackdrop');

  modal?.classList.add('hidden');
  backdrop?.classList.add('hidden');

  modal?.setAttribute('aria-hidden', 'true');
  backdrop?.setAttribute('aria-hidden', 'true');
}

async function applyImportBudgets() {
  const ids = Array.from(document.querySelectorAll('.chkImportBudget:checked'))
    .map((el) => Number(el.value))
    .filter(Boolean);

  if (!ids.length) {
    return toast.warn('Importar Orçamentos', 'Selecione pelo menos um orçamento.');
  }

  for (const id of ids) {
    const out = await fetchSafe(ROUTES.budgetById(id), {
      method: 'GET',
      headers: authHeaders(),
    });

    if (!out.ok) continue;

    const b = out.json || {};
    const items = Array.isArray(b.items) ? b.items : [];

    for (const it of items) {
      state.editing.items.push({
        ...it,
        source_budget_id: id,
        quantity: Number(it.quantity || 0),
        unit_price: Number(it.unit_price || 0),
        discount_value: Number(it.discount_value || 0),
      });
    }
  }

  renderItems();
  recalcTotals();
  closeImportBudgetsModal();

  toast.success('Importar Orçamentos', '✅ Itens importados com sucesso.');
}

/* ──────────────────────────────────────────────────────────────
  Bind Editor UI
────────────────────────────────────────────────────────────── */
export function bindEditorUI() {
  const btnFechar = $('#btnFechar');
  const btnSalvar = $('#btnSalvar');
  const btnImprimir = $('#btnImprimir');
  const btnCopiarOrcamento = $('#btnCopiarOrcamento');
  const btnImportarOrcamentos =
    document.getElementById('btnImportarOrcamentos');

  const btnPedido = $('#btnTransformarPedido');

  if (btnPedido) {
    btnPedido.hidden = true;
  }

  const btnVendedor =
    document.getElementById('btnVendedor');

  const btnRentabilidade =
    document.getElementById('btnRentabilidade');

  bindOnce(btnImportarOrcamentos, 'importBudgets', 'click', async () => {
    await openImportBudgetsModal();
  });

  bindOnce(document.getElementById('btnCloseImportBudgets'), 'closeImportBudgets', 'click', closeImportBudgetsModal);

  bindOnce(document.getElementById('btnCancelImportBudgets'), 'cancelImportBudgets', 'click', closeImportBudgetsModal);

  bindOnce(document.getElementById('importBudgetsBackdrop'), 'backdropImportBudgets', 'click', closeImportBudgetsModal);

  bindOnce(document.getElementById('btnApplyImportBudgets'), 'applyImportBudgets', 'click', async () => {
    await applyImportBudgets();
  });

  bindOnce(btnFechar, 'closeEditor', 'click', () => closeEditor());

  bindOnce(
    btnSalvar,
    'saveBudget',
    'click',
    async (event) => {
      event.preventDefault();

      console.log(
        '[budgets] Clique em SALVAR'
      );

      try {
        await saveBudget();

        /*
         * saveBudget deve atualizar state.selectedId depois
         * de criar ou atualizar o orçamento.
         */
        setNfePreviewBudgetId(
          state.selectedId
        );

        syncCopyButtonState();

        try {
          const module =
            await import('./budgets.list.js');

          await module.fetchBudgets();
        } catch (error) {
          console.warn(
            '[budgets] reload list after save:',
            error?.message || error
          );
        }
      } catch (error) {
        console.error(
          '[budgets] saveBudget error:',
          error
        );
      }
    }
  );

  bindOnce(btnImprimir, 'printBudget', 'click', () => {
    state.selectedId ? openPdf(state.selectedId) : window.print();
  });

  bindOnce(btnCopiarOrcamento, 'copyBudget', 'click', async () => {
    await copyCurrentBudget();
  });

  bindOnce(btnPedido, 'toOrder', 'click', () => {
    if (!state.selectedId) {
      return toast.warn('Atenção', 'Salve o orçamento antes de transformar em pedido.');
    }
    transformToOrder(state.selectedId);
  });

  try { setupObsModal(); } catch { }

  bindOnce(btnVendedor, 'pickSeller', 'click', async () => {
    await openSellerPicker();
  });

  bindOnce(btnRentabilidade, 'rentability', 'click', async () => {
    if (!state.editing?.items?.length) {
      return toast.warn('Rentabilidade', 'Adicione itens no orçamento para calcular.');
    }

    const out = await openRentabilityBudgetsModal({
      title: 'Rentabilidade do Orçamento',
      items: state.editing.items,
      freight_value: Number(document.getElementById('frete')?.value || 0),
    });

    if (!out?.ok) return;
    console.log('[budgets][rentability] snapshot', out.data);
    toast.success('Rentabilidade', '✅ Cálculo atualizado.');
  });

  const btnCliBuscar = $('#btnCliBuscar');
  bindOnce(btnCliBuscar, 'customerSearchBtn', 'click', openCustomerPicker);

  const cliBusca = $('#cliBusca');
  bindOnce(cliBusca, 'customerSearchEnter', 'keydown', (e) => {
    if (e.key === 'Enter') openCustomerPicker();
  });

  if (cliBusca && !cliBusca.dataset.boundCustomerInput) {
    const handleClientTyping = debounce(async () => {
      const q = cliBusca.value.trim();
      if (q.length < 3) return;
      await searchCustomerInline(q);
    }, 450);

    cliBusca.addEventListener('input', handleClientTyping);
    cliBusca.dataset.boundCustomerInput = '1';
  }

  const manufacturerRefInput = $('#manufacturerRef');

  if (manufacturerRefInput && !manufacturerRefInput.dataset.boundManufacturerRefInput) {
    const handleManufacturerRefTyping = debounce(async () => {
      const ref = manufacturerRefInput.value.trim();
      if (ref.length < 2) return;
      await searchProductByManufacturerRef(ref, { silent: true });
    }, 500);

    manufacturerRefInput.addEventListener('input', handleManufacturerRefTyping);
    manufacturerRefInput.dataset.boundManufacturerRefInput = '1';
  }

  bindOnce(manufacturerRefInput, 'manufacturerRefEnter', 'keydown', async (e) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    e.stopPropagation();

    const ref = manufacturerRefInput.value.trim();
    if (!ref) return;

    const product = await searchProductByManufacturerRef(ref);
    if (product) document.getElementById('qtd')?.focus();
  });

  const btnProdBuscar = $('#btnProdBuscar');
  bindOnce(btnProdBuscar, 'productSearchBtn', 'click', () => {
    openProductsModalSearch({
      apiBase: getApiBase(),
      async onPick(p) {
        await applyProductSelection(p);
      },
    });
  });

  const prodInput = $('#prodBusca');
  if (prodInput && !prodInput.dataset.boundProductInput) {
    const handleProductTyping = debounce(async () => {
      const q = prodInput.value.trim();
      if (q.length < 3) return;
      await searchProductInline(q);
    }, 450);

    prodInput.addEventListener('input', handleProductTyping);
    prodInput.dataset.boundProductInput = '1';
  }

  bindOnce(prodInput, 'productEnter', 'keydown', (e) => {
    if (e.key !== 'Enter') return;

    e.preventDefault();
    e.stopPropagation();

    const q = prodInput.value.trim();

    if (q.length >= 3) {
      searchProductInline(q);
      return;
    }

    openProductsModalSearch({
      apiBase: getApiBase(),
      async onPick(p) {
        await applyProductSelection(p);
        document.getElementById('qtd')?.focus();
      },
    });
  });

  const btnAddItem = $('#btnAddItem');

  bindOnce(btnAddItem, 'addItem', 'click', async () => {
    try {
      const m = await import('./budgets.items.js');

      const beforeCount = state.editing?.items?.length || 0;

      await m.addItem();

      const afterCount = state.editing?.items?.length || 0;

      if (afterCount <= beforeCount) {
        return;
      }

      console.log(
        '[budgets][autosave] Produto adicionado. Salvando orçamento...'
      );

      try {
        await saveBudget();

        // ✅ Atualiza recursos que dependem do ID
        // principalmente quando era um orçamento NOVO
        setNfePreviewBudgetId(state.selectedId);
        syncCopyButtonState();

        console.log(
          '[budgets][autosave] Orçamento salvo com sucesso.',
          { budgetId: state.selectedId }
        );
      } catch (saveError) {
        console.error(
          '[budgets][autosave] Erro ao salvar orçamento:',
          saveError
        );

        toast.error(
          'Autosave',
          'O produto foi adicionado, mas não foi possível salvar o orçamento automaticamente.'
        );
      }
    } catch (error) {
      console.error(
        '[budgets][addItem] Erro ao adicionar produto:',
        error
      );
    }
  });

  const freteInput = $('#frete');
  bindOnce(freteInput, 'freteInput', 'input', recalcTotals);

  const btnFrete = document.getElementById('btnFreteModal');
  bindOnce(btnFrete, 'freteModal', 'click', async () => {
    const freteEl = document.getElementById('frete');
    if (!freteEl) return toast.error('Erro', 'Campo #frete não encontrado.');

    const h = state.editing?.header || {};
    const currentFrete = Number(freteEl.value || h.freight_value || 0);

    const shipping = state.editing?.shipping || {};
    const calculatedGrossWeight = calculateBudgetGrossWeight();

    const out = await openOrdersDeliveryModal({
      freight_value: currentFrete,
      freight_mode: Number(
        shipping.freight_mode ??
        h.freight_mode ??
        (currentFrete > 0 ? 0 : 9)
      ),

      carrier_name: shipping.carrier_name ?? h.carrier_name,
      carrier_cnpj_cpf: shipping.carrier_cnpj_cpf ?? h.carrier_cnpj_cpf,
      carrier_ie: shipping.carrier_ie ?? h.carrier_ie,
      carrier_address: shipping.carrier_address ?? h.carrier_address,

      carrier_number: shipping.carrier_number ?? h.carrier_number,
      carrier_complement: shipping.carrier_complement ?? h.carrier_complement,
      carrier_district: shipping.carrier_district ?? h.carrier_district,
      carrier_city: shipping.carrier_city ?? h.carrier_city,
      carrier_state: shipping.carrier_state ?? h.carrier_state,
      carrier_zipcode: shipping.carrier_zipcode ?? h.carrier_zipcode,

      vehicle_plate: shipping.vehicle_plate ?? h.vehicle_plate,
      vehicle_state: shipping.vehicle_state ?? h.vehicle_state,
      vehicle_rntc: shipping.vehicle_rntc ?? h.vehicle_rntc,

      volumes: shipping.volumes ?? h.volumes,
      volume_quantity: shipping.volumes ?? shipping.volume_quantity ?? h.volumes ?? h.volume_quantity,
      volume_species: shipping.volume_species ?? h.volume_species,
      volume_brand: shipping.volume_brand ?? h.volume_brand,
      volume_numbering: shipping.volume_numbering ?? h.volume_numbering,
      gross_weight:
        calculatedGrossWeight > 0
          ? calculatedGrossWeight
          : (shipping.gross_weight ?? h.gross_weight ?? 0),
      net_weight: shipping.net_weight ?? h.net_weight,

      notes: shipping.notes ?? h.notes,
    });

    if (!out?.ok) return;

    const v = Number(out.data.freight_value || 0);
    freteEl.value = v.toFixed(2);

    ensureEditingShape();

    const normalizedShipping = {
      ...(state.editing.shipping || {}),
      ...out.data,

      freight_value: Number(out.data.freight_value || 0),
      freight_mode: Number(out.data.freight_mode ?? 9),

      carrier_number: out.data.carrier_number ?? null,
      carrier_complement: out.data.carrier_complement ?? null,
      carrier_district: out.data.carrier_district ?? null,
      carrier_zipcode: out.data.carrier_zipcode ?? null,
      vehicle_rntc: out.data.vehicle_rntc ?? null,
      notes: out.data.notes ?? null,

      volumes: Number(out.data.volumes ?? out.data.volume_quantity ?? 0),
      gross_weight:
        calculatedGrossWeight > 0
          ? calculatedGrossWeight
          : Number(out.data.gross_weight || 0),
    };

    state.editing.shipping = normalizedShipping;

    Object.assign(state.editing.header, normalizedShipping);

    recalcTotals();
  });

  const tabelaSel = $('#tabela');
  bindOnce(tabelaSel, 'tablePriceChange', 'change', async () => {
    await onTabelaChange();
    applyFactorOverCurrentPrice();
  });

  const umSel = $('#um');
  bindOnce(umSel, 'unitChange', 'change', () => {
    applyFactorOverCurrentPrice();
  });

  if (!document.body.dataset.boundBudgetsPaymentsInit) {
    initPaymentsEditorUI().catch((e) => {
      console.warn('[budgets][payments] init UI error:', e?.message || e);
    });
    document.body.dataset.boundBudgetsPaymentsInit = '1';
  }

  setPrintEnabled(false);
  syncCopyButtonState();

  const btnFreteCarrierSearch =
    document.getElementById('btnFreteCarrierSearch');

  bindOnce(
    btnFreteCarrierSearch,
    'freteCarrierSearch',
    'click',
    () => {

      openTransportersModalSearch({
        apiBase: `${getApiBase()}/api/transporters`,

        onPick(transporter) {
          console.log(
            '[budgets][freight][transporter-picked]',
            transporter
          );

          const carrierId =
            transporter.transporter_id ??
            transporter.id ??
            null;

          const carrierName =
            transporter.legal_name ||
            transporter.name ||
            transporter.trade_name ||
            '';

          const carrierDoc =
            transporter.cnpj_cpf ||
            transporter.cnpj ||
            transporter.cpf ||
            '';

          const carrierIe =
            transporter.state_registration ||
            transporter.ie ||
            '';

          const carrierAddress =
            transporter.street ||
            transporter.address ||
            '';

          const carrierNumber =
            transporter.number ||
            '';

          const carrierComplement =
            transporter.complement ||
            '';

          const carrierDistrict =
            transporter.neighborhood ||
            transporter.district ||
            '';

          const carrierCity =
            transporter.city ||
            '';

          const carrierState =
            transporter.uf ||
            transporter.state ||
            '';

          const carrierZipcode =
            transporter.zip_code ||
            transporter.cep ||
            '';

          const vehicleRntc =
            transporter.rntrc ||
            transporter.rntc ||
            '';


          // =====================================================
          // PREENCHE CAMPOS VISUAIS DO MODAL
          // =====================================================

          const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
          };

          setValue(
            'freteCarrierId',
            carrierId
          );

          setValue(
            'freteCarrierName',
            carrierName
          );

          setValue(
            'freteCarrierDoc',
            carrierDoc
          );

          setValue(
            'freteCarrierIe',
            carrierIe
          );

          setValue(
            'freteCarrierAddress',
            carrierAddress
          );

          setValue(
            'freteCarrierNumber',
            carrierNumber
          );

          setValue(
            'freteCarrierComplement',
            carrierComplement
          );

          setValue(
            'freteCarrierDistrict',
            carrierDistrict
          );

          setValue(
            'freteCarrierCity',
            carrierCity
          );

          setValue(
            'freteCarrierState',
            carrierState
          );

          setValue(
            'freteCarrierZipcode',
            carrierZipcode
          );

          setValue(
            'freteVehicleRntc',
            vehicleRntc
          );


          // =====================================================
          // GUARDA NO STATE
          // =====================================================

          ensureEditingShape();

          state.editing.shipping = {
            ...(state.editing.shipping || {}),

            carrier_id:
              carrierId,

            carrier_name:
              carrierName,

            carrier_cnpj_cpf:
              carrierDoc,

            carrier_ie:
              carrierIe,

            carrier_address:
              carrierAddress,

            carrier_number:
              carrierNumber,

            carrier_complement:
              carrierComplement,

            carrier_district:
              carrierDistrict,

            carrier_city:
              carrierCity,

            carrier_state:
              carrierState,

            carrier_zipcode:
              carrierZipcode,

            vehicle_rntc:
              vehicleRntc,
          };


          Object.assign(
            state.editing.header,
            state.editing.shipping
          );

          toast.success(
            'Transportadora',
            `✅ Selecionada: ${carrierName || 'Transportadora'}`
          );
        },
      });
    }
  );
}



/* ──────────────────────────────────────────────────────────────
  Open / Close / Hydrate
────────────────────────────────────────────────────────────── */
export async function openEditor(id) {
  activateTab('editor');

  const editorPanel = document.querySelector('[data-panel="editor"]');

  if (!editorPanel) {
    console.error('[budgets][editor] Painel do editor não encontrado no HTML.');
    toast.error('Erro', 'O painel do editor não foi encontrado no HTML.');
    return;
  }

  state.selectedId = id || null;

  /*
   * Existing budget: enables NF-e preview.
   * New budget: disables the button until saved.
   */
  setNfePreviewBudgetId(
    state.selectedId
  );

  $('#editorTitle') &&
    ($('#editorTitle').textContent = id
      ? `Editar orçamento #${id}`
      : 'Novo orçamento');

  state.editing = {
    header: {
      customer_id: null,
      issue_date: todayInSaoPaulo(),
      status: 'ABERTO',
      notes: '',
      freight_value: 0,

      payment_method_id: null,
      payment_due_date: null,
      payment_form_id: null,
      payment_term_id: null,

      price_id: null,
      price_table_name: '',

      seller_id: null,
      seller_name: '',
      seller_manual: false,
    },

    items: [],

    shipping: null,

    payments: [],
    payment_installments: [],
  };

  if (!state.selectedId) applyPriceModeToNewBudget();

  $('#dtEmissao') && ($('#dtEmissao').value = state.editing.header.issue_date);
  $('#status') && ($('#status').value = 'ABERTO');
  await loadBudgetOperationTypes();
  bindBudgetOperationType();
  await loadBudgetOperationTypes();
  $('#numero') && ($('#numero').value = '');
  clearCustomerFields();
  clearSellerOnHeader();

  $('#itemsTableBody') && ($('#itemsTableBody').innerHTML = '');
  $('#frete') && ($('#frete').value = '0.00');
  $('#obs') && ($('#obs').value = '');

  const formaPagamento = $('#formaPagamento');
  if (formaPagamento) formaPagamento.value = '';

  const condicaoPagamento = $('#condicaoPagamento');
  if (condicaoPagamento) condicaoPagamento.value = '';

  const dataVencimento = $('#dataVencimento');
  if (dataVencimento) dataVencimento.value = '';

  if ($('#prodBusca')) {
    $('#prodBusca').value = '';
    $('#prodBusca').dataset.sku = '';
    $('#prodBusca').dataset.pid = '';
    $('#prodBusca').dataset.desc = '';
    $('#prodBusca').dataset.unit = '';
  }

  if ($('#manufacturerRef')) {
    $('#manufacturerRef').value = '';
  }

  resetTabelaSelect();
  resetUMSelect();
  resetGradeSelect();

  await resetPaymentsEditorState();
  await renderPaymentsEditorUI();

  setPrintEnabled(!!state.selectedId);
  syncCopyButtonState();

  if (!id) {
    await autoPickSellerFromLogin({ force: true });

    try {
      await applyDefaultPaymentsForNewBudget();
      await renderPaymentsEditorUI();
    } catch (e) {
      console.warn('[budgets][payments] default new budget error:', e?.message || e);
    }
  }

  if (id) {
    const out = await fetchSafe(ROUTES.budgetById(id), { headers: authHeaders(), method: 'GET' });

    if (!out.ok) {
      if (handleAuthFail(out.status, out.text)) return;
      toast.error('Erro', 'Não foi possível carregar o orçamento.');
      return;
    }

    hydrateEditor(out.json || {});

    try {
      await loadPaymentsForBudgetEditor(id);
      await renderPaymentsEditorUI();
    } catch (e) {
      console.warn('[budgets][payments] load editor payments error:', e?.message || e);
      toast.warn('Pagamentos', 'Orçamento carregado, mas os pagamentos não puderam ser carregados.');
    }
  }

  recalcTotals();
}

export function closeEditor() {
  state.selectedId = null;
  state.editing = null;

  /*
   * Clear the NF-e preview budget.
   */
  setNfePreviewBudgetId(null);

  activateTab('list');
  setPrintEnabled(false);
  syncCopyButtonState();
}

export function hydrateEditor(b) {
  /*
   * REABERTURA DE ORÇAMENTO = DATA DE HOJE
   *
   * Ao reabrir um orçamento antigo a "Data" é atualizada para hoje,
   * porque é essa data-base que as parcelas do modal de Pagamentos
   * usam ao serem regeneradas.
   *
   * A data antiga do banco continua valendo até que o usuário salve.
   */
  const issueDate = todayInSaoPaulo();

  $('#dtEmissao') && ($('#dtEmissao').value = issueDate);

  $('#status') && ($('#status').value = b.status || 'ABERTO');
  loadBudgetOperationTypes().then(() => {
    setBudgetOperationType(b.operation_type_id ?? null);
  });
  $('#obs') && ($('#obs').value = b.notes || '');

  fillCustomer({
    id: b.customer_id,
    name: b.customer_name,
    tax_id: b.customer_tax_id,
    email: b.customer_email ?? b.email,
    phone: b.customer_phone ?? b.phone,
  });
  enrichCustomerContactsIfMissing(b.customer_id);
  loadCustomerCredit(b.customer_id, { silent: true });
  openCustomerStatusObservation(b.customer_id);

  const shipping = b.shipping || null;
  state.editing.shipping = shipping;

  const sellerIdFromBudget = b.seller_id ?? b.vendedor_id ?? null;
  const sellerNameFromBudget = b.seller_name ?? b.vendedor_nome ?? '';

  if (sellerIdFromBudget) {
    setSellerOnHeader({ seller_id: sellerIdFromBudget, seller_name: sellerNameFromBudget });
    state.editing.header.seller_manual = false;
  } else {
    autoPickSellerByCustomer(b.customer_id, { force: true });
  }

  const freightValue = Number(
    shipping?.freight_value ??
    b.freight_value ??
    0
  );

  $('#frete') && ($('#frete').value = freightValue.toFixed(2));

  const legacyPmId = b.payment_method_id ?? b.paymentMethods_id ?? b.payment_form_id ?? null;
  const legacyDue =
    b.payment_due_date ||
    b.due_date ||
    b.boleto_due_date ||
    b.data_vencimento_boleto ||
    b.data_vencimento ||
    null;

  if (legacyPmId != null) {
    const forma = $('#formaPagamento');
    if (forma) {
      forma.value = String(legacyPmId);
      try {
        onPaymentMethodChange();
      } catch { }
    }
  }

  const vencInp = $('#dataVencimento');
  if (vencInp) vencInp.value = legacyDue ? String(legacyDue).slice(0, 10) : '';

  ensureEditingShape();

  state.editing.header.customer_id = b.customer_id ?? null;
  state.editing.header.price_id = b.price_id ?? b.tabela_preco_id ?? null;
  state.editing.header.price_table_name = b.price_table_name ?? '';
  state.editing.header.issue_date = issueDate;
  state.editing.header.status = b.status || 'ABERTO';
  state.editing.header.operation_type_id = b.operation_type_id ?? null;
  state.editing.header.notes = b.notes || '';
  state.editing.header.freight_value = freightValue;
  state.editing.header.freight_mode = Number(shipping?.freight_mode ?? b.freight_mode ?? 9);

  if (shipping) {
    Object.assign(state.editing.header, shipping);
  }

  state.editing.header.global_discount_type =
    (b.global_discount_type || 'value') === 'percent' ? 'percent' : 'value';

  state.editing.header.global_discount_value = Number(b.global_discount_value || 0);
  state.editing.header.global_discount_amount = Number(b.global_discount_amount || 0);

  state.editing.header.payment_method_id = legacyPmId != null ? String(legacyPmId) : null;
  state.editing.header.payment_due_date = legacyDue ? String(legacyDue).slice(0, 10) : null;
  state.editing.header.payment_form_id = b.payment_form_id ?? null;
  state.editing.header.payment_term_id = b.payment_term_id ?? null;

  state.editing.header.seller_id = state.editing.header.seller_id || null;
  state.editing.header.seller_name = state.editing.header.seller_name || '';

  if (!state.editing.header.price_id && b.customer_id) {
    loadCustomerPriceTable(b.customer_id, { silent: true });
  }

  state.editing.items = (b.items || []).map((it) => ({
    product_id: it.product_id ?? it.pid ?? it.id ?? null,

    sku:
      it.sku ??
      it.product_code ??
      '',

    manufacturer_ref:
      it.manufacturer_ref ??
      it.manufacturerRef ??
      it.ref_fab ??
      it.refFab ??
      '',

    description:
      it.description ??
      '',

    unit: it.unit,
    unit_factor: Number(it.unit_factor || 1) || 1,

    quantity: Number(it.quantity || 0),
    barcode_id: it.barcode_id ?? null,
    unit_weight_kg: Number(it.unit_weight_kg ?? it.weight_kg ?? 0),
    weight_kg: Number(it.weight_kg ?? it.unit_weight_kg ?? 0),
    unit_price: Number(it.unit_price || 0),
    discount_value: Number(it.discount_value || 0),

    grade_id: it.grade_id ?? it.product_grade_id ?? it.produto_grade_id ?? null,
    grade:
      it.grade ??
      it.grade_name ??
      it.grade_desc ??
      it.grade_nome ??
      it.grade_label ??
      it.grade_text ??
      '',

    price_id: it.price_id ?? it.tabela_preco_id ?? null,
    commission_id: it.commission_id ?? null,

    lot_id: it.lot_id ?? null,
    lot_code: it.lot_code ?? '',
    lot_expiration: it.lot_expiration ?? null,
    expiry_date: it.expiry_date ?? it.lot_expiration ?? null,
    qty_available_lot: Number(it.qty_available_lot ?? 0),

    stock_available: Number(it.stock_available ?? 0),

    override_stock: !!it.override_stock,
    override_token: it.override_token ?? null,
    override_approved_at: it.override_approved_at ?? null,
    override_approved_by: it.override_approved_by ?? null,
    override_reason: it.override_reason ?? null,
    override_qty: Number(it.override_qty ?? 0),
    override_lot_id: it.override_lot_id ?? null,
  }));

  state.editing.payments = Array.isArray(state.editing.payments) ? state.editing.payments : [];
  state.editing.payment_installments = Array.isArray(state.editing.payment_installments)
    ? state.editing.payment_installments
    : [];

  renderItems();
  import('./budgets.items.js').then((m) => m.enrichMissingGradeNames?.());

  state.selectedId =
    b.id ||
    b.budget_id ||
    state.selectedId;

  setNfePreviewBudgetId(
    state.selectedId
  );

  setPrintEnabled(
    !!state.selectedId
  );

  syncCopyButtonState();

  import('./budgets.items.js').then((m) => {
    m.syncGlobalDiscountHiddenFields?.();
    m.recalcTotals?.();
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function openCustomerObservationCustomModal(row) {
  // Remove modal anterior, se existir
  const old = document.getElementById('customerObservationModal');
  if (old) old.remove();

  const note = escapeHtml(row?.note || '');

  const status = row?.status_type_id
    ? `Status #${row.status_type_id}`
    : 'Observação';

  const updatedAt = row?.updated_at
    ? new Date(row.updated_at).toLocaleString('pt-BR')
    : '-';

  const modal = document.createElement('div');

  modal.id = 'customerObservationModal';

  // IMPORTANTE:
  // modals.css só exibe .modal quando possui .is-open
  modal.className = 'modal modal-width-5 modal-height-3 is-open';

  modal.setAttribute('aria-hidden', 'false');

  modal.innerHTML = `
    <div
      class="modal__backdrop"
      data-customer-observation-close
    ></div>

    <div class="modal__dialog">
      <section
        class="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customerObservationModalTitle"
      >

        <!-- ================================================== -->
        <!-- HEADER                                             -->
        <!-- ================================================== -->
        <header class="modal__header modal-header-color-3">

          <h3
            id="customerObservationModalTitle"
            class="modal__title"
          >
            ⚠️ Observação do Cliente
          </h3>

          <button
            type="button"
            id="btnCloseCustomerObservationModal"
            class="btn btn-new btn-sm btn-icon modal__close"
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>

        </header>

        <!-- ================================================== -->
        <!-- BODY                                               -->
        <!-- ================================================== -->
        <div class="modal__body">

          <section class="modal-section">

            <div class="modal-form-grid modal-form-grid--2">

              <!-- STATUS -->
              <div class="fields fields-h-5 fields-w-12 fields-font-3">

                <label for="customerObservationStatus">
                  Status do Cliente
                </label>

                <input
                  id="customerObservationStatus"
                  type="text"
                  value="${escapeHtml(status)}"
                  class="field-input field-readonly"
                  readonly
                />

              </div>

              <!-- ÚLTIMA ATUALIZAÇÃO -->
              <div class="fields fields-h-5 fields-w-12 fields-font-3">

                <label for="customerObservationUpdatedAt">
                  Última atualização
                </label>

                <input
                  id="customerObservationUpdatedAt"
                  type="text"
                  value="${escapeHtml(updatedAt)}"
                  class="field-input field-readonly"
                  readonly
                />

              </div>

            </div>

            <div class="modal-divider"></div>

            <!-- OBSERVAÇÃO -->
            <div class="fields fields-w-full fields-font-3">

              <label for="customerObservationText">
                Observação
              </label>

              <textarea
                id="customerObservationText"
                class="field-input field-readonly"
                rows="7"
                readonly
              >${note}</textarea>

            </div>

          </section>

        </div>

        <!-- ================================================== -->
        <!-- FOOTER                                             -->
        <!-- ================================================== -->
        <footer class="modal__footer">

          <button
            type="button"
            id="btnConfirmCustomerObservationModal"
            class="btn btn-save btn-sm"
          >
            Entendi
          </button>

        </footer>

      </section>
    </div>
  `;

  document.body.appendChild(modal);

  // Impede scroll da página enquanto o modal estiver aberto
  document.body.classList.add('modal-open');

  // ============================================================
  // FECHAR MODAL
  // ============================================================
  const closeModal = () => {
    document.removeEventListener('keydown', onKeyDown);

    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    document.body.classList.remove('modal-open');

    modal.remove();
  };

  // ============================================================
  // ESC
  // ============================================================
  const onKeyDown = (event) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      event.preventDefault();
      closeModal();
    }
  };

  // ============================================================
  // BOTÃO X
  // ============================================================
  modal
    .querySelector('#btnCloseCustomerObservationModal')
    ?.addEventListener('click', closeModal);

  // ============================================================
  // BOTÃO ENTENDI
  // ============================================================
  modal
    .querySelector('#btnConfirmCustomerObservationModal')
    ?.addEventListener('click', closeModal);

  // ============================================================
  // CLIQUE NO FUNDO
  // ============================================================
  modal
    .querySelector('[data-customer-observation-close]')
    ?.addEventListener('click', closeModal);

  // ============================================================
  // TECLA ESC
  // ============================================================
  document.addEventListener('keydown', onKeyDown);

  modal
    .querySelector('#btnConfirmCustomerObservationModal')
    ?.focus();
}

async function openCustomerStatusObservation(customerId) {
  const cid = String(customerId || '').trim();
  if (!cid) return;

  try {
    const out = await fetchSafe(`${getApiBase()}/api/customers/${encodeURIComponent(cid)}/status`, {
      method: 'GET',
      headers: authHeaders(),
    });

    if (!out.ok) return;

    const row = out.json?.data || out.json?.row || null;
    const note = String(row?.note || '').trim();

    if (!note) return;

    openCustomerObservationCustomModal(row);
  } catch (err) {
    console.warn('[budgets][customer-status] erro:', err?.message || err);
  }
}

/* ──────────────────────────────────────────────────────────────
  Customer picker (modal)
────────────────────────────────────────────────────────────── */
function openCustomerPicker() {
  openCustomersModalSearch({
    apiBase: getApiBase(),

    async onPick(c) {
      const cid = c.customer_id || c.id;

      const legalName =
        c.legal_name ||
        c.trade_name ||
        '';

      const tradeName =
        c.trade_name ||
        c.legal_name ||
        '';

      fillCustomer({
        id: cid,
        name: legalName,
        legal_name: legalName,
        trade_name: tradeName,
        tax_id: c.tax_id || '',
        email: c.email || '',
        phone: c.phone_number || c.mobile_number || '',
      });

      /*
      * Campo "Cliente" = razão social.
      */
      const customerInput = $('#cliBusca');

      if (customerInput) {
        customerInput.value = legalName;
      }

      /*
      * Campo "Nome Fantasia".
      * Ajuste o seletor caso o ID no HTML seja diferente.
      */
      const tradeNameInput = $('#cliNome');

      if (tradeNameInput) {
        tradeNameInput.value = tradeName;
      }

      enrichCustomerContactsIfMissing(cid);
      await Promise.all([
        loadCustomerPriceTable(cid),
        loadCustomerCredit(cid),
      ]);
      openCustomerStatusObservation(cid);

      autoPickSellerByCustomer(cid, {
        force: true,
      });
    },
  });
}

// (opcional) export para testes no console
export const __seller = {
  setSellerOnHeader,
  clearSellerOnHeader,
  autoPickSellerFromLogin,
  autoPickSellerByCustomer,
};
