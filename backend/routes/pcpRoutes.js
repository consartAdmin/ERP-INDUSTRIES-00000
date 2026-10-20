// ╔══════════════════════════════════════════════════════════════════════╗
// ║ pcpRoutes.js — Rotas REST do PCP / Produção (Express ESM)           ║
/* ║ Mount: app.use('/api/pcp', requireAuth, pcpRoutes)                  ║ */
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import * as c from '../controllers/pcpController.js';

const router = Router();

router.get('/ensure', c.ensure);
router.get('/products', c.searchProducts);

// Centros de trabalho
router.get   ('/work-centers',     c.listWorkCenters);
router.post  ('/work-centers',     c.createWorkCenter);
router.put   ('/work-centers/:id', c.updateWorkCenter);
router.delete('/work-centers/:id', c.removeWorkCenter);

// Matérias-primas
router.get   ('/raw-materials',        c.listRawMaterials);
router.get   ('/raw-materials/search', c.searchRawMaterials);
router.get   ('/raw-materials/:id',    c.getRawMaterial);
router.post  ('/raw-materials',        c.createRawMaterial);
router.put   ('/raw-materials/:id',    c.updateRawMaterial);
router.delete('/raw-materials/:id',    c.removeRawMaterial);

// Ficha técnica (estrutura + roteiro)
router.get   ('/boms',     c.listBoms);
router.get   ('/boms/:id', c.getBom);
router.post  ('/boms',     c.createBom);
router.put   ('/boms/:id', c.updateBom);
router.delete('/boms/:id', c.removeBom);

// Ordens de produção
router.get   ('/orders',             c.listOrders);
router.get   ('/orders/:id',         c.getOrder);
router.post  ('/orders',             c.createOrder);
router.put   ('/orders/:id',         c.updateOrder);
router.patch ('/orders/:id/status',  c.changeOrderStatus);
router.post  ('/orders/:id/reports', c.addOrderReport);
router.delete('/orders/:id',         c.removeOrder);

// Necessidade de materiais
router.get('/mrp', c.materialNeeds);

export default router;
