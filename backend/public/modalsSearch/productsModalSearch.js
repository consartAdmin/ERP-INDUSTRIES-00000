// ╔══════════════════════════════════════════════════════════════════════╗
// ║ backend/public/modalsSearch/productsModalSearch.js                   ║
// ║ — Modal inline para buscar PRODUTOS                                  ║
// ║ ✅ Keyboard: ↑ ↓ Home End Enter Esc                                  ║
// ║ ✅ Estoque/Unidade/Preço: hidrata via APIs                           ║
// ║ ✅ Barcode: resolve via /api/barcodes/resolve                        ║
// ║ ✅ Unidade padrão: resolve via /api/products-units                   ║
// ║ ✅ Unidades múltiplas: expande via /api/barcodes/active-units        ║
// ║ ✅ Preço padrão: força tabela VAREJO quando priceId não vier         ║
// ║ ✅ Preço via productsPrices: usa product_id corretamente             ║
// ║ ✅ Filtro: não exibe produto inativo                                 ║
// ║ ✅ Retorna unidade correta quando busca por código de barras         ║
// ║ ✅ Imagem: miniatura por unidade via /api/products-imagens           ║
// ║ exporta: openProductsModalSearch({ apiBase, priceId, onPick })       ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import {
  PRODUCT_IMAGES_FEATURE_CODE,
  resolveShowProductImages,
} from '/public/includes/js/productImagesFeature.js';

