// ╔══════════════════════════════════════════════════════════════════════╗
// ║ FILE: productsFiscalBatch.config.js                                ║
// ║ MODULE: Products Fiscal Batch — Configuration                      ║
// ║ PRODNEX ERP                                                        ║
// ╚══════════════════════════════════════════════════════════════════════╝

'use strict';

// ============================================================================
// API BASE
// ============================================================================

export function getApiBase() {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.getApiBase === 'function'
    ) {
      return window.getApiBase();
    }

    if (
      typeof window !== 'undefined' &&
      window.apiBase
    ) {
      return window.apiBase;
    }
  } catch (error) {
    console.warn(
      '[ProductsFiscalBatch] Não foi possível obter API_BASE.',
      error
    );
  }

  return '';
}

export const API_BASE = getApiBase();

// ============================================================================
// ROTAS DA API V2
// ============================================================================

export const ROUTES = Object.freeze({
  // Lista todos os produtos com o vínculo fiscal V2 atual.
  batchList:
    '/api/v2/products-fiscal/batch-list',

  // Cria ou atualiza o vínculo fiscal atual de vários produtos.
  batchLink:
    '/api/v2/products-fiscal/batch/current',

  // Rota-base para encerrar o vínculo fiscal atual de um produto.
  // Uso:
  // POST /api/v2/products-fiscal/current/:productCode/close
  unlinkCurrent:
    '/api/v2/products-fiscal/current',

  // Lista os perfis fiscais V2.
  fiscalProfileList:
    '/api/v2/fiscal-profiles',

  // Lista as classificações fiscais V2.
  fiscalClassificationList:
    '/api/v2/fiscal-classifications',
});

// ============================================================================
// PAGINAÇÃO
// ============================================================================

export const DEFAULT_PAGE_SIZE = 50;