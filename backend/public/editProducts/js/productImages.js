// ╔══════════════════════════════════════════════════════════════════════╗
// ║ productImages.js — Galeria / Upload de Imagens do Produto          ║
// ║ PRODNEX ERP | ESM                                                   ║
// ║                                                                      ║
// ║ ✅ Todas as imagens do produto (gerais + por unidade)               ║
// ║ ✅ Seletor de unidade por imagem (productsImages.barcode_id)        ║
// ║ ✅ Unidade de destino no upload                                      ║
// ║ ✅ Principal por unidade / remoção                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝
'use strict';

import {
  listProductImages,
  listProductUnits,
  uploadProductImage,
  updateProductImage,
  setPrimaryProductImage,
  deleteProductImage,
  PRODUCT_IMAGES_CHANGED,
  notifyProductImagesChanged,
} from './productImagesApi.js';

const $ = (s) => document.querySelector(s);

const GENERAL_VALUE = '';
const EVENT_SOURCE = 'gallery';

function ensureStyles() {
  if ($('#product-images-runtime-styles')) return;
  const style = document.createElement('style');
  style.id = 'product-images-runtime-styles';
  style.textContent = `
    .product-image-item{display:flex;flex-direction:column;gap:4px;min-width:0}
    .product-image-item__media{position:relative;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff;aspect-ratio:1/1}
    .product-image-item.is-primary .product-image-item__media{outline:2px solid currentColor;outline-offset:1px}
    .product-image-item__media img{display:block;width:100%;height:100%;object-fit:contain;background:#fff}
    .product-image-item__primary{position:absolute;left:5px;top:5px;padding:3px 6px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font-size:10px;font-weight:800}
    .product-image-item__actions{position:absolute;right:5px;bottom:5px;display:flex;gap:4px;opacity:0;transition:opacity .15s ease}
    .product-image-item__media:hover .product-image-item__actions,.product-image-item__media:focus-within .product-image-item__actions{opacity:1}
    .product-image-item__actions button{border:0;border-radius:6px;padding:5px 7px;cursor:pointer;background:rgba(0,0,0,.76);color:#fff;font-size:11px}
    .product-image-item__unit{width:100%;min-width:0;height:24px;padding:0 4px;border:1px solid var(--line);border-radius:6px;background:var(--card);font-size:11px}
    .product-images-preview{grid-column:1/-1;display:flex;gap:7px;flex-wrap:wrap;margin-bottom:4px}
    .product-images-preview__item{width:54px;height:54px;border:1px dashed var(--line);border-radius:6px;overflow:hidden;background:#fff}
    .product-images-preview__item img{width:100%;height:100%;object-fit:contain}
    .product-images-loading{grid-column:1/-1;display:grid;place-items:center;min-height:130px;color:var(--muted)}
  `;
  document.head.appendChild(style);
}

function normalizeProductImage(raw = {}) {
  return {
    product_image_id: Number(raw.product_image_id ?? raw.product_imagem_id ?? 0) || null,
    barcode_id: raw.barcode_id == null ? null : Number(raw.barcode_id),
    image_url: raw.image_url ?? raw.imagem_url ?? raw.url ?? '',
    image_path: raw.image_path ?? raw.imagem_path ?? raw.path ?? '',
    image_alt: raw.image_alt ?? null,
    is_primary: raw.is_primary === true,
    position: Number(raw.position ?? 0),
  };
}

