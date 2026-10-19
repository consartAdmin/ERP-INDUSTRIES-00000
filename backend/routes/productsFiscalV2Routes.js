// ============================================================================
// backend/routes/productsFiscalV2Routes.js
// ============================================================================

import { Router } from 'express';
import * as controller from '../controllers/productsFiscalV2Controller.js';

const router = Router();

// ============================================================================
// LISTAGEM
// ============================================================================

// GET /api/v2/products-fiscal
router.get('/', controller.list);

// GET /api/v2/products-fiscal/batch-list
router.get('/batch-list', controller.batchList);

// ============================================================================
// VÍNCULO FISCAL ATUAL
// ============================================================================

// GET /api/v2/products-fiscal/current/:productCode
router.get('/current/:productCode', controller.getCurrent);

// PUT /api/v2/products-fiscal/current
router.put('/current', controller.upsertCurrent);

// POST /api/v2/products-fiscal/current/:productCode/close
router.post('/current/:productCode/close', controller.closeCurrent);

// ============================================================================
// VÍNCULO FISCAL EM LOTE
// ============================================================================

// PUT /api/v2/products-fiscal/batch/current
router.put('/batch/current', controller.batchUpsertCurrent);

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export default router;


//===============================================================================
//MONTAGEM NO APP PRINCIPAL
//===============================================================================

//import productsFiscalV2Routes from './routes/productsFiscalV2.routes.js';

//app.use('/api/v2/products-fiscal', productsFiscalV2Routes);


//===============================================================================
//ROTAS ESPERADAS PELO FRONTEND
//===============================================================================

//batchList: '/api/v2/products-fiscal/batch-list'
//batchLink: '/api/v2/products-fiscal/batch/current'
//unlinkCurrent: '/api/v2/products-fiscal/current'

//IMPORTANTE:
//- O vínculo V2 usa product_code como texto; não converter SKU para Number.
//- A listagem em lote assume public.products com as colunas product_id,
//  product_code e description. Se a sua tabela mestre usar outro nome, ajuste
//  somente as referências p.* dentro de listBatchProducts().