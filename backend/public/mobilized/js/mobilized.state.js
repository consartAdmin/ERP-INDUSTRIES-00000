'use strict';

export const state = {
  rows: [], total: 0, limit: 50, offset: 0,
  selectedId: null, selectedRow: null, items: [], attachments: [], selectedItemsTotal: 0,
  detailsReady: false, lastFocusedElement: null,
};

const $ = (selector, root = document) => root.querySelector(selector);

export const dom = {
  list: $('#tableBody'), listMeta: $('#listMeta'), form: $('#formMobilized'), itemsBody: $('#itemsBody'),
  q: $('#q'), statusFilter: $('#statusFilter'),
  btnNew: $('#btnNew'), btnRefresh: $('#btnRefresh'), btnSearch: $('#btnSearch'),
  btnPrev: $('#btnPrev'), btnNext: $('#btnNext'), btnSave: $('#btnSave'),
  btnDelete: $('#btnDelete'), btnAddItem: $('#btnAddItem'), btnOpenPdf: $('#btnOpenPdf'),
  btnPdfAll: $('#btnPdfAll'), btnPdfDownload: $('#btnPdfDownload'),
  btnPdfPickUpload: $('#btnPdfPickUpload'), btnPdfGenerateUpload: $('#btnPdfGenerateUpload'),
  pdfFile: $('#pdfFile'), kpiItemsCount: $('#kpiItemsCount'),
  kpiItemsTotal: $('#kpiItemsTotal'), itemsFootTotal: $('#itemsFootTotal'),
  editor: $('.mz-editor'), itemBackdrop: $('#itemModalBackdrop'), itemModal: $('#itemModal'),
  btnCloseItemModal: $('#btnCloseItemModal'), btnItemCancel: $('#btnItemCancel'),
  btnItemSave: $('#btnItemSave'), btnItemSetImageUrl: $('#btnItemSetImageUrl'),
  btnItemClearImageUrl: $('#btnItemClearImageUrl'), itemImgPreview: $('#item_img_preview'),
};

export const fields = {
  mobilized_id: $('#mobilized_id'), title: $('#title'), status: $('#status'),
  acquired_at: $('#acquired_at'), source_system: $('#source_system'),
  external_ref: $('#external_ref'), notes: $('#notes'), pdf_storage: $('#pdf_storage'),
  pdf_path: $('#pdf_path'), pdf_filename: $('#pdf_filename'), pdf_version: $('#pdf_version'),
  pdf_uploaded_at: $('#pdf_uploaded_at'), pdf_size_bytes: $('#pdf_size_bytes'), pdf_sha256: $('#pdf_sha256'),
};

export const itemFields = {
  mobilized_item_id: $('#mobilized_item_id'), sku: $('#item_sku'), description: $('#item_description'),
  model: $('#item_model'), serial_number: $('#item_serial_number'), nfe_ref: $('#item_nfe_ref'),
  quantity: $('#item_quantity'), unit: $('#item_unit'), unit_price: $('#item_unit_price'),
  total_value: $('#item_total_value'), notes: $('#item_notes'),
};

export const itemImageFile = Object.assign(document.createElement('input'), {
  type: 'file', accept: 'image/*', hidden: true,
});
