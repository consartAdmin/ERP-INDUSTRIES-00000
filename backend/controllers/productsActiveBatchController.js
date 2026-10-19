// ╔════════════════════════════════════════════════════════════════════════════╗
// ║ productsActiveBatchController.js — Controller Batch Active/Inactive        ║
// ║ CONSART ERP | ESM                                                         ║
// ║                                                                            ║
// ║ Endpoints:                                                                ║
// ║   GET  /api/products-active/batch/list                                     ║
// ║   POST /api/products-active/batch/activate                                 ║
// ║   POST /api/products-active/batch/deactivate                               ║
// ║   POST /api/products-active/batch/set                                      ║
// ╚════════════════════════════════════════════════════════════════════════════╝

'use strict';

import productsActiveBatchApi from '../repositories/productsActiveBatch/productsActiveBatch.index.js';

/**
 * Wrapper padrão do CONSART:
 * - captura erros
 * - status fallback
 * - retorna JSON consistente
 */
function asyncHandler(fn) {
  return async (req, res) => {
    try {
      return await fn(req, res);
    } catch (err) {
      const status = err?.status || err?.statusCode || 500;
      console.error('[productsActiveBatchController] error:', err);
      return res.status(status).json({
        ok: false,
        error: err?.message || 'Unexpected error.',
      });
    }
  };
}

// GET /api/products-active/batch/list
export const batchListProducts = asyncHandler(async (req, res) => {
  return productsActiveBatchApi.batchListProducts(req, res);
});

// POST /api/products-active/batch/set
export const batchSetActive = asyncHandler(async (req, res) => {
  return productsActiveBatchApi.batchSetActive(req, res);
});

// POST /api/products-active/batch/activate
export const batchActivate = asyncHandler(async (req, res) => {
  return productsActiveBatchApi.batchActivate(req, res);
});

// POST /api/products-active/batch/deactivate
export const batchDeactivate = asyncHandler(async (req, res) => {
  return productsActiveBatchApi.batchDeactivate(req, res);
});

export default {
  batchListProducts,
  batchSetActive,
  batchActivate,
  batchDeactivate,
};
