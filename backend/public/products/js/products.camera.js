// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.camera.js — Hover/Click preview da câmera                  ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { qsa } from './products.utils.js';
import { resolvePreviewUrlFromDataset } from './products.api.js';
import { makeCameraButtonDropTarget } from './products.dragdrop.js';

let previewEl = null;
let previewPinnedUntil = 0;

function ensurePreviewEl() {
  if (previewEl) return previewEl;

  const el = document.createElement('div');
  el.className = 'img-hover-preview';
  el.style.position = 'fixed';
  el.style.zIndex = '9999';
  el.style.pointerEvents = 'none';
  el.style.background = 'white';
  el.style.border = '1px solid var(--line, #e5e7eb)';
  el.style.boxShadow = 'var(--shadow, 0 6px 20px rgba(2,6,23,.08))';
  el.style.borderRadius = '10px';
  el.style.padding = '6px';
  el.style.display = 'none';
  el.innerHTML = `<img alt="preview" style="max-width:220px; max-height:220px; display:block; border-radius:8px;">`;

  document.body.appendChild(el);
  previewEl = el;

  const img = el.querySelector('img');
  img.addEventListener('error', () => {
    console.warn('[products] IMG preview falhou ao carregar:', img.src);
  });

  return el;
}

export async function onCameraEnter(e) {
  const btn = e.currentTarget;
  const urlDirect = btn.dataset.url || '';
  const path = btn.dataset.path || '';

  if (!urlDirect && !path) return;

  const el = ensurePreviewEl();
  const img = el.querySelector('img');

  el.style.display = 'block';
  positionPreview(e);

  try {
    const finalUrl = await resolvePreviewUrlFromDataset({ dataset: { url: urlDirect, path } });
    if (!finalUrl) {
      el.style.display = 'none';
      return;
    }
    img.src = finalUrl;
  } catch (err) {
    console.warn('[products] preview resolve failed:', err);
    if (urlDirect) img.src = urlDirect;
    else el.style.display = 'none';
  }
}

export function onCameraMove(e) {
  if (!previewEl || previewEl.style.display === 'none') return;
  positionPreview(e);
}

export function onCameraLeave() {
  if (Date.now() < previewPinnedUntil) return;
  if (previewEl) previewEl.style.display = 'none';
}

export async function onCameraClick(e) {
  const btn = e.currentTarget;
  const urlDirect = btn.dataset.url || '';
  const path = btn.dataset.path || '';

  if (!urlDirect && !path) return;

  const el = ensurePreviewEl();
  const img = el.querySelector('img');

  el.style.display = 'block';
  previewPinnedUntil = Date.now() + 2000;

  try {
    const finalUrl = await resolvePreviewUrlFromDataset({ dataset: { url: urlDirect, path } });
    if (finalUrl) img.src = finalUrl;
    else if (urlDirect) img.src = urlDirect;
  } catch (err) {
    console.warn('[products] preview resolve failed (click):', err);
    if (urlDirect) img.src = urlDirect;
  }

  setTimeout(() => {
    if (Date.now() >= previewPinnedUntil && el) el.style.display = 'none';
  }, 2100);
}

function positionPreview(e) {
  const el = ensurePreviewEl();
  const pad = 12;

  let x = e.clientX + pad;
  let y = e.clientY + pad;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = el.getBoundingClientRect();

  if (x + rect.width > vw - pad) x = e.clientX - rect.width - pad;
  if (y + rect.height > vh - pad) y = e.clientY - rect.height - pad;

  el.style.left = `${Math.max(0, x)}px`;
  el.style.top = `${Math.max(0, y)}px`;
}

function updateCameraVisualState(btn) {
  const url = String(btn.dataset.url || '').trim();
  const path = String(btn.dataset.path || '').trim();

  const hasImage = Boolean(url || path);

  btn.classList.toggle('btn-camera--without-image', !hasImage);
  btn.classList.toggle('btn-camera--with-image', hasImage);

  btn.setAttribute(
    'title',
    hasImage
      ? 'Visualizar imagem do produto'
      : 'Produto sem imagem — clique ou arraste uma imagem'
  );

  btn.setAttribute('aria-label', btn.title);
}

function updateCameraState(btn) {
  const url = String(btn.dataset.url || '').trim();
  const path = String(btn.dataset.path || '').trim();

  const hasImage = Boolean(url || path);

  btn.classList.toggle('has-image', hasImage);
  btn.classList.toggle('no-image', !hasImage);

  btn.title = hasImage
    ? 'Visualizar imagem do produto'
    : 'Produto sem imagem';

  btn.setAttribute('aria-label', btn.title);
}

export function bindCameraButtons(container = document) {
  qsa('button.btn-camera', container).forEach((btn) => {
    updateCameraState(btn);

    btn.addEventListener('mouseenter', onCameraEnter);
    btn.addEventListener('mousemove', onCameraMove);
    btn.addEventListener('mouseleave', onCameraLeave);
    btn.addEventListener('click', onCameraClick);

    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      btn.classList.add('camera-drop-hover');
    });

    btn.addEventListener('dragenter', (e) => {
      e.preventDefault();
      btn.classList.add('camera-drop-hover');
    });

    btn.addEventListener('dragleave', (e) => {
      e.preventDefault();
      btn.classList.remove('camera-drop-hover');
    });

    btn.addEventListener('drop', () => {
      btn.classList.remove('camera-drop-hover');

      setTimeout(() => {
        updateCameraState(btn);
      }, 200);
    });

    makeCameraButtonDropTarget(btn);

    const observer = new MutationObserver(() => {
      updateCameraState(btn);
    });

    observer.observe(btn, {
      attributes: true,
      attributeFilter: ['data-url', 'data-path'],
    });
  });
}