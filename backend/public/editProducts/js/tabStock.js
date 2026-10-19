// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tabStock.js — Aba Stock/Estoque + Lotes/Validade                     ║
// ║ PRODNEX ERP — ESM                                                    ║
// ║                                                                      ║
// ║ ✅ Mantém: stock_qty / stock_min / stock_max                         ║
// ║ ✅ Adiciona: readonly product_stock_id no formulário                 ║
// ║ ✅ Adiciona: productsStockLots (lote + validade + operações)         ║
// ║ ✅ Modal: usa <dialog id="dlgLot"> (novo HTML)                       ║
// ║ ✅ Classes: usa btn/btn-sm/btn-primary/btn-flat (CONSART)            ║
// ║ ✅ Alterna: STOCK_SIMPLE / STOCK_WITH_LOT via appFeatures           ║
// ║ ✅ Exporta: initEstoqueTab + initStockTab (compat selectLoads.js)    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { showCenterModal } from "../../includes/js/centerAlertModal.js";

/**
 * Alias compatível com seu selectLoads.js
 */
export async function initEstoqueTab(ctx, { productId, productCode, initialProductStockId } = {}) {
  // initialProductStockId is kept only for backward compatibility with callers.
  // It is intentionally NOT used to resolve the current product stock because it
  // may belong to a previously opened product/tab.
  return initStockTab(ctx, { productId, productCode, initialProductStockId });
}

/**
 * Aba Estoque (agregado) + Lotes (detalhado)
 */
