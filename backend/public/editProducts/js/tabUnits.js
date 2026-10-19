// ╔══════════════════════════════════════════════════════════════════════╗
// ║ tabUnits.js — Aba Unidades (productsBarCode)                        ║
// ║ PRODNEX ERP — ESM                                                   ║
// ║ ✅ Botão Gerar barcode                                               ║
// ║ ✅ Geração automática se barcode estiver vazio                       ║
// ║ ✅ Editar unidade/barcode                                            ║
// ║ ✅ Controle de barcode ativo/inativo                                 ║
// ║ ✅ Imagem por unidade (productsImages.barcode_id)                    ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  listProductImages,
  uploadProductImage,
  deleteProductImage,
  PRODUCT_IMAGES_CHANGED,
  notifyProductImagesChanged,
} from './productImagesApi.js';

const UNITS_EVENT_SOURCE = 'units';
const UNIT_IMAGE_TYPES = /^image\/(jpeg|png|webp)$/i;

function escAttr(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

// Mapa barcode_id → imagem principal ativa da unidade.
function buildUnitImagesMap(images = []) {
  const map = new Map();

  images
    .filter((img) => img.barcode_id != null && img.is_active !== false)
    .sort((a, b) =>
      Number(!!b.is_primary) - Number(!!a.is_primary) ||
      Number(a.position ?? 0) - Number(b.position ?? 0) ||
      Number(a.product_image_id) - Number(b.product_image_id))
    .forEach((img) => {
      const key = Number(img.barcode_id);
      if (!map.has(key)) map.set(key, img);
    });

  return map;
}

export async function initUnitsTab(ctx, { productId, productCode }) {
  const UI_UNITS = {
    sel: ['#unidadeSelect'],
    fator: ['#unitFactor'],
    desc: ['#unitDesc'],
    barcode: ['#unitBarcode'],

    width: ['#unitWidth'],
    length: ['#unitLength'],
    height: ['#unitHeight'],
    weight: ['#unitWeight'],

    btnGenerate: ['#btnGenerateUnitBarcode'],
    ativo: ['#unitIsActive'],
    padrao: ['#unitIsDefault'],
    form: ['#formUnitProduct'],
    tbody: ['#unitsTableBody'],
  };

  let editingBarcodeId = null;

  const qUnit = (key) => {
    for (const s of UI_UNITS[key] || []) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  const safeToast = (message, type = 'info') => {
    try {
      if (typeof ctx.toast === 'function') return ctx.toast(message, type);
      if (ctx.toast && typeof ctx.toast[type] === 'function') return ctx.toast[type](message);
      if (ctx.toast && typeof ctx.toast.show === 'function') return ctx.toast.show(message, type);
    } catch (_) { }
    console[type === 'error' ? 'error' : 'log'](message);
  };

  const UnitsApi = (() => {
    const normalizeRows = (resp) => resp?.rows || resp?.data?.rows || resp?.data || resp || [];

    async function tryGet(urls) {
      const list = Array.isArray(urls) ? urls : [urls];
      let lastErr;

      for (const u of list) {
        try {
          return await ctx.jfetch(u);
        } catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('not found') || msg.includes('404')) continue;
        }
      }

      throw lastErr || new Error('Endpoints de unidades indisponíveis');
    }

    async function trySend(method, urls, body) {
      const list = Array.isArray(urls) ? urls : [urls];
      let lastErr;

      for (const u of list) {
        try {
          return await ctx.jfetch(u, {
            method,
            body: body ? JSON.stringify(body) : undefined,
          });
        } catch (e) {
          lastErr = e;
          const msg = String(e?.message || '').toLowerCase();
          if (msg.includes('not found') || msg.includes('404')) continue;
        }
      }

      throw lastErr || new Error('Falha ao enviar para endpoints de unidades');
    }

    async function listCatalog() {
      const r = await ctx.jfetch('/api/units?onlyActive=true&limit=9999&offset=0');

      const rows = normalizeRows(r)
        .map((u) => ({
          unit_id: Number(u.unit_id ?? u.id),
          unit: (u.unit ?? u.sigla ?? '').toString().toUpperCase(),
          description: u.description ?? u.descricao ?? '',
          fator: u.fator == null ? null : Number(u.fator),
        }))
        .filter((u) => Number.isInteger(u.unit_id) && u.unit);

      rows.sort((a, b) => a.unit.localeCompare(b.unit));
      return rows;
    }

    async function listByProduct({ productId: pid, productCode: sku }) {
      const r = await tryGet(
        ctx.ROUTES.productUnitsList({
          product_code: String(sku || '').trim(),
          product_id: pid,
        })
      );

      const data = Array.isArray(r?.rows) ? r.rows : Array.isArray(r) ? r : normalizeRows(r);

      const rows = data
        .map((pu) => ({
          barcode_id: Number(pu.barcode_id ?? pu.id),
          product_unit_id: Number(pu.product_unit_id ?? pu.unit_id ?? pu.id),

          product_code: String(pu.product_code ?? pu.productCode ?? ''),
          unit_id: pu.unit_id == null ? null : Number(pu.unit_id),
          unit: (pu.unit ?? '').toString().toUpperCase(),
          fator: pu.fator == null ? null : Number(pu.fator),
          description: pu.description ?? pu.descricao ?? '',
          barcode: pu.barcode ?? '',

          width_cm: pu.width_cm == null ? null : Number(pu.width_cm),
          length_cm: pu.length_cm == null ? null : Number(pu.length_cm),
          height_cm: pu.height_cm == null ? null : Number(pu.height_cm),
          weight_kg: pu.weight_kg == null ? null : Number(pu.weight_kg),

          is_active: pu.is_active !== false,
          standard: !!(pu.standard ?? pu.padrao),
        }))
        .filter((pu) => pu.barcode_id);

      rows.sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          Number(b.standard) - Number(a.standard) ||
          a.unit.localeCompare(b.unit)
      );

      return rows;
    }

    async function upsert(payload) {
      return trySend('POST', ctx.ROUTES.productUnitsUpsert, payload);
    }

    async function update(id, patch) {
      return trySend('PUT', ctx.ROUTES.productUnitById(id), patch);
    }

    async function remove(id) {
      return trySend('DELETE', ctx.ROUTES.productUnitById(id));
    }

    return { listCatalog, listByProduct, upsert, update, remove };
  })();

  let __unitsCatalog = [];

  function onlyDigits(v) {
    return String(v ?? '').replace(/\D+/g, '');
  }

  function sanitizeFactor(v) {
    const n = ctx.Num.toNumOrNull(v);
    if (n == null || !isFinite(n) || n <= 0) return 1;
    return n;
  }

  function normalizeBarcode(v) {
    if (typeof ctx.normalizeBarcode === 'function') return ctx.normalizeBarcode(v);
    return onlyDigits(v);
  }

  function calcEan13CheckDigit(base12) {
    const clean = onlyDigits(base12);

    if (clean.length !== 12) {
      throw new Error('Base do EAN-13 deve conter 12 dígitos.');
    }

    let sum = 0;

    for (let i = 0; i < 12; i += 1) {
      const digit = Number(clean[i]);
      sum += digit * (i % 2 === 0 ? 1 : 3);
    }

    const mod = sum % 10;
    return mod === 0 ? 0 : 10 - mod;
  }

  function buildAutoBarcode({ sku, unitId, fator }) {
    const skuDigits = onlyDigits(sku).padStart(6, '0').slice(-6);
    const unitDigits = onlyDigits(unitId).padStart(2, '0').slice(-2);

    const fatorNum = sanitizeFactor(fator);
    const fatorScaled = Math.round(fatorNum * 10);
    const fatorDigits = String(fatorScaled).padStart(3, '0').slice(-3);

    const base12 = `2${skuDigits}${unitDigits}${fatorDigits}`;
    const checkDigit = calcEan13CheckDigit(base12);

    return `${base12}${checkDigit}`;
  }

  function getSelectedUnitPayload() {
    const sel = qUnit('sel');
    if (!sel || !sel.value) return null;

    const opt = sel.options[sel.selectedIndex];
    const unit_id = Number(sel.value);

    if (!Number.isInteger(unit_id)) return null;

    const unitSigla = (opt?.dataset?.sigla || opt?.textContent?.split('—')[0]?.trim() || '').toUpperCase();
    const fator = sanitizeFactor(opt?.dataset?.fator ?? 1);
    const description = (opt?.dataset?.descricao || '').trim();

    return { unit_id, unitSigla, fator, description, opt };
  }

  function fillUnitFieldsFromCatalog() {
    const sel = qUnit('sel');
    if (!sel) return;

    const idSel = Number(sel.value);
    const opt = sel.options[sel.selectedIndex];
    const u = __unitsCatalog.find((item) => Number(item.unit_id) === idSel);

    const fatorOpt = opt?.dataset?.fator != null ? Number(opt.dataset.fator) : null;
    const descOpt = opt?.dataset?.descricao || '';

    const fator = u && u.fator != null ? Number(u.fator) : Number.isFinite(fatorOpt) ? fatorOpt : 1;
    const desc = u && u.description ? u.description : descOpt;

    const inpF = qUnit('fator');
    const inpD = qUnit('desc');

    if (inpF) inpF.value = ctx.Num.formatBR(fator, 4);
    if (inpD) inpD.value = desc || '';
  }

  function lockUnitFields() {
    const inpF = qUnit('fator');
    const inpD = qUnit('desc');

    const block = (ev) => {
      if (ev.type === 'keydown') {
        const k = ev.key;
        const editingKeys = ['Backspace', 'Delete', 'Enter', ' ', '+', ',', '.', '-', '/', '*'];
        if (editingKeys.includes(k) || k.length === 1) ev.preventDefault();
      } else {
        ev.preventDefault();
      }
    };

    [inpF, inpD].forEach((el) => {
      if (!el || el.__locked) return;

      el.readOnly = true;
      el.setAttribute('aria-readonly', 'true');
      el.addEventListener('keydown', block);
      el.addEventListener('beforeinput', block);
      el.addEventListener('paste', block);
      el.addEventListener('drop', block);
      el.addEventListener('input', block);
      el.__locked = true;
    });
  }

  function fillGeneratedBarcode() {
    const selected = getSelectedUnitPayload();
    const inpBarcode = qUnit('barcode');

    if (!selected) {
      safeToast('Selecione uma unidade antes de gerar o código de barras.', 'error');
      qUnit('sel')?.focus();
      return;
    }

    const sku = String(productCode || '').trim();

    if (!sku) {
      safeToast('❌ product_code (SKU) não encontrado para gerar barcode.', 'error');
      return;
    }

    const generated = buildAutoBarcode({
      sku,
      unitId: selected.unit_id,
      fator: selected.fator,
    });

    if (inpBarcode) inpBarcode.value = generated;

    const chkActive = qUnit('ativo');
    if (chkActive) chkActive.checked = true;

    safeToast('🎯 Código de barras gerado automaticamente!', 'success');
  }

  function renderUnitImageCell(image) {
    if (!image) {
      return '<span class="unit-image-cell unit-image-cell--empty" title="Sem imagem para esta unidade">—</span>';
    }

    return `
      <span class="unit-image-cell">
        <a href="${escAttr(image.image_url)}" target="_blank" rel="noopener" title="Abrir imagem">
          <img src="${escAttr(image.image_url)}" alt="${escAttr(image.image_alt || 'Imagem da unidade')}" loading="lazy">
        </a>
        <button type="button" class="unit-image-cell__remove act-image-remove" data-image-id="${image.product_image_id}" title="Remover imagem da unidade">✕</button>
      </span>
    `;
  }

  function renderUnitsTable(rows = [], imagesByBarcode = new Map()) {
    const tbody = qUnit('tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="12" class="muted" style="padding:12px 14px;">
            Nenhuma unidade cadastrada para este produto.
          </td>
        </tr>
      `;
      return;
    }

    rows.forEach((r) => {
      const tr = document.createElement('tr');
      tr.dataset.id = String(r.barcode_id);

      tr.innerHTML = `
        <td>${renderUnitImageCell(imagesByBarcode.get(r.barcode_id))}</td>
        <td>${r.unit || '—'}</td>
        <td>${r.description || ''}</td>
        <td>${r.fator != null ? ctx.Num.formatBR(r.fator, 4) : ''}</td>
        <td>${r.barcode || ''}</td>
        <td>${r.width_cm != null ? ctx.Num.formatBR(r.width_cm, 2) : ''}</td>
        <td>${r.length_cm != null ? ctx.Num.formatBR(r.length_cm, 2) : ''}</td>
        <td>${r.height_cm != null ? ctx.Num.formatBR(r.height_cm, 2) : ''}</td>
        <td>${r.weight_kg != null ? ctx.Num.formatBR(r.weight_kg, 3) : ''}</td>
        <td>
          ${r.is_active
          ? '<span class="badge badge-success">Sim</span>'
          : '<span class="badge badge-danger">Não</span>'
        }
        </td>
        <td>
          ${r.standard
          ? '<span class="badge badge-success">Sim</span>'
          : '<span class="badge">Não</span>'
        }
        </td>
        <td style="white-space:nowrap;">
          <div class="btn-inline btn-gap-3">
            <button type="button"  class="btn btn-new btn-sm act-edit" title="Editar unidade">✏️</button>
            <button type="button" class="btn btn-new btn-sm act-image" title="Vincular imagem à unidade">🖼️</button>
            <button type="button" class="btn btn-new btn-sm act-standard" title="Tornar Padrão">Padrão</button>
            <button type="button" class="btn btn-new btn-sm act-remove" title="Remover">🗑️</button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  async function loadUnitsCatalog() {
    const sel = qUnit('sel');
    if (!sel) return;

    const catalog = await UnitsApi.listCatalog();

    __unitsCatalog = catalog
      .map((u) => ({
        unit_id: Number(u.unit_id ?? u.id),
        unit: (u.unit ?? u.sigla ?? '').toString().toUpperCase(),
        description: u.description ?? u.descricao ?? '',
        fator: u.fator != null ? Number(u.fator) : 1,
      }))
      .filter((u) => Number.isInteger(u.unit_id));

    sel.innerHTML = '<option value="">Selecione...</option>';

    __unitsCatalog
      .sort((a, b) => a.unit.localeCompare(b.unit))
      .forEach((u) => {
        const opt = document.createElement('option');
        opt.value = String(u.unit_id);
        opt.textContent = `${u.unit}${u.description ? ` — ${u.description}` : ''}`;
        opt.dataset.sigla = u.unit;
        opt.dataset.fator = String(u.fator);
        opt.dataset.descricao = u.description || '';
        sel.appendChild(opt);
      });

    const onChange = () => fillUnitFieldsFromCatalog();

    if (!sel.__changeBound) {
      sel.addEventListener('change', onChange);
      sel.__changeBound = true;
    }

    if (window.jQuery && window.jQuery.fn) {
      const $sel = window.jQuery(sel);

      if (!sel.__select2Bound && $sel.on) {
        $sel.on('select2:select', onChange);
        sel.__select2Bound = true;
      }

      if ($sel.data('select2')) {
        $sel.trigger('change.select2');
      }
    }

    fillUnitFieldsFromCatalog();
  }

  async function loadUnitImages() {
    try {
      return buildUnitImagesMap(await listProductImages(productCode));
    } catch (err) {
      console.warn('[tabUnits] falha ao carregar imagens das unidades:', err.message);
      return new Map();
    }
  }

  async function loadProductUnits() {
    const [rows, imagesByBarcode] = await Promise.all([
      UnitsApi.listByProduct({ productId, productCode }),
      loadUnitImages(),
    ]);
    renderUnitsTable(rows, imagesByBarcode);
  }

  function pickUnitImage(barcodeId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (!UNIT_IMAGE_TYPES.test(file.type)) {
        safeToast('Use uma imagem JPG, PNG ou WebP.', 'error');
        return;
      }

      try {
        safeToast('📤 Enviando imagem da unidade...', 'info');
        await uploadProductImage(productCode, file, { barcodeId, isPrimary: true });
        safeToast('✅ Imagem vinculada à unidade!', 'success');
        notifyProductImagesChanged(UNITS_EVENT_SOURCE);
        await loadProductUnits();
      } catch (err) {
        console.error(err);
        safeToast(`⚠️ Falha ao enviar imagem: ${err.message || err}`, 'error');
      }
    });

    input.click();
  }

  async function removeUnitImage(imageId) {
    if (!confirm('Remover a imagem desta unidade?')) return;

    await deleteProductImage(imageId);
    safeToast('🗑️ Imagem da unidade removida.', 'success');
    notifyProductImagesChanged(UNITS_EVENT_SOURCE);
    await loadProductUnits();
  }

  function clearUnitForm() {
    editingBarcodeId = null;

    const chkDefault = qUnit('padrao');
    const chkActive = qUnit('ativo');

    const inpB = qUnit('barcode');
    const inpW = qUnit('width');
    const inpL = qUnit('length');
    const inpH = qUnit('height');
    const inpWG = qUnit('weight');

    if (chkDefault) chkDefault.checked = false;
    if (chkActive) chkActive.checked = true;

    if (inpB) inpB.value = '';
    if (inpW) inpW.value = '';
    if (inpL) inpL.value = '';
    if (inpH) inpH.value = '';
    if (inpWG) inpWG.value = '';
  }

  async function addUnit() {
    const selected = getSelectedUnitPayload();

    if (!selected) {
      safeToast('Selecione a unidade.', 'error');
      qUnit('sel')?.focus();
      return;
    }

    const sku = String(productCode || '').trim();

    if (!sku) {
      safeToast('❌ product_code (SKU) não encontrado para salvar unidade.', 'error');
      return;
    }

    const standard = !!qUnit('padrao')?.checked;
    const isActive = qUnit('ativo')?.checked !== false;

    const barcodeInput = qUnit('barcode');
    const barcodeRaw = barcodeInput?.value ?? '';
    let barcode = normalizeBarcode(barcodeRaw);

    if (!barcode) {
      barcode = buildAutoBarcode({
        sku,
        unitId: selected.unit_id,
        fator: selected.fator,
      });

      if (barcodeInput) barcodeInput.value = barcode;
    }

    const payload = {
      product_code: sku,
      product_unit_id: selected.unit_id,
      unit_id: selected.unit_id,
      unit: selected.unitSigla,
      fator: selected.fator,
      description: selected.description,
      barcode,
      standard,
      is_active: isActive,
      width_cm: ctx.Num.toNumOrNull(qUnit('width')?.value),
      length_cm: ctx.Num.toNumOrNull(qUnit('length')?.value),
      height_cm: ctx.Num.toNumOrNull(qUnit('height')?.value),
      weight_kg: ctx.Num.toNumOrNull(qUnit('weight')?.value),
    };

    console.log('[tabUnits][SAVE_PAYLOAD]', payload);

    if (editingBarcodeId) {
      await UnitsApi.update(editingBarcodeId, payload);
      safeToast('✅ Unidade atualizada com sucesso!', 'success');
    } else {
      await UnitsApi.upsert(payload);
      safeToast('✅ Unidade adicionada/atualizada!', 'success');
    }

    clearUnitForm();
    notifyProductImagesChanged(UNITS_EVENT_SOURCE);
    await loadProductUnits();
  }

  async function editUnit(id) {
    const rows = await UnitsApi.listByProduct({ productId, productCode });
    const item = rows.find((r) => Number(r.barcode_id) === Number(id));

    if (!item) {
      safeToast('Unidade não encontrada para edição.', 'error');
      return;
    }

    editingBarcodeId = Number(id);

    const sel = qUnit('sel');

    if (sel && item.unit_id) {
      sel.value = String(item.unit_id);
      sel.dispatchEvent(new Event('change'));
    }

    const inpB = qUnit('barcode');
    const inpW = qUnit('width');
    const inpL = qUnit('length');
    const inpH = qUnit('height');
    const inpWG = qUnit('weight');

    const chkDefault = qUnit('padrao');
    const chkActive = qUnit('ativo');

    if (inpB) inpB.value = item.barcode || '';
    if (inpW) inpW.value = item.width_cm ?? '';
    if (inpL) inpL.value = item.length_cm ?? '';
    if (inpH) inpH.value = item.height_cm ?? '';
    if (inpWG) inpWG.value = item.weight_kg ?? '';

    if (chkDefault) chkDefault.checked = !!item.standard;
    if (chkActive) chkActive.checked = item.is_active !== false;

    safeToast('✏️ Unidade carregada para edição. Ajuste os campos e clique em Adicionar.', 'info');
  }

  async function setStandard(id) {
    await UnitsApi.update(id, {
      standard: true,
      is_active: true,
    });

    const rows = await UnitsApi.listByProduct({ productId, productCode });
    const others = rows.filter((r) => Number(r.barcode_id) !== Number(id) && r.standard);

    for (const r of others) {
      try {
        await UnitsApi.update(r.barcode_id, { standard: false });
      } catch (_) { }
    }

    safeToast('✅ Unidade padrão definida!', 'success');
    await loadProductUnits();
  }

  async function removeUnit(id) {
    if (!confirm('Remover esta unidade?')) return;

    await UnitsApi.remove(id);

    if (editingBarcodeId === id) clearUnitForm();

    safeToast('🗑️ Unidade removida.', 'success');
    notifyProductImagesChanged(UNITS_EVENT_SOURCE);
    await loadProductUnits();
  }

  function attachHandlers() {
    const form = qUnit('form');

    if (form) {
      if (form.__bound) form.removeEventListener('submit', form.__bound);

      form.__bound = (e) => {
        e.preventDefault();

        addUnit().catch((err) => {
          console.error(err);
          safeToast(`⚠️ Falha ao salvar unidade: ${err.message || err}`, 'error');
        });
      };

      form.addEventListener('submit', form.__bound);
    }

    const btnGenerate = qUnit('btnGenerate');

    if (btnGenerate) {
      if (btnGenerate.__bound) btnGenerate.removeEventListener('click', btnGenerate.__bound);

      btnGenerate.__bound = () => {
        try {
          fillGeneratedBarcode();
        } catch (err) {
          console.error(err);
          safeToast(`⚠️ Falha ao gerar barcode: ${err.message || err}`, 'error');
        }
      };

      btnGenerate.addEventListener('click', btnGenerate.__bound);
    }

    const tbody = qUnit('tbody');

    if (tbody) {
      if (tbody.__bound) tbody.removeEventListener('click', tbody.__bound);

      tbody.__bound = (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;

        const tr = btn.closest('tr');
        if (!tr) return;

        const id = Number(tr.dataset.id);
        if (!Number.isInteger(id)) return;

        if (btn.classList.contains('act-image')) {
          pickUnitImage(id);
        } else if (btn.classList.contains('act-image-remove')) {
          removeUnitImage(Number(btn.dataset.imageId)).catch((err) => {
            console.error(err);
            safeToast(`⚠️ Falha ao remover imagem: ${err.message || err}`, 'error');
          });
        } else if (btn.classList.contains('act-edit')) {
          editUnit(id).catch((err) => {
            console.error(err);
            safeToast(`⚠️ Falha ao editar unidade: ${err.message || err}`, 'error');
          });
        } else if (btn.classList.contains('act-standard')) {
          setStandard(id).catch((err) => {
            console.error(err);
            safeToast(`⚠️ Falha ao definir padrão: ${err.message || err}`, 'error');
          });
        } else if (btn.classList.contains('act-remove')) {
          removeUnit(id).catch((err) => {
            console.error(err);
            safeToast(`⚠️ Falha ao remover unidade: ${err.message || err}`, 'error');
          });
        }
      };

      tbody.addEventListener('click', tbody.__bound);
    }
  }

  try {
    await loadUnitsCatalog();
    await loadProductUnits();
    attachHandlers();

    // Imagens alteradas na galeria da aba Dados Gerais.
    document.addEventListener(PRODUCT_IMAGES_CHANGED, (event) => {
      if (event.detail?.source === UNITS_EVENT_SOURCE) return;
      loadProductUnits().catch((err) => console.warn('[tabUnits] falha ao recarregar unidades:', err.message));
    });
    lockUnitFields();

    const chkActive = qUnit('ativo');
    if (chkActive && chkActive.checked !== true) chkActive.checked = true;
  } catch (err) {
    console.warn('Falha ao carregar unidades:', err.message);
    safeToast(`⚠️ Unidades indisponíveis: ${err.message}`, 'error');
  }
}