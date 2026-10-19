// ╔════════════════════════════════════════════════════════════╗
// ║ roletaRoutes.js — Routes Roleta (CONSART ERP | ESM)        ║
// ║ Path: backend/routes/roletaRoutes.js                       ║
// ╚════════════════════════════════════════════════════════════╝

import express from 'express';
import * as controller from '../controllers/roletaController.js';

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// ADMIN (Management)
// ──────────────────────────────────────────────────────────────
router.get('/admin/campaigns', controller.adminListCampaigns);
router.post('/admin/campaigns', controller.adminCreateCampaign);

router.get('/admin/campaigns/:id/products', controller.adminListCampaignProducts);
router.post('/admin/campaigns/:id/products', controller.adminAddCampaignProduct);
router.delete('/admin/campaign-products/:id', controller.adminRemoveCampaignProduct);

router.get('/admin/tokens', controller.adminListTokens);
router.get('/admin/spins', controller.adminListSpins);

// ──────────────────────────────────────────────────────────────
// PUBLIC (Customer flow)
// ──────────────────────────────────────────────────────────────
router.post('/token', controller.createToken);
router.get('/:token', controller.getCampaign);
router.post('/:token/spin', controller.spin);

export default router;