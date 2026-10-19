// ╔══════════════════════════════════════════════════════════════════════╗
// ║ nfeReceiptsRoutes.js — Rotas Canhoto NF-e Digital                   ║
// ║ CONSART ERP                                                         ║
// ║ Base: /api/nfe-receipts                                             ║
// ╚══════════════════════════════════════════════════════════════════════╝

import express from 'express';
import * as controller from '../controllers/nfeReceiptsController.js';

const router = express.Router();

// Bootstrap
router.get('/ensure-table', controller.ensureTable);

// Listagem ERP
router.get('/', controller.listReceipts);

// Criar canhoto pendente
router.post('/nfe/:nfeId/create-pending', controller.createPendingByNfeId);
router.post('/number/:number/create-pending', controller.createPendingByNumber);

// Buscar canhoto
router.get('/nfe/:nfeId', controller.getByNfeId);
router.get('/key/:key', controller.getByAccessKey);
router.get('/number/:number', controller.getByNfeNumber);

// Assinar canhoto
router.post('/key/:key/sign', controller.signByAccessKey);
router.post('/number/:number/sign', controller.signByNfeNumber);

// Recusar canhoto
router.post('/key/:key/refuse', controller.refuseByAccessKey);
router.post('/number/:number/refuse', controller.refuseByNfeNumber);

// Imagem da assinatura
router.get('/key/:key/signature.png', controller.getSignaturePngByAccessKey);
router.get('/number/:number/signature.png', controller.getSignaturePngByNfeNumber);

export default router;