export async function initStockTab(ctx, { productId, productCode, initialProductStockId } = {}) {
  if (!ctx) throw new Error('ctx não informado (tabStock.js)');
  if (!productId) throw new Error('productId não informado (tabStock.js)');

  // Prefer the product_code explicitly supplied by the caller. For backward
  // compatibility, resolve it from the current page URL when necessary.
  const currentProductCode = String(
    productCode ??
    new URLSearchParams(window.location.search).get('product_code') ??
    ''
  ).trim();

  if (!currentProductCode) {
    throw new Error('productCode não informado (tabStock.js)');
  }

  /* ──────────────────────────────────────────────────────────────
     SELECTORS (Stock legado)
  ─────────────────────────────────────────────────────────────── */
  const STOCK_FIELDS = {
    form: '#form-estoque',
    id: '#product_stock_id', // ✅ NOVO (readonly)
    qty: '#stock_qty',
    min: '#stock_min',
    max: '#stock_max',
  };

  /* ──────────────────────────────────────────────────────────────
     SELECTORS (Lotes) — compatível com o HTML NOVO (dialog dlgLot)
  ─────────────────────────────────────────────────────────────── */
  const LOT_FIELDS = {
    wrap: '#lot-wrap',
    hint: '#lot-hint',
    toolbar: '#lot-toolbar',
    btnRefresh: '#btn-lot-refresh',
    btnNew: '#btn-lot-new',
    btnFefo: '#btn-lot-fefo',

    fQ: '#lot-q',
    fOnlyAvailable: '#lot-only-available',
    fOrderBy: '#lot-orderby',
    fDir: '#lot-dir',
    fLimit: '#lot-limit',

    tbody: '#lot-tbody',
    paging: '#lot-paging',

    // Modal (NOVO)
    modalDialog: '#dlgLot',
    modalTitle: '#dlgLotTitle',
    btnCloseModal: '#lot-modal-close',
    btnCancelModal: '#lot-modal-cancel',
    btnSaveModal: '#lot-modal-save',
    btnDeleteModal: '#lot-modal-delete',

    // Alerta local exclusivo da aba Estoque/Lotes
    lotAlertDialog: '#dlgLotAlert',
    lotAlertIcon: '#dlgLotAlertIcon',
    lotAlertTitle: '#dlgLotAlertTitle',
    lotAlertMessage: '#dlgLotAlertMessage',
    lotAlertOk: '#btnLotAlertOk',
    lotAlertCancel: '#btnLotAlertCancel',

    mLotId: '#mLotId',
    mProductGradeId: '#mProductGradeId',
    btnCreateGrade: '#btnCreateGradeFromLot',

    // Modal rápido de grade
    gradeDialog: '#dlgCreateGrade',
    gradeDialogTitle: '#dlgCreateGradeTitle',
    gradeDialogClose: '#btnCloseCreateGrade',
    gradeDialogCancel: '#btnCancelCreateGrade',
    gradeDialogSave: '#btnSaveCreateGrade',
    gradeCatalog: '#newGradeId',
    gradeStock: '#newGradeStock',
    mLotCode: '#mLotCode',
    mExpiresAt: '#mExpiresAt',
    mQtyOnHand: '#mQtyOnHand',
    mCostUnit: '#mCostUnit',
    mNfeKey: '#mNfeKey',
    mNfeItemSeq: '#mNfeItemSeq',

    mFiscalPanel: '#mFiscalPanel',
    mFiscalStatus: '#mFiscalStatus',
    mFiscalSubtitle: '#mFiscalSubtitle',

    btnApplyFiscalCostRule: '#btnApplyFiscalCostRule',

    mInboundInvoiceId: '#mInboundInvoiceId',
    mInboundItemId: '#mInboundItemId',
    mSupplierProductCode: '#mSupplierProductCode',

    mIcmsCst: '#mIcmsCst',
    mIcmsBase: '#mIcmsBase',
    mIcmsRate: '#mIcmsRate',
    mIcmsValue: '#mIcmsValue',

    mIcmsStBase: '#mIcmsStBase',
    mIcmsStRate: '#mIcmsStRate',
    mIcmsStValue: '#mIcmsStValue',

    mFiscalFractionPanel: '#mFiscalFractionPanel',
    mFiscalFractionHint: '#mFiscalFractionHint',
    mInboundQuantity: '#mInboundQuantity',
    mUnitIcmsBase: '#mUnitIcmsBase',
    mUnitIcmsValue: '#mUnitIcmsValue',
    mUnitIcmsStBase: '#mUnitIcmsStBase',
    mUnitIcmsStValue: '#mUnitIcmsStValue',
    mPreviewQuantity: '#mPreviewQuantity',
    mPreviewIcmsBase: '#mPreviewIcmsBase',
    mPreviewIcmsValue: '#mPreviewIcmsValue',
    mPreviewIcmsStBase: '#mPreviewIcmsStBase',
    mPreviewIcmsStValue: '#mPreviewIcmsStValue',
    mUnitIcmsBaseLabel: '#mUnitIcmsBaseLabel',
    mUnitIcmsValueLabel: '#mUnitIcmsValueLabel',
    mUnitIcmsStBaseLabel: '#mUnitIcmsStBaseLabel',
    mUnitIcmsStValueLabel: '#mUnitIcmsStValueLabel',
    mPreviewIcmsBaseLabel: '#mPreviewIcmsBaseLabel',
    mPreviewIcmsValueLabel: '#mPreviewIcmsValueLabel',
    mPreviewIcmsStBaseLabel: '#mPreviewIcmsStBaseLabel',
    mPreviewIcmsStValueLabel: '#mPreviewIcmsStValueLabel',

    mQtyReserved: '#mQtyReserved',

    opQty: '#lotOpQty',
    btnReserve: '#lotOpReserve',
    btnUnreserve: '#lotOpUnreserve',
    btnConsume: '#lotOpConsume',
    fShowInactive: '#lot-show-inactive',
  };

  const $ = (sel) => document.querySelector(sel);
  let __currentFiscalLot = null;

  const STOCK_FEATURE_CODE = 'PRODUCT_STOCK_MODE';
  const STOCK_MODES = Object.freeze({
    SIMPLE: 'STOCK_SIMPLE',
    WITH_LOT: 'STOCK_WITH_LOT',
  });

  let __stockMode = {
    mode: STOCK_MODES.WITH_LOT,
    requireLot: true,
    allowLots: true,
    source: 'SAFE_DEFAULT',
  };

  function normalizeStockModeResponse(response) {
    const root =
      response?.data?.data ??
      response?.data ??
      response ??
      {};

    const feature =
      root?.feature ??
      response?.feature ??
      root;

    const optionCode = String(
      feature?.optionCode ??
      feature?.option_code ??
      root?.optionCode ??
      root?.option_code ??
      root?.mode ??
      root?.stockMode?.mode ??
      '',
    )
      .trim()
      .toUpperCase();

    const managerMode = String(
      feature?.config?.managerMode ??
      feature?.config?.manager_mode ??
      root?.config?.managerMode ??
      root?.config?.manager_mode ??
      '',
    )
      .trim()
      .toLowerCase();

    const isSimple =
      optionCode === 'STOCK_SIMPLE' ||
      optionCode === 'SIMPLE' ||
      managerMode === 'simple';

    return {
      mode: isSimple
        ? STOCK_MODES.SIMPLE
        : STOCK_MODES.WITH_LOT,

      requireLot: !isSimple,
      allowLots: !isSimple,

      source:
        feature?.source ??
        root?.source ??
        'SAFE_DEFAULT',

      feature,
    };
  }

  async function resolveStockMode() {
    try {
      const response = await ctx.jfetch(
        `/api/app-features/${STOCK_FEATURE_CODE}/resolve?_=${Date.now()}`,
      );
      __stockMode = normalizeStockModeResponse(response);
    } catch (error) {
      console.warn('[tabStock] Falha ao resolver PRODUCT_STOCK_MODE; usando STOCK_WITH_LOT:', error?.message || error);
      __stockMode = normalizeStockModeResponse(null);
    }
    return __stockMode;
  }

  function applyStockModeUI() {
    const qtyField = $(STOCK_FIELDS.qty);
    const lotWrap = $(LOT_FIELDS.wrap);

    const isSimple =
      __stockMode.mode === STOCK_MODES.SIMPLE;

    /*
     * STOCK_SIMPLE:
     * - estoque atual editável;
     * - seção de lotes completamente escondida.
     *
     * STOCK_WITH_LOT:
     * - estoque atual calculado pelos lotes;
     * - seção de lotes visível.
     */
    if (qtyField) {
      qtyField.readOnly = !isSimple;
      qtyField.disabled = false;

      qtyField.setAttribute(
        'aria-readonly',
        String(!isSimple),
      );

      qtyField.title = isSimple
        ? 'Estoque editável no modo simples.'
        : 'Estoque calculado automaticamente pelos lotes.';
    }

    if (lotWrap) {
      lotWrap.hidden = isSimple;
      lotWrap.style.display = isSimple ? 'none' : '';
      lotWrap.setAttribute(
        'aria-hidden',
        String(isSimple),
      );
    }

    if (isSimple) {
      const dialog = $(LOT_FIELDS.modalDialog);

      if (dialog?.open) {
        dialog.close();
      }
    }
  }

  /* ──────────────────────────────────────────────────────────────
     Helpers
  ─────────────────────────────────────────────────────────────── */
  const Num = ctx.Num || {};
  const toNum = (v, def = 0) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : def;
  };
  const toNumOrNull = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const fmtNum3 = (v) => (Number(v || 0)).toLocaleString('pt-BR', {
    minimumFractionDigits: 3, maximumFractionDigits: 3
  });

  const fmtDateBR = (d) => {
    if (!d) return '—';
    const iso = String(d).slice(0, 10);
    const dt = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return iso;
    return dt.toLocaleDateString('pt-BR');
  };

  const escapeHtml = (s) => String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  function setVal(sel, v) {
    const el = $(sel);
    if (!el) return;
    el.value = (v ?? v === 0) ? String(v) : '';
  }
  function getVal(sel) {
    const el = $(sel);
    return el ? el.value : '';
  }

  function setText(sel, value, fallback = '—') {
    const el = $(sel);
    if (!el) return;

    const hasValue =
      value !== null &&
      value !== undefined &&
      value !== '';

    el.textContent = hasValue ? String(value) : fallback;
  }

  /* =====================================================================
     TAB STOCK — LOCAL NATIVE ALERT
     Mantém os alertas desta aba acima do <dialog id="dlgLot"> sem alterar
     centerAlertModal.js ou modals.css globais.
     ===================================================================== */
  const LOT_ALERT_VARIANTS = Object.freeze({
    info: { icon: 'ℹ️', title: 'Informação' },
    success: { icon: '✅', title: 'Concluído' },
    warning: { icon: '⚠️', title: 'Atenção' },
    error: { icon: '⛔', title: 'Ocorreu um erro' },
  });

  function showLotAlert({
    variant = 'warning',
    title = '',
    message = '',
    okText = 'OK',
    cancelText = 'Cancelar',
    showCancel = false,
  } = {}) {
    return new Promise((resolve) => {
      const dialog = $(LOT_FIELDS.lotAlertDialog);
      const icon = $(LOT_FIELDS.lotAlertIcon);
      const titleEl = $(LOT_FIELDS.lotAlertTitle);
      const messageEl = $(LOT_FIELDS.lotAlertMessage);
      const btnOk = $(LOT_FIELDS.lotAlertOk);
      const btnCancel = $(LOT_FIELDS.lotAlertCancel);

      // Fallback seguro caso o HTML local ainda não tenha sido publicado.
      if (!dialog) {
        const text = `${title ? `${title}\n\n` : ''}${message}`;
        if (showCancel) {
          resolve(window.confirm(text));
        } else {
          window.alert(text);
          resolve(true);
        }
        return;
      }

      // Não permite duas instâncias do mesmo alerta abertas ao mesmo tempo.
      if (dialog.open) {
        try { dialog.close(); } catch (_) { /* noop */ }
      }

      const config = LOT_ALERT_VARIANTS[variant] ?? LOT_ALERT_VARIANTS.warning;
      dialog.dataset.variant = variant;

      if (icon) icon.textContent = config.icon;
      if (titleEl) titleEl.textContent = title || config.title;
      if (messageEl) messageEl.textContent = String(message ?? '');
      if (btnOk) btnOk.textContent = okText || 'OK';

      if (btnCancel) {
        btnCancel.textContent = cancelText || 'Cancelar';
        btnCancel.classList.toggle('hidden', !showCancel);
      }

      let finished = false;

      const cleanup = () => {
        btnOk?.removeEventListener('click', handleOk);
        btnCancel?.removeEventListener('click', handleCancel);
        dialog.removeEventListener('cancel', handleCancelEvent);
        dialog.removeEventListener('close', handleDialogClose);
      };

      const finish = (result) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (dialog.open) {
          try { dialog.close(); } catch (_) { /* noop */ }
        }
        resolve(result);
      };

      const handleOk = () => finish(true);
      const handleCancel = () => finish(false);
      const handleCancelEvent = (event) => {
        event.preventDefault();
        finish(false);
      };
      const handleDialogClose = () => {
        if (!finished) finish(false);
      };

      btnOk?.addEventListener('click', handleOk);
      btnCancel?.addEventListener('click', handleCancel);
      dialog.addEventListener('cancel', handleCancelEvent);
      dialog.addEventListener('close', handleDialogClose);

      // Como este showModal() ocorre depois do dlgLot, entra por último no
      // top-layer do navegador e aparece corretamente acima do lote.
      dialog.showModal();
      window.setTimeout(() => btnOk?.focus(), 20);
    });
  }

  function fmtMoney(value) {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const number = Number(value);

    if (!Number.isFinite(number)) return '—';

    return number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  function fmtRate(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return '—';

    return `${number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}%`;
  }

  function fiscalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(String(value).replace(',', '.'));
    return Number.isFinite(number) ? number : null;
  }

  function fmtFiscalUnit(value) {
    const number = fiscalNumber(value);
    if (number === null) return '—';
    return `R$ ${number.toLocaleString('pt-BR', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    })}`;
  }

  function renderTaxNomenclatures(row = __currentFiscalLot) {
    const cst = String(
      row?.icms_cst ??
      row?.fiscal?.resolved?.cst ??
      row?.inbound_invoice_item?.icms_cst ??
      ''
    ).trim().padStart(2, '0');

    // vICMS = ICMS próprio. Campos ST são tratados separadamente.
    setText(LOT_FIELDS.mUnitIcmsBaseLabel, 'Base ICMS / unidade (vBC)');
    setText(LOT_FIELDS.mUnitIcmsValueLabel, 'ICMS / unidade (vICMS)');
    setText(LOT_FIELDS.mPreviewIcmsBaseLabel, 'Base ICMS proporcional (vBC)');
    setText(LOT_FIELDS.mPreviewIcmsValueLabel, 'ICMS proporcional (vICMS)');

    const usesSt = ['10', '30', '60', '70'].includes(cst);

    if (cst === '60') {
      setText(LOT_FIELDS.mUnitIcmsStBaseLabel, 'Base ICMS-ST retido / unidade (vBCSTRet)');
      setText(LOT_FIELDS.mUnitIcmsStValueLabel, 'ICMS-ST retido / unidade (vICMSSTRet)');
      setText(LOT_FIELDS.mPreviewIcmsStBaseLabel, 'Base ICMS-ST retido proporcional (vBCSTRet)');
      setText(LOT_FIELDS.mPreviewIcmsStValueLabel, 'ICMS-ST retido proporcional (vICMSSTRet)');
    } else if (usesSt) {
      setText(LOT_FIELDS.mUnitIcmsStBaseLabel, 'Base ICMS-ST / unidade (vBCST)');
      setText(LOT_FIELDS.mUnitIcmsStValueLabel, 'ICMS-ST / unidade (vICMSST)');
      setText(LOT_FIELDS.mPreviewIcmsStBaseLabel, 'Base ICMS-ST proporcional (vBCST)');
      setText(LOT_FIELDS.mPreviewIcmsStValueLabel, 'ICMS-ST proporcional (vICMSST)');
    } else {
      setText(LOT_FIELDS.mUnitIcmsStBaseLabel, 'Base ICMS-ST / unidade');
      setText(LOT_FIELDS.mUnitIcmsStValueLabel, 'ICMS-ST / unidade');
      setText(LOT_FIELDS.mPreviewIcmsStBaseLabel, 'Base ICMS-ST proporcional');
      setText(LOT_FIELDS.mPreviewIcmsStValueLabel, 'ICMS-ST proporcional');
    }
  }

  function ensureFiscalFractionPanel() {
    const host = $(LOT_FIELDS.mFiscalPanel);
    if (!host) return null;

    let panel = $(LOT_FIELDS.mFiscalFractionPanel);
    if (panel) return panel;

    if (!document.querySelector('#lot-fiscal-fraction-styles')) {
      const style = document.createElement('style');
      style.id = 'lot-fiscal-fraction-styles';
      style.textContent = `
  #mFiscalFractionPanel {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line, #dbe3ef);
  }

  #mFiscalFractionPanel .fiscal-fraction-title {
    font-weight: 900;
    margin-bottom: 4px;
  }

  #mFiscalFractionPanel .fiscal-fraction-hint {
    color: var(--muted, #64748b);
    margin-bottom: 10px;
  }

  #mFiscalFractionPanel .fiscal-fraction-grid {
    display: grid;

    /* Same width/behavior as Origem fiscal */
    grid-template-columns: repeat(10, minmax(105px, 1fr));

    gap: 8px;
    width: 100%;
  }

  #mFiscalFractionPanel .fiscal-fraction-card {
    min-width: 0;
    padding: 9px 10px;

    border: 1px solid var(--line, #dbe3ef);
    border-radius: var(--radius-sm, 8px);
    background: var(--card, #fff);
  }

  #mFiscalFractionPanel .fiscal-fraction-label {
    display: block;
    margin-bottom: 4px;

    color: var(--muted, #64748b);
    font-size: .72rem;
    line-height: 1.15;

    white-space: normal;
  }

  #mFiscalFractionPanel .fiscal-fraction-value {
    display: block;

    font-size: .86rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  #mFiscalFractionPanel .fiscal-preview-title {
    margin: 12px 0 8px;
    font-weight: 900;
  }

  @media (max-width: 1250px) {
    #mFiscalFractionPanel .fiscal-fraction-grid {
      grid-template-columns: repeat(5, minmax(120px, 1fr));
    }
  }

  @media (max-width: 900px) {
    #mFiscalFractionPanel .fiscal-fraction-grid {
      grid-template-columns: repeat(2, minmax(130px, 1fr));
    }
  }

  @media (max-width: 560px) {
    #mFiscalFractionPanel .fiscal-fraction-grid {
      grid-template-columns: 1fr;
    }
  }
`;
      document.head.appendChild(style);
    }

    panel = document.createElement('section');
    panel.id = 'mFiscalFractionPanel';
    panel.innerHTML = `
  <div class="fiscal-fraction-title">
    🧮 Fração fiscal por unidade da entrada
  </div>

  <div
    id="mFiscalFractionHint"
    class="fiscal-fraction-hint"
  >
    Calculada exclusivamente pela quantidade original do item na NF-e de entrada.
  </div>

  <div class="fiscal-fraction-section-labels">
    <div>Fração fiscal por unidade</div>
    <div>Prévia proporcional para a quantidade da operação</div>
  </div>

  <div class="fiscal-fraction-grid fiscal-fraction-grid--all">

    <!-- ═══════════════════════════════════════
         FRAÇÃO FISCAL POR UNIDADE
    ════════════════════════════════════════ -->

    <div class="fiscal-fraction-card">
      <span class="fiscal-fraction-label">
        Qtd. original da entrada
      </span>
      <span
        id="mInboundQuantity"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mUnitIcmsBaseLabel"
        class="fiscal-fraction-label"
      >
        Base ICMS / unidade
      </span>
      <span
        id="mUnitIcmsBase"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mUnitIcmsValueLabel"
        class="fiscal-fraction-label"
      >
        ICMS / unidade
      </span>
      <span
        id="mUnitIcmsValue"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mUnitIcmsStBaseLabel"
        class="fiscal-fraction-label"
      >
        Base ICMS-ST / unidade
      </span>
      <span
        id="mUnitIcmsStBase"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mUnitIcmsStValueLabel"
        class="fiscal-fraction-label"
      >
        ICMS-ST retido / unidade
      </span>
      <span
        id="mUnitIcmsStValue"
        class="fiscal-fraction-value"
      >—</span>
    </div>


    <!-- ═══════════════════════════════════════
         PRÉVIA PROPORCIONAL
    ════════════════════════════════════════ -->

    <div class="fiscal-fraction-card">
      <span class="fiscal-fraction-label">
        Quantidade
      </span>
      <span
        id="mPreviewQuantity"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mPreviewIcmsBaseLabel"
        class="fiscal-fraction-label"
      >
        Base ICMS proporcional
      </span>
      <span
        id="mPreviewIcmsBase"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mPreviewIcmsValueLabel"
        class="fiscal-fraction-label"
      >
        ICMS proporcional
      </span>
      <span
        id="mPreviewIcmsValue"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mPreviewIcmsStBaseLabel"
        class="fiscal-fraction-label"
      >
        Base ICMS-ST proporcional
      </span>
      <span
        id="mPreviewIcmsStBase"
        class="fiscal-fraction-value"
      >—</span>
    </div>

    <div class="fiscal-fraction-card">
      <span
        id="mPreviewIcmsStValueLabel"
        class="fiscal-fraction-label"
      >
        ICMS-ST retido proporcional
      </span>
      <span
        id="mPreviewIcmsStValue"
        class="fiscal-fraction-value"
      >—</span>
    </div>

  </div>
`;
    host.appendChild(panel);
    return panel;
  }

  function fiscalFraction(row) {
    const source = String(
      row?.fiscal_source ??
      row?.fiscal?.source ??
      ''
    ).toUpperCase();

    const calculated =
      row?.fiscal?.calculated ??
      {};

    const resolved =
      row?.fiscal?.resolved ??
      {};

    const inboundQuantity = fiscalNumber(
      row?.inbound_quantity ??
      row?.inbound_invoice_item?.quantity ??
      row?.quantity
    );

    /*
     * ============================================================
     * CASE 1
     * Real inbound NF-e exists.
     *
     * Divide original NF-e totals by original inbound quantity.
     * ============================================================
     */

    if (inboundQuantity > 0) {
      const divide = value => {
        const number = fiscalNumber(value);
        return number === null
          ? null
          : number / inboundQuantity;
      };

      return {
        mode: 'INBOUND_NFE',

        inboundQuantity,

        icmsBase:
          divide(
            resolved?.icms_base ??
            row?.icms_base
          ),

        icmsValue:
          divide(
            resolved?.icms_value ??
            row?.icms_value ??
            row?.icms
          ),

        icmsStBase:
          divide(
            resolved?.icms_st_base ??
            row?.icms_st_base
          ),

        icmsStValue:
          divide(
            resolved?.icms_st_value ??
            row?.icms_st_value
          ),
      };
    }

    /*
     * ============================================================
     * CASE 2
     * No historical NF-e item, but we have a fiscal rule.
     *
     * The calculator already works on unit cost, so use the
     * calculated unit values directly.
     * ============================================================
     */

    const hasFallbackRule =
      source === 'PRODUCT_RULE' ||
      source === 'CLASSIFICATION_RULE' ||
      source === 'PROFILE_RULE' ||
      source === 'NFE_WITH_FALLBACK';

    if (hasFallbackRule) {
      const icmsBaseUnit =
        fiscalNumber(
          calculated?.vBCUnit ??
          calculated?.icmsBaseUnit ??
          calculated?.icms_base_unit ??
          calculated?.icms_base_per_unit ??
          resolved?.icms_base
        );

      const icmsValueUnit =
        fiscalNumber(
          calculated?.vICMSUnit ??
          calculated?.icmsValueUnit ??
          calculated?.icms_value_unit ??
          calculated?.icms_value_per_unit ??
          resolved?.icms_value
        );

      const icmsStBaseUnit =
        fiscalNumber(
          calculated?.vBCSTUnit ??
          calculated?.icmsStBaseUnit ??
          calculated?.icms_st_base_unit ??
          calculated?.icms_st_base_per_unit ??
          resolved?.icms_st_base
        );

      const icmsStValueUnit =
        fiscalNumber(
          calculated?.vICMSSTUnit ??
          calculated?.icmsStValueUnit ??
          calculated?.icms_st_value_unit ??
          calculated?.icms_st_value_per_unit ??
          resolved?.icms_st_value
        );

      const hasAnyValue =
        icmsBaseUnit !== null ||
        icmsValueUnit !== null ||
        icmsStBaseUnit !== null ||
        icmsStValueUnit !== null;

      if (!hasAnyValue) {
        return null;
      }

      return {
        mode: 'FISCAL_RULE',

        // No original NF-e quantity exists.
        inboundQuantity: null,

        icmsBase: icmsBaseUnit,
        icmsValue: icmsValueUnit,
        icmsStBase: icmsStBaseUnit,
        icmsStValue: icmsStValueUnit,
      };
    }

    return null;
  }

  function renderFiscalPreview() {
    const fraction = fiscalFraction(__currentFiscalLot);
    const operationQuantity = fiscalNumber(getVal(LOT_FIELDS.opQty));
    setText(LOT_FIELDS.mPreviewQuantity, operationQuantity > 0 ? fmtNum3(operationQuantity) : null);

    const proportional = value => (
      fraction && operationQuantity > 0 && value !== null
        ? value * operationQuantity
        : null
    );

    setText(LOT_FIELDS.mPreviewIcmsBase, fmtMoney(proportional(fraction?.icmsBase)));
    setText(LOT_FIELDS.mPreviewIcmsValue, fmtMoney(proportional(fraction?.icmsValue)));
    setText(LOT_FIELDS.mPreviewIcmsStBase, fmtMoney(proportional(fraction?.icmsStBase)));
    setText(LOT_FIELDS.mPreviewIcmsStValue, fmtMoney(proportional(fraction?.icmsStValue)));
  }

  function renderFiscalFraction(row) {
    __currentFiscalLot = row || null;

    const panel =
      ensureFiscalFractionPanel();

    if (!panel) return;

    renderTaxNomenclatures(row);

    const fraction =
      fiscalFraction(row);

    const hint =
      $(LOT_FIELDS.mFiscalFractionHint);

    if (!fraction) {
      if (hint) {
        hint.textContent =
          'Não há NF-e de entrada nem regra fiscal suficiente para calcular os valores unitários.';
      }

      setText(
        LOT_FIELDS.mInboundQuantity,
        null
      );

      setText(
        LOT_FIELDS.mUnitIcmsBase,
        null
      );

      setText(
        LOT_FIELDS.mUnitIcmsValue,
        null
      );

      setText(
        LOT_FIELDS.mUnitIcmsStBase,
        null
      );

      setText(
        LOT_FIELDS.mUnitIcmsStValue,
        null
      );

      renderFiscalPreview();
      return;
    }

    /*
     * ==========================================================
     * Origin: real NF-e
     * ==========================================================
     */

    if (fraction.mode === 'INBOUND_NFE') {
      if (hint) {
        hint.textContent =
          'Totais da NF-e de entrada divididos pela quantidade original do item.';
      }

      setText(
        LOT_FIELDS.mInboundQuantity,
        fmtNum3(fraction.inboundQuantity)
      );
    }

    /*
     * ==========================================================
     * Origin: product/classification/profile fiscal rule
     * ==========================================================
     */

    else if (fraction.mode === 'FISCAL_RULE') {
      if (hint) {
        hint.textContent =
          'Valores unitários calculados pela regra fiscal. Não existe quantidade original de NF-e vinculada a este lote.';
      }

      setText(
        LOT_FIELDS.mInboundQuantity,
        'Sem NF-e'
      );
    }

    setText(
      LOT_FIELDS.mUnitIcmsBase,
      fmtFiscalUnit(fraction.icmsBase)
    );

    setText(
      LOT_FIELDS.mUnitIcmsValue,
      fmtFiscalUnit(fraction.icmsValue)
    );

    setText(
      LOT_FIELDS.mUnitIcmsStBase,
      fmtFiscalUnit(fraction.icmsStBase)
    );

    setText(
      LOT_FIELDS.mUnitIcmsStValue,
      fmtFiscalUnit(fraction.icmsStValue)
    );

    renderFiscalPreview();
  }

  function normalizeLotFiscalPayload(row = {}) {
    const inbound = row?.inbound_invoice_item ?? row?.inboundInvoiceItem ?? null;
    const fiscalRoot = row?.fiscal ?? null;
    const resolved = fiscalRoot?.resolved ?? {};
    const rule = fiscalRoot?.rule ?? {};

    return {
      ...row,
      inbound_item_id: inbound?.id ?? row?.inbound_item_id ?? null,
      inbound_invoice_id: inbound?.invoice_id ?? row?.inbound_invoice_id ?? row?.invoice_id ?? null,
      inbound_invoice_number: inbound?.invoice_number ?? row?.inbound_invoice_number ?? null,
      supplier_product_code: inbound?.nf_product_code ?? inbound?.product_code ?? row?.supplier_product_code ?? row?.nf_product_code ?? null,
      inbound_quantity: inbound?.quantity ?? row?.inbound_quantity ?? row?.quantity ?? null,
      nfe_key: inbound?.nfe_key ?? inbound?.access_key ?? row?.nfe_key ?? null,
      nfe_item_seq: inbound?.nfe_item_seq ?? row?.nfe_item_seq ?? null,
      icms_cst: resolved?.cst ?? inbound?.icms_cst ?? row?.icms_cst ?? null,
      icms_base: resolved?.icms_base ?? inbound?.icms_base ?? row?.icms_base ?? null,
      icms_rate: resolved?.icms_rate ?? inbound?.icms_rate ?? row?.icms_rate ?? null,
      icms_value: resolved?.icms_value ?? inbound?.icms ?? row?.icms_value ?? row?.icms ?? null,
      icms_st_base: resolved?.icms_st_base ?? inbound?.icms_st_base ?? row?.icms_st_base ?? null,
      icms_st_rate: resolved?.icms_st_rate ?? inbound?.icms_st_rate ?? row?.icms_st_rate ?? null,
      icms_st_value: resolved?.icms_st_value ?? inbound?.icms_st_value ?? row?.icms_st_value ?? null,
      fiscal_source: fiscalRoot?.source ?? rule?.rule_source ?? row?.fiscal_source ?? null,
      fiscal_status: fiscalRoot?.status ?? row?.fiscal_status ?? null,
    };
  }

  function fiscalStatus(row) {
    const apiStatus = String(row?.fiscal_status || '').toUpperCase();
    const source = String(row?.fiscal_source || '').toUpperCase();

    if (source === 'PRODUCT_RULE') return { code: 'FALLBACK_PRODUCT', label: 'Regra fiscal do produto', className: 'fiscal-status-warning' };
    if (source === 'CLASSIFICATION_RULE') return { code: 'FALLBACK_CLASSIFICATION', label: 'Regra da classificação fiscal', className: 'fiscal-status-warning' };
    if (source === 'PROFILE_RULE') return { code: 'FALLBACK_PROFILE', label: 'Regra do perfil fiscal', className: 'fiscal-status-warning' };
    if (source === 'NFE_WITH_FALLBACK') return { code: 'NFE_WITH_FALLBACK', label: 'NF-e + regra fiscal', className: 'fiscal-status-success' };

    // O endpoint agregado do produto já realiza a validação fiscal.
    if (apiStatus === 'OK') {
      return {
        code: 'COMPLETE',
        label: 'Dados fiscais completos',
        className: 'fiscal-status-ok',
      };
    }

    if (!row?.inbound_item_id) {
      return {
        code: 'NO_INBOUND_ITEM',
        label: 'Sem item de entrada',
        className: 'fiscal-status-error',
      };
    }

    const missingBasic =
      !row.nfe_key ||
      row.nfe_item_seq == null ||
      !(row.supplier_product_code ?? row.nf_product_code) ||
      !row.icms_cst ||
      row.icms_base == null ||
      row.icms_rate == null ||
      row.icms_value == null;

    if (missingBasic) {
      return {
        code: 'INCOMPLETE',
        label: 'Dados fiscais incompletos',
        className: 'fiscal-status-warning',
      };
    }

    const requiresSt = ['10', '30', '60', '70']
      .includes(String(row.icms_cst).padStart(2, '0'));

    const missingSt =
      requiresSt &&
      (
        row.icms_st_base == null ||
        row.icms_st_rate == null ||
        row.icms_st_value == null
      );

    if (missingSt) {
      return {
        code: 'INCOMPLETE_ST',
        label: 'ICMS-ST incompleto',
        className: 'fiscal-status-warning',
      };
    }

    return {
      code: 'COMPLETE',
      label: requiresSt
        ? 'Origem fiscal completa'
        : 'Origem fiscal completa — ST não aplicável',
      className: 'fiscal-status-success',
    };
  }

  /* ──────────────────────────────────────────────────────────────
     STOCK API (seu legado)
  ─────────────────────────────────────────────────────────────── */
  const StockApi = (() => {
    const normalize = (r) => {
      if (!r) return null;
      const row = r?.data?.data ?? r?.data ?? r;
      const obj = Array.isArray(row?.rows) ? row.rows[0] : (Array.isArray(row) ? row[0] : row);
      if (!obj) return null;

      return {
        product_stock_id: Number(obj.product_stock_id ?? obj.id ?? obj.stock_id ?? 0) || null,
        product_id: Number(obj.product_id ?? obj.productId ?? productId) || Number(productId) || null,
        stock_qty: (Num?.toNumOrNull?.(obj.stock_qty ?? obj.qty ?? obj.stock) ?? toNum(obj.stock_qty, 0)),
        stock_min: (Num?.toNumOrNull?.(obj.stock_min ?? obj.min) ?? toNum(obj.stock_min, 0)),
        stock_max: (Num?.toNumOrNull?.(obj.stock_max ?? obj.max) ?? toNum(obj.stock_max, 0)),
      };
    };

    async function tryGet(urls, opts) {
      let lastErr;
      for (const u of (Array.isArray(urls) ? urls : [urls])) {
        if (!u) continue;
        try {
          return await ctx.jfetch(u, opts);
        } catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
        }
      }
      throw lastErr || new Error('Endpoint de estoque indisponível');
    }

    async function getById(id) { return normalize(await tryGet(ctx.ROUTES.productStockById(id))); }

    async function getByProductCode(productCode) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error(
          'product_code não informado para carregar estoque.'
        );
      }

      const url =
        typeof ctx?.ROUTES?.productStockByProductCode === 'function'
          ? ctx.ROUTES.productStockByProductCode(code)
          : `/api/productsStock/by-product-code/${encodeURIComponent(code)}`;

      return normalize(
        await tryGet(url)
      );
    }

    async function create(payload) {
      const bodyObj = { product_id: Number(productId), ...payload };
      let lastErr;
      for (const u of [ctx.ROUTES.productsStock, ctx.ROUTES.productsStockAlt]) {
        if (!u) continue;
        try { return normalize(await ctx.jfetch(u, { method: 'POST', body: JSON.stringify(bodyObj) })); }
        catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
        }
      }
      throw lastErr || new Error('Falha ao criar estoque');
    }

    async function update(id, patch) {
      const bodyObj = { product_id: Number(productId), ...patch };
      let lastErr;
      // ✅ aqui é uma string (ou array); garantimos iteração consistente
      const urls = ctx.ROUTES.productStockById(id);
      for (const u of (Array.isArray(urls) ? urls : [urls])) {
        if (!u) continue;
        try { return normalize(await ctx.jfetch(u, { method: 'PUT', body: JSON.stringify(bodyObj) })); }
        catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
        }
      }
      throw lastErr || new Error('Falha ao atualizar estoque');
    }

    return { getById, getByProductCode, create, update };
  })();

  /* ──────────────────────────────────────────────────────────────
     LOTS API (productsStockLots)
  ─────────────────────────────────────────────────────────────── */
  const LotsApi = (() => {
    const base = (() => {
      if (ctx?.ROUTES?.productsStockLots) return ctx.ROUTES.productsStockLots;
      return '/api/productsStockLots';
    })();

    async function tryFetch(urls, opts) {
      let lastErr;
      for (const u of (Array.isArray(urls) ? urls : [urls])) {
        if (!u) continue;
        try { return await ctx.jfetch(u, opts); }
        catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
        }
      }
      throw lastErr || new Error('Endpoint de lotes indisponível');
    }

    const normalizeList = (r) => {
      const obj = r?.data?.data ?? r?.data ?? r;
      const rows = obj?.rows || obj?.data?.rows || (Array.isArray(obj) ? obj : []);
      const total = Number(obj?.total ?? rows.length ?? 0) || 0;
      const page = Number(obj?.page ?? 1) || 1;
      const limit = Number(obj?.limit ?? rows.length ?? 20) || 20;
      return { rows, total, page, limit };
    };

    const normalizeOne = (r) => {
      const obj = r?.data?.data ?? r?.data ?? r;
      return obj?.row ?? obj?.data?.row ?? obj;
    };

    function buildListUrl({ product_stock_id, q, onlyAvailable, showInactive, orderBy, dir, page, limit }) {
      const qs = new URLSearchParams();
      if (product_stock_id) qs.set('product_stock_id', String(product_stock_id));
      if (q) qs.set('q', q);
      qs.set('onlyAvailable', String(!!onlyAvailable));
      qs.set('orderBy', orderBy || 'expires_at');
      qs.set('dir', dir || 'asc');
      qs.set('page', String(page || 1));
      qs.set('limit', String(limit || 20));
      qs.set('showInactive', String(!!showInactive));
      return `${base}?${qs.toString()}`;

    }

    async function list(params) { return normalizeList(await tryFetch(buildListUrl(params))); }
    async function fefo(product_stock_id) { return normalizeList(await tryFetch(`${base}/fefo/${product_stock_id}`)); }
    async function getById(id) {
      return normalizeOne(
        await tryFetch(`${base}/${id}?_=${Date.now()}`)
      );
    }
    async function create(payload) { return normalizeOne(await tryFetch(`${base}`, { method: 'POST', body: JSON.stringify(payload) })); }
    async function update(id, patch) { return normalizeOne(await tryFetch(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(patch) })); }
    async function remove(id) { return await tryFetch(`${base}/${id}`, { method: 'DELETE' }); }

    async function reserve(id, qty) {
      return normalizeOne(await tryFetch(`${base}/${id}/reserve`, { method: 'POST', body: JSON.stringify({ qty }) }));
    }
    async function unreserve(id, qty) {
      return normalizeOne(await tryFetch(`${base}/${id}/unreserve`, { method: 'POST', body: JSON.stringify({ qty }) }));
    }
    async function consume(id, qty) {
      return normalizeOne(await tryFetch(`${base}/${id}/consume`, { method: 'POST', body: JSON.stringify({ qty }) }));
    }

    return { list, fefo, getById, create, update, remove, reserve, unreserve, consume };
  })();

  /**
   * Combina os dados operacionais do endpoint de lotes com os dados de
   * origem fiscal retornados pelo endpoint completo do produto.
   */
  async function getCompleteLotById(lotId) {
    const numericLotId = Number(lotId);

    if (!Number.isInteger(numericLotId) || numericLotId <= 0) {
      throw new Error('ID do lote inválido.');
    }

    // O endpoint do próprio lote deve devolver seus dados operacionais e
    // fiscais. Não consulte /api/products/:id aqui: além de desnecessário,
    // esse acoplamento impedia a abertura do lote quando a rota retornava 404.
    const completeLot = await LotsApi.getById(numericLotId);

    if (!completeLot) {
      throw new Error(`Lote #${numericLotId} não encontrado.`);
    }

    return completeLot;
  }

  /* ──────────────────────────────────────────────────────────────
   FISCAL COST RULE API
─────────────────────────────────────────────────────────────── */

  const FiscalCostRuleApi = (() => {

    function unwrapRuleResponse(response) {
      if (!response) return null;

      /*
       * Supported backend formats:
       *
       * { ok: true, row: {...} }
       *
       * { data: { row: {...} } }
       *
       * { data: { data: { row: {...} } } }
       *
       * or direct {...}
       */

      return (
        response?.data?.data?.row ??
        response?.data?.row ??
        response?.row ??
        response?.data?.data ??
        response?.data ??
        response ??
        null
      );
    }

    async function resolve(productCode) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error(
          'SKU não informado para resolver a regra fiscal.'
        );
      }

      const response = await ctx.jfetch(
        `/api/product-fiscal-cost-rules/resolve/${encodeURIComponent(code)}?_=${Date.now()}`
      );

      const row = unwrapRuleResponse(response);

      console.log(
        '[tabStock][FiscalCostRuleApi.resolve]',
        {
          productCode: code,
          response,
          row,
          ruleSource:
            row?.rule_source ??
            row?.source ??
            null,
        }
      );

      return row;
    }

    async function generate(productCode, payload = {}) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error(
          'SKU não informado para gerar a regra fiscal.'
        );
      }

      const response = await ctx.jfetch(
        `/api/product-fiscal-cost-rules/generate/${encodeURIComponent(code)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload ?? {}),
        }
      );

      return response;
    }

    function unwrapCalculateResponse(response) {
      if (!response) return null;

      return (
        response?.data?.data ??
        response?.data?.row ??
        response?.data ??
        response?.row ??
        response ??
        null
      );
    }

    async function calculate(productCode, { unitCost, quantity = 1 } = {}) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error('SKU não informado para calcular os dados fiscais.');
      }

      const cost = Number(unitCost);
      const qty = Number(quantity);

      if (!Number.isFinite(cost) || cost < 0) {
        throw new Error('Custo unitário inválido para o cálculo fiscal.');
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Quantidade inválida para o cálculo fiscal.');
      }

      const response = await ctx.jfetch(
        '/api/product-fiscal-cost-rules/calculate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product_code: code,
            unit_cost: cost,
            quantity: qty,
          }),
        }
      );

      return unwrapCalculateResponse(response);
    }

    /*
     * Grava a origem fiscal calculada em "productsFiscalOrigins".
     *
     * É isso que permite emitir NF-e (CST 60) para produtos que não possuem
     * mais NF-e de entrada do fornecedor: a emissão passa a encontrar a
     * origem do ICMS-ST retido nesta tabela, sem depender de
     * inboundInvoiceItems.
     *
     * lotId nulo grava a origem padrão do produto, usada no modo de estoque
     * sem lote (STOCK_SIMPLE).
     */
    async function applyOrigin(productCode, payload = {}) {
      const code = String(productCode ?? '').trim();

      if (!code) {
        throw new Error('SKU não informado para gravar a origem fiscal.');
      }

      const response = await ctx.jfetch(
        `/api/products-fiscal-origins/apply/${encodeURIComponent(code)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload ?? {}),
        }
      );

      return unwrapCalculateResponse(response);
    }

    return {
      resolve,
      generate,
      calculate,
      applyOrigin,
      unwrapRuleResponse,
      unwrapCalculateResponse,
    };

  })();

  function calculateFiscalFromResolvedRule(ruleResult, { unitCost, quantity = 1 } = {}) {
    const rule = ruleResult?.rule ?? ruleResult ?? {};
    const cost = fiscalNumber(unitCost);
    const qty = fiscalNumber(quantity);

    if (cost === null || cost < 0) {
      throw new Error('Custo unitário inválido para o cálculo fiscal.');
    }

    if (qty === null || qty <= 0) {
      throw new Error('Quantidade inválida para o cálculo fiscal.');
    }

    const num = (value, fallback = null) => {
      const parsed = fiscalNumber(value);
      return parsed === null ? fallback : parsed;
    };

    const round = (value, decimals = 4) => {
      const factor = 10 ** decimals;
      return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
    };

    const icmsBasePct = num(rule.icms_base_pct, 100);
    const icmsRate = num(rule.icms_rate, 0);
    const stBasePct = num(
      rule.icms_st_ret_base_pct ?? rule.icms_st_base_pct,
      100
    );
    const stRate = num(
      rule.icms_st_ret_rate ?? rule.icms_st_rate,
      0
    );

    const icmsBasePerUnit = round(cost * (icmsBasePct / 100), 4);
    const icmsValuePerUnit = round(icmsBasePerUnit * (icmsRate / 100), 4);
    const stBasePerUnit = round(cost * (stBasePct / 100), 4);
    const stValuePerUnit = round(stBasePerUnit * (stRate / 100), 4);

    return {
      source: 'PRODUCT_FISCAL_RULE',
      rule_id: rule.rule_id ?? null,
      rule_source: rule.rule_source ?? ruleResult?.rule_source ?? 'PRODUCT_RULE',
      product_code: rule.product_code ?? ruleResult?.product_code ?? null,
      cst: rule.inbound_cst ?? ruleResult?.inbound_cst ?? null,
      quantity: qty,
      unit_cost: cost,
      icms: {
        base_pct: icmsBasePct,
        rate: icmsRate,
        base_per_unit: icmsBasePerUnit,
        value_per_unit: icmsValuePerUnit,
        base_total: round(icmsBasePerUnit * qty, 2),
        value_total: round(icmsValuePerUnit * qty, 2),
      },
      icms_st: {
        base_pct: stBasePct,
        rate: stRate,
        mva_pct: num(rule.mva_pct, null),
        base_per_unit: stBasePerUnit,
        value_per_unit: stValuePerUnit,
        base_total: round(stBasePerUnit * qty, 2),
        value_total: round(stValuePerUnit * qty, 2),
      },
      ipi_rate: num(rule.ipi_rate, null),
      pis_rate: num(rule.pis_rate, null),
      cofins_rate: num(rule.cofins_rate, null),
    };
  }

  function mergeCalculatedFiscalIntoLot(lot, calculation, ruleResult = null) {
    const source = String(
      calculation?.rule_source ??
      ruleResult?.rule_source ??
      'PRODUCT_RULE'
    ).trim().toUpperCase() || 'PRODUCT_RULE';

    const hasInbound =
      Boolean(lot?.inbound_invoice_item?.id) ||
      Boolean(lot?.inbound_item_id);

    const resolved = {
      cst: calculation?.cst ?? null,
      icms_base: calculation?.icms?.base_total ?? null,
      icms_rate: calculation?.icms?.rate ?? null,
      icms_value: calculation?.icms?.value_total ?? null,
      icms_st_base: calculation?.icms_st?.base_total ?? null,
      icms_st_rate: calculation?.icms_st?.rate ?? null,
      icms_st_value: calculation?.icms_st?.value_total ?? null,
    };

    return normalizeLotFiscalPayload({
      ...lot,
      fiscal_source: hasInbound ? 'NFE_WITH_FALLBACK' : source,
      fiscal_status: 'OK',
      fiscal: {
        ...(lot?.fiscal ?? {}),
        status: 'OK',
        source: hasInbound ? 'NFE_WITH_FALLBACK' : source,
        rule: {
          ...(lot?.fiscal?.rule ?? {}),
          ...(ruleResult?.rule ?? ruleResult ?? {}),
          rule_source: source,
        },
        calculated: {
          ...(lot?.fiscal?.calculated ?? {}),
          source: calculation?.source ?? 'PRODUCT_FISCAL_RULE',
          cst: calculation?.cst ?? null,
          quantity: calculation?.quantity ?? 1,
          unit_cost: calculation?.unit_cost ?? null,
          icms_base: calculation?.icms?.base_total ?? null,
          icms_rate: calculation?.icms?.rate ?? null,
          icms_value: calculation?.icms?.value_total ?? null,
          icms_st_base: calculation?.icms_st?.base_total ?? null,
          icms_st_rate: calculation?.icms_st?.rate ?? null,
          icms_st_value: calculation?.icms_st?.value_total ?? null,
          icms_base_per_unit: calculation?.icms?.base_per_unit ?? null,
          icms_value_per_unit: calculation?.icms?.value_per_unit ?? null,
          icms_st_base_per_unit: calculation?.icms_st?.base_per_unit ?? null,
          icms_st_value_per_unit: calculation?.icms_st?.value_per_unit ?? null,
        },
        resolved: {
          ...(lot?.fiscal?.resolved ?? {}),
          ...resolved,
        },
      },
    });
  }

  async function applyFiscalCostRule() {
    const button = $(LOT_FIELDS.btnApplyFiscalCostRule);
    const lotId = Number(getVal(LOT_FIELDS.mLotId) || 0);

    if (!lotId) {
      ctx.toast?.('⚠️ Salve o lote antes de atualizar os dados fiscais.', 'warning');
      return;
    }

    const code = String(
      __currentFiscalLot?.product_code ??
      currentProductCode ??
      ''
    ).trim();

    if (!code) {
      ctx.toast?.('❌ Não foi possível identificar o SKU do produto.', 'error');
      return;
    }

    const oldText = button?.textContent;

    try {
      if (button) {
        button.disabled = true;
        button.textContent = '⏳ Atualizando...';
      }

      const lot = normalizeLotFiscalPayload(
        await getCompleteLotById(lotId)
      );

      const lotUnitCost = fiscalNumber(
        getVal(LOT_FIELDS.mCostUnit) ?? lot?.cost_unit
      );

      const operationQuantity = fiscalNumber(
        getVal(LOT_FIELDS.opQty)
      ) ?? 1;

      // Um custo informado precisa ser válido; ausente é aceitável e cai
      // para o custo do produto logo abaixo.
      if (lotUnitCost !== null && lotUnitCost < 0) {
        throw new Error(
          'O custo unitário do lote não pode ser negativo.'
        );
      }

      let ruleResult = await FiscalCostRuleApi.resolve(code);
      let ruleSource = String(
        ruleResult?.rule_source ??
        ruleResult?.source ??
        ''
      ).trim().toUpperCase();

      if (!ruleSource || ruleSource === 'NONE') {
        if (button) button.textContent = '⚙️ Gerando regra...';

        await FiscalCostRuleApi.generate(code, {
          force: false,
        });

        ruleResult = await FiscalCostRuleApi.resolve(code);
        ruleSource = String(
          ruleResult?.rule_source ??
          ruleResult?.source ??
          ''
        ).trim().toUpperCase();
      }

      if (!ruleSource || ruleSource === 'NONE') {
        throw new Error(
          'Nenhuma regra fiscal ativa foi encontrada para o produto.'
        );
      }

      /*
       * Lotes antigos costumam não ter custo unitário próprio.
       *
       * Nesse caso usamos products.cost_price, exatamente o mesmo fallback
       * que calculateForProduct() aplica no backend — em vez de bloquear o
       * botão e deixar o produto sem origem fiscal.
       */
      const ruleCostPrice = fiscalNumber(
        ruleResult?.cost_price ??
        ruleResult?.rule?.cost_price
      );

      const unitCost = lotUnitCost !== null
        ? lotUnitCost
        : ruleCostPrice;

      if (unitCost === null || unitCost < 0) {
        throw new Error(
          'O lote não possui custo unitário e o produto também não tem custo '
          + 'cadastrado. Informe um dos dois antes de atualizar os dados fiscais.'
        );
      }

      let calculation = null;

      /*
       * Caminho principal: cálculo centralizado no backend.
       *
       * Se a rota /calculate ainda não estiver publicada nesta instalação,
       * fazemos fallback compatível usando exatamente a regra já resolvida.
       */
      try {
        if (button) button.textContent = '🧮 Calculando...';

        calculation = await FiscalCostRuleApi.calculate(code, {
          unitCost,
          quantity: operationQuantity,
        });
      } catch (calculateError) {
        console.warn(
          '[tabStock][FISCAL RULE][CALCULATE ENDPOINT FALLBACK]',
          calculateError?.message || calculateError
        );

        calculation = calculateFiscalFromResolvedRule(
          ruleResult,
          {
            unitCost,
            quantity: operationQuantity,
          }
        );
      }

      if (!calculation) {
        throw new Error(
          'A regra fiscal foi encontrada, mas não foi possível calcular os valores fiscais.'
        );
      }

      const mergedLot = mergeCalculatedFiscalIntoLot(
        lot,
        calculation,
        ruleResult
      );

      __currentFiscalLot = mergedLot;
      LotsUI.openModal('edit', mergedLot);

      const hasInbound =
        Boolean(lot?.inbound_invoice_item?.id) ||
        Boolean(lot?.inbound_item_id);

      /*
       * Persiste a origem fiscal em "productsFiscalOrigins".
       *
       * Sem isto o cálculo seria apenas uma prévia de tela. Gravando, a
       * emissão de NF-e passa a conseguir montar o ICMS-ST retido (CST 60)
       * mesmo para produtos que não possuem mais NF-e de entrada.
       *
       * Grava sempre o escopo do lote e também o padrão do produto
       * (lot_id nulo), para que a origem funcione tanto no modo com lote
       * quanto no modo de estoque simples.
       */
      let originSaved = false;
      let originError = null;

      try {
        if (button) button.textContent = '💾 Gravando origem fiscal...';

        const originPayload = {
          productId: Number(productId) || null,
          productGradeId:
            Number(getVal(LOT_FIELDS.mProductGradeId) || 0) ||
            Number(lot?.product_grade_id || 0) ||
            null,
          unit: lot?.unit ?? null,
          unitCost,
        };

        await FiscalCostRuleApi.applyOrigin(code, {
          ...originPayload,
          lotId: lotId,
        });

        /*
         * Padrão do produto (STOCK_SIMPLE e lotes ainda sem origem própria).
         *
         * Gravado sem grade de propósito: é o catch-all do produto, precisa
         * valer para qualquer grade.
         */
        await FiscalCostRuleApi.applyOrigin(code, {
          ...originPayload,
          lotId: null,
          productGradeId: null,
        });

        originSaved = true;
      } catch (saveError) {
        originError = saveError;

        console.error(
          '[tabStock][FISCAL ORIGIN][SAVE FAILED]',
          saveError
        );
      }

      const sourceLabels = {
        PRODUCT_RULE: 'regra específica do produto',
        CLASSIFICATION_RULE: 'regra da classificação fiscal',
        PROFILE_RULE: 'regra do perfil fiscal',
      };

      const sourceLabel =
        sourceLabels[ruleSource] ??
        'regra fiscal do produto';

      if (!originSaved) {
        await showLotAlert({
          variant: 'warning',
          title: 'Dados fiscais calculados, mas não gravados',
          message:
            `Os campos foram calculados com a ${sourceLabel}, porém a origem `
            + 'fiscal não pôde ser gravada e a emissão de NF-e continuará '
            + `dependendo da NF-e de entrada. Detalhe: ${originError?.message || originError}`,
          okText: 'OK',
        });

        return;
      }

      await showLotAlert({
        variant: 'success',
        title: 'Dados fiscais atualizados',
        message: hasInbound
          ? `A origem da NF-e foi preservada e os campos faltantes foram recalculados com a ${sourceLabel}. `
            + 'A origem fiscal calculada também foi gravada como alternativa.'
          : `Os campos fiscais foram calculados com a ${sourceLabel} e gravados como origem fiscal do produto, `
            + 'permitindo emitir NF-e sem NF-e de entrada.',
        okText: 'OK',
      });

    } catch (error) {
      console.error('[tabStock][applyFiscalCostRule]', error);

      await showLotAlert({
        variant: 'error',
        title: 'Ocorreu um erro',
        message: `Falha ao atualizar os dados fiscais: ${error?.message || error}`,
        okText: 'OK',
      });
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || '⚙️ Atualizar dados fiscais';
      }
    }
  }

  /* ──────────────────────────────────────────────────────────────
     STOCK FORM
  ─────────────────────────────────────────────────────────────── */
  let __product_stock_id = null;

  function preencherStockForm(stock) {
    // ✅ NOVO: mostra o product_stock_id (readonly)
    const idVal = stock?.product_stock_id ?? __product_stock_id ?? '';
    setVal(STOCK_FIELDS.id, idVal);

    setVal(STOCK_FIELDS.qty, stock?.stock_qty ?? 0);
    setVal(STOCK_FIELDS.min, stock?.stock_min ?? 0);
    setVal(STOCK_FIELDS.max, stock?.stock_max ?? 0);
  }

  function coletarStockForm() {
    const payload = {
      stock_min: (Num?.toNumOrNull?.(getVal(STOCK_FIELDS.min)) ?? toNum(getVal(STOCK_FIELDS.min), 0)),
      stock_max: (Num?.toNumOrNull?.(getVal(STOCK_FIELDS.max)) ?? toNum(getVal(STOCK_FIELDS.max), 0)),
    };

    if (__stockMode.mode === STOCK_MODES.SIMPLE) {
      payload.stock_qty = Num?.toNumOrNull?.(getVal(STOCK_FIELDS.qty))
        ?? toNum(getVal(STOCK_FIELDS.qty), 0);
    }

    return payload;
  }

  async function salvarStock() {
    try {
      const payload = coletarStockForm();

      if (!__product_stock_id) {
        const created = await StockApi.create(payload);
        __product_stock_id = created?.product_stock_id ?? null;

        // ✅ Atualiza campo readonly
        setVal(STOCK_FIELDS.id, __product_stock_id ?? '');

        ctx.toast?.('✅ Estoque criado!', 'success');
        preencherStockForm(created || payload);
      } else {
        const updated = await StockApi.update(__product_stock_id, payload);

        // ✅ garante que o campo readonly mantenha o ID
        setVal(STOCK_FIELDS.id, __product_stock_id ?? '');

        ctx.toast?.('✅ Estoque atualizado!', 'success');
        preencherStockForm(updated || payload);
      }

      if (__stockMode.requireLot) await LotsUI.refreshSafe();
    } catch (err) {
      console.error('[tabStock] save stock error:', err);
      ctx.toast?.(`❌ Falha ao salvar estoque: ${err.message}`, 'error');
    }
  }

  function attachStockHandlers() {
    const form = $(STOCK_FIELDS.form);
    if (!form) return;

    if (form.__boundSubmit) form.removeEventListener('submit', form.__boundSubmit);

    form.__boundSubmit = (e) => {
      e.preventDefault();
      salvarStock();
    };

    form.addEventListener('submit', form.__boundSubmit);
  }

  let __productGradesRows = [];

  function unwrapRows(resp) {
    const data = resp?.data?.data ?? resp?.data ?? resp;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(resp?.rows)) return resp.rows;
    return [];
  }

  async function carregarGradesDoProduto(selectedProductGradeId = null) {
    const select = $(LOT_FIELDS.mProductGradeId);
    if (!select) return [];

    const previousValue = selectedProductGradeId ?? select.value ?? '';
    select.innerHTML = '<option value="">Sem grade</option>';

    try {
      const urls = typeof ctx?.ROUTES?.productGradesList === 'function'
        ? ctx.ROUTES.productGradesList(productId)
        : [
          `/api/productsGrades/by-product/${encodeURIComponent(productId)}`,
          `/api/productsGrades?product_id=${encodeURIComponent(productId)}&limit=500`,
          `/api/products-grades/by-product/${encodeURIComponent(productId)}`,
        ];

      let resp = null;
      let lastError = null;

      for (const url of (Array.isArray(urls) ? urls : [urls])) {
        if (!url) continue;
        try {
          resp = await ctx.jfetch(url);
          break;
        } catch (error) {
          lastError = error;
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
          throw error;
        }
      }

      if (!resp && lastError) throw lastError;

      const rows = unwrapRows(resp);
      __productGradesRows = rows;

      for (const g of rows) {
        const productGradeId = Number(g.product_grade_id ?? g.id ?? 0);
        if (!productGradeId) continue;

        const opt = document.createElement('option');
        opt.value = String(productGradeId);
        // Mostra só a descrição; o id fica no value.
        opt.textContent = String(g.description ?? g.grade_description ?? g.name ?? '').trim()
          || `Grade #${g.grade_id ?? productGradeId}`;
        select.appendChild(opt);
      }

      if (previousValue && Array.from(select.options).some(opt => opt.value === String(previousValue))) {
        select.value = String(previousValue);
      }

      return rows;
    } catch (e) {
      console.warn('[tabStock] Falha ao carregar grades:', e);
      __productGradesRows = [];
      return [];
    }
  }

  const GradeQuickUI = (() => {
    function dialog() {
      return $(LOT_FIELDS.gradeDialog);
    }

    function normalizeGradeCatalogRow(row = {}) {
      const gradeId = Number(row.grade_id ?? row.id ?? row.value ?? 0);
      if (!gradeId) return null;

      const description = String(
        row.description ??
        row.grade_description ??
        row.name ??
        row.label ??
        row.descricao ??
        '',
      ).trim();

      return { gradeId, description };
    }

    async function fetchFirst(urls) {
      let lastError = null;
      for (const url of (Array.isArray(urls) ? urls : [urls])) {
        if (!url) continue;
        try {
          return await ctx.jfetch(url);
        } catch (error) {
          lastError = error;
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
          throw error;
        }
      }
      throw lastError || new Error('Endpoint de grades indisponível.');
    }

    async function loadCatalog() {
      const select = $(LOT_FIELDS.gradeCatalog);
      if (!select) return [];

      select.disabled = true;
      select.innerHTML = '<option value="">Carregando grades...</option>';

      try {
        const candidates = ctx?.ROUTES?.gradesCandidates || [
          '/api/grades',
          '/api/grades/list',
          '/api/grades/catalog',
          '/api/productsGrades/grades',
        ];

        const resp = await fetchFirst(candidates);
        const rows = unwrapRows(resp)
          .map(normalizeGradeCatalogRow)
          .filter(Boolean);

        const linkedByGradeId = new Map(
          __productGradesRows
            .map(row => [Number(row.grade_id || 0), Number(row.product_grade_id || 0)])
            .filter(([gradeId, productGradeId]) => gradeId > 0 && productGradeId > 0),
        );

        select.innerHTML = '<option value="">— Selecione uma grade —</option>';

        for (const row of rows) {
          const opt = document.createElement('option');
          opt.value = String(row.gradeId);
          const linked = linkedByGradeId.has(row.gradeId);
          opt.textContent = `${row.gradeId}${row.description ? ` — ${row.description}` : ''}${linked ? ' (já vinculada)' : ''}`;
          opt.dataset.productGradeId = linked ? String(linkedByGradeId.get(row.gradeId)) : '';
          select.appendChild(opt);
        }

        select.disabled = false;
        return rows;
      } catch (error) {
        select.innerHTML = '<option value="">Falha ao carregar grades</option>';
        select.disabled = true;
        throw error;
      }
    }

    function extractCreatedProductGradeId(resp) {
      const data = resp?.data?.data ?? resp?.data ?? resp;
      const row = data?.row ?? data?.created ?? data?.result ?? data;
      return Number(
        row?.product_grade_id ??
        row?.id ??
        resp?.product_grade_id ??
        resp?.data?.product_grade_id ??
        0,
      ) || null;
    }

    async function createProductGrade(payload) {
      const candidates = ctx?.ROUTES?.productGradesCreate || [
        '/api/productsGrades',
        '/api/products-grades',
      ];

      let lastError = null;

      for (const url of (Array.isArray(candidates) ? candidates : [candidates])) {
        if (!url) continue;
        try {
          return await ctx.jfetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } catch (error) {
          lastError = error;
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) continue;
          throw error;
        }
      }

      throw lastError || new Error('Não foi possível vincular a grade ao produto.');
    }

    async function open() {
      const dlg = dialog();
      if (!dlg) {
        ctx.toast?.('❌ Modal de criação de grade não encontrado no HTML.', 'error');
        return;
      }

      await carregarGradesDoProduto(getVal(LOT_FIELDS.mProductGradeId));
      setVal(LOT_FIELDS.gradeStock, '0');
      await loadCatalog();

      if (!dlg.open) dlg.showModal();
      setTimeout(() => $(LOT_FIELDS.gradeCatalog)?.focus(), 50);
    }

    function close() {
      const dlg = dialog();
      if (dlg?.open) dlg.close();
    }

    async function save() {
      const select = $(LOT_FIELDS.gradeCatalog);
      const gradeId = Number(select?.value || 0);
      const stock = Math.max(0, toNum(getVal(LOT_FIELDS.gradeStock), 0));

      if (!gradeId) {
        ctx.toast?.('⚠️ Selecione uma grade.', 'warning');
        select?.focus();
        return;
      }

      const selectedOption = select?.selectedOptions?.[0];
      const existingProductGradeId = Number(selectedOption?.dataset?.productGradeId || 0);

      if (existingProductGradeId) {
        await carregarGradesDoProduto(existingProductGradeId);
        close();
        ctx.toast?.('✅ Grade já vinculada e selecionada no lote.', 'success');
        return;
      }

      const saveButton = $(LOT_FIELDS.gradeDialogSave);
      if (saveButton) saveButton.disabled = true;

      try {
        const payload = {
          product_id: Number(productId),
          grade_id: gradeId,
          stock,
        };

        const resp = await createProductGrade(payload);
        let createdProductGradeId = extractCreatedProductGradeId(resp);

        const rows = await carregarGradesDoProduto(createdProductGradeId);

        if (!createdProductGradeId) {
          createdProductGradeId = Number(
            rows.find(row => Number(row.grade_id || 0) === gradeId)?.product_grade_id || 0,
          ) || null;
        }

        if (createdProductGradeId) {
          setVal(LOT_FIELDS.mProductGradeId, createdProductGradeId);
        }

        // Mantém a aba Grade da página sincronizada quando ela já estiver inicializada.
        document.dispatchEvent(new CustomEvent('consart:product-grade-created', {
          detail: {
            productId: Number(productId),
            gradeId,
            productGradeId: createdProductGradeId,
            stock,
          },
        }));

        close();
        ctx.toast?.('✅ Grade criada e selecionada no lote!', 'success');
      } finally {
        if (saveButton) saveButton.disabled = false;
      }
    }

    function attachHandlers() {
      const createButton = $(LOT_FIELDS.btnCreateGrade);
      if (createButton && !createButton.dataset.gradeQuickBound) {
        createButton.dataset.gradeQuickBound = 'true';
        createButton.addEventListener('click', () => {
          open().catch(error => {
            console.error('[tabStock][gradeQuick] open error:', error);
            ctx.toast?.(`❌ ${error.message}`, 'error');
          });
        });
      }

      const closeButton = $(LOT_FIELDS.gradeDialogClose);
      if (closeButton && !closeButton.dataset.gradeQuickBound) {
        closeButton.dataset.gradeQuickBound = 'true';
        closeButton.addEventListener('click', close);
      }

      const cancelButton = $(LOT_FIELDS.gradeDialogCancel);
      if (cancelButton && !cancelButton.dataset.gradeQuickBound) {
        cancelButton.dataset.gradeQuickBound = 'true';
        cancelButton.addEventListener('click', close);
      }

      const saveButton = $(LOT_FIELDS.gradeDialogSave);
      if (saveButton && !saveButton.dataset.gradeQuickBound) {
        saveButton.dataset.gradeQuickBound = 'true';
        saveButton.addEventListener('click', () => {
          save().catch(error => {
            console.error('[tabStock][gradeQuick] save error:', error);
            ctx.toast?.(`❌ ${error.message}`, 'error');
          });
        });
      }

      const dlg = dialog();
      if (dlg && !dlg.dataset.gradeQuickBound) {
        dlg.dataset.gradeQuickBound = 'true';
        dlg.addEventListener('cancel', event => {
          event.preventDefault();
          close();
        });

        dlg.addEventListener('keydown', event => {
          if (event.key !== 'Enter') return;
          if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
          event.preventDefault();
          $(LOT_FIELDS.gradeDialogSave)?.click();
        });
      }
    }

    return { open, close, save, attachHandlers, loadCatalog };
  })();

  /* ──────────────────────────────────────────────────────────────
     LOTS UI
  ─────────────────────────────────────────────────────────────── */
  const LotsUI = (() => {
    const hasLotsDom = () => !!$(LOT_FIELDS.wrap);
    const lotsEnabled = () => __stockMode.requireLot === true;

    const state = {
      rows: [],
      total: 0,
      page: 1,
      limit: 20,
      mode: 'list', // list | fefo
    };

    function ensureVisibleState() {
      if (!hasLotsDom()) return;

      const wrap = $(LOT_FIELDS.wrap);
      if (!lotsEnabled()) {
        if (wrap) {
          wrap.hidden = true;
          wrap.setAttribute('aria-hidden', 'true');
        }
        return;
      }

      if (wrap) {
        wrap.hidden = false;
        wrap.setAttribute('aria-hidden', 'false');
      }

      const hint = $(LOT_FIELDS.hint);
      const toolbar = $(LOT_FIELDS.toolbar);

      if (!__product_stock_id) {
        hint?.classList.remove('hidden');
        toolbar?.classList.add('hidden');
      } else {
        hint?.classList.add('hidden');
        toolbar?.classList.remove('hidden');
      }
    }

    function readFilters() {
      return {
        q: getVal(LOT_FIELDS.fQ).trim(),
        onlyAvailable: String(getVal(LOT_FIELDS.fOnlyAvailable)) === 'true',
        orderBy: getVal(LOT_FIELDS.fOrderBy) || 'expires_at',
        dir: getVal(LOT_FIELDS.fDir) || 'asc',
        limit: Number(getVal(LOT_FIELDS.fLimit) || 20) || 20,
        showInactive: String(getVal(LOT_FIELDS.fShowInactive)) === 'true',
      };
    }

    function setPagingLabel() {
      const paging = $(LOT_FIELDS.paging);
      if (!paging) return;

      if (state.mode === 'fefo') {
        paging.textContent = `FEFO • ${state.total} lote(s) disponíveis`;
        return;
      }

      const pages = Math.max(1, Math.ceil(state.total / state.limit));
      paging.textContent = `Página ${state.page} de ${pages} • ${state.total} registro(s)`;
    }

    function renderTable(rows) {
      const tbody = $(LOT_FIELDS.tbody);
      if (!tbody) return;

      if (!__product_stock_id) {
        tbody.innerHTML = `<tr><td colspan="10" class="muted" style="padding:12px 14px;">Salve o estoque para habilitar os lotes.</td></tr>`;
        return;
      }

      if (!rows?.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="muted" style="padding:12px 14px;">Nenhum lote encontrado.</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(r => {
        const available = (r.qty_available != null)
          ? Number(r.qty_available || 0)
          : (Number(r.qty_on_hand || 0) - Number(r.qty_reserved || 0));

        const isActive = r.is_active !== false;

        const statusBadge = isActive
          ? `<span class="lot-status lot-status-active">Ativo</span>`
          : `<span class="lot-status lot-status-inactive">Inativo</span>`;

        const rowClass = isActive ? '' : ' class="lot-row-inactive"';

        return `
      <tr${rowClass}>
        <td class="num">${r.lot_id}</td>

        <td>
          ${escapeHtml(
          r.grade_name ||
          r.grade_description ||
          r.description ||
          r.grade_id ||
          'Sem grade'
        )}
        </td>

        <td class="mono">${escapeHtml(r.lot_code || '—')}</td>

        <td>${fmtDateBR(r.expires_at)}</td>

        <td class="num">${fmtNum3(r.qty_on_hand)}</td>

        <td class="num">${fmtNum3(r.qty_reserved)}</td>

        <td class="num">${fmtNum3(available)}</td>

        <td class="muted">
          ${r.updated_at ? new Date(r.updated_at).toLocaleString('pt-BR') : '—'}
        </td>

        <td>${statusBadge}</td>

        <td style="text-align:right;">
          <div class="row center" style="gap:8px; justify-content:flex-end; flex-wrap:wrap;">
            <button class="btn btn-toolbar btn-sm" data-act="edit" data-id="${r.lot_id}">✏️</button>
            <button class="btn btn-flat btn-sm" data-act="reserve" data-id="${r.lot_id}" ${isActive ? '' : 'disabled'}>Reservar</button>
            <button class="btn btn-flat btn-sm" data-act="unreserve" data-id="${r.lot_id}" ${isActive ? '' : 'disabled'}>Desreservar</button>
            <button class="btn btn-danger btn-sm" data-act="consume" data-id="${r.lot_id}" ${isActive ? '' : 'disabled'}>Baixar</button>
          </div>
        </td>
      </tr>
    `;
      }).join('');
    }

    function bindEnterToSaveLotModal() {
      const dlg = $(LOT_FIELDS.modalDialog);
      const btnSave = $(LOT_FIELDS.btnSaveModal);

      if (!dlg || !btnSave) return;

      dlg.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

        const tag = e.target?.tagName?.toLowerCase();
        if (tag === 'textarea') return;

        e.preventDefault();
        btnSave.click();
      };
    }

    function openModal(mode, row = null) {
      const dlg = $(LOT_FIELDS.modalDialog);
      if (!dlg) return;

      const title = $(LOT_FIELDS.modalTitle);
      const btnDelete = $(LOT_FIELDS.btnDeleteModal);

      if (mode === 'new') {
        __currentFiscalLot = null;
        title.textContent = 'Novo lote';
        btnDelete?.classList.add('hidden');

        setVal(LOT_FIELDS.mLotId, '');
        setVal(LOT_FIELDS.mProductGradeId, '');
        setVal(LOT_FIELDS.mLotCode, '');
        setVal(LOT_FIELDS.mExpiresAt, '');
        setVal(LOT_FIELDS.mQtyOnHand, '0');
        setVal(LOT_FIELDS.mCostUnit, '');
        setVal(LOT_FIELDS.mNfeKey, '');
        setVal(LOT_FIELDS.mNfeItemSeq, '');
        setVal(LOT_FIELDS.mQtyReserved, '0');

        setText(LOT_FIELDS.mInboundInvoiceId, null);
        setText(LOT_FIELDS.mInboundItemId, null);
        setText(LOT_FIELDS.mSupplierProductCode, null);
        setText(LOT_FIELDS.mIcmsCst, null);
        setText(LOT_FIELDS.mIcmsBase, null);
        setText(LOT_FIELDS.mIcmsRate, null);
        setText(LOT_FIELDS.mIcmsValue, null);
        setText(LOT_FIELDS.mIcmsStBase, null);
        setText(LOT_FIELDS.mIcmsStRate, null);
        setText(LOT_FIELDS.mIcmsStValue, null);

        const statusEl = $(LOT_FIELDS.mFiscalStatus);
        if (statusEl) {
          statusEl.textContent = 'Sem origem fiscal';
          statusEl.className = 'fiscal-status fiscal-status-warning';
        }

        ensureFiscalFractionPanel();
        renderFiscalFraction(null);
        $(LOT_FIELDS.mFiscalPanel)?.classList.add('hidden');

        $(LOT_FIELDS.btnReserve).disabled = true;
        $(LOT_FIELDS.btnUnreserve).disabled = true;
        $(LOT_FIELDS.btnConsume).disabled = true;

        if (!dlg.open) dlg.showModal();

        bindEnterToSaveLotModal();

        setTimeout(() => {
          const gradeEl = $(LOT_FIELDS.mProductGradeId);
          const lotEl = $(LOT_FIELDS.mLotCode);

          if (gradeEl) gradeEl.focus();
          else lotEl?.focus();
        }, 50);

        return;
      }

      if (!row) {
        ctx.toast?.('❌ Lote não encontrado para edição.', 'error');
        return;
      }

      row = normalizeLotFiscalPayload(row);

      title.textContent = `Editar lote #${row.lot_id}`;
      btnDelete?.classList.remove('hidden');

      setVal(LOT_FIELDS.mLotId, row.lot_id);
      setVal(LOT_FIELDS.mProductGradeId, row.product_grade_id ?? '');
      setVal(LOT_FIELDS.mLotCode, row.lot_code ?? '');
      setVal(LOT_FIELDS.mExpiresAt, row.expires_at ? String(row.expires_at).slice(0, 10) : '');
      setVal(LOT_FIELDS.mQtyOnHand, row.qty_on_hand ?? 0);
      setVal(LOT_FIELDS.mCostUnit, row.cost_unit ?? '');
      setVal(LOT_FIELDS.mNfeKey, row.nfe_key ?? '');
      setVal(LOT_FIELDS.mNfeItemSeq, row.nfe_item_seq ?? '');

      const status = fiscalStatus(row);
      const statusEl = $(LOT_FIELDS.mFiscalStatus);

      if (statusEl) {
        statusEl.textContent = status.label;
        statusEl.className = `fiscal-status ${status.className}`;
      }

      const fiscalSubtitle = $(LOT_FIELDS.mFiscalSubtitle);
      if (fiscalSubtitle) {
        const source = String(
          row?.fiscal_source ??
          row?.fiscal?.source ??
          ''
        ).trim().toUpperCase();

        const hasInbound =
          Boolean(row?.inbound_invoice_item?.id) ||
          Boolean(row?.inbound_item_id);

        if (source === 'NFE_WITH_FALLBACK') {
          fiscalSubtitle.textContent =
            'Valores da NF-e de entrada complementados pela regra fiscal do produto.';
        } else if (
          source === 'PRODUCT_RULE' ||
          source === 'CLASSIFICATION_RULE' ||
          source === 'PROFILE_RULE'
        ) {
          fiscalSubtitle.textContent =
            'Valores calculados pela regra fiscal ativa do produto.';
        } else if (hasInbound) {
          fiscalSubtitle.textContent =
            'Valores informados pelo fornecedor na NF-e de entrada.';
        } else {
          fiscalSubtitle.textContent =
            'Sem NF-e vinculada. Use “Atualizar dados fiscais” para calcular pela regra fiscal ativa.';
        }
      }

      setText(
        LOT_FIELDS.mInboundInvoiceId,
        row.inbound_invoice_number ?? row.inbound_invoice_id ?? row.invoice_id,
      );

      setText(
        LOT_FIELDS.mInboundItemId,
        row.inbound_item_id,
      );

      setText(
        LOT_FIELDS.mSupplierProductCode,
        row.supplier_product_code ?? row.nf_product_code,
      );

      setText(LOT_FIELDS.mIcmsCst, row.icms_cst);
      setText(LOT_FIELDS.mIcmsBase, fmtMoney(row.icms_base));
      setText(LOT_FIELDS.mIcmsRate, fmtRate(row.icms_rate));
      setText(
        LOT_FIELDS.mIcmsValue,
        fmtMoney(row.icms_value ?? row.icms),
      );

      setText(
        LOT_FIELDS.mIcmsStBase,
        fmtMoney(row.icms_st_base),
      );

      setText(
        LOT_FIELDS.mIcmsStRate,
        fmtRate(row.icms_st_rate),
      );

      setText(
        LOT_FIELDS.mIcmsStValue,
        fmtMoney(row.icms_st_value),
      );

      renderFiscalFraction(row);

      $(LOT_FIELDS.mFiscalPanel)?.classList.remove('hidden');

      setVal(LOT_FIELDS.mQtyReserved, row.qty_reserved ?? 0);

      $(LOT_FIELDS.btnReserve).disabled = false;
      $(LOT_FIELDS.btnUnreserve).disabled = false;
      $(LOT_FIELDS.btnConsume).disabled = false;

      if (!dlg.open) dlg.showModal();

      bindEnterToSaveLotModal();

      setTimeout(() => {
        const gradeEl = $(LOT_FIELDS.mProductGradeId);
        const lotEl = $(LOT_FIELDS.mLotCode);

        if (gradeEl) gradeEl.focus();
        else lotEl?.focus();
      }, 50);
    }

    function closeModal() {
      const dlg = $(LOT_FIELDS.modalDialog);
      if (!dlg) return;

      dlg.onkeydown = null;

      if (dlg.open) dlg.close();
    }

    function modalLotId() {
      const id = Number(getVal(LOT_FIELDS.mLotId) || 0);
      return id > 0 ? id : null;
    }

    function modalPayload() {
      return {
        product_stock_id: Number(__product_stock_id || 0) || null,
        product_grade_id: Number(getVal(LOT_FIELDS.mProductGradeId) || 0) || null,
        lot_code: String(getVal(LOT_FIELDS.mLotCode) || '').trim(),
        expires_at: getVal(LOT_FIELDS.mExpiresAt) || null,
        qty_on_hand: toNum(getVal(LOT_FIELDS.mQtyOnHand), 0),
        cost_unit: toNumOrNull(getVal(LOT_FIELDS.mCostUnit)),
        nfe_key: String(getVal(LOT_FIELDS.mNfeKey) || '').replace(/\D/g, '') || null,
        nfe_item_seq: Number(getVal(LOT_FIELDS.mNfeItemSeq) || 0) || null,
        is_active: true,
      };
    }

    async function refreshSafe() {
      if (!hasLotsDom() || !lotsEnabled()) return;
      ensureVisibleState();
      if (!__product_stock_id) return;

      if (state.mode === 'fefo') await loadFefo();
      else await loadList(1);
    }

    async function loadList(page = 1) {
      if (!lotsEnabled() || !__product_stock_id) return;
      state.mode = 'list';

      const f = readFilters();
      state.page = page;
      state.limit = f.limit;

      const data = await LotsApi.list({
        product_stock_id: __product_stock_id,
        q: f.q,
        onlyAvailable: f.onlyAvailable,
        orderBy: f.orderBy,
        dir: f.dir,
        page,
        limit: f.limit,
        showInactive: f.showInactive,
      });

      state.rows = data.rows || [];
      state.total = Number(data.total || 0);
      renderTable(state.rows);
      setPagingLabel();
    }

    async function loadFefo() {
      if (!lotsEnabled() || !__product_stock_id) return;
      state.mode = 'fefo';

      const data = await LotsApi.fefo(__product_stock_id);
      const rows = data.rows || [];

      state.rows = rows;
      state.total = rows.length;
      renderTable(rows);
      setPagingLabel();
    }

    async function saveModal() {
      if (!__product_stock_id) {
        ctx.toast?.('⚠️ Salve o estoque antes de criar lotes.', 'warning');
        return;
      }

      const payload = modalPayload();
      if (!payload.lot_code) {
        ctx.toast?.('⚠️ Informe o lote.', 'warning');
        $(LOT_FIELDS.mLotCode)?.focus();
        return;
      }

      const id = modalLotId();

      if (!id) {
        await LotsApi.create(payload);
        ctx.toast?.('✅ Lote criado/adicionado!', 'success');
      } else {
        const patch = { ...payload };
        delete patch.product_stock_id;
        await LotsApi.update(id, patch);
        ctx.toast?.('✅ Lote atualizado!', 'success');
      }

      closeModal();
      await refreshSafe();
    }

    async function deleteModal() {
      const id = modalLotId();
      if (!id) return;
      if (!confirm(`Excluir lote #${id}?`)) return;

      await LotsApi.remove(id);
      ctx.toast?.('✅ Lote excluído!', 'success');
      closeModal();
      await refreshSafe();
    }

    async function runOp(op) {
      const id = modalLotId();
      if (!id) {
        ctx.toast?.('⚠️ Salve o lote antes de operar.', 'warning');
        return;
      }
      const qty = toNum(getVal(LOT_FIELDS.opQty), 0);
      if (!(qty > 0)) {
        ctx.toast?.('⚠️ Quantidade inválida.', 'warning');
        return;
      }

      if (op === 'reserve') await LotsApi.reserve(id, qty);
      if (op === 'unreserve') await LotsApi.unreserve(id, qty);
      if (op === 'consume') {
        if (!confirm(`Confirmar baixa (consume) de ${qty}?`)) return;
        await LotsApi.consume(id, qty);
      }

      const fresh = await getCompleteLotById(id);
      openModal('edit', fresh);

      ctx.toast?.('✅ Operação realizada.', 'success');
      await refreshSafe();
    }

    function pickQtyPrompt(def = 1) {
      const raw = prompt('Quantidade:', String(def));
      if (raw === null) return null;
      const q = toNum(raw, 0);
      if (!(q > 0)) return null;
      return q;
    }

    function attachHandlers() {
      if (!hasLotsDom() || !lotsEnabled()) return;

      const fiscalRuleButton = $(LOT_FIELDS.btnApplyFiscalCostRule);
      if (fiscalRuleButton && !fiscalRuleButton.dataset.fiscalRuleBound) {
        fiscalRuleButton.dataset.fiscalRuleBound = 'true';
        fiscalRuleButton.addEventListener('click', () => {
          applyFiscalCostRule().catch(async error => {
            console.error('[tabStock][fiscalRule]', error);

            await showLotAlert({
              variant: 'error',
              title: 'Ocorreu um erro',
              message: error?.message || String(error),
              okText: 'OK',
            });
          });
        });
      }

      // toolbar
      $(LOT_FIELDS.btnRefresh)?.addEventListener('click', () => refreshSafe().catch(e => ctx.toast?.(e.message, 'error')));
      $(LOT_FIELDS.btnNew)?.addEventListener('click', () => openModal('new'));
      $(LOT_FIELDS.btnFefo)?.addEventListener('click', () => loadFefo().catch(e => ctx.toast?.(e.message, 'error')));

      // filters
      [LOT_FIELDS.fQ, LOT_FIELDS.fOnlyAvailable, LOT_FIELDS.fShowInactive, LOT_FIELDS.fOrderBy, LOT_FIELDS.fDir, LOT_FIELDS.fLimit]
        .forEach(sel => {
          $(sel)?.addEventListener('change', () => loadList(1).catch(e => ctx.toast?.(e.message, 'error')));
          $(sel)?.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
              ev.preventDefault();
              loadList(1).catch(e => ctx.toast?.(e.message, 'error'));
            }
          });
        });

      // table actions
      $(LOT_FIELDS.tbody)?.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('button[data-act]');
        if (!btn) return;

        const act = btn.getAttribute('data-act');
        const id = Number(btn.getAttribute('data-id'));
        if (!id) return;

        try {
          if (act === 'edit') {
            const row = await getCompleteLotById(id);
            openModal('edit', row);
            return;
          }

          const qty = pickQtyPrompt(1);
          if (!qty) return;

          if (act === 'reserve') await LotsApi.reserve(id, qty);
          if (act === 'unreserve') await LotsApi.unreserve(id, qty);
          if (act === 'consume') {
            if (!confirm(`Confirmar baixa (consume) de ${qty}?`)) return;
            await LotsApi.consume(id, qty);
          }

          ctx.toast?.('✅ Operação aplicada!', 'success');
          await refreshSafe();
        } catch (e) {
          console.error('[tabStock][lots] action error:', e);
          ctx.toast?.(`❌ ${e.message}`, 'error');
        }
      });

      $('#btnCopyLotNfeKey')?.addEventListener('click', async () => {
        const key = getVal(LOT_FIELDS.mNfeKey)
          .replace(/\D/g, '');

        if (!key) {
          ctx.toast?.('⚠️ Lote sem chave NF-e.', 'warning');
          return;
        }

        try {
          await navigator.clipboard.writeText(key);
          ctx.toast?.('✅ Chave NF-e copiada!', 'success');
        } catch {
          ctx.toast?.('❌ Não foi possível copiar a chave.', 'error');
        }
      });

      // modal close/cancel
      $(LOT_FIELDS.btnCloseModal)?.addEventListener('click', closeModal);
      $(LOT_FIELDS.btnCancelModal)?.addEventListener('click', closeModal);

      // dialog cancel (ESC / click backdrop)
      const dlg = $(LOT_FIELDS.modalDialog);
      dlg?.addEventListener('cancel', (ev) => {
        ev.preventDefault();
        closeModal();
      });

      // modal save/delete
      $(LOT_FIELDS.btnSaveModal)?.addEventListener('click', () => saveModal().catch(e => ctx.toast?.(e.message, 'error')));
      $(LOT_FIELDS.btnDeleteModal)?.addEventListener('click', () => deleteModal().catch(e => ctx.toast?.(e.message, 'error')));

      // modal operations
      $(LOT_FIELDS.btnReserve)?.addEventListener('click', () => runOp('reserve').catch(e => ctx.toast?.(e.message, 'error')));
      $(LOT_FIELDS.btnUnreserve)?.addEventListener('click', () => runOp('unreserve').catch(e => ctx.toast?.(e.message, 'error')));
      $(LOT_FIELDS.btnConsume)?.addEventListener('click', () => runOp('consume').catch(e => ctx.toast?.(e.message, 'error')));

      const operationQuantity = $(LOT_FIELDS.opQty);
      if (operationQuantity && !operationQuantity.dataset.fiscalPreviewBound) {
        operationQuantity.dataset.fiscalPreviewBound = 'true';
        operationQuantity.addEventListener('input', renderFiscalPreview);
        operationQuantity.addEventListener('change', renderFiscalPreview);
      }
    }

    return {
      attachHandlers,
      refreshSafe,
      loadList,
      loadFefo,
      openModal,
      closeModal,
      ensureVisibleState,
      enabled: lotsEnabled,
    };
  })();

  /* ─────────────────────────────────────────
     INIT (Stock)
  ───────────────────────────────────────── */
  await resolveStockMode();
  applyStockModeUI();

  // Clear any stock/lot state inherited from a previously opened product before
  // resolving the current product. This avoids a brief or persistent display of
  // the previous product's stock id and lot rows while the request is in flight.
  __product_stock_id = null;
  preencherStockForm({
    product_stock_id: null,
    stock_qty: 0,
    stock_min: 0,
    stock_max: 0,
  });

  const initialLotsTbody = $(LOT_FIELDS.tbody);
  if (initialLotsTbody) {
    initialLotsTbody.innerHTML = '<tr><td colspan="10" class="muted" style="padding:12px 14px;">Carregando lotes do produto...</td></tr>';
  }

  console.log('============================================================');
  console.log('[tabStock][CURRENT PRODUCT]', {
    productId: Number(productId),
    initialProductStockId: Number(initialProductStockId || 0) || null,
    url: window.location.href,
    urlProductCode: new URLSearchParams(window.location.search).get('product_code'),
  });
  console.log('============================================================');

  try {
    // Resolve product_id -> product_stock_id exclusively for the CURRENT product.
    console.log('[tabStock][INIT] Resolvendo estoque do produto:', {
      productId: Number(productId),
    });

    const stock = await StockApi.getByProductCode(currentProductCode).catch((error) => {
      console.warn('[tabStock] Falha ao carregar estoque pelo product_code:', {
        productId: Number(productId),
        productCode: currentProductCode,
        error: error?.message || error,
      });
      return null;
    });

    // Reject a response that explicitly belongs to another product.
    if (
      stock?.product_id != null &&
      Number(stock.product_id) !== Number(productId)
    ) {
      console.error('[tabStock][SECURITY] Estoque pertence a outro produto.', {
        expectedProductId: Number(productId),
        returnedProductId: Number(stock.product_id),
        returnedStockId: Number(stock.product_stock_id),
        stock,
      });

      throw new Error(
        `Estoque inconsistente: produto atual ${Number(productId)}, ` +
        `mas a API retornou estoque do produto ${Number(stock.product_id)}.`,
      );
    }

    // Never fall back to initialProductStockId: it can be stale.
    __product_stock_id = Number(stock?.product_stock_id ?? 0) || null;

    console.log('[tabStock][INIT] Estoque resolvido:', {
      productId: Number(productId),
      productStockId: __product_stock_id,
      stock,
    });

    preencherStockForm(
      stock || {
        product_stock_id: null,
        product_id: Number(productId),
        stock_qty: 0,
        stock_min: 0,
        stock_max: 0,
      },
    );

    // Clear stale lot rows before loading lots from the current stock.
    const tbody = $(LOT_FIELDS.tbody);
    if (tbody) {
      tbody.innerHTML = __product_stock_id
        ? `<tr><td colspan="10" class="muted" style="padding:12px 14px;">Carregando lotes do estoque #${escapeHtml(__product_stock_id)}...</td></tr>`
        : '<tr><td colspan="10" class="muted" style="padding:12px 14px;">Produto sem registro de estoque.</td></tr>';
    }

    const paging = $(LOT_FIELDS.paging);
    if (paging) {
      paging.textContent = __product_stock_id ? 'Carregando...' : '0 registro(s)';
    }
  } catch (err) {
    console.error('[tabStock] Falha ao carregar estoque do produto:', {
      productId: Number(productId),
      error: err?.message || err,
    });

    // Never preserve a stock id from another product after failure.
    __product_stock_id = null;

    preencherStockForm({
      product_stock_id: null,
      product_id: Number(productId),
      stock_qty: 0,
      stock_min: 0,
      stock_max: 0,
    });

    const tbody = $(LOT_FIELDS.tbody);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="muted" style="padding:12px 14px;">Não foi possível carregar o estoque deste produto.</td></tr>';
    }

    const paging = $(LOT_FIELDS.paging);
    if (paging) paging.textContent = '0 registro(s)';

    LotsUI.ensureVisibleState();
    ctx.toast?.(`❌ Falha ao carregar estoque: ${err.message}`, 'error');
  }

  attachStockHandlers();

  /* ─────────────────────────────────────────
     INIT (Lots)
  ───────────────────────────────────────── */
  if (LotsUI.enabled()) {
    LotsUI.attachHandlers();
    GradeQuickUI.attachHandlers();
    LotsUI.ensureVisibleState();
    await LotsUI.refreshSafe();
    await carregarGradesDoProduto();
  } else {
    LotsUI.ensureVisibleState();
  }

  return {
    get stockId() { return __product_stock_id; },
    get stockMode() { return __stockMode.mode; },
    save: salvarStock,
    reload: async () => {
      await resolveStockMode();
      applyStockModeUI();

      const s = await StockApi.getByProductCode(currentProductCode).catch((error) => {
        console.warn(
          '[tabStock] Falha ao recarregar estoque pelo product_code:',
          error?.message || error,
        );
        return null;
      });

      // Same safety rule used during init: the response must belong to the current product.
      if (
        s?.product_id != null &&
        Number(s.product_id) !== Number(productId)
      ) {
        console.error('[tabStock][RELOAD] Estoque pertence a outro produto.', {
          expectedProductId: Number(productId),
          returnedProductId: Number(s.product_id),
          returnedStockId: Number(s.product_stock_id),
          stock: s,
        });
        throw new Error(
          `Estoque inconsistente: produto atual ${Number(productId)}, ` +
          `mas a API retornou estoque do produto ${Number(s.product_id)}.`,
        );
      }

      __product_stock_id = Number(s?.product_stock_id ?? 0) || null;

      preencherStockForm(s || {
        product_stock_id: null,
        stock_qty: 0,
        stock_min: 0,
        stock_max: 0,
      });

      LotsUI.ensureVisibleState();

      if (LotsUI.enabled() && __product_stock_id) {
        await LotsUI.refreshSafe();
      } else if (LotsUI.enabled()) {
        // Prevent rows from a previously opened product from remaining visible
        // when the current product has no stock record or the stock endpoint fails.
        const tbody = $(LOT_FIELDS.tbody);
        if (tbody) {
          tbody.innerHTML = '<tr><td colspan="10" class="muted" style="padding:12px 14px;">Salve o estoque para habilitar os lotes.</td></tr>';
        }
        const paging = $(LOT_FIELDS.paging);
        if (paging) paging.textContent = '0 registro(s)';
      }

      return s;
    },
    lots: {
      enabled: LotsUI.enabled,
      refresh: LotsUI.refreshSafe,
      fefo: LotsUI.loadFefo,
    }
  };
}
