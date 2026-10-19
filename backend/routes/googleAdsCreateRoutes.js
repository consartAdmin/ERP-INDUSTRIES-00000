// ╔══════════════════════════════════════════════════════════════════════╗
// ║ googleAdsCreateRoutes.js — Rotas criação Google Ads                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { Router } from 'express';
import {
  postCreateCampaign,
  postCreateFullFlow
} from '../controllers/googleAdsCreateController.js';

const router = Router();

// Criar campanha simples
router.post('/googleads/campaigns/create', postCreateCampaign);

// Criar campanha + grupo + keywords + anúncios
router.post('/googleads/campaigns/create/full', postCreateFullFlow);

export default router;