export function openProductsModalSearch({
  apiBase = '',
  priceId = null, // tabela de preço opcional
  onPick,

  // endpoints padrão
  unitsEndpoint = '/api/products-units',
  pricesEndpoint = '/api/products',
  stockEndpoint = '/api/products-stock',
  barcodeResolveEndpoint = '/api/barcodes/resolve',
  priceTablesEndpoint = '/api/prices',
  barcodesByProductEndpoint = '/api/barcodes/active-units',
  imagesEndpoint = '/api/products-imagens/by-code',

  // coluna de imagem: null = segue a appFeature PRODUCT_SEARCH_IMAGE_MODE
  // (sem a feature cadastrada, exibe); true/false = força
  showImages = null,
  imagesFeatureCode = PRODUCT_IMAGES_FEATURE_CODE,

  // filtros (Status / Estoque / Grupo / Subgrupo / Fornecedor / Fabricante)
  showFilters = true,
  // valores iniciais: { status: 'active'|'inactive'|'all', stock: ''|'with'|'without',
  //                     group_id, subgroup_id, supplier_id, manufacturer_id }
  filters: initialFilters = {},
  groupsEndpoint = '/api/products-groups',
  subgroupsEndpoint = '/api/products-subgroups',
  suppliersEndpoint = '/api/suppliers',
  manufacturersEndpoint = '/api/products-manufactures',

  // ✅ ajuste aqui se o ID de VAREJO no seu banco for outro
  defaultVarejoPriceId = 1,

  // se true, completa Estoque/Unidade/Preço mesmo que /api/products/search não traga
  autoHydrate = true,
} = {}) {
  apiBase = (apiBase || '').replace(/\/$/, '');

  // começa exibindo (padrão atual); a feature pode ocultar logo após abrir
  const followImagesFeature = showImages == null;
  showImages = showImages !== false;

  // ──────────────────────────────────────────────────────────────
  // Modal global CONSART
  // Usa a mesma estrutura/padrão dos demais modais do ERP:
  // .modal > .modal__backdrop > .modal__dialog > .modal__panel
  // ──────────────────────────────────────────────────────────────
  const existingModal =
    document.getElementById('productsSearchOverlay');

  if (existingModal) {
    existingModal.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'productsSearchOverlay';
  overlay.className = 'modal modal-width-10 modal-height-10';
  overlay.setAttribute('aria-hidden', 'false');

  // coluna Foto oculta até a appFeature responder (evita piscar)
  if (followImagesFeature) overlay.classList.add('pms-images-pending');

  overlay.innerHTML = `
    <style>
      #productsSearchOverlay.pms-images-pending [data-col="image"] { display: none; }
    </style>
    <div class="modal__backdrop" data-modal-close></div>

    <div class="modal__dialog">
      <section
        class="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="productsSearchTitle"
      >
        <header class="modal__header modal-header-color-3">
          <h3 id="productsSearchTitle">Buscar Produto</h3>

          <button
            type="button"
            id="pms-close"
            data-modal-close
            class="btn btn-new btn-sm btn-icon"
            aria-label="Fechar"
            title="Fechar"
          >
            ✕
          </button>
        </header>

        <div class="modal__body" style="display:flex; flex-direction:column; min-height:0;">
          <!-- Busca + filtros numa única linha; campos flex dividem a largura -->
          <div class="fields-inline fields-gap-2">
            <div class="fields fields-h-6 fields-p-left-10" style="flex:2 1 0; min-width:180px;">
              <label for="pms-q">Produto</label>
              <input
                id="pms-q"
                type="text"
                placeholder="Nome, SKU, Ref.Fab. ou cód. barras…"
                title="Digite parte do nome, SKU, Ref.Fab. ou código de barras"
                autocomplete="off"
              />
            </div>

            <div class="fields fields-h-5" style="flex:0 0 auto; width:auto;">
              <button type="button" id="pms-btn" class="btn btn-new btn-h-5">
                Buscar
              </button>
            </div>

          ${showFilters ? `
          <!-- display:contents: os filtros entram na mesma linha flex -->
          <div id="pms-filters" style="display:contents;">
            <div class="fields fields-w-15 fields-h-6" style="flex:0 0 var(--fields-width);">
              <label for="pms-f-status">Status</label>
              <select id="pms-f-status">
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="all">Todos</option>
              </select>
            </div>

            <div class="fields fields-w-11 fields-h-6" style="flex:0 0 var(--fields-width);">
              <label for="pms-f-stock">Estoque</label>
              <select id="pms-f-stock">
                <option value="">Todos</option>
                <option value="with">Com estoque</option>
                <option value="without">Sem estoque</option>
              </select>
            </div>

            <div class="fields fields-h-6" style="flex:1 1 0; min-width:90px;">
              <label for="pms-f-group">Grupo</label>
              <select id="pms-f-group">
                <option value="">Todos</option>
              </select>
            </div>

            <div class="fields fields-h-6" style="flex:1 1 0; min-width:90px;">
              <label for="pms-f-subgroup">Subgrupo</label>
              <select id="pms-f-subgroup">
                <option value="">Todos</option>
              </select>
            </div>

            <div class="fields fields-h-6" style="flex:1 1 0; min-width:90px;">
              <label for="pms-f-supplier">Fornecedor</label>
              <input id="pms-f-supplier" type="text" list="pms-f-supplier-list"
                placeholder="Todos" autocomplete="off" />
              <datalist id="pms-f-supplier-list"></datalist>
            </div>

            <div class="fields fields-h-6" style="flex:1 1 0; min-width:90px;">
              <label for="pms-f-manufacturer">Fabricante</label>
              <input id="pms-f-manufacturer" type="text" list="pms-f-manufacturer-list"
                placeholder="Todos" autocomplete="off" />
              <datalist id="pms-f-manufacturer-list"></datalist>
            </div>

            <div class="fields fields-h-5" style="flex:0 0 auto; width:auto;">
              <button type="button" id="pms-f-clear" class="btn btn-new btn-h-5" title="Limpar filtros">
                Limpar
              </button>
            </div>
          </div>
          ` : ''}
          </div>

          <div
            id="pms-tablewrap"
            class="table-scroll--rounded table-sticky-head"
            style="overflow:auto; flex:1; min-height:0; margin-top:10px;"
          >
            <table class="table table-zebra table-zebra-hover table-sticky-head">
              <thead>
                <tr>
                  ${showImages ? '<th data-col="image" style="width:64px; text-align:center;">Foto</th>' : ''}
                  <th style="width:120px">SKU</th>
                  <th style="width:120px">Ref.Fab.</th>
                  <th>Descrição</th>
                  <th style="width:130px">Unidade</th>
                  <th style="width:90px">Fator</th>
                  <th style="width:110px">Estoque</th>
                  <th style="width:130px">Preço</th>
                  <th style="text-align:center; white-space:nowrap; width:130px;">Produto Fiscal</th>
                </tr>
              </thead>
              <tbody id="pms-tbody"></tbody>
            </table>
          </div>
        </div>

        <footer class="modal__footer modal-footer-color-3">
          <div
            id="pms-status"
            style="margin-right:auto; color:inherit; font-size:.7rem;"
            aria-live="polite"
          >
            Digite e clique em “Buscar”.
          </div>

          <button
            type="button"
            data-modal-close
            class="btn btn-new btn-sm"
          >
            Fechar
          </button>
        </footer>
      </section>
    </div>
  `;

  document.body.appendChild(overlay);

  // ==========================================================
  // OPEN MODAL — CONSART GLOBAL MODAL
  // ==========================================================
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
  });

  const dialog = overlay.querySelector('.modal__dialog');
  const $ = (sel) => dialog.querySelector(sel);
  const q = $('#pms-q');
  const btn = $('#pms-btn');
  const tbody = $('#pms-tbody');
  const status = $('#pms-status');
  const tableWrap = $('#pms-tablewrap');

  // ──────────────────────────────────────────────────────────────
  // Estado
  // ──────────────────────────────────────────────────────────────
  let activeIndex = -1;
  let isOpen = true;
  let hasTypedSinceLastSearch = false;
  let searchSeq = 0;

  // ──────────────────────────────────────────────────────────────
  // Filtros
  // ──────────────────────────────────────────────────────────────
  const filtersWrap = $('#pms-filters');
  const fStatus = $('#pms-f-status');
  const fStock = $('#pms-f-stock');
  const fGroup = $('#pms-f-group');
  const fSubgroup = $('#pms-f-subgroup');
  const fSupplier = $('#pms-f-supplier');
  const fManufacturer = $('#pms-f-manufacturer');
  const fClear = $('#pms-f-clear');

  let allSubgroups = [];
  // opções carregadas nos datalists: [{ id, name }]
  const lookupOptions = { supplier: [], manufacturer: [] };

  function optionId(row, ...keys) {
    for (const k of keys) {
      const n = Number(row?.[k]);
      if (Number.isInteger(n) && n > 0) return n;
    }
    return null;
  }

  function optionName(row) {
    return String(row?.name ?? row?.trade_name ?? row?.corporate_name ?? row?.description ?? '').trim();
  }

  function pickOptionRows(data) {
    if (Array.isArray(data?.data?.rows)) return data.data.rows;
    return pickFirstArray(data);
  }

  async function fetchOptions(endpoint, params = {}) {
    const url = new URL(endpoint, normBase());
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    try {
      return pickOptionRows(await fetchJSON(url.toString()));
    } catch (err) {
      console.warn('[productsModalSearch] error loading filter options:', endpoint, err);
      return [];
    }
  }

  function fillSelect(select, options, selectedValue = '') {
    if (!select) return;
    const selected = selectedValue == null ? '' : String(selectedValue);
    select.innerHTML = [
      '<option value="">Todos</option>',
      ...options.map((o) =>
        `<option value="${o.id}"${String(o.id) === selected ? ' selected' : ''}>${escHtml(o.name)}</option>`
      ),
    ].join('');
  }

  function renderSubgroups(selectedValue = '') {
    const gid = Number(fGroup?.value) || null;
    const list = gid ? allSubgroups.filter((s) => s.group_id === gid) : allSubgroups;
    fillSelect(fSubgroup, list, selectedValue);
  }

  function fillDatalist(kind, rows) {
    const list = $(`#pms-f-${kind}-list`);
    const opts = rows
      .map((r) => ({
        id: optionId(r, kind === 'supplier' ? 'supplier_id' : 'manufacturer_id', 'id'),
        name: optionName(r),
      }))
      .filter((o) => o.id && o.name);

    lookupOptions[kind] = opts;
    if (list) list.innerHTML = opts.map((o) => `<option value="${escHtml(o.name)}"></option>`).join('');
  }

  // Resolve o texto digitado para um ID: nome exato ou único parcial.
  function lookupId(kind, input) {
    const text = String(input?.value ?? '').trim().toUpperCase();
    if (!text) return null;

    const opts = lookupOptions[kind];
    const exact = opts.find((o) => o.name.toUpperCase() === text);
    if (exact) return exact.id;

    const partial = opts.filter((o) => o.name.toUpperCase().includes(text));
    return partial.length === 1 ? partial[0].id : null;
  }

  const lookupEndpoints = {
    supplier: () => [suppliersEndpoint, { limit: 200 }],
    manufacturer: () => [manufacturersEndpoint, { limit: 100 }],
  };

  // busca no servidor conforme digita (fabricantes > 100 não vêm na carga inicial)
  function bindLookupInput(kind, input) {
    if (!input) return;
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const [endpoint, params] = lookupEndpoints[kind]();
        const term = input.value.trim();
        const rows = await fetchOptions(endpoint, term ? { ...params, q: term } : params);
        if (isOpen) fillDatalist(kind, rows);
      }, 250);
    });
  }

  async function initFilters() {
    if (!filtersWrap) return;

    const init = initialFilters || {};
    if (fStatus && init.status) fStatus.value = init.status;
    if (fStock && init.stock) fStock.value = init.stock;

    const [groups, subgroups, suppliers, manufacturers] = await Promise.all([
      fetchOptions(groupsEndpoint, { limit: 1000 }),
      fetchOptions(subgroupsEndpoint, { limit: 1000 }),
      fetchOptions(suppliersEndpoint, { limit: 200 }),
      fetchOptions(manufacturersEndpoint, { limit: 100 }),
    ]);
    if (!isOpen) return;

    const toOpts = (rows, ...idKeys) => rows
      .filter((r) => r?.is_active !== false && r?.active !== false)
      .map((r) => ({ id: optionId(r, ...idKeys, 'id'), name: optionName(r), group_id: Number(r?.group_id) || null }))
      .filter((o) => o.id && o.name)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    fillSelect(fGroup, toOpts(groups, 'product_group_id', 'group_id'), init.group_id);
    allSubgroups = toOpts(subgroups, 'product_subgroup_id', 'subgroup_id');
    renderSubgroups(init.subgroup_id);

    fillDatalist('supplier', suppliers);
    fillDatalist('manufacturer', manufacturers);

    const setLookup = (kind, input, id) => {
      const found = lookupOptions[kind].find((o) => o.id === Number(id));
      if (input && found) input.value = found.name;
    };
    setLookup('supplier', fSupplier, init.supplier_id);
    setLookup('manufacturer', fManufacturer, init.manufacturer_id);
  }

  function getFilters() {
    return {
      status: fStatus?.value || initialFilters?.status || 'active',
      stock: fStock?.value || '',
      group_id: Number(fGroup?.value) || null,
      subgroup_id: Number(fSubgroup?.value) || null,
      supplier_id: lookupId('supplier', fSupplier),
      manufacturer_id: lookupId('manufacturer', fManufacturer),
    };
  }

  function hasNarrowingFilters(f) {
    return !!(f.stock || f.group_id || f.subgroup_id || f.supplier_id || f.manufacturer_id || f.status === 'inactive');
  }

  function applyFiltersToUrl(url, f) {
    // /api/products/search: active='' → todos (ignora o default "somente ativos")
    url.searchParams.set('active', f.status === 'all' ? '' : String(f.status !== 'inactive'));
    if (f.stock) url.searchParams.set('stock', f.stock);
    if (f.group_id) url.searchParams.set('group_id', String(f.group_id));
    if (f.subgroup_id) url.searchParams.set('subgroup_id', String(f.subgroup_id));
    if (f.supplier_id) url.searchParams.set('supplier_id', String(f.supplier_id));
    if (f.manufacturer_id) url.searchParams.set('manufacturer_id', String(f.manufacturer_id));
  }

  // Ao mudar um filtro, refaz a busca se já houver algo para buscar.
  function onFilterChanged() {
    if (q.value.trim() || hasNarrowingFilters(getFilters())) buscar();
  }

  // ──────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────
  function escHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatCurrencyBR(value) {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;

    const s = String(v).trim();
    if (!s) return null;

    const normalized = s
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function toDecimalValue(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;

    const s = String(v).trim();
    if (!s) return null;

    // remove spaces
    const clean = s.replace(/\s+/g, '');

    // if has both "." and ",", assume Brazilian thousands + decimal comma
    if (clean.includes('.') && clean.includes(',')) {
      const n = Number(
        clean
          .replace(/\./g, '')
          .replace(',', '.')
          .replace(/[^\d.-]/g, '')
      );
      return Number.isFinite(n) ? n : null;
    }

    // if only comma, treat comma as decimal separator
    if (clean.includes(',')) {
      const n = Number(
        clean
          .replace(',', '.')
          .replace(/[^\d.-]/g, '')
      );
      return Number.isFinite(n) ? n : null;
    }

    // if only dot or plain number, use as decimal separator
    const n = Number(clean.replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function formatQtyBR(value) {
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
  }

  function normBase() {
    return (apiBase && apiBase.trim())
      ? apiBase.replace(/\/$/, '')
      : window.location.origin;
  }

  async function fetchJSON(url) {
    const r = await fetch(url);
    const t = await r.text();

    if (!r.ok) {
      throw new Error(`${r.status} ${r.statusText}: ${t}`);
    }

    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }

  function pickFirstArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.rows)) return data.rows;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function normalizeBarcode(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    return s.replace(/\D+/g, '');
  }

  function isLikelyBarcode(term) {
    const clean = normalizeBarcode(term);
    //evita confundir SKU numerico curto com código de barras 
    //prioriza GTIN / EAN mais comuns
    return /^\d{12,14}$/.test(clean);
  }

  function getProductCode(product) {
    return String(
      product?.product_code ??
      product?.sku ??
      product?.codigo ??
      product?.code ??
      ''
    ).trim();
  }

  function getProductId(product) {
    return String(
      product?.product_id ??
      product?.id ??
      ''
    ).trim();
  }

  function getManufacturerRef(product) {
    return String(
      product?.manufacturer_ref ??
      product?.manufacturerRef ??
      product?.ref_fab ??
      product?.refFab ??
      product?.referencia_fabricante ??
      ''
    ).trim();
  }

  function getProductIdentifierForLookups(product) {
    return String(
      product?.product_id ??
      product?.id ??
      product?.product_code ??
      product?.sku ??
      product?.codigo ??
      product?.code ??
      ''
    ).trim();
  }

  function getProductIdentifierForPrices(product) {
    return String(
      product?.product_id ??
      product?.id ??
      ''
    ).trim();
  }

  function getDescription(product) {
    return String(
      product?.description ??
      product?.descricao ??
      product?.nome ??
      product?.name ??
      ''
    ).trim();
  }

  function getUnit(product) {
    return String(
      product?.matched_unit ??
      product?.unit ??
      product?.unidade ??
      product?.unit_name ??
      product?.product_unit ??
      ''
    ).trim();
  }

  function getBarcode(product) {
    return normalizeBarcode(
      product?.matched_barcode ??
      product?.barcode ??
      product?.product_barcode ??
      product?.codigo_barras ??
      product?.ean ??
      product?.gtin ??
      product?.gtin13 ??
      product?.gtin14 ??
      ''
    );
  }

  function getUnitTextFromRow(row) {
    return String(
      row?.unit ??
      row?.unidade ??
      row?.unit_name ??
      row?.sigla ??
      row?.unit_code ??
      row?.abbreviation ??
      ''
    ).trim();
  }

  function isStandardUnitRow(row) {
    return (
      row?.standard === true ||
      row?.is_default === true ||
      row?.default === true ||
      row?.padrao === true ||
      row?.principal === true ||
      row?.is_standard === true ||
      String(row?.standard ?? '').toLowerCase() === 'true' ||
      String(row?.is_default ?? '').toLowerCase() === 'true' ||
      String(row?.padrao ?? '').toLowerCase() === 'true'
    );
  }

  function getPriceTableName(row) {
    return String(
      row?.name ??
      row?.nome ??
      row?.descricao ??
      row?.description ??
      row?.table_name ??
      row?.price_name ??
      ''
    ).trim().toUpperCase();
  }

  function getPriceTableId(row) {
    return (
      row?.price_id ??
      row?.id ??
      row?.tabela_preco_id ??
      row?.table_id ??
      null
    );
  }

  function normalizeProduct(p) {
    const obj = (p && typeof p === 'object') ? { ...p } : {};

    obj.product_code =
      obj.product_code ??
      obj.sku ??
      obj.codigo ??
      obj.code ??
      '';

    obj.product_id =
      obj.product_id ??
      obj.id ??
      '';

    obj.description =
      obj.description ??
      obj.descricao ??
      obj.nome ??
      obj.name ??
      '';

    obj.manufacturer_ref =
      obj.manufacturer_ref ??
      obj.manufacturerRef ??
      obj.ref_fab ??
      obj.refFab ??
      obj.referencia_fabricante ??
      '';

    obj.barcode = getBarcode(obj);

    const flag = (obj.is_active ?? obj.active ?? obj.ativo ?? obj.isActive);
    obj.__isInactive = (flag === false);

    return obj;
  }

  function normalizeResolvedBarcodeProduct(data) {
    if (!data || typeof data !== 'object') return null;

    const product = {
      product_code: data.product_code ?? '',
      product_id: data.product_id ?? '',
      sku: data.product_code ?? '',
      description: data.description ?? '',
      manufacturer_ref:
        data.manufacturer_ref ??
        data.manufacturerRef ??
        data.ref_fab ??
        data.refFab ??
        '',
      unit: data.unit ?? '',
      unidade: data.unit ?? '',
      matched_unit: data.unit ?? '',
      unit_factor: toDecimalValue(data.fator),
      fator: toDecimalValue(data.fator),
      standard: data.standard ?? false,
      barcode: data.barcode ?? '',
      matched_barcode: data.barcode ?? '',
      product_unit_id: data.product_unit_id ?? null,
      barcode_id: data.barcode_id ?? null,
      barcode_type: data.barcode_type ?? '',
      is_active: data.product_is_active ?? true,
      __resolvedByBarcode: true,
      __isInactive: data.product_is_active === false,
    };

    return normalizeProduct(product);
  }

  const ICON_FISCAL_OK = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.14"></circle>
      <path d="M8.5 12.5l2.2 2.2 4.8-5.2"
        fill="none"
        stroke="#22c55e"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"></path>
    </svg>
  `;

  const ICON_FISCAL_NO = `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#ef4444" opacity="0.14"></circle>
      <path d="M9 9l6 6M15 9l-6 6"
        fill="none"
        stroke="#b91c1c"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"></path>
    </svg>
  `;

  // ──────────────────────────────────────────────────────────────
  // Navegação / Seleção
  // ──────────────────────────────────────────────────────────────
  function getRows() {
    return [...tbody.querySelectorAll('tr')];
  }

  function clearActive() {
    for (const tr of getRows()) {
      tr.style.background = '';
      tr.style.outline = '';
      tr.style.outlineOffset = '';
      tr.setAttribute('aria-selected', 'false');
    }
  }

  function setActive(index) {
    const rows = getRows();
    if (!rows.length) {
      activeIndex = -1;
      return;
    }

    const i = Math.max(0, Math.min(index, rows.length - 1));
    activeIndex = i;

    clearActive();

    const tr = rows[activeIndex];
    tr.style.background = 'rgba(37, 99, 235, 0.10)';
    tr.style.outline = '2px solid rgba(37, 99, 235, 0.35)';
    tr.style.outlineOffset = '-2px';
    tr.setAttribute('aria-selected', 'true');

    try {
      tr.scrollIntoView({ block: 'nearest' });
    } catch { }
  }

  function pickActiveRow() {
    const rows = getRows();
    if (!rows.length) return;

    if (activeIndex < 0) setActive(0);

    const tr = rows[activeIndex];
    if (!tr) return;

    const rawJson = (tr.dataset.json || '')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"');

    const data = normalizeProduct(JSON.parse(rawJson || '{}'));

    try {
      onPick && onPick(data);
    } finally {
      close();
    }
  }

  function close() {
    if (!isOpen) return;

    isOpen = false;

    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');

    document.removeEventListener(
      'keydown',
      navKeyHandler,
      true
    );

    overlay.remove();
  }

  // ──────────────────────────────────────────────────────────────
  // Cache
  // ──────────────────────────────────────────────────────────────
  const stockCache = new Map();
  const priceCache = new Map();
  const unitCache = new Map();
  const barcodeUnitsCache = new Map();
  const imagesCache = new Map();

  let varejoPriceIdCache = null;
  let varejoPriceIdLoaded = false;

  function cacheKeyPrice(productId, pid) {
    return `${String(productId ?? '').trim()}|${pid == null ? '' : String(pid)}`;
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver Estoque
  // ──────────────────────────────────────────────────────────────
  async function resolveStock(productId) {
    const pid = String(productId ?? '').trim();
    if (!pid) return null;

    if (stockCache.has(pid)) return stockCache.get(pid);

    const base = normBase();

    const s1 = new URL(stockEndpoint, base);
    s1.searchParams.set('product_id', pid);

    const s2 = new URL(`${stockEndpoint.replace(/\/$/, '')}/${encodeURIComponent(pid)}`, base);

    const s3 = new URL('/api/productsStock', base);
    s3.searchParams.set('product_id', pid);

    const tries = [s1.toString(), s2.toString(), s3.toString()];

    for (const url of tries) {
      try {
        const data = await fetchJSON(url);

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const direct = toNum(data.stock_qty ?? data.qty ?? data.estoque ?? data.stock);
          if (direct != null) {
            stockCache.set(pid, direct);
            return direct;
          }

          const inner = data.data;
          if (inner && typeof inner === 'object') {
            const n2 = toNum(inner.stock_qty ?? inner.qty ?? inner.estoque ?? inner.stock);
            if (n2 != null) {
              stockCache.set(pid, n2);
              return n2;
            }
          }

          const arr = pickFirstArray(data);
          if (arr.length) {
            const first = arr[0] || {};
            const n3 = toNum(first.stock_qty ?? first.qty ?? first.estoque ?? first.stock);
            if (n3 != null) {
              stockCache.set(pid, n3);
              return n3;
            }
          }
        }

        if (Array.isArray(data) && data.length) {
          const first = data[0] || {};
          const n4 = toNum(first.stock_qty ?? first.qty ?? first.estoque ?? first.stock);
          if (n4 != null) {
            stockCache.set(pid, n4);
            return n4;
          }
        }
      } catch { }
    }

    stockCache.set(pid, null);
    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver Unidade padrão via productsBarCode
  // (a tabela productsUnits não existe mais; unidades ficam em productsBarCode)
  // ──────────────────────────────────────────────────────────────
  async function resolveDefaultUnit(productCode) {
    const code = String(productCode ?? '').trim();
    if (!code) return '';

    if (unitCache.has(code)) return unitCache.get(code) || '';

    const rows = await resolveAllUnitsFromBarcodeTable(code);
    const standard = rows.find(isStandardUnitRow) || rows[0];
    const unit = standard ? getUnitTextFromRow(standard) : '';

    unitCache.set(code, unit);
    return unit;
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver unidades ativas via tabela productsBarCode
  // ──────────────────────────────────────────────────────────────
  async function resolveAllUnitsFromBarcodeTable(productCode) {
    const code = String(productCode ?? '').trim();
    if (!code) return [];

    if (barcodeUnitsCache.has(code)) {
      return barcodeUnitsCache.get(code);
    }

    const base = normBase();
    const url = new URL(barcodesByProductEndpoint, base);
    url.searchParams.set('product_code', code);

    try {
      const data = await fetchJSON(url.toString());
      const rows = pickFirstArray(data);

      barcodeUnitsCache.set(code, rows);
      return rows;
    } catch (err) {
      console.warn('[productsModalSearch] error loading barcode units:', err);
      barcodeUnitsCache.set(code, []);
      return [];
    }
  }

  async function expandProductsWithUnits(products = []) {
    const expanded = [];

    for (const raw of products) {
      const product = normalizeProduct(raw);
      const productCode = getProductCode(product);
      const productId = getProductId(product);

      if (!productCode) {
        expanded.push(product);
        continue;
      }

      const units = await resolveAllUnitsFromBarcodeTable(productCode);

      if (!units.length) {
        expanded.push(product);
        continue;
      }

      for (const u of units) {
        expanded.push(normalizeProduct({
          ...product,
          product_code: u?.product_code ?? productCode,
          product_id: u?.product_id ?? productId,
          product_unit_id: u?.product_unit_id ?? null,
          barcode_id: u?.barcode_id ?? null,
          matched_barcode: u?.barcode ?? '',
          barcode: u?.barcode ?? '',
          barcode_type: u?.barcode_type ?? '',
          matched_unit: u?.unit ?? '',
          unit: u?.unit ?? '',
          unidade: u?.unit ?? '',
          unit_factor: toDecimalValue(u?.fator),
          fator: toDecimalValue(u?.fator),
          standard: u?.standard ?? false,
          description: u?.description ?? product.description,
          is_active: u?.product_is_active ?? product.is_active ?? true,
          __expandedFromBarcodeTable: true,
        }));
      }
    }

    return expanded;
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver ID da tabela VAREJO
  // ──────────────────────────────────────────────────────────────
  async function resolveVarejoPriceId() {
    if (priceId != null && priceId !== '') {
      return Number(priceId);
    }

    // ✅ força VAREJO fixo se informado
    if (defaultVarejoPriceId != null && defaultVarejoPriceId !== '') {
      return Number(defaultVarejoPriceId);
    }

    if (varejoPriceIdLoaded) {
      return varejoPriceIdCache;
    }

    varejoPriceIdLoaded = true;

    const base = normBase();
    const tries = [
      new URL(priceTablesEndpoint, base).toString(),
      new URL('/api/price-tables', base).toString(),
      new URL('/api/tabela-precos', base).toString(),
      new URL('/api/tabelas-preco', base).toString(),
    ];

    for (const url of tries) {
      try {
        const data = await fetchJSON(url);
        const rows = pickFirstArray(data);
        if (!rows.length) continue;

        const found = rows.find((row) => getPriceTableName(row) === 'VAREJO');
        if (!found) continue;

        varejoPriceIdCache = Number(getPriceTableId(found));
        return varejoPriceIdCache;
      } catch { }
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver Preço
  // IMPORTANTE:
  // - productsPrices usa product_id
  // - /api/precos-produtos costuma usar sku/product_code
  // ──────────────────────────────────────────────────────────────
  async function resolvePrice(productIdForPrices, pidTabela = null, productCodeForFallback = '') {
    const pid = String(productIdForPrices ?? '').trim();
    const skuCode = String(productCodeForFallback ?? '').trim();

    if (!pid && !skuCode) return null;

    const effectivePriceId = await resolveVarejoPriceId();
    const finalPriceId =
      effectivePriceId != null && effectivePriceId !== ''
        ? Number(effectivePriceId)
        : (pidTabela != null && pidTabela !== '' ? Number(pidTabela) : null);

    const cacheBaseId = pid || skuCode;
    const key = cacheKeyPrice(cacheBaseId, finalPriceId);
    if (priceCache.has(key)) return priceCache.get(key);

    const base = normBase();
    const ep = (pricesEndpoint || '/api/products-prices').replace(/\/$/, '');
    const urls = [];

    if (pid) {
      const u1 = new URL(`${ep}/${encodeURIComponent(pid)}/prices`, base);
      if (finalPriceId != null) u1.searchParams.set('price_id', String(finalPriceId));
      urls.push(u1.toString());

      const u2 = new URL(ep, base);
      u2.searchParams.set('product_id', pid);
      if (finalPriceId != null) u2.searchParams.set('price_id', String(finalPriceId));
      urls.push(u2.toString());

      const u3 = new URL(`${ep}/product/${encodeURIComponent(pid)}`, base);
      if (finalPriceId != null) u3.searchParams.set('price_id', String(finalPriceId));
      urls.push(u3.toString());

      const u4 = new URL(`${ep}/by-product/${encodeURIComponent(pid)}`, base);
      if (finalPriceId != null) u4.searchParams.set('price_id', String(finalPriceId));
      urls.push(u4.toString());

      const u5 = new URL('/api/productsPrices', base);
      u5.searchParams.set('product_id', pid);
      if (finalPriceId != null) u5.searchParams.set('price_id', String(finalPriceId));
      urls.push(u5.toString());
    }

    if (skuCode) {
      const u6 = new URL('/api/precos-produtos', base);
      u6.searchParams.set('sku', skuCode);
      if (finalPriceId != null) u6.searchParams.set('tabela_preco_id', String(finalPriceId));
      urls.push(u6.toString());

      const u7 = new URL(ep, base);
      u7.searchParams.set('sku', skuCode);
      if (finalPriceId != null) u7.searchParams.set('price_id', String(finalPriceId));
      urls.push(u7.toString());
    }

    const tries = [...new Set(urls)];

    for (const url of tries) {
      try {
        const data = await fetchJSON(url);

        const direct = toDecimalValue(
          data?.sale_price ??
          data?.preco_venda ??
          data?.price ??
          data?.preco ??
          data?.valor
        );

        if (direct != null) {
          priceCache.set(key, direct);
          return direct;
        }

        const inner = data?.data;

        if (inner && !Array.isArray(inner)) {
          const innerDirect = toDecimalValue(
            inner?.sale_price ??
            inner?.preco_venda ??
            inner?.price ??
            inner?.preco ??
            inner?.valor
          );

          if (innerDirect != null) {
            priceCache.set(key, innerDirect);
            return innerDirect;
          }
        }

        const rows = pickFirstArray(data);

        const norm = rows
          .map((r) => ({
            price_id: Number(
              r?.price_id ??
              r?.tabela_preco_id ??
              r?.priceId ??
              r?.priceID
            ),
            sale_price: toDecimalValue(
              r?.sale_price ??
              r?.preco_venda ??
              r?.price ??
              r?.preco ??
              r?.valor
            ),
          }))
          .filter((x) => x.sale_price != null);

        if (!norm.length) continue;

        let selected = null;

        if (finalPriceId != null) {
          selected = norm.find((x) => Number(x.price_id) === Number(finalPriceId)) || null;
        }

        if (!selected) {
          selected = norm[0] || null;
        }

        const price = selected ? selected.sale_price : null;
        priceCache.set(key, price);
        return price;
      } catch (err) {
        console.warn('[productsModalSearch] price resolve failed:', url, err);
      }
    }

    priceCache.set(key, null);
    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver Imagem via productsImages
  // (imagens por product_code; barcode_id vincula a uma unidade,
  //  barcode_id nulo = imagem geral do produto)
  // ──────────────────────────────────────────────────────────────
  async function loadProductImages(productCode) {
    const code = String(productCode ?? '').trim();
    if (!code) return [];

    if (imagesCache.has(code)) return imagesCache.get(code);

    // guarda a promise para as várias unidades do mesmo produto
    // compartilharem uma única requisição
    const pending = (async () => {
      const base = normBase();
      const url = new URL(
        `${imagesEndpoint.replace(/\/$/, '')}/${encodeURIComponent(code)}`,
        base
      );
      url.searchParams.set('onlyActive', 'true');

      try {
        const data = await fetchJSON(url.toString());
        return pickFirstArray(data);
      } catch (err) {
        console.warn('[productsModalSearch] error loading product images:', err);
        return [];
      }
    })();

    imagesCache.set(code, pending);
    return pending;
  }

  function getImageSrc(img) {
    const url = String(img?.image_url ?? img?.imagem_url ?? img?.url ?? '').trim();
    if (url) return url;

    const path = String(img?.image_path ?? img?.imagem_path ?? img?.path ?? '').trim();
    if (path) {
      return `${normBase()}/api/gcs/images/proxy?key=${encodeURIComponent(path)}`;
    }

    return '';
  }

  async function resolveProductImage(productCode, barcodeId = null) {
    const images = (await loadProductImages(productCode)).filter((img) => getImageSrc(img));
    if (!images.length) return '';

    const byPriority = (list) =>
      list.find((img) => img.is_primary === true) || list[0] || null;

    const bid = barcodeId == null || barcodeId === '' ? null : Number(barcodeId);

    // 1) imagem da unidade  2) imagem geral  3) qualquer imagem do produto
    const unitImages = bid != null
      ? images.filter((img) => img.barcode_id != null && Number(img.barcode_id) === bid)
      : [];
    const generalImages = images.filter((img) => img.barcode_id == null);

    const selected =
      byPriority(unitImages) ||
      byPriority(generalImages) ||
      byPriority(images);

    return selected ? getImageSrc(selected) : '';
  }

  function renderImageCell(td, src, alt) {
    if (!td) return;

    if (!src) {
      td.innerHTML = '<span style="color:#94a3b8; font-size:.7rem;">—</span>';
      return;
    }

    td.innerHTML = `
      <img
        src="${escHtml(src)}"
        alt="${escHtml(alt)}"
        loading="lazy"
        data-pms-thumb
        style="width:44px; height:44px; object-fit:contain; background:#fff; border:1px solid #e5e7eb; border-radius:6px; display:block; margin:0 auto; cursor:zoom-in;"
      />
    `;

    td.querySelector('img')?.addEventListener('error', () => {
      td.innerHTML = '<span style="color:#94a3b8; font-size:.7rem;">—</span>';
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Prévia ampliada da imagem (hover na miniatura)
  // ──────────────────────────────────────────────────────────────
  const PREVIEW_SIZE = 320;
  const PREVIEW_OFFSET = 16;

  const imagePreview = document.createElement('div');
  imagePreview.setAttribute('aria-hidden', 'true');
  imagePreview.style.cssText = `
    position:fixed; z-index:100000; display:none; pointer-events:none;
    width:${PREVIEW_SIZE}px; padding:8px; background:#fff;
    border:1px solid #e5e7eb; border-radius:10px;
    box-shadow:0 12px 32px rgba(15, 23, 42, .25);
  `;
  imagePreview.innerHTML = `
    <img style="display:block; width:100%; height:${PREVIEW_SIZE - 16}px; object-fit:contain; background:#fff;" alt="" />
    <div style="margin-top:6px; font-size:.72rem; font-weight:700; color:#0f172a; text-align:center; line-height:1.25;"></div>
  `;
  // dentro do overlay: é removido junto com o modal
  overlay.appendChild(imagePreview);

  const previewImg = imagePreview.querySelector('img');
  const previewCaption = imagePreview.querySelector('div');

  function positionImagePreview(ev) {
    const w = imagePreview.offsetWidth || PREVIEW_SIZE;
    const h = imagePreview.offsetHeight || PREVIEW_SIZE;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // à direita do cursor; se não couber, à esquerda. Sempre dentro da tela.
    let left = ev.clientX + PREVIEW_OFFSET;
    if (left + w > vw - 8) left = ev.clientX - PREVIEW_OFFSET - w;
    let top = ev.clientY - h / 2;

    left = Math.max(8, Math.min(left, vw - w - 8));
    top = Math.max(8, Math.min(top, vh - h - 8));

    imagePreview.style.left = `${left}px`;
    imagePreview.style.top = `${top}px`;
  }

  function showImagePreview(thumb, ev) {
    if (previewImg.getAttribute('src') !== thumb.src) previewImg.src = thumb.src;
    previewImg.alt = thumb.alt || '';
    previewCaption.textContent = thumb.alt || '';
    previewCaption.style.display = thumb.alt ? '' : 'none';
    imagePreview.style.display = 'block';
    positionImagePreview(ev);
  }

  function hideImagePreview() {
    imagePreview.style.display = 'none';
  }

  // ──────────────────────────────────────────────────────────────
  // Resolver barcode no backend
  // ──────────────────────────────────────────────────────────────
  async function resolveProductByBarcode(barcodeRaw) {
    const barcode = normalizeBarcode(barcodeRaw);
    if (!barcode) return null;

    const base = normBase();
    const url = new URL(barcodeResolveEndpoint, base);
    url.searchParams.set('barcode', barcode);

    try {
      const data = await fetchJSON(url.toString());
      if (!data || typeof data !== 'object') return null;
      return normalizeResolvedBarcodeProduct(data);
    } catch (err) {
      console.warn('[productsModalSearch] barcode resolve failed:', err);
      return null;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Hidratador
  // ──────────────────────────────────────────────────────────────
  async function hydrateTable(targets = []) {
    if (!autoHydrate) return;
    if (!targets?.length) return;

    const MAX = 8;
    const queue = targets.slice();

    const workers = Array.from({ length: MAX }, async () => {
      while (queue.length && isOpen) {
        const item = queue.shift();
        // linha de uma busca anterior (tabela já re-renderizada)
        if (!item?.tr?.isConnected) continue;

        const product = normalizeProduct(item.product || {});
        const tr = item.tr;

        const lookupId = getProductIdentifierForLookups(product);
        const priceLookupId = getProductIdentifierForPrices(product);
        const productCode = getProductCode(product);

        if (!lookupId && !productCode) continue;

        const tdStock = tr.querySelector('[data-col="stock"]');
        const tdUnit = tr.querySelector('[data-col="unit"]');
        const tdPrice = tr.querySelector('[data-col="price"]');
        const tdFactor = tr.querySelector('[data-col="factor"]');
        const tdImage = tr.querySelector('[data-col="image"]');

        // imagem
        if (tdImage && productCode) {
          // prioriza a imagem da unidade; /api/products/search só traz a geral
          const src =
            await resolveProductImage(productCode, product.barcode_id) ||
            getImageSrc(product);
          renderImageCell(tdImage, src, getDescription(product));
          product.image_url = src || '';
        } else if (tdImage) {
          renderImageCell(tdImage, '', '');
        }

        // estoque
        const currentStock = product.stock_qty ?? product.stock ?? product.estoque ?? null;
        if ((currentStock === null || currentStock === undefined || currentStock === '') && tdStock) {
          tdStock.textContent = '…';
          const s = lookupId ? await resolveStock(lookupId) : null;
          tdStock.textContent = s != null ? formatQtyBR(s) : '';
          product.stock_qty = s;
          product.stock = s;
          product.estoque = s;
        } else if (tdStock && currentStock !== null && currentStock !== undefined && currentStock !== '') {
          tdStock.textContent = formatQtyBR(currentStock);
        }

        // unidade
        const currentUnit = getUnit(product);
        if (tdUnit) {
          if (currentUnit) {
            tdUnit.textContent = currentUnit;
          } else {
            tdUnit.textContent = '…';
            const unit = productCode ? await resolveDefaultUnit(productCode) : '';
            tdUnit.textContent = unit || '';
            if (unit) {
              product.unit = unit;
              product.unidade = unit;
            }
          }
        }

        // preço
        const currentPrice =
          product.price ??
          product.sale_price ??
          product.preco ??
          product.preco_venda ??
          null;

        const cellEmpty = tdPrice && !String(tdPrice.textContent || '').trim();
        const priceMissing = (
          currentPrice === null ||
          currentPrice === undefined ||
          currentPrice === '' ||
          toNum(currentPrice) == null
        );

        if ((priceMissing || cellEmpty) && tdPrice) {
          tdPrice.textContent = '…';

          const p = await resolvePrice(
            priceLookupId || lookupId,
            priceId,
            productCode
          );

          tdPrice.textContent = p != null ? formatCurrencyBR(p) : '';
          product.price = p;
          product.sale_price = p;
          product.preco = p;
          product.preco_venda = p;
        }

        try {
          tr.dataset.json = JSON.stringify(product).replace(/'/g, '&apos;');
        } catch { }
      }
    });

    await Promise.all(workers);
  }

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────
  function renderRows(rows) {
    // a miniatura sob o cursor some sem disparar mouseout
    hideImagePreview();

    tbody.innerHTML = rows.map((p) => {
      const sku = getProductCode(p) || getProductId(p);
      const manufacturerRef = getManufacturerRef(p);
      const desc = getDescription(p);
      const barcode = getBarcode(p);
      const factorValue = toDecimalValue(p.unit_factor ?? p.fator);
      const estoqueRaw = p.stock_qty ?? p.stock ?? p.estoque ?? null;
      const estoque = estoqueRaw != null ? formatQtyBR(estoqueRaw) : '';
      const und = getUnit(p);
      const precoRaw =
        p.price ??
        p.preco_venda ??
        p.preco ??
        p.sale_price ??
        p.preco_tabela ??
        null;
      const preco = formatCurrencyBR(precoRaw);

      const isFiscal = (
        p.has_fiscal_product ??
        p.is_fiscal_product ??
        p.produto_fiscal ??
        p.fiscal ??
        false
      );

      const unitBadgeBg = p.standard ? '#16a34a' : '#2563eb';
      const unitLabel = und || '-';

      const subtitle = [
        barcode ? `CB: ${barcode}` : '',
        p.standard ? 'Padrão' : 'Unidade alternativa',
        p.__isInactive ? 'INATIVO' : '',
      ].filter(Boolean).join(' • ');

      return `
<tr
  data-json='${JSON.stringify(p).replace(/'/g, '&apos;')}'
  style="
    cursor:pointer;
    border-bottom:1px solid #e5e7eb;
  "
