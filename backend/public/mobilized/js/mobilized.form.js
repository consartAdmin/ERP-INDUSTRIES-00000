'use strict';

import { DEFAULT_STATUS } from './mobilized.config.js';
import { dom, fields, itemFields, state } from './mobilized.state.js';
import { formatDateTime, parseDateTimeLocal, setDisabled, toNumber } from './mobilized.utils.js';

export function setPdfButtons(enabled) {
  [dom.btnPdfDownload, dom.btnPdfPickUpload, dom.btnPdfGenerateUpload].forEach((button) => setDisabled(button, !enabled));
}
export function resetEditor() {
  state.selectedId = null; state.selectedRow = null; state.items = []; state.attachments = []; state.selectedItemsTotal = 0;
  dom.form?.reset();
  if (fields.mobilized_id) fields.mobilized_id.value = '';
  if (fields.status) fields.status.value = DEFAULT_STATUS;
  if (fields.pdf_storage) fields.pdf_storage.value = 'local';
  if (fields.pdf_version) fields.pdf_version.value = 1;
  [dom.btnSave, dom.btnDelete, dom.btnAddItem, dom.btnOpenPdf].forEach((button) => setDisabled(button, true));
  setPdfButtons(false);
}
export function prepareNew() {
  resetEditor(); setDisabled(dom.btnSave, false);
  fields.acquired_at.value = formatDateTime(new Date());
}
export function fillEditor(row) {
  state.selectedRow = row; state.selectedId = row.mobilized_id;
  const values = { ...row, acquired_at: formatDateTime(row.acquired_at), pdf_uploaded_at: formatDateTime(row.pdf_uploaded_at) };
  Object.entries(fields).forEach(([key, field]) => { if (field) field.value = values[key] ?? ''; });
  fields.status.value ||= DEFAULT_STATUS; fields.pdf_storage.value ||= 'local'; fields.pdf_version.value ||= 1;
  setDisabled(dom.btnSave, false); setDisabled(dom.btnDelete, false); setDisabled(dom.btnAddItem, false);
  setDisabled(dom.btnOpenPdf, !String(fields.pdf_path.value || '').trim()); setPdfButtons(true);
}
export function collectMobilized() {
  return {
    title: fields.title.value.trim(), status: fields.status.value,
    acquired_at: parseDateTimeLocal(fields.acquired_at.value),
    source_system: fields.source_system.value.trim() || null,
    external_ref: fields.external_ref.value.trim() || null, notes: fields.notes.value.trim() || null,
    pdf_storage: fields.pdf_storage.value, pdf_path: fields.pdf_path.value.trim() || null,
    pdf_filename: fields.pdf_filename.value.trim() || null, pdf_version: Number(fields.pdf_version.value || 1),
    pdf_uploaded_at: parseDateTimeLocal(fields.pdf_uploaded_at.value),
    pdf_size_bytes: fields.pdf_size_bytes.value ? Number(fields.pdf_size_bytes.value) : null,
    pdf_sha256: fields.pdf_sha256.value.trim() || null,
  };
}
export function fillItem(row = null) {
  Object.entries(itemFields).forEach(([key, field]) => { if (field) field.value = row?.[key] ?? ''; });
  itemFields.quantity.value = row?.quantity ?? 1; recalcItemTotal();
}
export function collectItem() {
  const quantity = toNumber(itemFields.quantity.value); const unitPrice = toNumber(itemFields.unit_price.value);
  return {
    sku: itemFields.sku.value.trim() || null, description: itemFields.description.value.trim(),
    model: itemFields.model.value.trim() || null, serial_number: itemFields.serial_number.value.trim() || null,
    nfe_ref: itemFields.nfe_ref.value.trim() || null, quantity,
    unit: itemFields.unit.value.trim() || null,
    unit_price: itemFields.unit_price.value !== '' ? unitPrice : null,
    total_value: Number((quantity * unitPrice).toFixed(2)), notes: itemFields.notes.value.trim() || null,
  };
}
export function recalcItemTotal() {
  if (!itemFields.total_value) return;
  itemFields.total_value.value = (toNumber(itemFields.quantity.value) * toNumber(itemFields.unit_price.value)).toFixed(2);
  itemFields.total_value.readOnly = true;
}
