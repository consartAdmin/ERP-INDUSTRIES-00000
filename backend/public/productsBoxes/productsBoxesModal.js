/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ productsBoxesModal.js — Modal Item (SKU) | PRODNEX ERP               ║
   ║ Path: backend/public/productsBoxes/productsBoxesModal.js             ║
   ║ Exporta: openProductsBoxesItemModal({ apiBase, title, initial, onPickProduct }) ║
   ║ ✅ ENTER no SKU abre busca (igual F2)                                 ║
   ║ ✅ ENTER inteligente (vazio => busca / preenchido => próxima etapa)   ║
   ║ ✅ CSS robusto via import.meta.url (não quebra em rotas diferentes)   ║
   ║ ✅ Botões padrão: btn btn-toolbar btn-sm                              ║
   ║ ✅ ALERTAS: validações via centerAlertModal (SEM quebrar o módulo)    ║
   ║ ✅ HARDEN: se import falhar => fallback alert()                       ║
   ║ ✅ FIX: “toastCenter” aqui é SOMENTE modal central (não toast UI)     ║
   ║ ✅ FIX: resolve sempre Promise do modal (não deixa “pendurado”)       ║
   ╚══════════════════════════════════════════════════════════════════════╝ */

'use strict';

const STACK_KEY = '__consartProductsBoxesModalStack__';
const CSS_ID = '__pbxm_css__';

// ✅ ajuste aqui se seu caminho for diferente
const CENTER_ALERT_MODULE_PATH = '/public/includes/js/centerAlertModal.js';

function getStack() {
  if (!window[STACK_KEY]) window[STACK_KEY] = [];
  return window[STACK_KEY];
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[m]));
}

function normalizeStr(v) {
  const s = String(v ?? '').trim();
  return s ? s : '';
}

function toNumOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ──────────────────────────────────────────────────────────────
   CenterAlert — loader seguro (não quebra o módulo se falhar)
────────────────────────────────────────────────────────────── */
let __centerAlertPromise = null;

async function getShowCenterModal() {
  try {
    if (!__centerAlertPromise) {
      // ✅ dynamic import (se falhar, não derruba o arquivo)
      __centerAlertPromise = import(CENTER_ALERT_MODULE_PATH);
    }
    const mod = await __centerAlertPromise;
    return typeof mod?.showCenterModal === 'function' ? mod.showCenterModal : null;
  } catch (e) {
    console.warn('[productsBoxesModal] centerAlert import falhou:', e);
    return null;
  }
}

/**
 * ⚠️ “toastCenter” aqui = modal central CONSART (não toast flutuante).
 * - Sempre tenta showCenterModal; se falhar, usa alert().
 */
async function toastCenter(message, type = 'info', title) {
  const map = { info: 'info', success: 'success', warning: 'warning', error: 'error' };
  const variant = map[type] || 'info';

  const defaultTitle =
    variant === 'success' ? 'Tudo certo!'
      : variant === 'warning' ? 'Atenção'
        : variant === 'error' ? 'Ocorreu um erro'
          : 'Informação';

  const t = title ?? defaultTitle;
  const m = String(message ?? '');

  const showCenterModal = await getShowCenterModal();

  // ✅ fallback se não existir / falhar
  if (!showCenterModal) {
    alert(`${t}\n\n${m}`);
    return;
  }

  try {
    // ⚠️ showCenterModal resolve com true/false/null/btn — não precisamos do retorno aqui
    await showCenterModal({
      variant,
      title: t,
      message: m,
      timeoutMs: null, // ✅ validação: não auto-some
      okText: 'OK',
      closeText: 'Fechar',
    });
  } catch (e) {
    console.warn('[productsBoxesModal] showCenterModal falhou:', e);
    alert(`${t}\n\n${m}`);
  }
}