>
  ${showImages ? `
  <!-- FOTO -->
  <td data-col="image" style="text-align:center; padding:4px;">
    <span style="color:#94a3b8; font-size:.7rem;">${autoHydrate ? '…' : '—'}</span>
  </td>
  ` : ''}

  <!-- SKU -->
  <td style="font-weight:700; white-space:nowrap;">
    ${escHtml(sku)}
  </td>

  <!-- REF. FABRICANTE -->
  <td style="font-weight:700; white-space:nowrap;">
    ${escHtml(manufacturerRef || '-')}
  </td>

  <!-- DESCRIÇÃO -->
  <td>
    <div style="font-weight:700; color:#0f172a;">
      ${escHtml(desc)}
    </div>
    ${subtitle ? `
      <div style="font-size:.72rem; color:#64748b; margin-top:4px;">
        ${escHtml(subtitle)}
      </div>
    ` : ''}
  </td>

  <!-- UNIDADE -->
  <td data-col="unit" style="text-align:center;">
    <span style="
      display:flex;
      align-items:center;
      justify-content:center;
      min-width:72px;
      padding:5px 10px;
      border-radius:999px;
      background:${unitBadgeBg};
      color:#fff;
      font-weight:800;
      font-size:.72rem;
    ">
      ${escHtml(unitLabel)}
    </span>
  </td>

  <!-- FATOR -->
  <td data-col="factor" style="text-align:center; font-weight:800;">
    ${factorValue != null ? `${escHtml(formatQtyBR(factorValue))}x` : '-'}
  </td>

  <!-- ESTOQUE -->
  <td data-col="stock" style="text-align:center; font-weight:700;">
    ${escHtml(estoque)}
  </td>

  <!-- PREÇO -->
  <td data-col="price" style="text-align:center; font-weight:700;">
    ${escHtml(preco)}
  </td>

  <!-- FISCAL -->
  <td style="text-align:center">
    ${isFiscal ? ICON_FISCAL_OK : ICON_FISCAL_NO}
  </td>
