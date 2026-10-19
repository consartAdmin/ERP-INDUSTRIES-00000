'use strict';

import { API_BASE, MOBILIZED_API } from './mobilized.config.js';
import { mobilizedApi } from './mobilized.api.js';
import { collectItem, collectMobilized, fillEditor, prepareNew, recalcItemTotal, resetEditor, setPdfButtons } from './mobilized.form.js';
import { closeItemModal, openDetailsModal, openItemModal } from './mobilized.modal.js';
import { configureRender, renderItems, renderList, renderTotals } from './mobilized.render.js';
import { dom, fields, itemFields, itemImageFile, state } from './mobilized.state.js';
import { imageCandidates, notify, setDisabled, setImageWithFallback } from './mobilized.utils.js';
import { validateItem, validateMobilized } from './mobilized.validation.js';

export async function loadList(reset = false) {
  try {
    if (reset) state.offset = 0;
    const query = new URLSearchParams({ limit: state.limit, offset: state.offset, orderBy: 'mobilized_id desc' });
    if (dom.q?.value.trim()) query.set('q', dom.q.value.trim());
    if (dom.statusFilter?.value) query.set('status', dom.statusFilter.value);
    const output = await mobilizedApi.list(query);
    state.rows = output.data || []; state.total = output.meta?.total ?? state.rows.length;
    if (state.selectedId && !state.rows.some((row) => String(row.mobilized_id) === String(state.selectedId))) resetEditor();
    renderList(); renderItems(); renderTotals();
  } catch (error) { notify(error.message || 'Erro ao listar mobilizados.', 'error'); }
}
export async function loadItems(id) {
  try {
    const itemsOutput = await mobilizedApi.listItems(id);
    state.items = itemsOutput.data || [];
  } catch (error) {
    state.items = [];
    notify(error.message || 'Erro ao carregar itens.', 'error');
  }

  try {
    const attachmentsOutput = await mobilizedApi.listAttachments(id);
    state.attachments = attachmentsOutput.data || [];
  } catch (error) {
    state.attachments = [];
    console.warn('[mobilized] Não foi possível carregar os anexos:', error);
  }
  renderItems(); renderTotals();
}
export async function selectMobilized(id) {
  try {
    const row = (await mobilizedApi.get(id)).data;
    if (!row) return notify('Registro não encontrado.', 'error');
    fillEditor(row); renderList(); await loadItems(id); openDetailsModal();
  } catch (error) { notify(error.message || 'Erro ao carregar mobilizado.', 'error'); }
}
export function newMobilized() {
  prepareNew(); renderItems(); renderTotals(); openDetailsModal({ focusTitle: true });
}
export async function saveMobilized() {
  const payload = collectMobilized(); const validation = validateMobilized(payload);
  if (validation) return notify(validation, 'error');
  try {
    const id = Number(fields.mobilized_id.value) || null;
    const output = id ? await mobilizedApi.update(id, payload) : await mobilizedApi.create(payload);
    fillEditor(output.data); await loadList(!id); notify(id ? 'Mobilizado atualizado ✅' : 'Mobilizado criado com sucesso ✅');
  } catch (error) { notify(error.message || 'Erro ao salvar mobilizado.', 'error'); }
}
export async function deleteMobilized() {
  const id = Number(fields.mobilized_id.value) || null;
  if (!id || !confirm('Excluir este mobilizado e todos os seus itens?')) return;
  try { await mobilizedApi.remove(id); resetEditor(); await loadList(true); notify('Mobilizado excluído ✅'); }
  catch (error) { notify(error.message || 'Erro ao excluir mobilizado.', 'error'); }
}
export async function saveItem() {
  if (!state.selectedId) return notify('Salve o mobilizado primeiro.', 'error');
  const payload = collectItem(); const validation = validateItem(payload);
  if (validation) return notify(validation, 'error');
  const id = Number(itemFields.mobilized_item_id.value) || null;
  try {
    if (id) await mobilizedApi.updateItem(id, payload); else await mobilizedApi.createItem(state.selectedId, payload);
    closeItemModal(); await loadItems(state.selectedId); await loadList(false);
    notify(id ? 'Item atualizado ✅' : 'Item adicionado ✅');
  } catch (error) { notify(error.message || 'Erro ao salvar item.', 'error'); }
}
export async function deleteItem(id) {
  if (!confirm('Excluir este item?')) return;
  try { await mobilizedApi.removeItem(id); await loadItems(state.selectedId); await loadList(false); notify('Item excluído ✅'); }
  catch (error) { notify(error.message || 'Erro ao excluir item.', 'error'); }
}
export async function refreshItemImage() {
  const itemId = Number(itemFields.mobilized_item_id.value) || null;
  const attachment = itemId
    ? state.attachments.find((entry) =>
        Number(entry.mobilized_item_id) === itemId &&
        entry.is_primary &&
        entry.status === 'ACTIVE'
      )
    : null;
  setImageWithFallback(
    dom.itemImgPreview,
    attachment?.public_url ? [attachment.public_url] : imageCandidates(itemFields.sku.value)
  );
}
async function uploadSelectedImage() {
  const file = itemImageFile.files?.[0];
  const itemId = Number(itemFields.mobilized_item_id.value) || null;
  if (!file) return;
  if (!state.selectedId || !itemId) {
    itemImageFile.value = '';
    return notify('Salve o item antes de enviar a imagem.', 'error');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    itemImageFile.value = '';
    return notify('Selecione uma imagem JPG, PNG ou WEBP.', 'error');
  }
  try {
    const data = new FormData();
    data.append('attachment', file);
    data.append('attachment_type', 'IMAGE');
    data.append('is_primary', 'true');
    const output = await mobilizedApi.uploadItemAttachment(state.selectedId, itemId, data);
    state.attachments = state.attachments.filter((entry) =>
      !(Number(entry.mobilized_item_id) === itemId && entry.is_primary)
    );
    if (output.data) state.attachments.push(output.data);
    await refreshItemImage();
    renderItems();
    notify('Imagem enviada para o GCS ✅');
  } catch (error) { notify(error.message || 'Falha ao enviar imagem.', 'error'); }
  finally { itemImageFile.value = ''; }
}
function openPath(path) {
  if (!path) return;
  const url = /^https?:\/\//i.test(path) ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
function downloadAll() {
  const query = new URLSearchParams(); if (dom.q?.value.trim()) query.set('q', dom.q.value.trim());
  if (dom.statusFilter?.value) query.set('status', dom.statusFilter.value);
  openPath(`${MOBILIZED_API}/pdf/all${query.size ? `?${query}` : ''}`);
}
export function bindActions() {
  configureRender({ select: selectMobilized, editItem: openItemModal, deleteItem });
  dom.btnNew?.addEventListener('click', newMobilized); dom.btnRefresh?.addEventListener('click', () => loadList(false));
  dom.btnSearch?.addEventListener('click', () => loadList(true));
  dom.q?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loadList(true); });
  dom.statusFilter?.addEventListener('change', () => loadList(true));
  dom.btnPrev?.addEventListener('click', () => { state.offset = Math.max(0, state.offset - state.limit); loadList(); });
  dom.btnNext?.addEventListener('click', () => { if (state.offset + state.limit < state.total) { state.offset += state.limit; loadList(); } });
  dom.btnSave?.addEventListener('click', (event) => { event.preventDefault(); saveMobilized(); });
  dom.btnDelete?.addEventListener('click', (event) => { event.preventDefault(); deleteMobilized(); });
  dom.btnAddItem?.addEventListener('click', () => state.selectedId ? openItemModal() : notify('Salve o mobilizado primeiro.', 'error'));
  dom.btnItemSave?.addEventListener('click', saveItem);
  itemFields.quantity?.addEventListener('input', recalcItemTotal); itemFields.unit_price?.addEventListener('input', recalcItemTotal);
  itemFields.sku?.addEventListener('input', refreshItemImage);
  dom.btnItemSetImageUrl?.addEventListener('click', () => {
    if (!Number(itemFields.mobilized_item_id.value)) {
      return notify('Salve o item antes de enviar a imagem.', 'error');
    }
    itemImageFile.value = '';
    itemImageFile.click();
  });
  itemImageFile.addEventListener('change', uploadSelectedImage);
  dom.btnItemClearImageUrl?.addEventListener('click', async () => {
    const itemId = Number(itemFields.mobilized_item_id.value) || null;
    const attachment = state.attachments.find((entry) =>
      Number(entry.mobilized_item_id) === itemId &&
      entry.is_primary &&
      entry.status === 'ACTIVE'
    );
    if (!attachment) return notify('Este item não possui imagem enviada.', 'error');
    if (!confirm('Remover esta imagem?')) return;
    try {
      await mobilizedApi.removeAttachment(state.selectedId, attachment.mobilized_attachment_id);
      state.attachments = state.attachments.filter((entry) =>
        Number(entry.mobilized_attachment_id) !== Number(attachment.mobilized_attachment_id)
      );
      await refreshItemImage();
      renderItems();
      notify('Imagem removida ✅');
    } catch (error) {
      notify(error.message || 'Falha ao remover imagem.', 'error');
    }
  });
  dom.btnOpenPdf?.addEventListener('click', () => openPath(fields.pdf_path.value.trim()));
  fields.pdf_path?.addEventListener('input', () => setDisabled(dom.btnOpenPdf, !fields.pdf_path.value.trim()));
  dom.btnPdfDownload?.addEventListener('click', () => state.selectedId && openPath(`${MOBILIZED_API}/${state.selectedId}/pdf`));
  dom.btnPdfAll?.addEventListener('click', downloadAll);
  dom.btnPdfGenerateUpload?.addEventListener('click', async () => {
    if (!state.selectedId) return notify('Selecione um mobilizado.', 'error');
    try { fillEditor((await mobilizedApi.generatePdf(state.selectedId)).data); notify('PDF gerado e enviado ao GCS ✅'); }
    catch (error) { notify(error.message || 'Falha ao gerar PDF.', 'error'); }
  });
  dom.btnPdfPickUpload?.addEventListener('click', () => state.selectedId ? dom.pdfFile?.click() : notify('Selecione um mobilizado.', 'error'));
  dom.pdfFile?.addEventListener('change', async () => {
    const file = dom.pdfFile.files?.[0]; if (!file || !state.selectedId) return;
    try { const data = new FormData(); data.append('pdf', file); fillEditor((await mobilizedApi.uploadPdf(state.selectedId, data)).data); notify('PDF enviado ao GCS ✅'); }
    catch (error) { notify(error.message || 'Falha ao enviar PDF.', 'error'); }
    finally { dom.pdfFile.value = ''; }
  });
  setPdfButtons(false);
}
