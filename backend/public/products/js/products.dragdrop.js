'use strict';

import { qsa } from './products.utils.js';
import { getCameraDropZone, setStatus } from './products.dom.js';
import { uploadProductImage } from './products.api.js';

const codeOf = (element) => String(
  element?.closest?.('tr')?.dataset?.productCode || element?.dataset?.productCode || ''
).trim();

function updateButton(btn, response) {
  const url = response?.data?.image_url || response?.data?.imagem_url || response?.data?.url || '';
  const imagePath = response?.data?.image_path || response?.data?.imagePath || response?.data?.path || '';
  if (!btn) return;
  btn.dataset.url = url;
  btn.dataset.path = imagePath;
  btn.classList.toggle('has-image', Boolean(url || imagePath));
  btn.classList.toggle('no-image', !Boolean(url || imagePath));
  btn.title = (url || imagePath) ? 'Visualizar foto' : 'Sem foto';
  btn.setAttribute('aria-label', btn.title);
}

async function sendFile(productCode, file, button = null) {
  if (!productCode) throw new Error('Produto não identificado para upload.');
  if (!file) throw new Error('Arquivo de imagem não informado.');
  setStatus(`Enviando imagem do produto ${productCode}…`, 'info');
  const response = await uploadProductImage(productCode, file, null);
  if (!response?.ok) throw new Error(response?.error || 'Falha no upload.');
  updateButton(button, response);
  window.currentProductForCamera = productCode;
  updateCameraFocusStyles();
  setStatus(`Imagem atualizada para o produto ${productCode}.`, 'success');
}

export function makeRowDraggable() {}

export function makeCameraButtonDropTarget(btn) {
  if (!btn || btn._dropBound) return;
  btn._dropBound = true;
  btn.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    btn.classList.add('camera-drop-hover');
  });
  btn.addEventListener('dragleave', () => btn.classList.remove('camera-drop-hover'));
  btn.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    btn.classList.remove('camera-drop-hover');
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      await sendFile(codeOf(btn), file, btn);
    } catch (error) {
      console.error('[products] Falha ao enviar imagem via botão:', error);
      setStatus(`Falha ao enviar imagem: ${error.message || error}`, 'error');
    }
  });
}

export function bindCameraDropZone() {
  const area = getCameraDropZone();
  if (!area || area._cameraDropBound) return;
  area._cameraDropBound = true;
  area.addEventListener('dragover', onCameraDragOver);
  area.addEventListener('dragleave', onCameraDragLeave);
  area.addEventListener('drop', onCameraDrop);
}

export function onCameraDragOver(event) {
  event.preventDefault();
  event.currentTarget?.classList?.add('camera-drop-hover');
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
}

export function onCameraDragLeave(event) {
  event.preventDefault();
  event.currentTarget?.classList?.remove('camera-drop-hover');
}

export async function onCameraDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const area = event.currentTarget;
  area?.classList?.remove('camera-drop-hover');
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const productCode = codeOf(area) || String(window.currentProductForCamera || '').trim();
  const row = area?.closest?.('tr');
  try {
    await sendFile(productCode, file, row?.querySelector('button.btn-camera'));
  } catch (error) {
    console.error('[products] Falha ao enviar imagem via drop:', error);
    setStatus(`Falha ao enviar imagem: ${error.message || error}`, 'error');
  }
}

export function updateCameraFocusStyles() {
  const current = String(window.currentProductForCamera || '').trim();
  qsa('button.btn-camera').forEach((btn) => {
    const productCode = codeOf(btn);
    btn.classList.toggle('camera-focused', Boolean(current && productCode === current));
    btn.classList.toggle('camera-unfocused', !current);
  });
}