</tr>
`;
    }).join('');
  }

  // ──────────────────────────────────────────────────────────────
  // Buscar
  // ──────────────────────────────────────────────────────────────
  async function buscar() {
    const termo = q.value.trim();
    const filters = getFilters();
    const narrowed = hasNarrowingFilters(filters);

    const unresolved = [
      fSupplier?.value.trim() && !filters.supplier_id ? 'Fornecedor' : '',
      fManufacturer?.value.trim() && !filters.manufacturer_id ? 'Fabricante' : '',
    ].filter(Boolean);

    if (unresolved.length) {
      status.textContent = `${unresolved.join(' e ')} não encontrado — selecione uma opção da lista.`;
      return;
    }

    if (!termo && !narrowed) {
      tbody.innerHTML = '';
      status.textContent = 'Informe um termo de busca ou selecione um filtro.';
      activeIndex = -1;
      return;
    }

    const seq = ++searchSeq;
    status.textContent = 'Pesquisando…';

    try {
      let rows = [];
      let total = 0;
      const base = normBase();

      // 1) busca normal por produto primeiro
      {
        const url = new URL('/api/products/search', base);
        if (termo) url.searchParams.set('q', termo);
        url.searchParams.set('limit', '50');
        url.searchParams.set('offset', '0');
        applyFiltersToUrl(url, filters);

        if (priceId != null && priceId !== '') {
          url.searchParams.set('price_id', String(priceId));
        }

        const data = await fetchJSON(url.toString());
        const rawRows = Array.isArray(data) ? data : (data.rows || data.data || data.items || []);
        total = Number(data?.total) || rawRows.length;

        rows = rawRows.map(normalizeProduct);
        if (filters.status === 'active') rows = rows.filter((p) => !p.__isInactive);

        if (rows.length) {
          rows = await expandProductsWithUnits(rows);
        }
      }

      // 2) se não encontrou nada, tenta resolver como barcode
      //    (só sem filtros: o resolve não respeita grupo/estoque/etc.)
      if (!rows.length && termo && !narrowed && isLikelyBarcode(termo)) {
        const resolved = await resolveProductByBarcode(termo);
        if (resolved && !resolved.__isInactive) {
          rows = [resolved];
        }
      }

      // uma busca mais recente já assumiu a tabela
      if (seq !== searchSeq || !isOpen) return;

      const hydratedTargets = [];

      renderRows(rows);

      if (autoHydrate && rows.length) {
        const trs = [...tbody.querySelectorAll('tr')];
        trs.forEach((tr, idx) => hydratedTargets.push({ tr, product: rows[idx] }));
      }

      // total conta produtos; rows conta linhas por unidade
      const foundText = total > 50
        ? `${rows.length} linha(s) — exibindo 50 de ${total} produtos. Refine a busca ou os filtros.`
        : `${rows.length} produto(s) encontrado(s).`;

      status.textContent = rows.length ? foundText : 'Nenhum resultado encontrado.';

      activeIndex = -1;
      if (rows.length) setActive(0);

      try {
        tableWrap.scrollTop = 0;
      } catch { }

      hasTypedSinceLastSearch = false;

      if (hydratedTargets.length) {
        status.textContent = `${foundText} Carregando estoque/unidade/preço…`;
        await hydrateTable(hydratedTargets);
        if (seq === searchSeq) status.textContent = foundText;
      }
    } catch (e) {
      if (seq !== searchSeq) return;
      console.error(e);
      status.textContent = 'Erro ao buscar produtos.';
      tbody.innerHTML = '';
      activeIndex = -1;
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Eventos UI
  // ──────────────────────────────────────────────────────────────
  // Todos os elementos marcados com data-modal-close fecham o modal
  overlay.addEventListener('click', (e) => {
    const closeTrigger = e.target.closest('[data-modal-close]');
    if (!closeTrigger || !overlay.contains(closeTrigger)) return;

    e.preventDefault();
    close();
  });

  btn.addEventListener('click', () => {
    buscar();
  });

  q.addEventListener('input', () => {
    hasTypedSinceLastSearch = true;
  });

  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      ev.stopPropagation();

      const rows = getRows();

      if (hasTypedSinceLastSearch) {
        buscar();
        return;
      }

      if (rows.length) {
        pickActiveRow();
        return;
      }

      buscar();
    }
  });

  // filtros
  fGroup?.addEventListener('change', () => {
    // subgrupo selecionado pode não pertencer ao novo grupo
    const current = fSubgroup?.value || '';
    renderSubgroups(current);
    onFilterChanged();
  });

  for (const el of [fStatus, fStock, fSubgroup, fSupplier, fManufacturer]) {
    el?.addEventListener('change', onFilterChanged);
  }

  for (const el of [fSupplier, fManufacturer]) {
    el?.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      buscar();
    });
  }

  bindLookupInput('supplier', fSupplier);
  bindLookupInput('manufacturer', fManufacturer);

  fClear?.addEventListener('click', () => {
    fStatus.value = 'active';
    fStock.value = '';
    fGroup.value = '';
    renderSubgroups('');
    fSupplier.value = '';
    fManufacturer.value = '';
    if (q.value.trim()) buscar();
    q.focus();
  });

  initFilters();

  // ──────────────────────────────────────────────────────────────
  // appFeature: exibir/ocultar a coluna de imagem
  // IMAGE_SHOW | IMAGE_HIDE (option_config.showImages)
  // ──────────────────────────────────────────────────────────────
  async function applyImagesFeature() {
    if (!followImagesFeature) return;

    // feature não cadastrada ou falha → true (mantém a coluna visível)
    const show = await resolveShowProductImages({ apiBase, featureCode: imagesFeatureCode });
    if (!isOpen) return;

    if (show) {
      overlay.classList.remove('pms-images-pending');
      return;
    }

    showImages = false;
    hideImagePreview();
    overlay.querySelectorAll('[data-col="image"]').forEach((el) => el.remove());
    overlay.classList.remove('pms-images-pending');
  }

  applyImagesFeature();

  // prévia ampliada da miniatura
  tbody.addEventListener('mouseover', (ev) => {
    const thumb = ev.target.closest('img[data-pms-thumb]');
    if (thumb) showImagePreview(thumb, ev);
  });

  tbody.addEventListener('mouseout', (ev) => {
    const thumb = ev.target.closest('img[data-pms-thumb]');
    if (thumb && !thumb.contains(ev.relatedTarget)) hideImagePreview();
  });

  tableWrap.addEventListener('scroll', hideImagePreview, { passive: true });

  tbody.addEventListener('mousemove', (ev) => {
    if (imagePreview.style.display === 'block') positionImagePreview(ev);

    const tr = ev.target.closest('tr');
    if (!tr) return;

    const rows = getRows();
    const idx = rows.indexOf(tr);
    if (idx >= 0 && idx !== activeIndex) setActive(idx);
  });

  tbody.addEventListener('click', (ev) => {
    const tr = ev.target.closest('tr');
    if (!tr) return;

    const rows = getRows();
    const idx = rows.indexOf(tr);
    if (idx >= 0) setActive(idx);

    pickActiveRow();
  });

  // ──────────────────────────────────────────────────────────────
  // Teclado global
  // ──────────────────────────────────────────────────────────────
  function navKeyHandler(ev) {
    if (!isOpen) return;
    if (!overlay.isConnected) return;

    const rows = getRows();
    const key = ev.key;

    if (key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      close();
      return;
    }

    const isFocusOnSearch = (document.activeElement === q);

    // selects / datalists dos filtros usam as setas e o Enter nativamente
    if (filtersWrap && filtersWrap.contains(document.activeElement)) return;

    if (!rows.length) return;

    if (key === 'ArrowDown') {
      ev.preventDefault();
      ev.stopPropagation();
      setActive(activeIndex < 0 ? 0 : activeIndex + 1);
      return;
    }

    if (key === 'ArrowUp') {
      ev.preventDefault();
      ev.stopPropagation();
      setActive(activeIndex < 0 ? rows.length - 1 : activeIndex - 1);
      return;
    }

    if (key === 'Home') {
      ev.preventDefault();
      ev.stopPropagation();
      setActive(0);
      return;
    }

    if (key === 'End') {
      ev.preventDefault();
      ev.stopPropagation();
      setActive(rows.length - 1);
      return;
    }

    if (key === 'Enter') {
      if (isFocusOnSearch) return;

      ev.preventDefault();
      ev.stopPropagation();
      pickActiveRow();
    }
  }

  document.addEventListener('keydown', navKeyHandler, true);

  // foco inicial
  setTimeout(() => q.focus(), 0);
}