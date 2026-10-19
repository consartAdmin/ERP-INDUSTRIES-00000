/* ╔══════════════════════════════════════════════════════════════════╗
 * ║ nfeInbox.state.js — Estado e DOM | PRODNEX ERP (ESM)            ║
 * ╚══════════════════════════════════════════════════════════════════╝ */
'use strict';

import { DEFAULT_PAGE_SIZE } from './nfeInbox.config.js';

export const DEFAULT_SORT_COLUMN = 'data_autorizacao';
export const DEFAULT_SORT_DIRECTION = 'desc';

/** Colunas que o backend aceita ordenar. */
export const SORTABLE_COLUMNS = Object.freeze([
  'data_autorizacao',
  'chave_nfe',
  'numero',
  'emitente_razao',
  'destinatario_razao',
  'valor_total',
  'entrada_criada',
  // 'manifestacao' fora da lista: a coluna está oculta na tela
]);

export const state = {
  currentPage: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortColumn: DEFAULT_SORT_COLUMN,
  sortDirection: DEFAULT_SORT_DIRECTION,
  total: 0,
  totalPages: 1,
  lastBatchSize: 0,
  currentRows: [],
  selectedId: null,
  selectedRowEl: null,
  loading: false,
};

export function getDom() {
  const byId = (id) => document.getElementById(id);
  const $modal = byId('nfi-detail-modal');
  const $entryModal = byId('nfi-entry-modal');

  return {
    $form: byId('nfi-filter-form'),
    $situacao: byId('situacao'),
    $manifestacao: byId('manifestacao'),
    $table: byId('nfi-table'),
    // O id do componente mudou para filterDateRange; o antigo fica como fallback
    $periodo: byId('filterDateRange') || byId('nfi-periodo'),
    // Mantidos como fallback caso a página volte aos inputs nativos
    $dataIni: byId('dataIni'),
    $dataFim: byId('dataFim'),
    $q: byId('nfi-q'),
    $tbody: byId('tableBodyList'),
    $emptyState: byId('nfi-empty-state'),
    $tableInfo: byId('apTableInfo'),
    $pageSize: byId('pageSize'),
    $prevPage: byId('btnPrevious'),
    $nextPage: byId('btnNext'),
    $pageInfo: byId('apTableInfos') || byId('pageInfo'),
    $btnApplyFilters: byId('btnNfiApplyFilters'),
    $btnClearFilters: byId('btnNfiClearFilters'),
    $btnImportXml: byId('btnNfiImportXml'),
    $fileInput: byId('nfi-file-input'),
    $btnEntradaNF: byId('btnNfiEntrada'),
    $btnSyncDfe: byId('btnNfiSyncDfe'),
    // Única superfície de status da sincronização (indicador no topo).
    $syncInfo: byId('nfi-sync-info'),
    $btnDownloadXml: byId('btnNfiDownloadXml'),
    $btnDownloadPdf: byId('btnNfiDownloadPdf'),
    $btnManifest: byId('btnNfiManifest'),
    $manifestSelect: byId('nfi-manifest-select'),
    $btnDownloadXmlLote: byId('btnNfiDownloadXmlLote'),
    $modal,
    $modalClose: byId('nfi-modal-close'),
    $modalBackdrop: $modal?.querySelector('.nfi-modal-backdrop'),
    $dChave: byId('nfi-detail-chave'),
    $dModSerieNum: byId('nfi-detail-mod-serie-num'),
    $dEmissao: byId('nfi-detail-emissao'),
    $dAutorizacao: byId('nfi-detail-autorizacao'),
    $dEmitenteCnpj: byId('nfi-detail-emitente-cnpj'),
    $dEmitenteRazao: byId('nfi-detail-emitente-razao'),
    $dDestCnpj: byId('nfi-detail-dest-cnpj'),
    $dDestRazao: byId('nfi-detail-dest-razao'),
    $dSituacao: byId('nfi-detail-situacao'),
    $dManifestacao: byId('nfi-detail-manifestacao'),
    $dValor: byId('nfi-detail-valor'),
    $dXml: byId('nfi-detail-xml'),
    $entryModal,
    $entryBackdrop: $entryModal?.querySelector('.nfi-modal-backdrop'),
    $entryClose: byId('nfi-entry-close'),
    $entryChave: byId('nfi-entry-chave'),
    $entryEmitente: byId('nfi-entry-emitente'),
    $entryValor: byId('nfi-entry-valor'),
    $entryConfirm: byId('nfi-entry-confirm'),
    $entryCancel: byId('nfi-entry-cancel'),
  };
}

export function resetListState() {
  state.currentPage = 1;
  state.sortColumn = DEFAULT_SORT_COLUMN;
  state.sortDirection = DEFAULT_SORT_DIRECTION;
  state.total = 0;
  state.totalPages = 1;
  state.lastBatchSize = 0;
  state.currentRows = [];
  state.selectedId = null;
  state.selectedRowEl = null;
}
