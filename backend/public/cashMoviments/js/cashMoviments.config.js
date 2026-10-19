// ╔══════════════════════════════════════════════════════════════════════╗
// ║ caixa.config.js — Configuração (API, paths, paginação)               ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

export const API_BASE = (window.API_BASE || '');
export const API = `${API_BASE}/api/caixa`;
export const PATH_MOV = 'movimentacoes';

export const PAGE_SIZE = 50;
export const DEFAULT_ORDER_BY = 'data_hora DESC';