/* ──────────────────────────────────────────────────────────────
   CSS Loader
────────────────────────────────────────────────────────────── */
async function ensureCssLoaded() {
  if (document.getElementById(CSS_ID)) return;

  const cssUrl = new URL('./productsBoxesModal.css', import.meta.url).href;

  const link = document.createElement('link');
  link.id = CSS_ID;
  link.rel = 'stylesheet';
  link.href = cssUrl;

  const loaded = new Promise((resolve) => {
    link.addEventListener('load', () => resolve(true), { once: true });
    link.addEventListener('error', () => resolve(false), { once: true });
  });

  document.head.appendChild(link);

  const ok = await loaded;

  if (!ok) {
    console.warn('[productsBoxesModal] CSS não carregou:', cssUrl, '=> fallback mínimo.');
    link.remove();

    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      .pbxm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:99998;padding:16px}
      .pbxm-dialog{width:min(720px,calc(100vw - 26px));background:#fff;border-radius:18px;border:1px solid #e5e7eb;box-shadow:0 18px 60px rgba(0,0,0,.22);overflow:hidden}
      .pbxm-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
      .pbxm-header h3{margin:0;font-size:15px;color:#111}
      .pbxm-close{border:1px solid #d1d5db;background:#fff;color:#111;width:36px;height:36px;border-radius:12px;cursor:pointer}
      .pbxm-body{padding:14px}
      .pbxm-grid{display:grid;grid-template-columns:1.2fr .8fr .6fr;gap:12px}
      .pbxm-field label{display:block;font-size:12px;color:#6b7280;margin-bottom:6px}
      .pbxm-field input,.pbxm-field textarea{width:100%;border:1px solid #d1d5db;background:#fff;color:#111;padding:10px;border-radius:12px;outline:none;font-size:13px}
      .pbxm-field textarea{resize:vertical;min-height:56px}
      .pbxm-span3{grid-column:span 3}
      .pbxm-skuWrap{position:relative}
      .pbxm-footer{padding:12px 14px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px;background:#f8fafc}
      .pbxm-suggest{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:99999;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 14px 30px rgba(0,0,0,.12);overflow:hidden;max-height:260px}
      .pbxm-suggest[hidden]{display:none!important}
      @media(max-width:620px){.pbxm-grid{grid-template-columns:1fr}.pbxm-span3{grid-column:span 1}}
    `;
    document.head.appendChild(style);
  }
}

/* ──────────────────────────────────────────────────────────────
   Modal
────────────────────────────────────────────────────────────── */
export function openProductsBoxesItemModal({
  apiBase = '',
  title = 'Adicionar / Atualizar Item',
  initial = null,
  onPickProduct = null,
} = {}) {
  return new Promise(async (resolve) => {
    await ensureCssLoaded();

    const stack = getStack();

    const backdrop = document.createElement('div');
    backdrop.className = 'pbxm-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'pbxm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    dialog.innerHTML = `
      <div class="pbxm-header">
        <h3>${escHtml(title)}</h3>
        <button class="pbxm-close" type="button" data-act="close" title="Fechar">✕</button>
      </div>

      <div class="pbxm-body">
        <div class="pbxm-grid">
          <div class="pbxm-field pbxm-skuWrap">
            <label>SKU *</label>
            <input id="pbxm_sku" type="text" maxlength="60"
              placeholder="Digite o SKU... (F2 ou Enter para buscar)" />
            <div class="pbxm-suggest" id="pbxm_suggest" hidden></div>
          </div>

          <div class="pbxm-field">
            <label>Quantidade *</label>
            <input id="pbxm_qty" type="number" step="0.001" min="0" placeholder="1" />
          </div>

          <div class="pbxm-field">
            <label>Unidade</label>
            <input id="pbxm_unit" type="text" maxlength="20" placeholder="UN" />
          </div>

          <div class="pbxm-field pbxm-span3">
            <label>Descrição (Produto)</label>
            <input id="pbxm_desc" type="text" maxlength="240"
              placeholder="Será preenchida ao buscar o produto..." readonly />
          </div>

          <div class="pbxm-field pbxm-span3">
            <label>Observação (Item)</label>
            <textarea id="pbxm_notes" rows="2" placeholder="Ex: frágil, manter em pé, etc."></textarea>
          </div>
        </div>
      </div>

      <div class="pbxm-footer">
        <button class="btn btn-toolbar btn-sm" type="button" data-act="cancel">Cancelar</button>
        <button class="btn btn-toolbar btn-sm" type="button" data-act="save">Salvar Item</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const $ = (sel) => dialog.querySelector(sel);
    const skuEl     = $('#pbxm_sku');
    const qtyEl     = $('#pbxm_qty');
    const unitEl    = $('#pbxm_unit');
    const descEl    = $('#pbxm_desc');
    const notesEl   = $('#pbxm_notes');
    const suggestEl = $('#pbxm_suggest'); // reservado p/ futuro

    // fill initial
    if (initial) {
      skuEl.value   = normalizeStr(initial.sku);
      qtyEl.value   = initial.quantity != null ? String(initial.quantity) : '';
      unitEl.value  = normalizeStr(initial.unit);
      descEl.value  = normalizeStr(initial.desc ?? initial.product_description ?? '');
      notesEl.value = normalizeStr(initial.notes);
    }

    // stack + close logic
    const myStackItem = { close: null };
    stack.push(myStackItem);

    let closed = false;

    function cleanup() {
      if (closed) return;
      closed = true;

      const idx = stack.indexOf(myStackItem);
      if (idx >= 0) stack.splice(idx, 1);

      window.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
    }

    function close(ret = null) {
      cleanup();
      resolve(ret);
    }

    myStackItem.close = close;

    // ✅ validação (com modal central / fallback alert)
    async function validateAndGet() {
      const sku = normalizeStr(skuEl.value);
      const qty = toNumOrNull(qtyEl.value);

      if (!sku) {
        await toastCenter('SKU é obrigatório.', 'warning', 'Atenção');
        skuEl.focus();
        return { error: true };
      }

      if (qty == null || qty <= 0) {
        await toastCenter('Quantidade deve ser maior que 0.', 'warning', 'Atenção');
        qtyEl.focus();
        return { error: true };
      }

      return {
        value: {
          sku,
          quantity: qty,
          unit: normalizeStr(unitEl.value) || null,
          desc: normalizeStr(descEl.value) || null,
          notes: normalizeStr(notesEl.value) || null,
        },
      };
    }

    // ESC robusto: só fecha o topo da stack
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      const top = getStack().at(-1);
      if (top !== myStackItem) return;
      e.preventDefault();
      close(null);
    }
    window.addEventListener('keydown', onKeyDown, true);

    // backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(null);
    });

    // footer/header buttons
    dialog.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const act = btn.getAttribute('data-act');
      if (act === 'close' || act === 'cancel') return close(null);

      if (act === 'save') {
        const res = await validateAndGet();
        if (res?.error) return;
        return close(res.value);
      }
    });

    // Product picker integration
    function pickProduct() {
      if (typeof onPickProduct !== 'function') return;

      onPickProduct({
        setSku:   (v) => { skuEl.value  = normalizeStr(v); },
        setUnit:  (v) => { if (!unitEl.value) unitEl.value = normalizeStr(v); },
        setDesc:  (v) => { descEl.value = normalizeStr(v); },
        setNotes: (v) => { if (!notesEl.value) notesEl.value = normalizeStr(v); },
        focusQty: () => qtyEl.focus(),
      });
    }

    // ✅ ENTER inteligente:
    skuEl.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        pickProduct();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const skuNow = normalizeStr(skuEl.value);
        if (!skuNow && typeof onPickProduct === 'function') pickProduct();
        else qtyEl.focus();
      }
    });

    // dblclick abre busca
    skuEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      pickProduct();
    });

    // Enter flow (restante)
    qtyEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); unitEl.focus(); }
    });
    unitEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); notesEl.focus(); }
    });

    // focus
    setTimeout(() => skuEl.focus(), 0);

    // evita “variável não usada” em bundlers mais chatos
    void apiBase;
    void suggestEl;
  });
}
