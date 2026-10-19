// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: fiscalProfile.state.js                                        ║
// ║ MODULE: Fiscal Profile — State and DOM                              ║
// ║ PRODNEX ERP                                                         ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

import { DEFAULT_PAGE_SIZE } from './fiscalProfile.config.js';
import { qs } from './fiscalProfile.utils.js';

export const state = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  q: '',
  loading: false,
  currentView: 'list',
};

export const dom = {
  // =========================================================
  // PÁGINAS DO MÓDULO
  // =========================================================

  listPage: qs('#painel-lista'),
  formPage: qs('#painel-form'),

  // =========================================================
  // NAVEGAÇÃO
  // =========================================================

  newButton: qs('#btnNovo'),
  backToListButton: qs('#btnVoltarLista'),

  // =========================================================
  // LISTA E FILTROS
  // =========================================================

  tableBody: qs('#tableBody'),
  searchInput: qs('#busca'),
  searchButton: qs('#btnBuscar'),

  // =========================================================
  // PAGINAÇÃO
  // =========================================================

  previousButton: qs('#btnPrevious'),
  nextButton: qs('#btnNext'),
  tableInfo: qs('#apTableInfo'),
  pageInfo: qs('#pageInfo'),
  pageSizeSelect: qs('#pageSize'),

  // =========================================================
  // FORMULÁRIO
  // =========================================================

  form: qs('#formFiscalProfile'),
  formTitle: qs('#formTitulo'),
  formSubtitle: qs('#formSubtitulo'),
  clearButton: qs('#btnLimpar'),

  // =========================================================
  // CAMPOS
  // =========================================================

  fields: {
    id: qs('#fiscal_profile_id'),
    profileName: qs('#profile_name'),
    description: qs('#description'),

    icmsCst: qs('#icms_cst'),
    icmsRate: qs('#icms_rate'),
    benefitCode: qs('#benefit_code'),

    cfopEntry: qs('#cfop_entry'),
    cfopExit: qs('#cfop_exit'),
    originCode: qs('#origin_code'),

    pisCst: qs('#pis_cst'),
    pisRate: qs('#pis_rate'),

    cofinsCst: qs('#cofins_cst'),
    cofinsRate: qs('#cofins_rate'),

    isActive: qs('#is_active'),
  },
};
