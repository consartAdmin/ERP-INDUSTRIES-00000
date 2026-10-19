// ╔══════════════════════════════════════════════════════════════════╗
// ║ sellersRoutes.js — Rotas HTTP para Vendedores (ESM)             ║
// ║ Base: /api/sellers                                              ║
// ║ Alias opcional: /api/cadastrovendedores                         ║
// ╚══════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import sellersController from '../controllers/sellersController.js';
import { erpCompanyContext } from '../utils/erpCompanyContext.js';

const router = Router();

// Empresa da tela (BH3 x CONSART) também aqui, além do middleware global
router.use(erpCompanyContext);

/* ====================================================================
 * Rotas base: /api/sellers
 * ==================================================================== */
router.get('/sellers',        sellersController.listSellers);
router.get('/sellers/search', sellersController.searchSellers);
router.get('/sellers/export/pdf',   sellersController.exportSellersPdf);
router.get('/sellers/export/excel', sellersController.exportSellersExcel);
router.get('/sellers/:id',    sellersController.getSellerById);
router.post('/sellers',       sellersController.createSeller);
router.put('/sellers/:id',    sellersController.updateSeller);
router.delete('/sellers/:id', sellersController.deleteSeller);

/* ====================================================================
 * Alias de compatibilidade: /api/cadastrovendedores
 * (para não quebrar módulos legados/CRM que usam esse path)
 * ==================================================================== */
router.get('/cadastrovendedores',        sellersController.listSellers);
router.get('/cadastrovendedores/search', sellersController.searchSellers);
router.get('/cadastrovendedores/:id',    sellersController.getSellerById);
router.post('/cadastrovendedores',       sellersController.createSeller);
router.put('/cadastrovendedores/:id',    sellersController.updateSeller);
router.delete('/cadastrovendedores/:id', sellersController.deleteSeller);

export default router;