function normalizeUnit(raw = {}) {
  return {
    barcode_id: Number(raw.barcode_id),
    unit: String(raw.unit ?? '').trim().toUpperCase(),
    description: String(raw.unit_description ?? raw.description ?? '').trim(),
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

export function initProductImages(ctx, { productCode } = {}) {
  ensureStyles();

  const code = String(productCode ?? '').trim();
  const gallery = $('#productsImagensGallery');
  const input = $('#productsImagensInput');
  const uploadBtn = $('#btnUploadProductsImagens');
  const uploadUnit = $('#productsImagensUploadUnit');
  const count = $('#productsImagensCount');

  if (!gallery || !input || !uploadBtn || !count) {
    console.warn('[productImages] elementos da galeria não encontrados.');
    return null;
  }
  if (!code) {
    console.warn('[productImages] productCode inválido:', productCode);
    return null;
  }

  let images = [];
  let units = [];
  let selectedFiles = [];
  let busy = false;

  const toast = (message, type = 'info') => {
    if (typeof ctx?.toast === 'function') return ctx.toast(message, type);
    console[type === 'error' ? 'error' : 'log'](message);
  };

  function unitOptionsHtml(selectedBarcodeId) {
    const selected = selectedBarcodeId == null ? GENERAL_VALUE : String(selectedBarcodeId);
    const options = [{ value: GENERAL_VALUE, label: 'Geral (produto)', title: 'Imagem geral do produto' }];

    units.forEach((u) => {
      options.push({
        value: String(u.barcode_id),
        label: u.unit,
        title: u.description ? `${u.unit} — ${u.description}` : u.unit,
      });
    });

    // Imagem vinculada a uma unidade inativa/removida continua visível.
    if (selected !== GENERAL_VALUE && !options.some((o) => o.value === selected)) {
      options.push({ value: selected, label: `Unidade #${selected} (inativa)`, title: 'Unidade inativa' });
    }

    return options
      .map((o) => `<option value="${esc(o.value)}" title="${esc(o.title)}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`)
      .join('');
  }

  function renderUploadUnitSelect() {
    if (!uploadUnit) return;
    const current = uploadUnit.value || GENERAL_VALUE;
    uploadUnit.innerHTML = unitOptionsHtml(null);
    // Mantém a escolha anterior se a unidade ainda existir.
    if ([...uploadUnit.options].some((o) => o.value === current)) uploadUnit.value = current;
  }

  function unitLabel(barcodeId) {
    if (barcodeId == null) return 'Geral';
    return units.find((u) => u.barcode_id === barcodeId)?.unit || `Unidade #${barcodeId}`;
  }

  function updateCount() {
    count.textContent = `${images.length} ${images.length === 1 ? 'imagem' : 'imagens'}`;
  }

  function renderSelectedPreview() {
    gallery.querySelector('.product-images-preview')?.remove();
    if (!selectedFiles.length) return;

    const wrap = document.createElement('div');
    wrap.className = 'product-images-preview';
    wrap.title = `${selectedFiles.length} arquivo(s) selecionado(s) para envio`;

    selectedFiles.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'product-images-preview__item';
      const img = document.createElement('img');
      img.alt = file.name || 'Prévia';
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      item.appendChild(img);
      wrap.appendChild(item);
    });
    gallery.prepend(wrap);
  }

  function render() {
    gallery.innerHTML = '';
    updateCount();
    renderUploadUnitSelect();

    if (!images.length) {
      const empty = document.createElement('div');
      empty.id = 'productsImagensEmpty';
      empty.className = 'product-images-empty';
      empty.textContent = 'Nenhuma imagem cadastrada para este produto.';
      gallery.appendChild(empty);
      renderSelectedPreview();
      return;
    }

    images.forEach((image) => {
      const item = document.createElement('article');
      item.className = `product-image-item${image.is_primary ? ' is-primary' : ''}`;
      item.dataset.imageId = String(image.product_image_id);

      const label = esc(unitLabel(image.barcode_id));

      item.innerHTML = `
        <div class="product-image-item__media">
          <img src="${esc(image.image_url)}" alt="${esc(image.image_alt || `Imagem do produto ${code}`)}" loading="lazy">
          ${image.is_primary ? `<span class="product-image-item__primary" title="Imagem principal — ${label}">★ ${label}</span>` : ''}
          <div class="product-image-item__actions">
            ${image.is_primary ? '' : `<button type="button" data-action="primary" title="Definir como principal de ${esc(unitLabel(image.barcode_id))}">★</button>`}
            <button type="button" data-action="delete" title="Remover imagem">🗑️</button>
          </div>
        </div>
        <select class="product-image-item__unit" data-action="unit" title="Unidade desta imagem" aria-label="Unidade desta imagem">
          ${unitOptionsHtml(image.barcode_id)}
        </select>
      `;

      item.querySelector('img').addEventListener('error', (ev) => {
        console.warn('[productImages] imagem não carregou:', { image_url: image.image_url, image_path: image.image_path });
        ev.currentTarget.alt = 'Não foi possível carregar esta imagem';
      });

      gallery.appendChild(item);
    });

    renderSelectedPreview();
  }

  async function refresh() {
    gallery.innerHTML = '<div class="product-images-loading">Carregando imagens…</div>';
    try {
      const [responseImages, responseUnits] = await Promise.all([
        listProductImages(code),
        listProductUnits(code).catch((err) => {
          console.warn('[productImages] falha ao carregar unidades:', err.message);
          return [];
        }),
      ]);

      images = responseImages.map(normalizeProductImage).filter((img) => img.product_image_id);
      units = responseUnits.map(normalizeUnit).filter((u) => Number.isInteger(u.barcode_id) && u.unit);
      render();
    } catch (err) {
      images = [];
      render();
      toast(`❌ Falha ao carregar imagens: ${err.message}`, 'error');
    }
  }

  // Executa uma alteração, recarrega a galeria e avisa a aba Unidades.
  async function mutate(action, successMessage) {
    if (busy) return;
    busy = true;
    try {
      await action();
      if (successMessage) toast(successMessage, 'success');
      notifyProductImagesChanged(EVENT_SOURCE);
    } catch (err) {
      toast(`❌ ${err.message}`, 'error');
    } finally {
      busy = false;
      await refresh();
    }
  }

  input.addEventListener('change', () => {
    selectedFiles = Array.from(input.files || []).filter((f) => /^image\/(jpeg|png|webp)$/i.test(f.type));
    uploadBtn.disabled = selectedFiles.length === 0 || busy;
    render();
  });

  uploadBtn.addEventListener('click', async () => {
    if (busy || !selectedFiles.length) return;
    busy = true;
    uploadBtn.disabled = true;
    const originalText = uploadBtn.textContent;
    const barcodeId = uploadUnit?.value ? Number(uploadUnit.value) : null;

    try {
      for (let i = 0; i < selectedFiles.length; i += 1) {
        uploadBtn.textContent = `📤 Enviando ${i + 1}/${selectedFiles.length}...`;
        await uploadProductImage(code, selectedFiles[i], { barcodeId });
      }
      selectedFiles = [];
      input.value = '';
      toast(`✅ Imagem(ns) enviada(s) para ${unitLabel(barcodeId)}.`, 'success');
      notifyProductImagesChanged(EVENT_SOURCE);
    } catch (err) {
      toast(`❌ Falha no upload: ${err.message}`, 'error');
    } finally {
      busy = false;
      uploadBtn.textContent = originalText;
      uploadBtn.disabled = selectedFiles.length === 0;
      await refresh();
    }
  });

  gallery.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || busy) return;
    const imageId = Number(button.closest('[data-image-id]')?.dataset.imageId);
    if (!Number.isFinite(imageId) || imageId <= 0) return;

    if (button.dataset.action === 'primary') {
      mutate(() => setPrimaryProductImage(code, imageId), '✅ Imagem principal atualizada.');
    } else if (button.dataset.action === 'delete') {
      if (!window.confirm('Remover esta imagem do produto?')) return;
      mutate(() => deleteProductImage(imageId), '✅ Imagem removida.');
    }
  });

  gallery.addEventListener('change', (event) => {
    const select = event.target.closest('select[data-action="unit"]');
    if (!select) return;
    const imageId = Number(select.closest('[data-image-id]')?.dataset.imageId);
    if (!Number.isFinite(imageId) || imageId <= 0) return;

    const barcodeId = select.value ? Number(select.value) : null;
    mutate(
      () => updateProductImage(imageId, { barcode_id: barcodeId }),
      `✅ Imagem vinculada a ${unitLabel(barcodeId)}.`,
    );
  });

  // Alterações feitas na aba Unidades (imagens ou unidades).
  document.addEventListener(PRODUCT_IMAGES_CHANGED, (event) => {
    if (event.detail?.source !== EVENT_SOURCE) refresh();
  });

  refresh();
  return { refresh, getImages: () => [...images] };
}

export default initProductImages;
