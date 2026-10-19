// ╔══════════════════════════════════════════════════════════════════════╗
// ║ products.upload.js — Upload de imagem por linha                     ║
// ║ PRODNEX ERP | ESM                                                   ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { setStatus } from './products.dom.js';
import { uploadProductImage } from './products.api.js';
import { updateCameraFocusStyles } from './products.dragdrop.js';

export async function onUploadImageTable(ev) {
  const input = ev.currentTarget;
  const productCode = String(
    input.dataset.productCode || input.closest('tr')?.dataset?.productCode || ''
  ).trim();

  if (!productCode || !input.files?.length) return;

  const file = input.files[0];
  setStatus(`Enviando imagem do produto ${productCode}…`);

  try {
    // Upload pela lista cria/atualiza a imagem geral (barcode_id = NULL).
    const res = await uploadProductImage(productCode, file, null);
    if (!res?.ok) throw new Error(res?.error || 'Falha no upload.');

    const tr = input.closest('tr');
    const cam = tr?.querySelector('button.btn-camera');

    const url  = res.data?.image_url || res.data?.imagem_url || res.data?.url || '';
    const path = res.data?.image_path || res.data?.imagePath || res.data?.path || '';

    if (cam) {
      cam.dataset.url = url || '';
      cam.dataset.path = path || '';
      cam.classList.toggle('has-image', !!(url || path));
      cam.classList.toggle('no-image', !(url || path));
      cam.title = (url || path) ? 'Visualizar foto' : 'Sem foto';
      cam.setAttribute('aria-label', cam.title);
    }

    setStatus(`Imagem atualizada para o produto ${productCode}.`, 'success');
    updateCameraFocusStyles();
  } catch (err) {
    console.error('Upload falhou:', err);
    setStatus(`Falha ao enviar imagem: ${err.message || err}`, 'error');
  } finally {
    input.value = '';
  }
}
