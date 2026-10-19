// ╔══════════════════════════════════════════════════════════════════════╗
// ║ spedFiscal.config.js — Configurações do módulo SPED Fiscal          ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE = (
  window.API_BASE ||
  window.apiBase ||
  window.location.origin
).replace(/\/$/, '');

export const DEFAULT_FINALIDADE = 'original';

export const SELECTORS = Object.freeze({
  companyId: '#companyId',
  enterpriseName: '#enterpriseName',
  btnSearchEnterprise: '#btnSearchEnterprise',
  month: '#month',
  year: '#year',
  uf: '#uf',
  finalidade: '#finalidade',
  btnPreview: '#btnPreview',
  btnValidate: '#btnValidate',
  btnGenerate: '#btnGenerate',
  btnDownload: '#btnDownload',
  summaryBox: '#summaryBox',
  statusBox: '#statusBox',
  issuesTableBody: '#issuesTableBody',
  issuesModal: '#spedIssuesModal',
  btnOpenIssues: '#btnOpenIssues',
  btnCloseIssues: '#btnCloseIssues',
  issuesCount: '#issuesCount',
  downloadLoteId: '#downloadLoteId',
});
